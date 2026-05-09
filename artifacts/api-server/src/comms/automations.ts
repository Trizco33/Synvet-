import { and, eq } from "drizzle-orm";
import {
  db,
  commsAutomationsTable,
  commsTemplatesTable,
  commsChannelsTable,
  commsJobsTable,
  commsMessagesTable,
  petsTable,
  tutorsTable,
} from "@workspace/db";
import { commsBus, type CommsEvent } from "./event-bus";
import { renderTemplate } from "./templates";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Listens for domain events (consultation.created, vaccine.due, …),
// matches active automations, renders the linked template with the event
// context, persists a `comms_messages` row + a `comms_jobs` send_message job.
// The scheduler is what actually delivers via the configured provider.
// ---------------------------------------------------------------------------

export function startAutomationsListener() {
  commsBus.onEvent(async (event) => {
    try {
      await handleEvent(event);
    } catch (err) {
      logger.error({ err, event: event.type }, "automations handler failed");
    }
  });
  logger.info("comms automations listener registered");
}

function formatDateBR(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

async function loadTutorPet(petId: string, clinicId: string) {
  const [pet] = await db
    .select({
      id: petsTable.id,
      name: petsTable.name,
      species: petsTable.species,
      tutorId: petsTable.tutorId,
    })
    .from(petsTable)
    .where(and(eq(petsTable.id, petId), eq(petsTable.clinicId, clinicId)));
  if (!pet) return null;
  const [tutor] = await db
    .select({ id: tutorsTable.id, name: tutorsTable.name, phone: tutorsTable.phone })
    .from(tutorsTable)
    .where(and(eq(tutorsTable.id, pet.tutorId), eq(tutorsTable.clinicId, clinicId)));
  if (!tutor) return null;
  return { pet, tutor };
}

async function resolveChannel(clinicId: string, channelId: string | null) {
  if (channelId) {
    const [c] = await db
      .select()
      .from(commsChannelsTable)
      .where(and(eq(commsChannelsTable.id, channelId), eq(commsChannelsTable.clinicId, clinicId)));
    return c ?? null;
  }
  const channels = await db
    .select()
    .from(commsChannelsTable)
    .where(eq(commsChannelsTable.clinicId, clinicId));
  return channels.find((c) => c.kind === "whatsapp_qr") ?? channels[0] ?? null;
}

function eventDate(event: CommsEvent): Date | null {
  if ("scheduledAt" in event && event.scheduledAt) return new Date(event.scheduledAt);
  if ("dueAt" in event && event.dueAt) return new Date(event.dueAt);
  return null;
}

function petIdOf(event: CommsEvent): string | null {
  return "petId" in event ? event.petId : null;
}

function consultationIdOf(event: CommsEvent): string | null {
  return "consultationId" in event ? event.consultationId : null;
}

async function handleEvent(event: CommsEvent) {
  const rules = await db
    .select()
    .from(commsAutomationsTable)
    .where(
      and(
        eq(commsAutomationsTable.clinicId, event.clinicId),
        eq(commsAutomationsTable.trigger, event.type),
        eq(commsAutomationsTable.enabled, true),
      ),
    );
  if (rules.length === 0) return;

  const petId = petIdOf(event);
  if (!petId) return;

  const ctx = await loadTutorPet(petId, event.clinicId);
  if (!ctx) return;
  if (!ctx.tutor.phone) {
    logger.debug(
      { event: event.type, petId },
      "automation skipped: tutor has no phone",
    );
    return;
  }

  for (const rule of rules) {
    try {
      const [template] = await db
        .select()
        .from(commsTemplatesTable)
        .where(
          and(
            eq(commsTemplatesTable.id, rule.templateId),
            eq(commsTemplatesTable.clinicId, event.clinicId),
          ),
        );
      if (!template || !template.enabled) continue;

      const channel = await resolveChannel(event.clinicId, rule.channelId);
      if (!channel) {
        logger.warn({ ruleId: rule.id, event: event.type }, "automation skipped: no channel available");
        continue;
      }

      const baseDate = eventDate(event) ?? new Date();
      const scheduledFor = new Date(baseDate.getTime() + rule.offsetMinutes * 60_000);

      const vars: Record<string, string> = {
        pet_name: ctx.pet.name,
        pet_species: ctx.pet.species,
        tutor_name: ctx.tutor.name,
        tutor_first_name: ctx.tutor.name.split(/\s+/)[0] ?? ctx.tutor.name,
      };
      if ("scheduledAt" in event && event.scheduledAt) {
        vars["scheduled_at"] = formatDateBR(new Date(event.scheduledAt));
      }
      if ("vaccineName" in event && event.vaccineName) {
        vars["vaccine_name"] = event.vaccineName;
      }
      if ("dueAt" in event && event.dueAt) {
        vars["due_at"] = formatDateBR(new Date(event.dueAt));
      }

      const body = renderTemplate(template.body, vars);
      const willSendNow = scheduledFor.getTime() <= Date.now() + 1000;

      const [msg] = await db
        .insert(commsMessagesTable)
        .values({
          clinicId: event.clinicId,
          channelId: channel.id,
          automationId: rule.id,
          templateId: template.id,
          tutorId: ctx.tutor.id,
          petId: ctx.pet.id,
          consultationId: consultationIdOf(event),
          direction: "outbound",
          toAddress: ctx.tutor.phone,
          body,
          status: willSendNow ? "queued" : "scheduled",
          scheduledFor,
        })
        .returning();
      await db.insert(commsJobsTable).values({
        clinicId: event.clinicId,
        kind: "send_message",
        payload: { messageId: msg.id },
        scheduledFor,
      });
    } catch (err) {
      logger.error({ err, ruleId: rule.id, event: event.type }, "automation rule failed");
    }
  }
}
