import { Router, type IRouter, type Request } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  buildCopilotContext,
  renderContextForPrompt,
} from "../ai/copilot/contextBuilder";
import { streamCopilotChat } from "../ai/copilot/service";
import { COPILOT_DISCLAIMER } from "../ai/copilot/prompts";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ParsedChatBody {
  petId: string;
  consultationId: string | null;
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
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > 20)
    return "messages deve ter entre 1 e 20 itens";
  const messages: ParsedChatBody["messages"] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== "object") return "mensagem inválida";
    const mm = m as Record<string, unknown>;
    if (mm.role !== "user" && mm.role !== "assistant") return "role inválido";
    if (typeof mm.content !== "string" || mm.content.length === 0 || mm.content.length > 4000)
      return "content inválido";
    messages.push({ role: mm.role, content: mm.content });
  }
  return { petId: b.petId, consultationId, messages };
}

router.post("/ai/copilot/chat", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = parseChatBody(req.body);
  if (typeof parsed === "string") {
    res.status(400).json({ error: parsed });
    return;
  }
  const { petId, consultationId, messages } = parsed;

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

  send("ready", { disclaimer: COPILOT_DISCLAIMER });

  try {
    for await (const ev of streamCopilotChat(
      { context, messages },
      { requestId: req.id?.toString(), signal: ac.signal },
    )) {
      if (ac.signal.aborted) break;
      if (ev.type === "delta") send("delta", { content: ev.content });
      else if (ev.type === "done") send("done", ev);
      else if (ev.type === "error") send("error", { message: ev.message });
    }
  } catch (err) {
    req.log.error({ err }, "copilot stream failed");
    send("error", { message: "Falha durante a geração da resposta." });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

export default router;
