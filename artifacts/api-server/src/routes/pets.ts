import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, ilike, max, or, sql } from "drizzle-orm";
import {
  db,
  petsTable,
  tutorsTable,
  consultationsTable,
  examsTable,
  vaccinesTable,
  medicalRecordsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { toDateString } from "../lib/dates";
import { signExamPaths } from "../lib/exam-files";

const router: IRouter = Router();

router.get("/pets", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListPetsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const filters = [eq(petsTable.clinicId, user.clinicId)];
  if (params.data.tutorId) filters.push(eq(petsTable.tutorId, params.data.tutorId));
  if (params.data.species) filters.push(eq(petsTable.species, params.data.species));
  if (params.data.q) {
    const q = params.data.q.trim();
    filters.push(
      or(
        ilike(petsTable.name, `%${q}%`),
        ilike(petsTable.breed, `%${q}%`),
        ilike(tutorsTable.name, `%${q}%`),
      )!,
    );
  }
  const rows = await db
    .select({
      id: petsTable.id,
      tutorId: petsTable.tutorId,
      name: petsTable.name,
      species: petsTable.species,
      breed: petsTable.breed,
      sex: petsTable.sex,
      birthDate: petsTable.birthDate,
      weightKg: petsTable.weightKg,
      neutered: petsTable.neutered,
      allergies: petsTable.allergies,
      continuousMedications: petsTable.continuousMedications,
      isCritical: petsTable.isCritical,
      notes: petsTable.notes,
      photoUrl: petsTable.photoUrl,
      createdAt: petsTable.createdAt,
      updatedAt: petsTable.updatedAt,
      tutorName: tutorsTable.name,
    })
    .from(petsTable)
    .innerJoin(tutorsTable, eq(petsTable.tutorId, tutorsTable.id))
    .where(and(...filters))
    .orderBy(asc(petsTable.name));
  res.json(schemas.ListPetsResponse.parse(rows));
});

router.post("/pets", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreatePetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tutor] = await db
    .select({ id: tutorsTable.id })
    .from(tutorsTable)
    .where(
      and(
        eq(tutorsTable.id, parsed.data.tutorId),
        eq(tutorsTable.clinicId, user.clinicId),
      ),
    );
  if (!tutor) {
    res.status(400).json({ error: "Tutor not found in clinic" });
    return;
  }
  const [pet] = await db
    .insert(petsTable)
    .values({
      ...parsed.data,
      birthDate: toDateString(parsed.data.birthDate) ?? null,
      clinicId: user.clinicId,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(pet);
});

router.get("/pets/:petId", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.GetPetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [pet] = await db
    .select()
    .from(petsTable)
    .where(
      and(eq(petsTable.id, params.data.petId), eq(petsTable.clinicId, user.clinicId)),
    );
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  const [tutor] = await db
    .select()
    .from(tutorsTable)
    .where(eq(tutorsTable.id, pet.tutorId));
  const [stats] = await db
    .select({
      consultationsCount: sql<number>`(select count(*)::int from ${consultationsTable} where ${consultationsTable.petId} = ${pet.id})`,
      examsCount: sql<number>`(select count(*)::int from ${examsTable} where ${examsTable.petId} = ${pet.id})`,
      vaccinesCount: sql<number>`(select count(*)::int from ${vaccinesTable} where ${vaccinesTable.petId} = ${pet.id})`,
      lastVisit: sql<Date | null>`(select max(${consultationsTable.scheduledAt}) from ${consultationsTable} where ${consultationsTable.petId} = ${pet.id})`,
    })
    .from(petsTable)
    .where(eq(petsTable.id, pet.id));
  res.json(schemas.GetPetResponse.parse({ ...pet, tutor, stats }));
});

router.patch("/pets/:petId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.UpdatePetParams.safeParse(req.params);
  const body = schemas.UpdatePetBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [pet] = await db
    .update(petsTable)
    .set({
      ...body.data,
      birthDate: toDateString(body.data.birthDate),
      updatedAt: new Date(),
    })
    .where(
      and(eq(petsTable.id, params.data.petId), eq(petsTable.clinicId, user.clinicId)),
    )
    .returning();
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  res.json(schemas.UpdatePetResponse.parse(pet));
});

router.delete("/pets/:petId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.DeletePetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [pet] = await db
    .delete(petsTable)
    .where(
      and(eq(petsTable.id, params.data.petId), eq(petsTable.clinicId, user.clinicId)),
    )
    .returning();
  if (!pet) {
    res.status(404).json({ error: "Pet not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/pets/:petId/consultations", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListPetConsultationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(consultationsTable)
    .where(
      and(
        eq(consultationsTable.petId, params.data.petId),
        eq(consultationsTable.clinicId, user.clinicId),
      ),
    )
    .orderBy(desc(consultationsTable.scheduledAt));
  res.json(schemas.ListPetConsultationsResponse.parse(rows));
});

router.get("/pets/:petId/exams", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListPetExamsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(examsTable)
    .where(
      and(
        eq(examsTable.petId, params.data.petId),
        eq(examsTable.clinicId, user.clinicId),
      ),
    )
    .orderBy(desc(examsTable.performedAt));
  const signed = await signExamPaths(rows.map((r) => r.filePath));
  const out = rows.map((r, i) => ({ ...r, fileUrl: signed[i] ?? r.fileUrl }));
  res.json(schemas.ListPetExamsResponse.parse(out));
});

router.get("/pets/:petId/vaccines", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListPetVaccinesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(vaccinesTable)
    .where(
      and(
        eq(vaccinesTable.petId, params.data.petId),
        eq(vaccinesTable.clinicId, user.clinicId),
      ),
    )
    .orderBy(desc(vaccinesTable.appliedAt));
  res.json(schemas.ListPetVaccinesResponse.parse(rows));
});

router.post("/pets/:petId/vaccines", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.CreateVaccineParams.safeParse(req.params);
  const body = schemas.CreateVaccineBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
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
  const [vaccine] = await db
    .insert(vaccinesTable)
    .values({
      ...body.data,
      appliedAt: toDateString(body.data.appliedAt)!,
      nextDueAt: toDateString(body.data.nextDueAt) ?? null,
      petId: pet.id,
      clinicId: user.clinicId,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(vaccine);
});

router.get("/pets/:petId/medical-records", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListMedicalRecordsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(medicalRecordsTable)
    .where(
      and(
        eq(medicalRecordsTable.petId, params.data.petId),
        eq(medicalRecordsTable.clinicId, user.clinicId),
      ),
    )
    .orderBy(desc(medicalRecordsTable.createdAt));
  res.json(schemas.ListMedicalRecordsResponse.parse(rows));
});

router.post("/pets/:petId/medical-records", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.CreateMedicalRecordParams.safeParse(req.params);
  const body = schemas.CreateMedicalRecordBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
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
  const [record] = await db
    .insert(medicalRecordsTable)
    .values({
      ...body.data,
      petId: pet.id,
      clinicId: user.clinicId,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(record);
});

export default router;
