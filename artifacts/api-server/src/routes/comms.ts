import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  commsChannelsTable,
  commsTemplatesTable,
  commsAutomationsTable,
  commsMessagesTable,
  commsJobsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { getProvider, defaultProviderName } from "../comms/providers";
import { extractVariables } from "../comms/templates";
import { seedClinicTemplates, seedClinicAutomations } from "../comms/seed";

const router: IRouter = Router();

// ============================== dashboard ==============================
router.get("/comms/dashboard", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [channels, templates, automations, msgs, recent] = await Promise.all([
    db.select().from(commsChannelsTable).where(eq(commsChannelsTable.clinicId, user.clinicId)),
    db.select({ id: commsTemplatesTable.id }).from(commsTemplatesTable).where(eq(commsTemplatesTable.clinicId, user.clinicId)),
    db.select({ id: commsAutomationsTable.id, enabled: commsAutomationsTable.enabled }).from(commsAutomationsTable).where(eq(commsAutomationsTable.clinicId, user.clinicId)),
    db.select({ status: commsMessagesTable.status }).from(commsMessagesTable).where(and(eq(commsMessagesTable.clinicId, user.clinicId), gte(commsMessagesTable.createdAt, since))),
    db.select().from(commsMessagesTable).where(eq(commsMessagesTable.clinicId, user.clinicId)).orderBy(desc(commsMessagesTable.createdAt)).limit(10),
  ]);
  const counts = msgs.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});
  res.json(
    schemas.CommsDashboardResponse.parse({
      channels: {
        total: channels.length,
        connected: channels.filter((c) => c.status === "connected").length,
      },
      templates: { total: templates.length },
      automations: {
        total: automations.length,
        enabled: automations.filter((a) => a.enabled).length,
      },
      messages: {
        last30d: msgs.length,
        sent: (counts["sent"] ?? 0) + (counts["delivered"] ?? 0) + (counts["read"] ?? 0),
        failed: counts["failed"] ?? 0,
        queued: (counts["queued"] ?? 0) + (counts["scheduled"] ?? 0) + (counts["sending"] ?? 0),
      },
      recent,
    }),
  );
});

// ============================== channels ==============================
router.get("/comms/channels", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const rows = await db
    .select()
    .from(commsChannelsTable)
    .where(eq(commsChannelsTable.clinicId, user.clinicId))
    .orderBy(desc(commsChannelsTable.createdAt));
  res.json(schemas.ListCommsChannelsResponse.parse({ items: rows }));
});

router.post("/comms/channels", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateCommsChannelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(commsChannelsTable)
    .values({
      clinicId: user.clinicId,
      kind: parsed.data.kind,
      provider: parsed.data.provider ?? defaultProviderName(),
      displayName: parsed.data.displayName ?? null,
      phoneNumber: parsed.data.phoneNumber ?? null,
      createdBy: user.id,
    })
    .returning();
  // Seed templates+automations on first channel for this clinic (idempotent)
  await seedClinicTemplates(user.clinicId);
  await seedClinicAutomations(user.clinicId);
  res.status(201).json(row);
});

router.patch("/comms/channels/:channelId", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const id = String(req.params["channelId"]);
  const parsed = schemas.UpdateCommsChannelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(commsChannelsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(commsChannelsTable.id, id), eq(commsChannelsTable.clinicId, user.clinicId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  res.json(row);
});

router.delete("/comms/channels/:channelId", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const [row] = await db
    .delete(commsChannelsTable)
    .where(and(eq(commsChannelsTable.id, String(req.params["channelId"])), eq(commsChannelsTable.clinicId, user.clinicId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/comms/channels/:channelId/connect", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const id = String(req.params["channelId"]);
  const [channel] = await db
    .select()
    .from(commsChannelsTable)
    .where(and(eq(commsChannelsTable.id, id), eq(commsChannelsTable.clinicId, user.clinicId)));
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const provider = getProvider(channel.provider);
  let result;
  try {
    result = await provider.connect({
      id: channel.id,
      clinicId: channel.clinicId,
      externalId: channel.externalId,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(commsChannelsTable)
      .set({ status: "error", lastError: errMsg.slice(0, 500), updatedAt: new Date() })
      .where(eq(commsChannelsTable.id, channel.id));
    res.status(502).json({ error: errMsg });
    return;
  }
  // MockProvider auto-confirms; real providers stay "connecting" until webhook
  const isMock = channel.provider === "mock";
  const [updated] = await db
    .update(commsChannelsTable)
    .set({
      status: isMock ? "connected" : result.status,
      lastConnectedAt: isMock ? new Date() : channel.lastConnectedAt,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(commsChannelsTable.id, channel.id))
    .returning();
  res.json({
    channel: updated,
    qrString: result.qrString,
    expiresAt: result.expiresAt,
    message: result.message ?? null,
  });
});

router.post("/comms/channels/:channelId/disconnect", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const id = String(req.params["channelId"]);
  const [channel] = await db
    .select()
    .from(commsChannelsTable)
    .where(and(eq(commsChannelsTable.id, id), eq(commsChannelsTable.clinicId, user.clinicId)));
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const provider = getProvider(channel.provider);
  try {
    await provider.disconnect({ id: channel.id, externalId: channel.externalId });
  } catch (err) {
    req.log.warn({ err: err instanceof Error ? err.message : err }, "provider disconnect failed");
  }
  const [updated] = await db
    .update(commsChannelsTable)
    .set({ status: "disconnected", updatedAt: new Date() })
    .where(eq(commsChannelsTable.id, channel.id))
    .returning();
  res.json(updated);
});

// ============================== templates ==============================
router.get("/comms/templates", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const rows = await db
    .select()
    .from(commsTemplatesTable)
    .where(eq(commsTemplatesTable.clinicId, user.clinicId))
    .orderBy(desc(commsTemplatesTable.createdAt));
  res.json(schemas.ListCommsTemplatesResponse.parse({ items: rows }));
});

router.post("/comms/templates", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateCommsTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db
    .select({ id: commsTemplatesTable.id })
    .from(commsTemplatesTable)
    .where(
      and(
        eq(commsTemplatesTable.clinicId, user.clinicId),
        eq(commsTemplatesTable.slug, parsed.data.slug),
      ),
    );
  if (existing.length > 0) {
    res.status(409).json({ error: "Já existe um template com esse identificador" });
    return;
  }
  const variables = parsed.data.variables ?? extractVariables(parsed.data.body);
  const [row] = await db
    .insert(commsTemplatesTable)
    .values({
      clinicId: user.clinicId,
      slug: parsed.data.slug,
      name: parsed.data.name,
      channel: parsed.data.channel ?? "whatsapp",
      category: parsed.data.category ?? "transactional",
      body: parsed.data.body,
      variables,
      isSystem: false,
      enabled: parsed.data.enabled ?? true,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/comms/templates/:templateId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.UpdateCommsTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.body && !parsed.data.variables) {
    patch["variables"] = extractVariables(parsed.data.body);
  }
  const [row] = await db
    .update(commsTemplatesTable)
    .set(patch)
    .where(
      and(
        eq(commsTemplatesTable.id, String(req.params["templateId"])),
        eq(commsTemplatesTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(row);
});

router.delete("/comms/templates/:templateId", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const [row] = await db
    .delete(commsTemplatesTable)
    .where(
      and(
        eq(commsTemplatesTable.id, String(req.params["templateId"])),
        eq(commsTemplatesTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.sendStatus(204);
});

// ============================== automations ==============================
router.get("/comms/automations", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const rows = await db
    .select()
    .from(commsAutomationsTable)
    .where(eq(commsAutomationsTable.clinicId, user.clinicId))
    .orderBy(desc(commsAutomationsTable.createdAt));
  res.json(schemas.ListCommsAutomationsResponse.parse({ items: rows }));
});

router.post("/comms/automations", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateCommsAutomationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tpl] = await db
    .select({ id: commsTemplatesTable.id })
    .from(commsTemplatesTable)
    .where(and(eq(commsTemplatesTable.id, parsed.data.templateId), eq(commsTemplatesTable.clinicId, user.clinicId)));
  if (!tpl) {
    res.status(400).json({ error: "templateId não pertence à clínica" });
    return;
  }
  if (parsed.data.channelId) {
    const [ch] = await db
      .select({ id: commsChannelsTable.id })
      .from(commsChannelsTable)
      .where(and(eq(commsChannelsTable.id, parsed.data.channelId), eq(commsChannelsTable.clinicId, user.clinicId)));
    if (!ch) {
      res.status(400).json({ error: "channelId não pertence à clínica" });
      return;
    }
  }
  const [row] = await db
    .insert(commsAutomationsTable)
    .values({
      clinicId: user.clinicId,
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      templateId: parsed.data.templateId,
      channelId: parsed.data.channelId ?? null,
      offsetMinutes: parsed.data.offsetMinutes ?? 0,
      config: parsed.data.config ?? {},
      enabled: parsed.data.enabled ?? true,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/comms/automations/:automationId", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.UpdateCommsAutomationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.templateId) {
    const [tpl] = await db
      .select({ id: commsTemplatesTable.id })
      .from(commsTemplatesTable)
      .where(and(eq(commsTemplatesTable.id, parsed.data.templateId), eq(commsTemplatesTable.clinicId, user.clinicId)));
    if (!tpl) {
      res.status(400).json({ error: "templateId não pertence à clínica" });
      return;
    }
  }
  if (parsed.data.channelId) {
    const [ch] = await db
      .select({ id: commsChannelsTable.id })
      .from(commsChannelsTable)
      .where(and(eq(commsChannelsTable.id, parsed.data.channelId), eq(commsChannelsTable.clinicId, user.clinicId)));
    if (!ch) {
      res.status(400).json({ error: "channelId não pertence à clínica" });
      return;
    }
  }
  const [row] = await db
    .update(commsAutomationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(commsAutomationsTable.id, String(req.params["automationId"])),
        eq(commsAutomationsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  res.json(row);
});

router.delete("/comms/automations/:automationId", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const [row] = await db
    .delete(commsAutomationsTable)
    .where(
      and(
        eq(commsAutomationsTable.id, String(req.params["automationId"])),
        eq(commsAutomationsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  res.sendStatus(204);
});

// ============================== messages ==============================
router.get("/comms/messages", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const filters = [eq(commsMessagesTable.clinicId, user.clinicId)];
  if (typeof req.query["status"] === "string") {
    filters.push(eq(commsMessagesTable.status, req.query["status"]));
  }
  if (typeof req.query["tutorId"] === "string") {
    filters.push(eq(commsMessagesTable.tutorId, req.query["tutorId"]));
  }
  if (typeof req.query["petId"] === "string") {
    filters.push(eq(commsMessagesTable.petId, req.query["petId"]));
  }
  const limit = Math.min(Number(req.query["limit"]) || 50, 200);
  const rows = await db
    .select()
    .from(commsMessagesTable)
    .where(and(...filters))
    .orderBy(desc(commsMessagesTable.createdAt))
    .limit(limit);
  res.json(schemas.ListCommsMessagesResponse.parse({ items: rows }));
});

// ============================== test send ==============================
router.post("/comms/test-send", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CommsTestSendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [channel] = await db
    .select()
    .from(commsChannelsTable)
    .where(
      and(
        eq(commsChannelsTable.id, parsed.data.channelId),
        eq(commsChannelsTable.clinicId, user.clinicId),
      ),
    );
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const [msg] = await db
    .insert(commsMessagesTable)
    .values({
      clinicId: user.clinicId,
      channelId: channel.id,
      direction: "outbound",
      toAddress: parsed.data.toAddress,
      body: parsed.data.body,
      status: "queued",
    })
    .returning();
  await db.insert(commsJobsTable).values({
    clinicId: user.clinicId,
    kind: "send_message",
    payload: { messageId: msg.id },
  });
  res.status(201).json(msg);
});

export default router;
