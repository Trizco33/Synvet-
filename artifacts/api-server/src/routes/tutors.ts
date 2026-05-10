import { Router, type IRouter } from "express";
import { and, eq, asc } from "drizzle-orm";
import { db, tutorsTable, petsTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function normalizeExternalId(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

router.get("/tutors", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListTutorsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(tutorsTable)
    .where(eq(tutorsTable.clinicId, user.clinicId))
    .orderBy(asc(tutorsTable.name));
  const q = params.data.q?.trim();
  const filtered = q
    ? (() => {
        const needle = normalizeForSearch(q);
        return rows.filter((r) => {
          const haystack = [r.name, r.email, r.phone, r.whatsapp, r.externalId]
            .filter(Boolean)
            .map((s) => normalizeForSearch(String(s)))
            .join(" \u0001 ");
          return haystack.includes(needle);
        });
      })()
    : rows;
  res.json(schemas.ListTutorsResponse.parse(filtered));
});

router.post("/tutors", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateTutorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { externalId: rawExternalId, ...rest } = parsed.data;
  const values: Record<string, unknown> = {
    ...rest,
    clinicId: user.clinicId,
    createdBy: user.id,
  };
  if (rawExternalId !== undefined) {
    if (user.role !== "admin") {
      res.status(403).json({ error: "Apenas administradores podem definir o ID do sistema antigo." });
      return;
    }
    values.externalId = normalizeExternalId(rawExternalId);
  }
  try {
    const [tutor] = await db.insert(tutorsTable).values(values as typeof tutorsTable.$inferInsert).returning();
    res.status(201).json(tutor);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res
        .status(409)
        .json({ error: "Já existe um tutor com esse ID do sistema antigo nesta clínica." });
      return;
    }
    throw err;
  }
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

router.patch("/tutors/:tutorId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.UpdateTutorParams.safeParse(req.params);
  const body = schemas.UpdateTutorBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { externalId: rawExternalId, ...rest } = body.data;
  const updateValues: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (rawExternalId !== undefined) {
    if (user.role !== "admin") {
      res.status(403).json({ error: "Apenas administradores podem alterar o ID do sistema antigo." });
      return;
    }
    updateValues.externalId = normalizeExternalId(rawExternalId);
  }
  try {
    const [tutor] = await db
      .update(tutorsTable)
      .set(updateValues)
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
  } catch (err) {
    if (isUniqueViolation(err)) {
      res
        .status(409)
        .json({ error: "Já existe um tutor com esse ID do sistema antigo nesta clínica." });
      return;
    }
    throw err;
  }
});

router.delete("/tutors/:tutorId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
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
