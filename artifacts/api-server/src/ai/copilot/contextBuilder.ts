import { and, eq, desc } from "drizzle-orm";
import {
  db,
  petsTable,
  consultationsTable,
  anamnesesTable,
  examsTable,
  vaccinesTable,
  medicalRecordsTable,
} from "@workspace/db";
import { sanitize, clip } from "../sanitize";

export interface CopilotPetContext {
  pet: {
    name: string;
    species: string;
    breed: string | null;
    sex: string;
    ageYears: number | null;
    weightKg: number | null;
    isCritical: boolean;
    neutered: boolean;
    allergies: string | null;
    continuousMedications: string | null;
    notes: string | null;
  };
  recentConsultations: Array<{
    date: string;
    reason: string;
    status: string;
    summary: string | null;
  }>;
  recentExams: Array<{
    date: string;
    title: string;
    category: string;
    status: string;
    summary: string | null;
  }>;
  recentVaccines: Array<{
    date: string;
    name: string;
    nextDueAt: string | null;
    overdue: boolean;
  }>;
  recentRecords: Array<{
    date: string;
    title: string;
    excerpt: string;
  }>;
  focusedConsultation: {
    date: string;
    reason: string;
    status: string;
    symptoms: string | null;
    observations: string | null;
    evolution: string | null;
    medications: string | null;
    anamnesis: {
      neurological: string | null;
      digestive: string | null;
      respiratory: string | null;
      dermatological: string | null;
      general: string | null;
    } | null;
  } | null;
  citations: {
    consultationsCount: number;
    examsCount: number;
    vaccinesCount: number;
    recordsCount: number;
    rangeFromDate: string | null;
  };
}

const MAX_PER_TYPE = 10;

function ageYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Number((ms / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));
}

function fmtDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return d.toISOString().slice(0, 10);
}

export async function buildCopilotContext(
  petId: string,
  clinicId: string,
  focusedConsultationId: string | null,
): Promise<CopilotPetContext | null> {
  const [pet] = await db
    .select()
    .from(petsTable)
    .where(and(eq(petsTable.id, petId), eq(petsTable.clinicId, clinicId)));
  if (!pet) return null;

  const [consults, exams, vaccines, records] = await Promise.all([
    db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.petId, pet.id),
          eq(consultationsTable.clinicId, clinicId),
        ),
      )
      .orderBy(desc(consultationsTable.scheduledAt))
      .limit(MAX_PER_TYPE),
    db
      .select()
      .from(examsTable)
      .where(
        and(eq(examsTable.petId, pet.id), eq(examsTable.clinicId, clinicId)),
      )
      .orderBy(desc(examsTable.performedAt))
      .limit(MAX_PER_TYPE),
    db
      .select()
      .from(vaccinesTable)
      .where(
        and(
          eq(vaccinesTable.petId, pet.id),
          eq(vaccinesTable.clinicId, clinicId),
        ),
      )
      .orderBy(desc(vaccinesTable.appliedAt))
      .limit(MAX_PER_TYPE),
    db
      .select()
      .from(medicalRecordsTable)
      .where(
        and(
          eq(medicalRecordsTable.petId, pet.id),
          eq(medicalRecordsTable.clinicId, clinicId),
        ),
      )
      .orderBy(desc(medicalRecordsTable.createdAt))
      .limit(MAX_PER_TYPE),
  ]);

  let focused: CopilotPetContext["focusedConsultation"] = null;
  if (focusedConsultationId) {
    const [c] = await db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, focusedConsultationId),
          eq(consultationsTable.clinicId, clinicId),
        ),
      );
    if (c && c.petId === pet.id) {
      const [a] = await db
        .select()
        .from(anamnesesTable)
        .where(
          and(
            eq(anamnesesTable.consultationId, c.id),
            eq(anamnesesTable.clinicId, clinicId),
          ),
        );
      focused = {
        date: fmtDate(c.scheduledAt),
        reason: sanitize(c.reason) || "(sem motivo informado)",
        status: c.status,
        symptoms: c.symptoms ? clip(sanitize(c.symptoms), 1500) : null,
        observations: c.observations ? clip(sanitize(c.observations), 1500) : null,
        evolution: c.evolution ? clip(sanitize(c.evolution), 1500) : null,
        medications: c.medications ? clip(sanitize(c.medications), 600) : null,
        anamnesis: a
          ? {
              neurological: a.neurological ? clip(sanitize(a.neurological), 600) : null,
              digestive: a.digestive ? clip(sanitize(a.digestive), 600) : null,
              respiratory: a.respiratory ? clip(sanitize(a.respiratory), 600) : null,
              dermatological: a.dermatological ? clip(sanitize(a.dermatological), 600) : null,
              general: a.general ? clip(sanitize(a.general), 600) : null,
            }
          : null,
      };
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allDates = [
    ...consults.map((c) => +c.scheduledAt),
    ...exams.map((e) => +new Date(e.performedAt)),
    ...vaccines.map((v) => +new Date(v.appliedAt)),
    ...records.map((r) => +r.createdAt),
  ];
  const rangeFrom = allDates.length > 0 ? new Date(Math.min(...allDates)) : null;

  return {
    pet: {
      name: sanitize(pet.name) || "(sem nome)",
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      ageYears: ageYears(pet.birthDate),
      weightKg: pet.weightKg,
      isCritical: pet.isCritical,
      neutered: pet.neutered,
      allergies: pet.allergies ? clip(sanitize(pet.allergies), 500) : null,
      continuousMedications: pet.continuousMedications
        ? clip(sanitize(pet.continuousMedications), 500)
        : null,
      notes: pet.notes ? clip(sanitize(pet.notes), 500) : null,
    },
    recentConsultations: consults.map((c) => ({
      date: fmtDate(c.scheduledAt),
      reason: clip(sanitize(c.reason), 200) || "(sem motivo)",
      status: c.status,
      summary: c.observations
        ? clip(sanitize(c.observations), 300)
        : c.symptoms
          ? clip(sanitize(c.symptoms), 300)
          : null,
    })),
    recentExams: exams.map((e) => ({
      date: fmtDate(e.performedAt),
      title: clip(sanitize(e.title), 200),
      category: e.category,
      status: e.status,
      summary: e.notes ? clip(sanitize(e.notes), 300) : null,
    })),
    recentVaccines: vaccines.map((v) => {
      const due = v.nextDueAt ? new Date(v.nextDueAt) : null;
      return {
        date: fmtDate(v.appliedAt),
        name: clip(sanitize(v.name), 100),
        nextDueAt: v.nextDueAt ?? null,
        overdue: !!(due && due < today),
      };
    }),
    recentRecords: records.map((r) => ({
      date: fmtDate(r.createdAt),
      title: clip(sanitize(r.title), 200),
      excerpt: clip(sanitize(r.content), 400),
    })),
    focusedConsultation: focused,
    citations: {
      consultationsCount: consults.length,
      examsCount: exams.length,
      vaccinesCount: vaccines.length,
      recordsCount: records.length,
      rangeFromDate: rangeFrom ? fmtDate(rangeFrom) : null,
    },
  };
}

export function renderContextForPrompt(ctx: CopilotPetContext): string {
  const lines: string[] = [];
  lines.push("# CONTEXTO DO PACIENTE");
  lines.push("");
  lines.push(`Nome: ${ctx.pet.name}`);
  lines.push(`Espécie: ${ctx.pet.species}${ctx.pet.breed ? ` — ${ctx.pet.breed}` : ""}`);
  lines.push(
    `Sexo: ${ctx.pet.sex === "male" ? "Macho" : ctx.pet.sex === "female" ? "Fêmea" : "Não informado"}${ctx.pet.neutered ? " (castrado)" : ""}`,
  );
  if (ctx.pet.ageYears !== null) lines.push(`Idade aproximada: ${ctx.pet.ageYears} anos`);
  if (ctx.pet.weightKg !== null) lines.push(`Peso: ${ctx.pet.weightKg} kg`);
  if (ctx.pet.isCritical) lines.push(`⚠ Paciente CRÍTICO`);
  if (ctx.pet.allergies) lines.push(`Alergias: ${ctx.pet.allergies}`);
  if (ctx.pet.continuousMedications)
    lines.push(`Medicações contínuas: ${ctx.pet.continuousMedications}`);
  if (ctx.pet.notes) lines.push(`Observações de cadastro: ${ctx.pet.notes}`);

  if (ctx.focusedConsultation) {
    const f = ctx.focusedConsultation;
    lines.push("");
    lines.push("## CONSULTA EM FOCO");
    lines.push(`Data: ${f.date} — Status: ${f.status}`);
    lines.push(`Motivo: ${f.reason}`);
    if (f.symptoms) lines.push(`Sintomas: ${f.symptoms}`);
    if (f.observations) lines.push(`Observações: ${f.observations}`);
    if (f.evolution) lines.push(`Evolução: ${f.evolution}`);
    if (f.medications) lines.push(`Medicações: ${f.medications}`);
    if (f.anamnesis) {
      const a = f.anamnesis;
      const parts: string[] = [];
      if (a.general) parts.push(`Geral: ${a.general}`);
      if (a.neurological) parts.push(`Neuro: ${a.neurological}`);
      if (a.digestive) parts.push(`Digestivo: ${a.digestive}`);
      if (a.respiratory) parts.push(`Respiratório: ${a.respiratory}`);
      if (a.dermatological) parts.push(`Dermato: ${a.dermatological}`);
      if (parts.length) lines.push(`Anamnese — ${parts.join(" | ")}`);
    }
  }

  if (ctx.recentConsultations.length > 0) {
    lines.push("");
    lines.push(`## CONSULTAS RECENTES (${ctx.recentConsultations.length})`);
    for (const c of ctx.recentConsultations) {
      lines.push(
        `- ${c.date} [${c.status}] ${c.reason}${c.summary ? ` — ${c.summary}` : ""}`,
      );
    }
  }
  if (ctx.recentExams.length > 0) {
    lines.push("");
    lines.push(`## EXAMES RECENTES (${ctx.recentExams.length})`);
    for (const e of ctx.recentExams) {
      lines.push(
        `- ${e.date} [${e.category}/${e.status}] ${e.title}${e.summary ? ` — ${e.summary}` : ""}`,
      );
    }
  }
  if (ctx.recentVaccines.length > 0) {
    lines.push("");
    lines.push(`## VACINAS RECENTES (${ctx.recentVaccines.length})`);
    for (const v of ctx.recentVaccines) {
      lines.push(
        `- ${v.date} ${v.name}${v.nextDueAt ? ` (próxima ${v.nextDueAt}${v.overdue ? " — ATRASADA" : ""})` : ""}`,
      );
    }
  }
  if (ctx.recentRecords.length > 0) {
    lines.push("");
    lines.push(`## PRONTUÁRIO RECENTE (${ctx.recentRecords.length})`);
    for (const r of ctx.recentRecords) {
      lines.push(`- ${r.date} ${r.title}: ${r.excerpt}`);
    }
  }

  return lines.join("\n");
}
