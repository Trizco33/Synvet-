import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, examsTable, petsTable, tutorsTable, consultationsTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { toDateString } from "../lib/dates";
import { signExamPath, signExamPaths } from "../lib/exam-files";

const router: IRouter = Router();

router.get("/exams", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListExamsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const filters = [eq(examsTable.clinicId, user.clinicId)];
  if (params.data.petId) filters.push(eq(examsTable.petId, params.data.petId));
  if (params.data.category) filters.push(eq(examsTable.category, params.data.category));
  const rows = await db
    .select({
      id: examsTable.id,
      petId: examsTable.petId,
      consultationId: examsTable.consultationId,
      title: examsTable.title,
      category: examsTable.category,
      status: examsTable.status,
      filePath: examsTable.filePath,
      fileUrl: examsTable.fileUrl,
      fileType: examsTable.fileType,
      fileSize: examsTable.fileSize,
      notes: examsTable.notes,
      performedAt: examsTable.performedAt,
      createdAt: examsTable.createdAt,
      updatedAt: examsTable.updatedAt,
      petName: petsTable.name,
      tutorName: tutorsTable.name,
    })
    .from(examsTable)
    .innerJoin(petsTable, eq(examsTable.petId, petsTable.id))
    .innerJoin(tutorsTable, eq(petsTable.tutorId, tutorsTable.id))
    .where(and(...filters))
    .orderBy(desc(examsTable.performedAt));
  // Re-assina cada filePath sob demanda (TTL 1h). Mantém fileUrl legado se não houver path.
  const signed = await signExamPaths(rows.map((r) => r.filePath));
  const out = rows.map((r, i) => ({ ...r, fileUrl: signed[i] ?? r.fileUrl }));
  res.json(schemas.ListExamsResponse.parse(out));
});

router.post("/exams", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [pet] = await db
    .select({ id: petsTable.id })
    .from(petsTable)
    .where(
      and(eq(petsTable.id, parsed.data.petId), eq(petsTable.clinicId, user.clinicId)),
    );
  if (!pet) {
    res.status(400).json({ error: "Pet not found in clinic" });
    return;
  }
  if (parsed.data.consultationId) {
    const [c] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, parsed.data.consultationId),
          eq(consultationsTable.clinicId, user.clinicId),
        ),
      );
    if (!c) {
      res.status(400).json({ error: "Consultation not found in clinic" });
      return;
    }
  }
  // Tenancy guard no filePath: precisa começar com <clinicId>/
  if (parsed.data.filePath && !parsed.data.filePath.startsWith(`${user.clinicId}/`)) {
    res.status(403).json({ error: "filePath fora da clínica" });
    return;
  }
  const [exam] = await db
    .insert(examsTable)
    .values({
      ...parsed.data,
      performedAt: toDateString(parsed.data.performedAt)!,
      clinicId: user.clinicId,
      createdBy: user.id,
    })
    .returning();
  // Re-assina filePath na resposta para o frontend exibir imediatamente.
  const fileUrl = (await signExamPath(exam.filePath)) ?? exam.fileUrl;
  res.status(201).json({ ...exam, fileUrl });
});

router.delete("/exams/:examId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.DeleteExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [exam] = await db
    .delete(examsTable)
    .where(
      and(
        eq(examsTable.id, params.data.examId),
        eq(examsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
