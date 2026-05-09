import { Router, type IRouter, type Request } from "express";
import rateLimit from "express-rate-limit";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  copilotConversationsTable,
  copilotMessagesTable,
  petsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  buildCopilotContext,
  renderContextForPrompt,
} from "../ai/copilot/contextBuilder";
import { streamCopilotChat } from "../ai/copilot/service";
import { COPILOT_DISCLAIMER, COPILOT_PROMPT_VERSION } from "../ai/copilot/prompts";

const router: IRouter = Router();

const copilotLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.user.id ?? req.ip ?? "anon",
  message: { error: "Limite do Copilot atingido. Aguarde alguns segundos." },
});

router.use("/ai/copilot", copilotLimiter, requireRole("admin", "vet"));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COPILOT_DEFAULT_MODEL = "gpt-5-mini";

function clipTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, " ").slice(0, 80);
  return t.length > 0 ? t : "Nova conversa";
}

// ─────────────────────────────────────────────────────────────────────────────
// Context summary endpoint (unchanged from before).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/ai/copilot/context/:petId", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const petId = String(req.params.petId ?? "");
  const consultationId =
    typeof req.query.consultationId === "string" && req.query.consultationId.length > 0
      ? req.query.consultationId
      : null;
  if (!petId) {
    res.status(400).json({ error: "petId obrigatório" });
    return;
  }
  try {
    const ctx = await buildCopilotContext(petId, user.clinicId, consultationId);
    if (!ctx) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    res.json({
      pet: ctx.pet,
      citations: ctx.citations,
      hasFocusedConsultation: !!ctx.focusedConsultation,
      previewBlock: renderContextForPrompt(ctx).slice(0, 1200),
      disclaimer: COPILOT_DISCLAIMER,
    });
  } catch (err) {
    req.log.error({ err }, "ai.copilot.context failed");
    res.status(500).json({ error: "Falha ao carregar contexto" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Persistent conversations (per user, per pet, per clinic).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/ai/copilot/conversations", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const petId = typeof req.query.petId === "string" ? req.query.petId : "";
  if (!petId || !UUID_RE.test(petId)) {
    res.status(400).json({ error: "petId inválido" });
    return;
  }
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
    : 20;

  const rows = await db
    .select({
      id: copilotConversationsTable.id,
      petId: copilotConversationsTable.petId,
      consultationId: copilotConversationsTable.consultationId,
      title: copilotConversationsTable.title,
      model: copilotConversationsTable.model,
      promptVersion: copilotConversationsTable.promptVersion,
      createdAt: copilotConversationsTable.createdAt,
      updatedAt: copilotConversationsTable.updatedAt,
      messageCount: sql<number>`(select count(*)::int from ${copilotMessagesTable} where ${copilotMessagesTable.conversationId} = ${copilotConversationsTable.id})`,
    })
    .from(copilotConversationsTable)
    .where(
      and(
        eq(copilotConversationsTable.clinicId, user.clinicId),
        eq(copilotConversationsTable.petId, petId),
        eq(copilotConversationsTable.userId, user.id),
      ),
    )
    .orderBy(desc(copilotConversationsTable.updatedAt))
    .limit(limit);

  res.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

router.get(
  "/ai/copilot/conversations/:conversationId",
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const id = String(req.params.conversationId ?? "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "conversationId inválido" });
      return;
    }
    const [conv] = await db
      .select()
      .from(copilotConversationsTable)
      .where(
        and(
          eq(copilotConversationsTable.id, id),
          eq(copilotConversationsTable.clinicId, user.clinicId),
          eq(copilotConversationsTable.userId, user.id),
        ),
      );
    if (!conv) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }
    const messages = await db
      .select({
        id: copilotMessagesTable.id,
        role: copilotMessagesTable.role,
        content: copilotMessagesTable.content,
        createdAt: copilotMessagesTable.createdAt,
      })
      .from(copilotMessagesTable)
      .where(eq(copilotMessagesTable.conversationId, id))
      .orderBy(copilotMessagesTable.createdAt);

    res.json({
      id: conv.id,
      petId: conv.petId,
      consultationId: conv.consultationId,
      title: conv.title,
      model: conv.model,
      promptVersion: conv.promptVersion,
      messageCount: messages.length,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  },
);

router.delete(
  "/ai/copilot/conversations/:conversationId",
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const id = String(req.params.conversationId ?? "");
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "conversationId inválido" });
      return;
    }
    const result = await db
      .delete(copilotConversationsTable)
      .where(
        and(
          eq(copilotConversationsTable.id, id),
          eq(copilotConversationsTable.clinicId, user.clinicId),
          eq(copilotConversationsTable.userId, user.id),
        ),
      )
      .returning({ id: copilotConversationsTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }
    res.status(204).end();
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Chat (streaming + persistent).
// ─────────────────────────────────────────────────────────────────────────────
interface ParsedChatBody {
  petId: string;
  consultationId: string | null;
  conversationId: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

function parseChatBody(raw: unknown): ParsedChatBody | string {
  if (!raw || typeof raw !== "object") return "Corpo inválido";
  const b = raw as Record<string, unknown>;
  if (typeof b.petId !== "string" || !UUID_RE.test(b.petId)) return "petId inválido";

  let consultationId: string | null = null;
  if (b.consultationId != null) {
    if (typeof b.consultationId !== "string" || !UUID_RE.test(b.consultationId))
      return "consultationId inválido";
    consultationId = b.consultationId;
  }

  let conversationId: string | null = null;
  if (b.conversationId != null) {
    if (typeof b.conversationId !== "string" || !UUID_RE.test(b.conversationId))
      return "conversationId inválido";
    conversationId = b.conversationId;
  }

  if (!Array.isArray(b.messages) || b.messages.length === 0)
    return "messages é obrigatório";
  // Não rejeitamos históricos longos: o serviço de chat já trunca para uma
  // janela recente. Limite alto só pra evitar payloads abusivos.
  if (b.messages.length > 200) return "histórico excede o limite máximo";
  const messages: ParsedChatBody["messages"] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== "object") return "mensagem inválida";
    const mm = m as Record<string, unknown>;
    if (mm.role !== "user" && mm.role !== "assistant") return "role inválido";
    if (typeof mm.content !== "string" || mm.content.length === 0 || mm.content.length > 4000)
      return "content inválido";
    messages.push({ role: mm.role, content: mm.content });
  }
  if (messages[messages.length - 1].role !== "user")
    return "Última mensagem deve ser do usuário";
  return { petId: b.petId, consultationId, conversationId, messages };
}

router.post("/ai/copilot/chat", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = parseChatBody(req.body);
  if (typeof parsed === "string") {
    res.status(400).json({ error: parsed });
    return;
  }
  const { petId, consultationId, conversationId: convIdFromBody, messages } = parsed;

  // Validate pet belongs to clinic before any LLM cost.
  const [pet] = await db
    .select({ id: petsTable.id })
    .from(petsTable)
    .where(and(eq(petsTable.id, petId), eq(petsTable.clinicId, user.clinicId)));
  if (!pet) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  // Resolve / create the conversation (always tied to clinic + user).
  let conversationId: string;
  let isNewConversation = false;
  if (convIdFromBody) {
    const [existing] = await db
      .select({ id: copilotConversationsTable.id })
      .from(copilotConversationsTable)
      .where(
        and(
          eq(copilotConversationsTable.id, convIdFromBody),
          eq(copilotConversationsTable.clinicId, user.clinicId),
          eq(copilotConversationsTable.userId, user.id),
          eq(copilotConversationsTable.petId, petId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }
    conversationId = existing.id;
  } else {
    const firstUser = messages.find((m) => m.role === "user")?.content ?? "Conversa";
    const [created] = await db
      .insert(copilotConversationsTable)
      .values({
        clinicId: user.clinicId,
        petId,
        consultationId: consultationId ?? null,
        userId: user.id,
        title: clipTitle(firstUser),
        model: COPILOT_DEFAULT_MODEL,
        promptVersion: COPILOT_PROMPT_VERSION,
      })
      .returning({ id: copilotConversationsTable.id });
    conversationId = created.id;
    isNewConversation = true;
  }

  // Build clinical context (filtered by clinicId).
  let context;
  try {
    context = await buildCopilotContext(petId, user.clinicId, consultationId ?? null);
  } catch (err) {
    req.log.error({ err }, "copilot context build failed");
    res.status(500).json({ error: "Falha ao montar contexto" });
    return;
  }
  if (!context) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  // SSE setup.
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  const send = (event: string, data: unknown): void => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("ready", {
    disclaimer: COPILOT_DISCLAIMER,
    conversationId,
    isNew: isNewConversation,
  });

  const lastUserMessage = messages[messages.length - 1].content;
  let assistantContent = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let receivedDone = false;

  try {
    for await (const ev of streamCopilotChat(
      { context, messages },
      { requestId: req.id?.toString(), signal: ac.signal },
    )) {
      if (ac.signal.aborted) break;
      if (ev.type === "delta") {
        assistantContent += ev.content;
        send("delta", { content: ev.content });
      } else if (ev.type === "done") {
        receivedDone = true;
        promptTokens = ev.usage.promptTokens;
        completionTokens = ev.usage.completionTokens;
        send("done", { ...ev, conversationId });
      } else if (ev.type === "error") {
        send("error", { message: ev.message });
      }
    }
  } catch (err) {
    req.log.error({ err }, "copilot stream failed");
    send("error", { message: "Falha durante a geração da resposta." });
  } finally {
    if (!res.writableEnded) res.end();
  }

  // Persist messages best-effort. If client disconnected mid-stream (no done
  // and no content), still persist the user message so the conversation isn't
  // empty; if there's partial assistant content, persist it too.
  try {
    const toInsert: Array<typeof copilotMessagesTable.$inferInsert> = [
      {
        conversationId,
        clinicId: user.clinicId,
        role: "user",
        content: lastUserMessage,
        tokensIn: receivedDone ? promptTokens : null,
        tokensOut: null,
      },
    ];
    if (assistantContent.trim().length > 0) {
      toInsert.push({
        conversationId,
        clinicId: user.clinicId,
        role: "assistant",
        content: assistantContent,
        tokensIn: null,
        tokensOut: receivedDone ? completionTokens : null,
      });
    }
    await db.insert(copilotMessagesTable).values(toInsert);
    await db
      .update(copilotConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(copilotConversationsTable.id, conversationId));
  } catch (persistErr) {
    req.log.error({ err: persistErr }, "copilot persist failed");
  }
});

export default router;
