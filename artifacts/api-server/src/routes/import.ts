import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  tutorsTable,
  petsTable,
  consultationsTable,
  importLogsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

type Kind = "tutors" | "pets" | "appointments";

const KINDS: readonly Kind[] = ["tutors", "pets", "appointments"];

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
    headers: ["name", "email", "phone", "whatsapp", "address"],
    example: [
      "Maria Silva",
      "maria@exemplo.com",
      "+55 11 99999-0001",
      "+55 11 99999-0001",
      "Rua das Flores, 123 — São Paulo/SP",
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

// =============================================================
// Planejamento (pass 1) — valida + resolve refs SEM gravar.
// =============================================================
type Plan =
  | { row: number; outcome: "created"; insert: Record<string, unknown>; refKey?: string }
  | { row: number; outcome: "skipped"; message: string; id: string }
  | { row: number; outcome: "error"; message: string };

async function planTutors(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<Plan[]> {
  const existing = await db
    .select({ id: tutorsTable.id, email: tutorsTable.email, phone: tutorsTable.phone })
    .from(tutorsTable)
    .where(eq(tutorsTable.clinicId, clinicId));
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const t of existing) {
    const e = normEmail(t.email);
    if (e) byEmail.set(e, t.id);
    const p = normPhone(t.phone);
    if (p) byPhone.set(p, t.id);
  }

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
    const dupId = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
    if (dupId) {
      plans.push({
        row: rowNum,
        outcome: "skipped",
        message: "Tutor já existe (dedupe por e-mail/telefone)",
        id: dupId,
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
      },
      refKey: email ?? phone ?? `row-${rowNum}`,
    });
    // Reserva chave dentro do batch (linhas seguintes com mesmo email/phone
    // viram skipped).
    if (email) byEmail.set(email, "__pending__");
    if (phone) byPhone.set(phone, "__pending__");
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
      refKey: d.externalId ?? dupKey,
    });
    petByKey.set(dupKey, "__pending__");
    if (d.externalId) petByExternalId.set(d.externalId, "__pending__");
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
      ? { row: p.row, outcome: "skipped", message: p.message, id: p.id }
      : p.outcome === "error"
        ? { row: p.row, outcome: "error", message: p.message }
        : { row: p.row, outcome: "created" },
  );

  const toCreate = plans.filter(
    (p): p is Extract<Plan, { outcome: "created" }> => p.outcome === "created",
  );
  if (toCreate.length === 0) return results;

  const table =
    kind === "tutors" ? tutorsTable : kind === "pets" ? petsTable : consultationsTable;

  await db.transaction(async (tx) => {
    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const slice = toCreate.slice(i, i + CHUNK_SIZE);
      const inserted = await tx
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(table as any)
        .values(slice.map((p) => p.insert))
        .returning({ id: (table as { id: typeof tutorsTable.id }).id });
      for (let j = 0; j < slice.length; j++) {
        const planRow = slice[j]!.row;
        const idx = results.findIndex((r) => r.row === planRow);
        if (idx >= 0) results[idx]!.id = inserted[j]?.id;
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

    // Aplica o mapping de cada linha (csvColumn → synvetField).
    const mappedRows = rows.map((r: Record<string, string>) =>
      applyMapping(r as Record<string, string | null>, mapping),
    );

    // Pass 1 — valida + resolve refs sem gravar nada.
    let plans: Plan[];
    try {
      if (kind === "tutors") plans = await planTutors(user.clinicId, user.id, mappedRows);
      else if (kind === "pets") plans = await planPets(user.clinicId, user.id, mappedRows);
      else plans = await planAppointments(user.clinicId, user.id, mappedRows);
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
          ? { row: p.row, outcome: "skipped", message: p.message, id: p.id }
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
