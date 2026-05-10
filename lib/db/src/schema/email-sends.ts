import { pgTable, text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * Idempotência de e-mails transacionais. Cada disparo é gravado com
 * (clinicId, template, idempotencyKey) ÚNICO — antes de enviar consultamos
 * essa chave; se já existe, pulamos. Isso protege contra:
 *  - Re-execução de webhooks Stripe.
 *  - Restart do scheduler sobreposto à janela do "trial 3d".
 *  - Reprocessamento manual de jobs.
 *
 * Status `sent` (sucesso, com providerId) ou `failed` (com error). Falha NÃO
 * marca como sent — assim o próximo retry pode tentar de novo (a unique key
 * usa upsert: ON CONFLICT DO UPDATE) — ver `recordEmailSend`.
 */
export const emailSendsTable = pgTable(
  "email_sends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id"),
    template: text("template").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status", { enum: ["sent", "failed"] }).notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("email_sends_unique_idx").on(t.clinicId, t.template, t.idempotencyKey),
    clinicIdx: index("email_sends_clinic_idx").on(t.clinicId),
  }),
);

export type EmailSend = typeof emailSendsTable.$inferSelect;
