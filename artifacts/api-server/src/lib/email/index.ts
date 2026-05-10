// Serviço de e-mails transacionais Synvet.
//
// Provider abstraction: `mock` (default em dev / quando não há RESEND_API_KEY)
// só loga, nunca envia; `resend` usa o cliente Resend real. Idempotência via
// tabela `email_sends` — cada disparo carrega um `idempotencyKey` derivado
// do gatilho (ex.: stripeEventId, "trial-3d:<clinicId>:<trialEndsAt>").
//
// Exposto como singleton: `sendEmail({ to, template, data, idempotencyKey,
// clinicId, log })`. O serviço NUNCA lança — falha é logada e retornada
// como `{ ok: false, error }`.
import type { Logger } from "pino";
import { and, eq } from "drizzle-orm";
import { db, emailSendsTable } from "@workspace/db";
import { logger as rootLogger } from "../logger";
import { renderTemplate, type TemplateDataMap, type TemplateId } from "./templates";

export type SendEmailInput<T extends TemplateId> = {
  to: string;
  template: T;
  data: TemplateDataMap[T];
  idempotencyKey: string;
  clinicId: string | null;
  log?: Logger;
};

export type SendEmailResult =
  | { ok: true; providerId: string | null; deduplicated?: boolean }
  | { ok: false; error: string };

type EmailProvider = {
  name: "mock" | "resend";
  send(args: { to: string; subject: string; html: string; text: string }): Promise<{ id: string | null }>;
};

let cachedProvider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;
  const explicit = process.env.EMAIL_PROVIDER;
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const useResend = explicit === "resend" || (explicit !== "mock" && hasKey);
  if (useResend) {
    cachedProvider = makeResendProvider();
  } else {
    cachedProvider = makeMockProvider();
  }
  return cachedProvider;
}

function makeMockProvider(): EmailProvider {
  return {
    name: "mock",
    async send({ to, subject }) {
      rootLogger.info({ to, subject, provider: "mock" }, "[email mock] envio simulado");
      return { id: null };
    },
  };
}

function makeResendProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Synvet <ola@synvet.app.br>";
  if (!key) {
    rootLogger.warn("RESEND_API_KEY ausente — caindo para provider mock.");
    return makeMockProvider();
  }
  return {
    name: "resend",
    async send({ to, subject, html, text }) {
      // Lazy import — evita custo de boot se nunca enviarmos com Resend.
      const { Resend } = await import("resend");
      const client = new Resend(key);
      const result = await client.emails.send({
        from,
        to,
        subject,
        html,
        text,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Resend send failed");
      }
      return { id: result.data?.id ?? null };
    },
  };
}

export async function sendEmail<T extends TemplateId>(
  input: SendEmailInput<T>,
): Promise<SendEmailResult> {
  const log = input.log ?? rootLogger;
  const { to, template, data, idempotencyKey, clinicId } = input;

  // Idempotência: já temos um envio bem-sucedido com essa chave?
  try {
    const [existing] = await db
      .select({ id: emailSendsTable.id, status: emailSendsTable.status })
      .from(emailSendsTable)
      .where(
        and(
          // Em SQL, NULL != NULL → pra casos "global" (sem clinicId) usamos
          // strings vazias na column. Hoje todos os templates têm clinicId.
          eq(emailSendsTable.clinicId, clinicId ?? ""),
          eq(emailSendsTable.template, template),
          eq(emailSendsTable.idempotencyKey, idempotencyKey),
        ),
      );
    if (existing && existing.status === "sent") {
      log.info({ template, idempotencyKey, clinicId }, "email já enviado — pulando (idempotente)");
      return { ok: true, providerId: null, deduplicated: true };
    }
  } catch (err) {
    log.warn({ err, template }, "falha ao consultar idempotência de e-mail (segue tentando enviar)");
  }

  const rendered = renderTemplate(template, data);
  const provider = getProvider();

  try {
    const { id } = await provider.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await recordEmailSend({
      clinicId: clinicId ?? "",
      template,
      idempotencyKey,
      recipient: to,
      status: "sent",
      providerId: id,
      error: null,
    });
    log.info({ template, to, provider: provider.name, providerId: id }, "email enviado");
    return { ok: true, providerId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, template, to, provider: provider.name }, "falha ao enviar email");
    await recordEmailSend({
      clinicId: clinicId ?? "",
      template,
      idempotencyKey,
      recipient: to,
      status: "failed",
      providerId: null,
      error: message.slice(0, 500),
    }).catch(() => undefined);
    return { ok: false, error: message };
  }
}

async function recordEmailSend(values: {
  clinicId: string;
  template: string;
  idempotencyKey: string;
  recipient: string;
  status: "sent" | "failed";
  providerId: string | null;
  error: string | null;
}) {
  // Upsert: se já existe `failed` com a mesma key, atualiza para `sent` ao
  // ter sucesso (e mantém failed→failed em retentativas). Unique index garante
  // que nunca duplicamos por (clinic, template, key).
  await db
    .insert(emailSendsTable)
    .values({
      clinicId: values.clinicId || null,
      template: values.template,
      idempotencyKey: values.idempotencyKey,
      recipient: values.recipient,
      status: values.status,
      providerId: values.providerId,
      error: values.error,
    })
    .onConflictDoUpdate({
      target: [emailSendsTable.clinicId, emailSendsTable.template, emailSendsTable.idempotencyKey],
      set: {
        status: values.status,
        providerId: values.providerId,
        error: values.error,
        sentAt: new Date(),
        recipient: values.recipient,
      },
    });
}

export function emailProviderName(): "mock" | "resend" {
  return getProvider().name;
}
