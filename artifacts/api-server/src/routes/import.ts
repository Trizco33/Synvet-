import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  tutorsTable,
  petsTable,
  consultationsTable,
  examsTable,
  vaccinesTable,
  medicalRecordsTable,
  importLogsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

type Kind =
  | "tutors"
  | "pets"
  | "appointments"
  | "exams"
  | "vaccines"
  | "medical_records";

const KINDS: readonly Kind[] = [
  "tutors",
  "pets",
  "appointments",
  "exams",
  "vaccines",
  "medical_records",
];

function isKind(v: string): v is Kind {
  return (KINDS as readonly string[]).includes(v);
}

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const CHUNK_SIZE = 100;

// =============================================================
// Templates CSV — cabeçalho + 1 linha de exemplo por tipo.
// =============================================================
const TEMPLATES: Record<Kind, { headers: string[]; example: string[] }> = {
  tutors: {
    headers: ["name", "email", "phone", "whatsapp", "address", "externalId"],
    example: [
      "Maria Silva",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "+55 11 99999-0001",
      "Rua das Flores, 123 — São Paulo/SP",
      "TUT-00042",
    ],
  },
  pets: {
    headers: [
      "name",
      "species",
      "breed",
      "sex",
      "birthDate",
      "weightKg",
      "tutorEmail",
      "tutorPhone",
      "externalId",
      "notes",
    ],
    example: [
      "Thor",
      "dog",
      "Golden Retriever",
      "male",
      "2020-03-15",
      "28.4",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "PT-00125",
      "Vacinação em dia",
    ],
  },
  appointments: {
    headers: ["scheduledAt", "petName", "tutorEmail", "tutorPhone", "reason", "status"],
    example: [
      "2026-05-20T14:30:00-03:00",
      "Thor",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "Consulta de rotina",
      "scheduled",
    ],
  },
  exams: {
    headers: [
      "performedAt",
      "petName",
      "tutorEmail",
      "tutorPhone",
      "title",
      "category",
      "status",
      "fileUrl",
      "notes",
    ],
    example: [
      "2026-04-12",
      "Thor",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "Hemograma completo",
      "laboratorial",
      "completed",
      "https://exemplo.com/laudos/thor-hemograma.pdf",
      "Sem alterações relevantes",
    ],
  },
  vaccines: {
    headers: [
      "appliedAt",
      "petName",
      "tutorEmail",
      "tutorPhone",
      "vaccine",
      "nextDueAt",
      "notes",
    ],
    example: [
      "2026-03-10",
      "Thor",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "V10",
      "2027-03-10",
      "Lote ABC123 — reforço anual",
    ],
  },
  medical_records: {
    headers: [
      "recordedAt",
      "petName",
      "tutorEmail",
      "tutorPhone",
      "title",
      "content",
    ],
    example: [
      "2025-11-22",
      "Thor",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "Atendimento clínico",
      "Paciente apresentou quadro de dermatite. Prescrito banho medicamentoso por 7 dias.",
    ],
  },
};

function csvEscape(v: string): string {
  if (v.includes('"') || v.includes(",") || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function buildTemplateCsv(kind: Kind): string {
  const t = TEMPLATES[kind];
  return `${t.headers.map(csvEscape).join(",")}\n${t.example.map(csvEscape).join(",")}\n`;
}

// =============================================================
// Helpers de normalização e dedupe.
// =============================================================
function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function normPhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/\D+/g, "");
  return digits.length >= 8 ? digits : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function applyMapping(
  row: Record<string, string | null>,
  mapping: Record<string, string>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [csvCol, synvetField] of Object.entries(mapping)) {
    if (!synvetField) continue;
    const value = row[csvCol];
    out[synvetField] = value ?? null;
  }
  return out;
}

// =============================================================
// Zod schemas por kind — enforce contrato de cada linha.
// =============================================================
const optStr = z
  .string()
  .nullish()
  .transform((v: string | null | undefined) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null,
  );

const reqStr = (msg: string) =>
  z
    .string({ required_error: msg, invalid_type_error: msg })
    .nullish()
    .transform((v: string | null | undefined) => (typeof v === "string" ? v.trim() : ""))
    .refine((v: string) => v.length > 0, { message: msg });

const TutorRowSchema = z
  .object({
    name: reqStr("Nome obrigatório"),
    email: optStr,
    phone: optStr,
    whatsapp: optStr,
    address: optStr,
    externalId: optStr,
  })
  .refine(
    (d: { email: string | null; phone: string | null }) =>
      normEmail(d.email) || normPhone(d.phone),
    { message: "Informe e-mail ou telefone válido", path: ["email"] },
  );

const PetRowSchema = z.object({
  name: reqStr("Nome obrigatório"),
  species: reqStr("Espécie obrigatória (ex.: dog, cat)").transform((v: string) =>
    v.toLowerCase(),
  ),
  breed: optStr,
  sex: optStr,
  birthDate: optStr,
  weightKg: optStr,
  tutorEmail: optStr,
  tutorPhone: optStr,
  externalId: optStr,
  notes: optStr,
});

const AppointmentRowSchema = z.object({
  scheduledAt: reqStr("Data/hora obrigatória"),
  petName: reqStr("Nome do pet obrigatório"),
  tutorEmail: optStr,
  tutorPhone: optStr,
  reason: optStr,
  status: optStr,
});

const SEX_VALUES = new Set(["male", "female", "unknown"]);
const STATUS_VALUES = new Set(["scheduled", "in_progress", "completed", "cancelled"]);
const EXAM_STATUS_VALUES = new Set(["pending", "completed"]);

const ExamRowSchema = z.object({
  performedAt: reqStr("Data do exame obrigatória (YYYY-MM-DD)"),
  petName: reqStr("Nome do pet obrigatório"),
  tutorEmail: optStr,
  tutorPhone: optStr,
  title: reqStr("Título do exame obrigatório"),
  category: reqStr("Categoria obrigatória (ex.: laboratorial, imagem)"),
  status: optStr,
  fileUrl: optStr,
  notes: optStr,
});

const VaccineRowSchema = z.object({
  appliedAt: reqStr("Data de aplicação obrigatória (YYYY-MM-DD)"),
  petName: reqStr("Nome do pet obrigatório"),
  tutorEmail: optStr,
  tutorPhone: optStr,
  vaccine: reqStr("Nome da vacina obrigatório"),
  nextDueAt: optStr,
  notes: optStr,
});

const MedicalRecordRowSchema = z.object({
  recordedAt: optStr,
  petName: reqStr("Nome do pet obrigatório"),
  tutorEmail: optStr,
  tutorPhone: optStr,
  title: reqStr("Título obrigatório"),
  content: reqStr("Conteúdo do prontuário obrigatório"),
});

function isValidDateOnly(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
}

// =============================================================
// Planejamento (pass 1) — valida + resolve refs SEM gravar.
// =============================================================
type Plan =
  | { row: number; outcome: "created"; insert: Record<string, unknown> }
  | { row: number; outcome: "skipped"; message: string; id: string | null }
  | { row: number; outcome: "error"; message: string };

async function planTutors(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const existing = await db
    .select({
      id: tutorsTable.id,
      email: tutorsTable.email,
      phone: tutorsTable.phone,
      externalId: tutorsTable.externalId,
    })
    .from(tutorsTable)
    .where(eq(tutorsTable.clinicId, clinicId));
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byExternalId = new Map<string, string>();
  for (const t of existing) {
    const e = normEmail(t.email);
    if (e) byEmail.set(e, t.id);
    const p = normPhone(t.phone);
    if (p) byPhone.set(p, t.id);
    if (t.externalId) byExternalId.set(t.externalId, t.id);
  }

  const inBatchEmails = new Set<string>();
  const inBatchPhones = new Set<string>();
  const inBatchExternalIds = new Set<string>();
  const plans: Plan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = TutorRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: parsed.error.issues[0]?.message ?? "Linha inválida",
      });
      continue;
    }
    const d = parsed.data;
    const email = normEmail(d.email);
    const phone = normPhone(d.phone);
    // Dedupe prioritário por externalId; fallback por e-mail/telefone.
    let dupId: string | null = null;
    let dupReason: "externalId" | "email" | "phone" | null = null;
    if (d.externalId && byExternalId.has(d.externalId)) {
      dupId = byExternalId.get(d.externalId)!;
      dupReason = "externalId";
    } else if (email && byEmail.has(email)) {
      dupId = byEmail.get(email)!;
      dupReason = "email";
    } else if (phone && byPhone.has(phone)) {
      dupId = byPhone.get(phone)!;
      dupReason = "phone";
    }
    if (dupId) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message:
          dupReason === "externalId"
            ? "Tutor já existe (dedupe por ID do sistema antigo)"
            : "Tutor já existe (dedupe por e-mail/telefone)",
        id: dupId,
      });
      continue;
    }
    if (
      (email && inBatchEmails.has(email)) ||
      (phone && inBatchPhones.has(phone)) ||
      (d.externalId && inBatchExternalIds.has(d.externalId))
    ) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Linha duplicada dentro do mesmo arquivo",
        id: null,
      });
      continue;
    }
    plans.push({
      row: rowNum,
      outcome: "created",
      insert: {
        clinicId,
        createdBy: userId,
        name: d.name,
        email: d.email,
        phone: d.phone,
        whatsapp: d.whatsapp ?? d.phone,
        address: d.address,
        externalId: d.externalId,
      },
    });
    // Reserva chave dentro do batch: linhas seguintes com mesmo
    // email/phone/externalId serão marcadas como skipped (sem id, pois
    // ainda não foi gravado).
    if (email) inBatchEmails.add(email);
    if (phone) inBatchPhones.add(phone);
    if (d.externalId) inBatchExternalIds.add(d.externalId);
  }
  return plans;
}

async function planPets(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const tutors = await db
    .select({ id: tutorsTable.id, email: tutorsTable.email, phone: tutorsTable.phone })
    .from(tutorsTable)
    .where(eq(tutorsTable.clinicId, clinicId));
  const tutorByEmail = new Map<string, string>();
  const tutorByPhone = new Map<string, string>();
  for (const t of tutors) {
    const e = normEmail(t.email);
    if (e) tutorByEmail.set(e, t.id);
    const p = normPhone(t.phone);
    if (p) tutorByPhone.set(p, t.id);
  }
  const existingPets = await db
    .select({
      id: petsTable.id,
      tutorId: petsTable.tutorId,
      name: petsTable.name,
      externalId: petsTable.externalId,
    })
    .from(petsTable)
    .where(eq(petsTable.clinicId, clinicId));
  const petKey = (tutorId: string, name: string) =>
    `${tutorId}::${name.trim().toLowerCase()}`;
  const petByKey = new Map<string, string>();
  const petByExternalId = new Map<string, string>();
  for (const p of existingPets) {
    petByKey.set(petKey(p.tutorId, p.name), p.id);
    if (p.externalId) petByExternalId.set(p.externalId, p.id);
  }

  const inBatchKeys = new Set<string>();
  const inBatchExternalIds = new Set<string>();
  const plans: Plan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = PetRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: parsed.error.issues[0]?.message ?? "Linha inválida",
      });
      continue;
    }
    const d = parsed.data;
    const tutorEmail = normEmail(d.tutorEmail);
    const tutorPhone = normPhone(d.tutorPhone);
    const tutorId =
      (tutorEmail && tutorByEmail.get(tutorEmail)) ||
      (tutorPhone && tutorByPhone.get(tutorPhone)) ||
      null;
    if (!tutorId) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message:
          "Tutor não encontrado. Importe os tutores primeiro ou informe e-mail/telefone existente.",
      });
      continue;
    }
    // Dedupe prioritário por externalId; fallback (tutorId, name).
    if (d.externalId && petByExternalId.has(d.externalId)) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Pet já cadastrado (mesmo ID externo)",
        id: petByExternalId.get(d.externalId)!,
      });
      continue;
    }
    const dupKey = petKey(tutorId, d.name);
    if (petByKey.has(dupKey)) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Pet já cadastrado para este tutor",
        id: petByKey.get(dupKey)!,
      });
      continue;
    }
    if (
      inBatchKeys.has(dupKey) ||
      (d.externalId && inBatchExternalIds.has(d.externalId))
    ) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Linha duplicada dentro do mesmo arquivo",
        id: null,
      });
      continue;
    }
    let sex: "male" | "female" | "unknown" = "unknown";
    if (d.sex && SEX_VALUES.has(d.sex.toLowerCase())) {
      sex = d.sex.toLowerCase() as typeof sex;
    }
    let weightKg: number | null = null;
    if (d.weightKg) {
      const parsedNum = Number(d.weightKg.replace(",", "."));
      if (Number.isFinite(parsedNum)) weightKg = parsedNum;
    }
    plans.push({
      row: rowNum,
      outcome: "created",
      insert: {
        clinicId,
        tutorId,
        createdBy: userId,
        name: d.name,
        species: d.species,
        breed: d.breed,
        sex,
        birthDate: d.birthDate,
        weightKg,
        notes: d.notes,
        externalId: d.externalId,
      },
    });
    inBatchKeys.add(dupKey);
    if (d.externalId) inBatchExternalIds.add(d.externalId);
  }
  return plans;
}

async function planAppointments(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const tutors = await db
    .select({ id: tutorsTable.id, email: tutorsTable.email, phone: tutorsTable.phone })
    .from(tutorsTable)
    .where(eq(tutorsTable.clinicId, clinicId));
  const tutorByEmail = new Map<string, string>();
  const tutorByPhone = new Map<string, string>();
  for (const t of tutors) {
    const e = normEmail(t.email);
    if (e) tutorByEmail.set(e, t.id);
    const p = normPhone(t.phone);
    if (p) tutorByPhone.set(p, t.id);
  }
  const tutorIds = tutors.map((t) => t.id);
  const pets = tutorIds.length
    ? await db
        .select({
          id: petsTable.id,
          tutorId: petsTable.tutorId,
          name: petsTable.name,
        })
        .from(petsTable)
        .where(inArray(petsTable.tutorId, tutorIds))
    : [];
  const petByKey = new Map<string, string>();
  for (const p of pets) {
    petByKey.set(`${p.tutorId}::${p.name.trim().toLowerCase()}`, p.id);
  }

  const plans: Plan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = AppointmentRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: parsed.error.issues[0]?.message ?? "Linha inválida",
      });
      continue;
    }
    const d = parsed.data;
    const scheduled = new Date(d.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Data inválida — use ISO 8601 (ex.: 2026-05-20T14:30:00-03:00)",
      });
      continue;
    }
    const tutorEmail = normEmail(d.tutorEmail);
    const tutorPhone = normPhone(d.tutorPhone);
    const tutorId =
      (tutorEmail && tutorByEmail.get(tutorEmail)) ||
      (tutorPhone && tutorByPhone.get(tutorPhone)) ||
      null;
    if (!tutorId) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Tutor não encontrado (e-mail/telefone)",
      });
      continue;
    }
    const petId = petByKey.get(`${tutorId}::${d.petName.toLowerCase()}`);
    if (!petId) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Pet não encontrado para este tutor",
      });
      continue;
    }
    let status: "scheduled" | "in_progress" | "completed" | "cancelled" = "scheduled";
    if (d.status && STATUS_VALUES.has(d.status.toLowerCase())) {
      status = d.status.toLowerCase() as typeof status;
    }
    plans.push({
      row: rowNum,
      outcome: "created",
      insert: {
        clinicId,
        createdBy: userId,
        petId,
        scheduledAt: scheduled,
        status,
        reason: d.reason,
      },
    });
  }
  return plans;
}

type PetLookup = {
  petByKey: Map<string, string>;
};

async function loadPetLookup(clinicId: string): Promise<PetLookup> {
  const tutors = await db
    .select({ id: tutorsTable.id, email: tutorsTable.email, phone: tutorsTable.phone })
    .from(tutorsTable)
    .where(eq(tutorsTable.clinicId, clinicId));
  const tutorByEmail = new Map<string, string>();
  const tutorByPhone = new Map<string, string>();
  for (const t of tutors) {
    const e = normEmail(t.email);
    if (e) tutorByEmail.set(e, t.id);
    const p = normPhone(t.phone);
    if (p) tutorByPhone.set(p, t.id);
  }
  const tutorIds = tutors.map((t) => t.id);
  const pets = tutorIds.length
    ? await db
        .select({
          id: petsTable.id,
          tutorId: petsTable.tutorId,
          name: petsTable.name,
        })
        .from(petsTable)
        .where(inArray(petsTable.tutorId, tutorIds))
    : [];
  const petByKey = new Map<string, string>();
  for (const p of pets) {
    const tutor = tutors.find((t) => t.id === p.tutorId);
    if (!tutor) continue;
    const e = normEmail(tutor.email);
    const ph = normPhone(tutor.phone);
    const nameKey = p.name.trim().toLowerCase();
    if (e) petByKey.set(`e:${e}::${nameKey}`, p.id);
    if (ph) petByKey.set(`p:${ph}::${nameKey}`, p.id);
  }
  return { petByKey };
}

function resolvePetId(
  lookup: PetLookup,
  petName: string,
  tutorEmail: string | null,
  tutorPhone: string | null,
): string | null {
  const nameKey = petName.trim().toLowerCase();
  const e = normEmail(tutorEmail);
  const p = normPhone(tutorPhone);
  if (e) {
    const id = lookup.petByKey.get(`e:${e}::${nameKey}`);
    if (id) return id;
  }
  if (p) {
    const id = lookup.petByKey.get(`p:${p}::${nameKey}`);
    if (id) return id;
  }
  return null;
}

async function planExams(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const lookup = await loadPetLookup(clinicId);
  const plans: Plan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = ExamRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: parsed.error.issues[0]?.message ?? "Linha inválida",
      });
      continue;
    }
    const d = parsed.data;
    if (!isValidDateOnly(d.performedAt)) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Data do exame inválida — use YYYY-MM-DD (ex.: 2026-04-12)",
      });
      continue;
    }
    const petId = resolvePetId(lookup, d.petName, d.tutorEmail, d.tutorPhone);
    if (!petId) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Pet não encontrado. Importe tutores e pacientes antes dos exames.",
      });
      continue;
    }
    let status: "pending" | "completed" = "completed";
    if (d.status && EXAM_STATUS_VALUES.has(d.status.toLowerCase())) {
      status = d.status.toLowerCase() as typeof status;
    }
    plans.push({
      row: rowNum,
      outcome: "created",
      insert: {
        clinicId,
        createdBy: userId,
        petId,
        title: d.title,
        category: d.category,
        status,
        fileUrl: d.fileUrl,
        notes: d.notes,
        performedAt: d.performedAt,
      },
    });
  }
  return plans;
}

async function planVaccines(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const lookup = await loadPetLookup(clinicId);
  const existing = await db
    .select({
      id: vaccinesTable.id,
      petId: vaccinesTable.petId,
      name: vaccinesTable.name,
      appliedAt: vaccinesTable.appliedAt,
    })
    .from(vaccinesTable)
    .where(eq(vaccinesTable.clinicId, clinicId));
  const dupKey = (petId: string, name: string, appliedAt: string) =>
    `${petId}::${name.trim().toLowerCase()}::${appliedAt}`;
  const existingByKey = new Map<string, string>();
  for (const v of existing) {
    existingByKey.set(dupKey(v.petId, v.name, v.appliedAt), v.id);
  }
  const inBatchKeys = new Set<string>();
  const plans: Plan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = VaccineRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: parsed.error.issues[0]?.message ?? "Linha inválida",
      });
      continue;
    }
    const d = parsed.data;
    if (!isValidDateOnly(d.appliedAt)) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Data de aplicação inválida — use YYYY-MM-DD (ex.: 2026-03-10)",
      });
      continue;
    }
    if (d.nextDueAt && !isValidDateOnly(d.nextDueAt)) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Próxima dose inválida — use YYYY-MM-DD ou deixe em branco",
      });
      continue;
    }
    const petId = resolvePetId(lookup, d.petName, d.tutorEmail, d.tutorPhone);
    if (!petId) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: "Pet não encontrado. Importe tutores e pacientes antes das vacinas.",
      });
      continue;
    }
    const k = dupKey(petId, d.vaccine, d.appliedAt);
    if (existingByKey.has(k)) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Vacina já registrada (mesmo pet, vacina e data)",
        id: existingByKey.get(k)!,
      });
      continue;
    }
    if (inBatchKeys.has(k)) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Linha duplicada dentro do mesmo arquivo",
        id: null,
      });
      continue;
    }
    inBatchKeys.add(k);
    plans.push({
      row: rowNum,
      outcome: "created",
      insert: {
        clinicId,
        createdBy: userId,
        petId,
        name: d.vaccine,
        appliedAt: d.appliedAt,
        nextDueAt: d.nextDueAt,
        notes: d.notes,
      },
    });
  }
  return plans;
}

async function planMedicalRecords(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const lookup = await loadPetLookup(clinicId);
  const plans: Plan[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = MedicalRecordRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message: parsed.error.issues[0]?.message ?? "Linha inválida",
      });
      continue;
    }
    const d = parsed.data;
    let recordedAt: Date | null = null;
    if (d.recordedAt) {
      // Aceita YYYY-MM-DD ou ISO 8601 completo.
      const candidate = isValidDateOnly(d.recordedAt)
        ? new Date(`${d.recordedAt}T12:00:00Z`)
        : new Date(d.recordedAt);
      if (Number.isNaN(candidate.getTime())) {
        plans.push({
          row: rowNum,
          outcome: "error",
          message: "Data do prontuário inválida — use YYYY-MM-DD ou ISO 8601",
        });
        continue;
      }
      recordedAt = candidate;
    }
    const petId = resolvePetId(lookup, d.petName, d.tutorEmail, d.tutorPhone);
    if (!petId) {
      plans.push({
        row: rowNum,
        outcome: "error",
        message:
          "Pet não encontrado. Importe tutores e pacientes antes dos prontuários.",
      });
      continue;
    }
    plans.push({
      row: rowNum,
      outcome: "created",
      insert: {
        clinicId,
        createdBy: userId,
        petId,
        title: d.title,
        content: d.content,
        sourceType: "manual",
        ...(recordedAt ? { createdAt: recordedAt, updatedAt: recordedAt } : {}),
      },
    });
  }
  return plans;
}

// =============================================================
// Execução (pass 2) — só roda se pass 1 não tiver NENHUM erro.
// Atomicidade fail-all: tudo dentro da mesma transação, em chunks
// de CHUNK_SIZE para evitar payloads gigantes em uma única query.
// =============================================================
type RowResult = {
  row: number;
  outcome: "created" | "updated" | "skipped" | "error";
  message?: string;
  id?: string;
};

async function executePlans(kind: Kind, plans: Plan[]): Promise<RowResult[]> {
  const results: RowResult[] = plans.map((p) =>
    p.outcome === "skipped"
      ? {
          row: p.row,
          outcome: "skipped",
          message: p.message,
          ...(p.id ? { id: p.id } : {}),
        }
      : p.outcome === "error"
        ? { row: p.row, outcome: "error", message: p.message }
        : { row: p.row, outcome: "created" },
  );

  const toCreate = plans.filter(
    (p): p is Extract<Plan, { outcome: "created" }> => p.outcome === "created",
  );
  if (toCreate.length === 0) return results;

  const writeBackIds = (ids: Array<{ id: string }>, slice: typeof toCreate) => {
    for (let j = 0; j < slice.length; j++) {
      const planRow = slice[j]!.row;
      const idx = results.findIndex((r) => r.row === planRow);
      if (idx >= 0) results[idx]!.id = ids[j]?.id;
    }
  };

  await db.transaction(async (tx) => {
    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const slice = toCreate.slice(i, i + CHUNK_SIZE);
      if (kind === "tutors") {
        const inserted = await tx
          .insert(tutorsTable)
          .values(slice.map((p) => p.insert as typeof tutorsTable.$inferInsert))
          .returning({ id: tutorsTable.id });
        writeBackIds(inserted, slice);
      } else if (kind === "pets") {
        const inserted = await tx
          .insert(petsTable)
          .values(slice.map((p) => p.insert as typeof petsTable.$inferInsert))
          .returning({ id: petsTable.id });
        writeBackIds(inserted, slice);
      } else if (kind === "appointments") {
        const inserted = await tx
          .insert(consultationsTable)
          .values(slice.map((p) => p.insert as typeof consultationsTable.$inferInsert))
          .returning({ id: consultationsTable.id });
        writeBackIds(inserted, slice);
      } else if (kind === "exams") {
        const inserted = await tx
          .insert(examsTable)
          .values(slice.map((p) => p.insert as typeof examsTable.$inferInsert))
          .returning({ id: examsTable.id });
        writeBackIds(inserted, slice);
      } else if (kind === "vaccines") {
        const inserted = await tx
          .insert(vaccinesTable)
          .values(slice.map((p) => p.insert as typeof vaccinesTable.$inferInsert))
          .returning({ id: vaccinesTable.id });
        writeBackIds(inserted, slice);
      } else {
        const inserted = await tx
          .insert(medicalRecordsTable)
          .values(slice.map((p) => p.insert as typeof medicalRecordsTable.$inferInsert))
          .returning({ id: medicalRecordsTable.id });
        writeBackIds(inserted, slice);
      }
    }
  });
  return results;
}

// =============================================================
// Rotas.
// =============================================================
router.get("/import/template/:kind", async (req, res): Promise<void> => {
  const kind = String(req.params.kind);
  if (!isKind(kind)) {
    res.status(400).json({ error: "Tipo inválido" });
    return;
  }
  const csv = buildTemplateCsv(kind);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="synvet-template-${kind}.csv"`,
  );
  res.send(csv);
});

router.post(
  "/import/:kind",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const kind = String(req.params.kind);
    if (!isKind(kind)) {
      res.status(400).json({ error: "Tipo inválido" });
      return;
    }

    // Limite hard de 5 MB no servidor — não confia em validação cliente.
    const contentLength = Number(req.headers["content-length"] ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      res.status(413).json({ error: "Arquivo acima de 5 MB. Divida em arquivos menores." });
      return;
    }

    const parsed = schemas.RunImportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { rows, mapping, fileHash, fileName } = parsed.data;
    if (rows.length === 0) {
      res.status(400).json({ error: "Nenhuma linha para importar" });
      return;
    }

    // Idempotência: bloqueia reimportação do mesmo arquivo (mesmo hash).
    const previous = await db
      .select()
      .from(importLogsTable)
      .where(
        and(
          eq(importLogsTable.clinicId, user.clinicId),
          eq(importLogsTable.kind, kind),
          eq(importLogsTable.fileHash, fileHash),
        ),
      )
      .limit(1);
    if (previous.length > 0) {
      const p = previous[0]!;
      // Permite retry quando a rodada anterior falhou (errorCount > 0):
      // como nada foi gravado em fail-all, o usuário corrige o CSV (mesmo
      // que mantenha algumas linhas iguais) e reenvia. Removemos o log
      // antigo para não bater no UNIQUE INDEX (clinicId, kind, fileHash).
      if (p.errorCount > 0) {
        await db.delete(importLogsTable).where(eq(importLogsTable.id, p.id));
      } else {
        res.status(409).json({
          error:
            "Este arquivo já foi importado anteriormente. Para reimportar, ajuste pelo menos uma linha (o conteúdo precisa ser diferente).",
          previousImport: {
            createdAt: p.createdAt,
            rowCount: p.rowCount,
            created: p.createdCount,
            skipped: p.skippedCount,
            errors: p.errorCount,
          },
        });
        return;
      }
    }

    // Aplica o mapping de cada linha (csvColumn → synvetField).
    const mappedRows = rows.map((r: Record<string, string>) =>
      applyMapping(r as Record<string, string | null>, mapping),
    );

    // Pass 1 — valida + resolve refs sem gravar nada.
    let plans: Plan[];
    try {
      if (kind === "tutors") plans = await planTutors(user.clinicId, user.id, mappedRows);
      else if (kind === "pets") plans = await planPets(user.clinicId, user.id, mappedRows);
      else if (kind === "appointments")
        plans = await planAppointments(user.clinicId, user.id, mappedRows);
      else if (kind === "exams") plans = await planExams(user.clinicId, user.id, mappedRows);
      else if (kind === "vaccines")
        plans = await planVaccines(user.clinicId, user.id, mappedRows);
      else plans = await planMedicalRecords(user.clinicId, user.id, mappedRows);
    } catch (err) {
      req.log.error({ err, kind }, "Import planning failed");
      res.status(500).json({
        error: "Falha ao validar a importação. Nenhuma linha foi gravada.",
      });
      return;
    }

    const errorPlans = plans.filter((p) => p.outcome === "error");
    const summary = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: errorPlans.length,
    };
    for (const p of plans) {
      if (p.outcome === "skipped") summary.skipped++;
      else if (p.outcome === "created") summary.created++;
    }

    // Atomicidade fail-all: se houver QUALQUER erro, devolve relatório
    // sem gravar nada. Cliente corrige e reenvia.
    let results: RowResult[];
    if (errorPlans.length > 0) {
      results = plans.map((p) =>
        p.outcome === "skipped"
          ? {
              row: p.row,
              outcome: "skipped",
              message: p.message,
              ...(p.id ? { id: p.id } : {}),
            }
          : p.outcome === "error"
            ? { row: p.row, outcome: "error", message: p.message }
            : { row: p.row, outcome: "error", message: "Não gravado: outras linhas estão inválidas" },
      );
      summary.created = 0;
      summary.errors = results.filter((r) => r.outcome === "error").length;
    } else {
      try {
        results = await executePlans(kind, plans);
      } catch (err) {
        req.log.error({ err, kind }, "Import execution failed");
        res.status(500).json({
          error: "Falha ao gravar a importação. Nenhuma linha foi gravada.",
        });
        return;
      }
    }

    await db
      .insert(importLogsTable)
      .values({
        clinicId: user.clinicId,
        userId: user.id,
        kind,
        fileName: fileName ?? null,
        fileHash,
        rowCount: rows.length,
        createdCount: summary.created,
        updatedCount: summary.updated,
        skippedCount: summary.skipped,
        errorCount: summary.errors,
        mapping: JSON.stringify(mapping),
      })
      .catch((err) => {
        req.log.error({ err }, "Failed to write import_log");
      });

    res.json(
      schemas.RunImportResponse.parse({
        kind,
        total: rows.length,
        ...summary,
        results,
      }),
    );
  },
);

export default router;
