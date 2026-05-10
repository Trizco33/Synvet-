// Scheduler de e-mails de ciclo de vida — roda a cada hora.
// Varre `clinics` em `trialing` cujo `trialEndsAt` cai numa janela específica
// e dispara templates. Idempotência via `email_sends.idempotencyKey` que
// codifica o evento + data, garantindo no máximo 1 envio por clínica por evento.
//
// Eventos:
//  - "trial-ending-3d": disparado quando trialEndsAt está em (now, now+72h]
//    (precisão diária — qualquer execução no dia "T-3" envia uma vez).
//  - "trial-ended": disparado quando trialEndsAt < now há até 24h, sem
//    stripeSubscriptionId.
import { and, eq, isNotNull, isNull, lt, gte, lte } from "drizzle-orm";
import { db, clinicsTable, usersTable } from "@workspace/db";
import { logger } from "../logger";
import { sendEmail } from "./index";

const HOUR_MS = 60 * 60 * 1000;
const TICK_MS = 60 * 60 * 1000; // 1h

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startEmailScheduler() {
  if (interval) return;
  interval = setInterval(() => void tick(), TICK_MS);
  // Primeira execução 30s após boot (não no instante 0 para não competir com seed).
  setTimeout(() => void tick(), 30_000);
  logger.info({ tickMs: TICK_MS }, "email scheduler started");
}

export function stopEmailScheduler() {
  if (interval) clearInterval(interval);
  interval = null;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await runTrialEndingReminder();
    await runTrialEndedNotice();
  } catch (err) {
    logger.error({ err }, "email scheduler tick falhou");
  } finally {
    running = false;
  }
}

async function runTrialEndingReminder() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 71 * HOUR_MS);
  const windowEnd = new Date(now.getTime() + 73 * HOUR_MS);

  const due = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      trialEndsAt: clinicsTable.trialEndsAt,
      notifyTrialReminder: clinicsTable.notifyTrialReminder,
    })
    .from(clinicsTable)
    .where(
      and(
        eq(clinicsTable.status, "trialing"),
        isNull(clinicsTable.stripeSubscriptionId),
        isNotNull(clinicsTable.trialEndsAt),
        gte(clinicsTable.trialEndsAt, windowStart),
        lte(clinicsTable.trialEndsAt, windowEnd),
      ),
    );

  for (const clinic of due) {
    if (!clinic.notifyTrialReminder) continue;
    if (!clinic.trialEndsAt) continue;
    const admin = await getClinicAdmin(clinic.id);
    if (!admin?.email) continue;
    const dayKey = clinic.trialEndsAt.toISOString().slice(0, 10);
    await sendEmail({
      to: admin.email,
      template: "trial_ending_3d",
      data: {
        name: admin.name ?? "veterinário(a)",
        clinicName: clinic.name,
        daysLeft: 3,
        upgradeUrl: `${appUrl()}/app/configuracoes?tab=assinatura`,
      },
      idempotencyKey: `trial-ending-3d:${dayKey}`,
      clinicId: clinic.id,
    });
  }
}

async function runTrialEndedNotice() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * HOUR_MS);

  const due = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      trialEndsAt: clinicsTable.trialEndsAt,
      notifyTrialReminder: clinicsTable.notifyTrialReminder,
    })
    .from(clinicsTable)
    .where(
      and(
        eq(clinicsTable.status, "trialing"),
        isNull(clinicsTable.stripeSubscriptionId),
        isNotNull(clinicsTable.trialEndsAt),
        lt(clinicsTable.trialEndsAt, now),
        gte(clinicsTable.trialEndsAt, windowStart),
      ),
    );

  for (const clinic of due) {
    if (!clinic.notifyTrialReminder) continue;
    if (!clinic.trialEndsAt) continue;
    const admin = await getClinicAdmin(clinic.id);
    if (!admin?.email) continue;
    const dayKey = clinic.trialEndsAt.toISOString().slice(0, 10);
    await sendEmail({
      to: admin.email,
      template: "trial_ended",
      data: {
        name: admin.name ?? "veterinário(a)",
        clinicName: clinic.name,
        upgradeUrl: `${appUrl()}/app/configuracoes?tab=assinatura`,
      },
      idempotencyKey: `trial-ended:${dayKey}`,
      clinicId: clinic.id,
    });
  }
}

async function getClinicAdmin(clinicId: string) {
  const [admin] = await db
    .select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(and(eq(usersTable.clinicId, clinicId), eq(usersTable.role, "admin")))
    .limit(1);
  return admin ?? null;
}

function appUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "https://synvet.app.br";
}
