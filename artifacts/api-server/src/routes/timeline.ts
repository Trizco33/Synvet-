import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  petsTable,
  consultationsTable,
  examsTable,
  vaccinesTable,
  medicalRecordsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { signExamPaths } from "../lib/exam-files";

const router: IRouter = Router();

type Severity = "info" | "warning" | "critical";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "agendada",
  in_progress: "em andamento",
  completed: "concluída",
  cancelled: "cancelada",
  pending: "pendente",
};

router.get("/pets/:petId/timeline", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.GetPetTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [pet] = await db
    .select({ id: petsTable.id })
    .from(petsTable)
    .where(
      and(eq(petsTable.id, params.data.petId), eq(petsTable.clinicId, user.clinicId)),
    );
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }

  const [consults, exams, vaccines, records] = await Promise.all([
    db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.petId, pet.id),
          eq(consultationsTable.clinicId, user.clinicId),
        ),
      ),
    db
      .select()
      .from(examsTable)
      .where(
        and(eq(examsTable.petId, pet.id), eq(examsTable.clinicId, user.clinicId)),
      ),
    db
      .select()
      .from(vaccinesTable)
      .where(
        and(eq(vaccinesTable.petId, pet.id), eq(vaccinesTable.clinicId, user.clinicId)),
      ),
    db
      .select()
      .from(medicalRecordsTable)
      .where(
        and(
          eq(medicalRecordsTable.petId, pet.id),
          eq(medicalRecordsTable.clinicId, user.clinicId),
        ),
      ),
  ]);

  const events: Array<{
    id: string;
    type: "consultation" | "exam" | "vaccine" | "record";
    date: string;
    title: string;
    description: string | null;
    status: string | null;
    category: string | null;
    severity: Severity | null;
    sourceUrl: string | null;
  }> = [];

  for (const c of consults) {
    const sev: Severity =
      c.status === "cancelled" ? "warning" : c.status === "in_progress" ? "info" : "info";
    events.push({
      id: c.id,
      type: "consultation",
      date: c.scheduledAt.toISOString(),
      title: c.reason?.trim() || `Consulta ${STATUS_LABEL[c.status] ?? c.status}`,
      description: c.observations || c.symptoms || null,
      status: c.status,
      category: null,
      severity: sev,
      sourceUrl: `/consultas/${c.id}`,
    });
  }

  const examUrls = await signExamPaths(exams.map((e) => e.filePath));
  exams.forEach((e, i) => {
    events.push({
      id: e.id,
      type: "exam",
      date: new Date(e.performedAt).toISOString(),
      title: e.title,
      description: e.notes || null,
      status: e.status,
      category: e.category,
      severity: e.status === "pending" ? "warning" : "info",
      sourceUrl: examUrls[i] ?? e.fileUrl ?? null,
    });
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const v of vaccines) {
    const due = v.nextDueAt ? new Date(v.nextDueAt) : null;
    const overdue = due && due < today;
    events.push({
      id: v.id,
      type: "vaccine",
      date: new Date(v.appliedAt).toISOString(),
      title: `Vacina: ${v.name}`,
      description: v.nextDueAt
        ? `Próxima dose: ${v.nextDueAt}${overdue ? " (atrasada)" : ""}`
        : v.notes || null,
      status: null,
      category: null,
      severity: overdue ? "critical" : "info",
      sourceUrl: null,
    });
  }

  for (const r of records) {
    events.push({
      id: r.id,
      type: "record",
      date: r.createdAt.toISOString(),
      title: r.title,
      description: r.content.length > 240 ? r.content.slice(0, 237) + "..." : r.content,
      status: null,
      category: r.sourceType,
      severity: "info",
      sourceUrl: null,
    });
  }

  events.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  res.json(schemas.GetPetTimelineResponse.parse(events));
});

export default router;
