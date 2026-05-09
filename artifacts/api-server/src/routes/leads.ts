import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db, leadsTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";

const router: IRouter = Router();

const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas solicitações. Tente novamente em 1 hora." },
});

router.post("/leads", leadsLimiter, async (req, res): Promise<void> => {
  const parsed = schemas.CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const { name, email, phone, clinicName, role, message, source } = parsed.data;

  try {
    const [row] = await db
      .insert(leadsTable)
      .values({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        clinicName: clinicName?.trim() || null,
        role: role?.trim() || null,
        message: message?.trim() || null,
        source: (source?.trim() || "landing").slice(0, 80),
      })
      .returning({ id: leadsTable.id });

    req.log.info(
      { leadId: row.id, email: email.toLowerCase(), source: source ?? "landing" },
      "lead captured",
    );

    // TODO: notificar por email (Resend/SMTP) quando provider for configurado.
    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    req.log.error({ err }, "failed to insert lead");
    res.status(500).json({ error: "Erro ao registrar solicitação." });
  }
});

export default router;
