import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  db,
  petsTable,
  tutorsTable,
  consultationsTable,
  examsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = startOfMonth(new Date());

  const [{ totalPatients }] = await db
    .select({ totalPatients: count() })
    .from(petsTable)
    .where(eq(petsTable.clinicId, user.clinicId));

  const [{ consultationsToday }] = await db
    .select({ consultationsToday: count() })
    .from(consultationsTable)
    .where(
      and(
        eq(consultationsTable.clinicId, user.clinicId),
        gte(consultationsTable.scheduledAt, today),
        lt(consultationsTable.scheduledAt, tomorrow),
      ),
    );

  const [{ pendingExams }] = await db
    .select({ pendingExams: count() })
    .from(examsTable)
    .where(
      and(eq(examsTable.clinicId, user.clinicId), eq(examsTable.status, "pending")),
    );

  const [{ newPatientsThisMonth }] = await db
    .select({ newPatientsThisMonth: count() })
    .from(petsTable)
    .where(
      and(eq(petsTable.clinicId, user.clinicId), gte(petsTable.createdAt, monthStart)),
    );

  res.json(
    schemas.GetDashboardSummaryResponse.parse({
      totalPatients,
      consultationsToday,
      pendingExams,
      newPatientsThisMonth,
    }),
  );
});

router.get("/dashboard/today-schedule", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await db
    .select({
      id: consultationsTable.id,
      scheduledAt: consultationsTable.scheduledAt,
      status: consultationsTable.status,
      reason: consultationsTable.reason,
      petId: petsTable.id,
      petName: petsTable.name,
      petSpecies: petsTable.species,
      petExternalId: petsTable.externalId,
      tutorName: tutorsTable.name,
      tutorExternalId: tutorsTable.externalId,
    })
    .from(consultationsTable)
    .innerJoin(petsTable, eq(consultationsTable.petId, petsTable.id))
    .innerJoin(tutorsTable, eq(petsTable.tutorId, tutorsTable.id))
    .where(
      and(
        eq(consultationsTable.clinicId, user.clinicId),
        gte(consultationsTable.scheduledAt, today),
        lt(consultationsTable.scheduledAt, tomorrow),
      ),
    )
    .orderBy(asc(consultationsTable.scheduledAt));

  res.json(schemas.GetTodayScheduleResponse.parse(rows));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const recentConsults = await db
    .select({
      id: consultationsTable.id,
      type: sql<"consultation">`'consultation'`,
      title: sql<string>`'Consulta ' || ${consultationsTable.status}`,
      description: consultationsTable.reason,
      petId: consultationsTable.petId,
      petName: petsTable.name,
      timestamp: consultationsTable.createdAt,
    })
    .from(consultationsTable)
    .innerJoin(petsTable, eq(consultationsTable.petId, petsTable.id))
    .where(eq(consultationsTable.clinicId, user.clinicId))
    .orderBy(desc(consultationsTable.createdAt))
    .limit(8);

  const recentExams = await db
    .select({
      id: examsTable.id,
      type: sql<"exam">`'exam'`,
      title: examsTable.title,
      description: examsTable.category,
      petId: examsTable.petId,
      petName: petsTable.name,
      timestamp: examsTable.createdAt,
    })
    .from(examsTable)
    .innerJoin(petsTable, eq(examsTable.petId, petsTable.id))
    .where(eq(examsTable.clinicId, user.clinicId))
    .orderBy(desc(examsTable.createdAt))
    .limit(8);

  const recentPets = await db
    .select({
      id: petsTable.id,
      type: sql<"pet_created">`'pet_created'`,
      title: sql<string>`'Novo paciente: ' || ${petsTable.name}`,
      description: petsTable.species,
      petId: petsTable.id,
      petName: petsTable.name,
      timestamp: petsTable.createdAt,
    })
    .from(petsTable)
    .where(eq(petsTable.clinicId, user.clinicId))
    .orderBy(desc(petsTable.createdAt))
    .limit(8);

  const all = [...recentConsults, ...recentExams, ...recentPets]
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 12);

  res.json(schemas.GetRecentActivityResponse.parse(all));
});

export default router;
