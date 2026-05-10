import { Router, type IRouter } from "express";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  clinicsTable,
  petsTable,
  consultationsTable,
  commsTemplatesTable,
  commsChannelsTable,
  usersTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

type StepId =
  | "clinic_profile"
  | "first_patient"
  | "first_consultation"
  | "comms_template"
  | "whatsapp_channel"
  | "invite_team"
  | "choose_plan";

async function computeState(clinicId: string, authUserId: string) {
  const [
    [clinic],
    [{ value: petsCount }],
    [{ value: consultsCount }],
    [{ value: customTemplatesCount }],
    [{ value: connectedChannelsCount }],
    [{ value: usersCount }],
    [me],
  ] = await Promise.all([
    db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)),
    db
      .select({ value: count() })
      .from(petsTable)
      .where(eq(petsTable.clinicId, clinicId)),
    db
      .select({ value: count() })
      .from(consultationsTable)
      .where(eq(consultationsTable.clinicId, clinicId)),
    db
      .select({ value: count() })
      .from(commsTemplatesTable)
      .where(
        and(
          eq(commsTemplatesTable.clinicId, clinicId),
          eq(commsTemplatesTable.isSystem, false),
        ),
      ),
    db
      .select({ value: count() })
      .from(commsChannelsTable)
      .where(
        and(
          eq(commsChannelsTable.clinicId, clinicId),
          eq(commsChannelsTable.status, "connected"),
        ),
      ),
    db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.clinicId, clinicId)),
    db
      .select({
        onboardingDismissedAt: usersTable.onboardingDismissedAt,
        onboardingCompletedSeenAt: usersTable.onboardingCompletedSeenAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, authUserId)),
  ]);

  const clinicProfileDone = Boolean(
    clinic && clinic.cnpj && clinic.phone && clinic.address,
  );

  const steps: Array<{ id: StepId; done: boolean }> = [
    { id: "clinic_profile", done: clinicProfileDone },
    { id: "first_patient", done: petsCount > 0 },
    { id: "first_consultation", done: consultsCount > 0 },
    { id: "comms_template", done: customTemplatesCount > 0 },
    { id: "whatsapp_channel", done: connectedChannelsCount > 0 },
    { id: "invite_team", done: usersCount > 1 },
    { id: "choose_plan", done: Boolean(clinic && clinic.plan !== "trial") },
  ];

  const allDone = steps.every((s) => s.done);
  const dismissedAt = me?.onboardingDismissedAt ?? null;
  const completedSeenAt = me?.onboardingCompletedSeenAt ?? null;

  // Visível quando: não dispensado E (ainda há passos abertos OU acabou de
  // concluir e ainda não viu o estado "Tudo pronto"). O servidor marca
  // completedSeenAt logo abaixo, então na próxima visita o card some sozinho.
  const visible = !dismissedAt && (!allDone || !completedSeenAt);

  return {
    steps,
    allDone,
    dismissedAt: dismissedAt ? dismissedAt.toISOString() : null,
    visible,
  };
}

async function markCompletedSeenIfNeeded(authUserId: string, allDone: boolean) {
  if (!allDone) return;
  await db
    .update(usersTable)
    .set({ onboardingCompletedSeenAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(usersTable.id, authUserId),
        isNull(usersTable.onboardingCompletedSeenAt),
      ),
    );
}

router.get(
  "/onboarding/state",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const state = await computeState(user.clinicId, user.id);
    // Marca "viu o estado concluído" — efeito: o card "Tudo pronto" aparece
    // apenas uma vez; na próxima visita ao Dashboard, visible=false.
    await markCompletedSeenIfNeeded(user.id, state.allDone);
    res.json(schemas.GetOnboardingStateResponse.parse(state));
  },
);

router.post(
  "/onboarding/dismiss",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    // Idempotente: só grava na primeira chamada; repetições preservam o
    // timestamp original e não mutam o estado persistido.
    await db
      .update(usersTable)
      .set({ onboardingDismissedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(eq(usersTable.id, user.id), isNull(usersTable.onboardingDismissedAt)),
      );
    const state = await computeState(user.clinicId, user.id);
    res.json(schemas.DismissOnboardingResponse.parse(state));
  },
);

export default router;
