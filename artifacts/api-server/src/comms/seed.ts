import { and, eq } from "drizzle-orm";
import { db, commsTemplatesTable, commsAutomationsTable } from "@workspace/db";
import { extractVariables } from "./templates";
import { logger } from "../lib/logger";

interface DefaultTemplate {
  slug: string;
  name: string;
  category: string;
  body: string;
}

const DEFAULTS: DefaultTemplate[] = [
  {
    slug: "consultation_created",
    name: "Confirmação de agendamento",
    category: "transactional",
    body: "Olá {{tutor_first_name}}! Agendamos {{pet_name}} para {{scheduled_at}}. Para confirmar ou reagendar, é só responder esta mensagem.",
  },
  {
    slug: "consultation_reminder_24h",
    name: "Lembrete de consulta (24h antes)",
    category: "reminder",
    body: "Oi {{tutor_first_name}}, lembrando que {{pet_name}} tem consulta amanhã às {{scheduled_at}}. Podemos confirmar?",
  },
  {
    slug: "consultation_cancelled",
    name: "Cancelamento de consulta",
    category: "transactional",
    body: "Sua consulta para {{pet_name}} foi cancelada. Quando quiser reagendar, é só nos chamar por aqui.",
  },
  {
    slug: "exam_ready",
    name: "Exame disponível",
    category: "transactional",
    body: "Olá {{tutor_first_name}}, o exame de {{pet_name}} já está disponível. Acesse o portal ou nos chame para receber o laudo.",
  },
  {
    slug: "vaccine_due_d7",
    name: "Vacina próxima do vencimento (D-7)",
    category: "reminder",
    body: "{{tutor_first_name}}, a vacina {{vaccine_name}} de {{pet_name}} vence em {{due_at}}. Vamos agendar o reforço?",
  },
  {
    slug: "pet_birthday",
    name: "Aniversário do pet",
    category: "campaign",
    body: "Hoje é o aniversário de {{pet_name}}! Toda a equipe deseja muita saúde — e lembramos do checkup anual quando puder.",
  },
];

const TRIGGER_FOR_SLUG: Record<
  string,
  { trigger: string; offsetMinutes: number; name: string }
> = {
  consultation_created: { trigger: "consultation.created", offsetMinutes: 0, name: "Confirmação ao agendar" },
  consultation_cancelled: { trigger: "consultation.cancelled", offsetMinutes: 0, name: "Aviso ao cancelar" },
  exam_ready: { trigger: "exam.ready", offsetMinutes: 0, name: "Aviso de exame pronto" },
  vaccine_due_d7: { trigger: "vaccine.due", offsetMinutes: 0, name: "Lembrete de vacina (D-7)" },
};

export async function seedClinicTemplates(clinicId: string) {
  let created = 0;
  for (const t of DEFAULTS) {
    const existing = await db
      .select({ id: commsTemplatesTable.id })
      .from(commsTemplatesTable)
      .where(
        and(eq(commsTemplatesTable.clinicId, clinicId), eq(commsTemplatesTable.slug, t.slug)),
      );
    if (existing.length > 0) continue;
    await db.insert(commsTemplatesTable).values({
      clinicId,
      slug: t.slug,
      name: t.name,
      channel: "whatsapp",
      category: t.category,
      body: t.body,
      variables: extractVariables(t.body),
      isSystem: true,
      enabled: true,
    });
    created++;
  }
  if (created > 0) logger.info({ clinicId, created }, "comms templates seeded");
}

export async function seedClinicAutomations(clinicId: string) {
  const templates = await db
    .select()
    .from(commsTemplatesTable)
    .where(eq(commsTemplatesTable.clinicId, clinicId));
  let created = 0;
  for (const tmpl of templates) {
    const cfg = TRIGGER_FOR_SLUG[tmpl.slug];
    if (!cfg) continue;
    const existing = await db
      .select({ id: commsAutomationsTable.id })
      .from(commsAutomationsTable)
      .where(
        and(
          eq(commsAutomationsTable.clinicId, clinicId),
          eq(commsAutomationsTable.trigger, cfg.trigger),
        ),
      );
    if (existing.length > 0) continue;
    await db.insert(commsAutomationsTable).values({
      clinicId,
      name: cfg.name,
      trigger: cfg.trigger,
      templateId: tmpl.id,
      channelId: null,
      offsetMinutes: cfg.offsetMinutes,
      config: {},
      // Disabled by default — clinic must turn each rule on once they review wording
      enabled: false,
    });
    created++;
  }
  if (created > 0) logger.info({ clinicId, created }, "comms automations seeded");
}
