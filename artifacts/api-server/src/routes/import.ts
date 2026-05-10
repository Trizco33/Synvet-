import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
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
// Importadores por tipo.
// =============================================================
type RowResult = {
  row: number;
  outcome: "created" | "updated" | "skipped" | "error";
  message?: string;
  id?: string;
};

async function importTutors(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<RowResult[]> {
  // Pré-carrega tutores existentes da clínica (email / phone) para dedupe.
  const existing = await db
    .select({
      id: tutorsTable.id,
      email: tutorsTable.email,
      phone: tutorsTable.phone,
    })
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

  const results: RowResult[] = [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const name = strOrNull(r.name);
      const email = normEmail(r.email);
      const phone = normPhone(r.phone);
      const whatsapp = normPhone(r.whatsapp) ?? phone;
      const address = strOrNull(r.address);
      if (!name) {
        results.push({ row: rowNum, outcome: "error", message: "Nome obrigatório" });
        continue;
      }
      if (!email && !phone) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Informe e-mail ou telefone",
        });
        continue;
      }
      const dupId = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
      if (dupId) {
        results.push({
          row: rowNum,
          outcome: "skipped",
          message: "Tutor já existe (dedupe por e-mail/telefone)",
          id: dupId,
        });
        continue;
      }
      const [created] = await tx
        .insert(tutorsTable)
        .values({
          clinicId,
          createdBy: userId,
          name,
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
          whatsapp: r.whatsapp?.trim() || r.phone?.trim() || null,
          address,
        })
        .returning({ id: tutorsTable.id });
      if (email) byEmail.set(email, created.id);
      if (phone) byPhone.set(phone, created.id);
      results.push({ row: rowNum, outcome: "created", id: created.id });
    }
  });
  return results;
}

async function importPets(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<RowResult[]> {
  // Pré-carrega tutores (para resolver tutorEmail/tutorPhone) e pets existentes
  // (para dedupe por (tutorId, name)).
  const tutors = await db
    .select({
      id: tutorsTable.id,
      email: tutorsTable.email,
      phone: tutorsTable.phone,
    })
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
    .select({ id: petsTable.id, tutorId: petsTable.tutorId, name: petsTable.name })
    .from(petsTable)
    .where(eq(petsTable.clinicId, clinicId));
  const petKey = (tutorId: string, name: string) =>
    `${tutorId}::${name.trim().toLowerCase()}`;
  const petByKey = new Map<string, string>();
  for (const p of existingPets) {
    petByKey.set(petKey(p.tutorId, p.name), p.id);
  }

  const SEX = new Set(["male", "female", "unknown"]);

  const results: RowResult[] = [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const name = strOrNull(r.name);
      const species = strOrNull(r.species)?.toLowerCase() ?? null;
      if (!name) {
        results.push({ row: rowNum, outcome: "error", message: "Nome obrigatório" });
        continue;
      }
      if (!species) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Espécie obrigatória (ex.: dog, cat)",
        });
        continue;
      }
      const tutorEmail = normEmail(r.tutorEmail);
      const tutorPhone = normPhone(r.tutorPhone);
      const tutorId =
        (tutorEmail && tutorByEmail.get(tutorEmail)) ||
        (tutorPhone && tutorByPhone.get(tutorPhone)) ||
        null;
      if (!tutorId) {
        results.push({
          row: rowNum,
          outcome: "error",
          message:
            "Tutor não encontrado. Importe os tutores primeiro ou informe e-mail/telefone existente.",
        });
        continue;
      }
      const dupId = petByKey.get(petKey(tutorId, name));
      if (dupId) {
        results.push({
          row: rowNum,
          outcome: "skipped",
          message: "Pet já cadastrado para este tutor",
          id: dupId,
        });
        continue;
      }
      let sex: "male" | "female" | "unknown" = "unknown";
      const sexRaw = strOrNull(r.sex)?.toLowerCase();
      if (sexRaw && SEX.has(sexRaw)) sex = sexRaw as typeof sex;
      const weightStr = strOrNull(r.weightKg);
      let weightKg: number | null = null;
      if (weightStr) {
        const parsed = Number(weightStr.replace(",", "."));
        weightKg = Number.isFinite(parsed) ? parsed : null;
      }
      const birthDate = strOrNull(r.birthDate);
      const breed = strOrNull(r.breed);
      const notes = strOrNull(r.notes);
      const [created] = await tx
        .insert(petsTable)
        .values({
          clinicId,
          tutorId,
          createdBy: userId,
          name,
          species,
          breed,
          sex,
          birthDate,
          weightKg,
          notes,
        })
        .returning({ id: petsTable.id });
      petByKey.set(petKey(tutorId, name), created.id);
      results.push({ row: rowNum, outcome: "created", id: created.id });
    }
  });
  return results;
}

async function importAppointments(
  clinicId: string,
  userId: string,
  rows: Array<Record<string, string | null>>,
): Promise<RowResult[]> {
  const tutors = await db
    .select({
      id: tutorsTable.id,
      email: tutorsTable.email,
      phone: tutorsTable.phone,
    })
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

  const STATUS = new Set(["scheduled", "in_progress", "completed", "cancelled"]);
  const results: RowResult[] = [];

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const scheduledRaw = strOrNull(r.scheduledAt);
      const petName = strOrNull(r.petName);
      const tutorEmail = normEmail(r.tutorEmail);
      const tutorPhone = normPhone(r.tutorPhone);
      if (!scheduledRaw) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Data/hora obrigatória (ISO 8601: YYYY-MM-DDThh:mm:ssZ)",
        });
        continue;
      }
      const scheduled = new Date(scheduledRaw);
      if (Number.isNaN(scheduled.getTime())) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Data inválida — use ISO 8601 (ex.: 2026-05-20T14:30:00-03:00)",
        });
        continue;
      }
      if (!petName) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Nome do pet obrigatório",
        });
        continue;
      }
      const tutorId =
        (tutorEmail && tutorByEmail.get(tutorEmail)) ||
        (tutorPhone && tutorByPhone.get(tutorPhone)) ||
        null;
      if (!tutorId) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Tutor não encontrado (e-mail/telefone)",
        });
        continue;
      }
      const petId = petByKey.get(`${tutorId}::${petName.trim().toLowerCase()}`);
      if (!petId) {
        results.push({
          row: rowNum,
          outcome: "error",
          message: "Pet não encontrado para este tutor",
        });
        continue;
      }
      let status: "scheduled" | "in_progress" | "completed" | "cancelled" =
        "scheduled";
      const statusRaw = strOrNull(r.status)?.toLowerCase();
      if (statusRaw && STATUS.has(statusRaw)) status = statusRaw as typeof status;
      const reason = strOrNull(r.reason);
      const [created] = await tx
        .insert(consultationsTable)
        .values({
          clinicId,
          createdBy: userId,
          petId,
          scheduledAt: scheduled,
          status,
          reason,
        })
        .returning({ id: consultationsTable.id });
      results.push({ row: rowNum, outcome: "created", id: created.id });
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

    // Idempotência: bloqueia reimportação do mesmo arquivo (mesmo hash) por
    // clínica+tipo. Devolve 409 com a contagem do relatório anterior.
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

    let results: RowResult[];
    try {
      if (kind === "tutors") {
        results = await importTutors(user.clinicId, user.id, mappedRows);
      } else if (kind === "pets") {
        results = await importPets(user.clinicId, user.id, mappedRows);
      } else {
        results = await importAppointments(user.clinicId, user.id, mappedRows);
      }
    } catch (err) {
      req.log.error({ err, kind }, "Import transaction failed");
      res.status(500).json({
        error:
          "Falha ao processar a importação. Nenhuma linha foi gravada — corrija o arquivo e tente novamente.",
      });
      return;
    }

    const summary = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
    for (const r of results) {
      if (r.outcome === "created") summary.created++;
      else if (r.outcome === "updated") summary.updated++;
      else if (r.outcome === "skipped") summary.skipped++;
      else summary.errors++;
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
