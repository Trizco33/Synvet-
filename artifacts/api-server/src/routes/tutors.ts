import { Router, type IRouter } from "express";
import { and, eq, ilike, or, asc } from "drizzle-orm";
import { db, tutorsTable, petsTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tutors", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListTutorsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const q = params.data.q?.trim();
  const where = q
    ? and(
        eq(tutorsTable.clinicId, user.clinicId),
        or(
          ilike(tutorsTable.name, `%${q}%`),
          ilike(tutorsTable.email, `%${q}%`),
          ilike(tutorsTable.phone, `%${q}%`),
        ),
      )
    : eq(tutorsTable.clinicId, user.clinicId);
  const rows = await db
    .select()
    .from(tutorsTable)
    .where(where)
    .orderBy(asc(tutorsTable.name));
  res.json(schemas.ListTutorsResponse.parse(rows));
});

router.post("/tutors", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateTutorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tutor] = await db
    .insert(tutorsTable)
    .values({ ...parsed.data, clinicId: user.clinicId })
    .returning();
  res.status(201).json(tutor);
});

router.get("/tutors/:tutorId", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.GetTutorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tutor] = await db
    .select()
    .from(tutorsTable)
    .where(
      and(
        eq(tutorsTable.id, params.data.tutorId),
        eq(tutorsTable.clinicId, user.clinicId),
      ),
    );
  if (!tutor) {
    res.status(404).json({ error: "Tutor not found" });
    return;
  }
  const pets = await db
    .select()
    .from(petsTable)
    .where(eq(petsTable.tutorId, tutor.id))
    .orderBy(asc(petsTable.name));
  res.json(schemas.GetTutorResponse.parse({ ...tutor, pets }));
});

router.patch("/tutors/:tutorId", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.UpdateTutorParams.safeParse(req.params);
  const body = schemas.UpdateTutorBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [tutor] = await db
    .update(tutorsTable)
    .set(body.data)
    .where(
      and(
        eq(tutorsTable.id, params.data.tutorId),
        eq(tutorsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!tutor) {
    res.status(404).json({ error: "Tutor not found" });
    return;
  }
  res.json(schemas.UpdateTutorResponse.parse(tutor));
});

router.delete("/tutors/:tutorId", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.DeleteTutorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tutor] = await db
    .delete(tutorsTable)
    .where(
      and(
        eq(tutorsTable.id, params.data.tutorId),
        eq(tutorsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!tutor) {
    res.status(404).json({ error: "Tutor not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
