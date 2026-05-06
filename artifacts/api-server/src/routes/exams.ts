import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, examsTable, petsTable, tutorsTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { toDateString } from "../lib/dates";

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
      title: examsTable.title,
      category: examsTable.category,
      status: examsTable.status,
      fileUrl: examsTable.fileUrl,
      fileType: examsTable.fileType,
      notes: examsTable.notes,
      performedAt: examsTable.performedAt,
      createdAt: examsTable.createdAt,
      petName: petsTable.name,
      tutorName: tutorsTable.name,
    })
    .from(examsTable)
    .innerJoin(petsTable, eq(examsTable.petId, petsTable.id))
    .innerJoin(tutorsTable, eq(petsTable.tutorId, tutorsTable.id))
    .where(and(...filters))
    .orderBy(desc(examsTable.performedAt));
  res.json(schemas.ListExamsResponse.parse(rows));
});

router.post("/exams", async (req, res): Promise<void> => {
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
  const [exam] = await db
    .insert(examsTable)
    .values({
      ...parsed.data,
      performedAt: toDateString(parsed.data.performedAt)!,
      clinicId: user.clinicId,
    })
    .returning();
  res.status(201).json(exam);
});

router.delete("/exams/:examId", async (req, res): Promise<void> => {
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
