import { Router, type IRouter } from "express";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  consultationsTable,
  petsTable,
  tutorsTable,
  anamnesesTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { commsBus } from "../comms";

const router: IRouter = Router();

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

router.get("/consultations", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.ListConsultationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const filters = [eq(consultationsTable.clinicId, user.clinicId)];
  if (params.data.from) {
    filters.push(gte(consultationsTable.scheduledAt, new Date(params.data.from)));
  }
  if (params.data.to) {
    filters.push(lte(consultationsTable.scheduledAt, new Date(params.data.to)));
  }
  const rows = await db
    .select({
      id: consultationsTable.id,
      petId: consultationsTable.petId,
      scheduledAt: consultationsTable.scheduledAt,
      status: consultationsTable.status,
      reason: consultationsTable.reason,
      symptoms: consultationsTable.symptoms,
      observations: consultationsTable.observations,
      evolution: consultationsTable.evolution,
      medications: consultationsTable.medications,
      createdAt: consultationsTable.createdAt,
      updatedAt: consultationsTable.updatedAt,
      petName: petsTable.name,
      petSpecies: petsTable.species,
      petExternalId: petsTable.externalId,
      tutorName: tutorsTable.name,
      tutorExternalId: tutorsTable.externalId,
    })
    .from(consultationsTable)
    .innerJoin(petsTable, eq(consultationsTable.petId, petsTable.id))
    .innerJoin(tutorsTable, eq(petsTable.tutorId, tutorsTable.id))
    .where(and(...filters))
    .orderBy(asc(consultationsTable.scheduledAt));

  const q = params.data.q?.trim();
  const filtered = q
    ? (() => {
        const needle = normalizeForSearch(q);
        return rows.filter((r) => {
          const haystack = [
            r.petName,
            r.tutorName,
            r.petExternalId,
            r.tutorExternalId,
          ]
            .filter(Boolean)
            .map((s) => normalizeForSearch(String(s)))
            .join(" \u0001 ");
          return haystack.includes(needle);
        });
      })()
    : rows;
  res.json(schemas.ListConsultationsResponse.parse(filtered));
});

router.post("/consultations", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateConsultationBody.safeParse(req.body);
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
  const [c] = await db
    .insert(consultationsTable)
    .values({ ...parsed.data, clinicId: user.clinicId, createdBy: user.id })
    .returning();
  commsBus.emitEvent({
    type: "consultation.created",
    clinicId: user.clinicId,
    consultationId: c.id,
    petId: c.petId,
    scheduledAt: c.scheduledAt,
  });
  res.status(201).json(c);
});

router.get("/consultations/:consultationId", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.GetConsultationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [c] = await db
    .select()
    .from(consultationsTable)
    .where(
      and(
        eq(consultationsTable.id, params.data.consultationId),
        eq(consultationsTable.clinicId, user.clinicId),
      ),
    );
  if (!c) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }
  const [pet] = await db
    .select()
    .from(petsTable)
    .where(eq(petsTable.id, c.petId));
  const [tutor] = await db
    .select()
    .from(tutorsTable)
    .where(eq(tutorsTable.id, pet.tutorId));
  const [anamnesis] = await db
    .select()
    .from(anamnesesTable)
    .where(eq(anamnesesTable.consultationId, c.id));
  res.json(
    schemas.GetConsultationResponse.parse({
      ...c,
      pet,
      tutor,
      anamnesis: anamnesis ?? null,
    }),
  );
});

router.patch("/consultations/:consultationId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.UpdateConsultationParams.safeParse(req.params);
  const body = schemas.UpdateConsultationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [prev] = await db
    .select({ status: consultationsTable.status })
    .from(consultationsTable)
    .where(
      and(
        eq(consultationsTable.id, params.data.consultationId),
        eq(consultationsTable.clinicId, user.clinicId),
      ),
    );
  const [c] = await db
    .update(consultationsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(
      and(
        eq(consultationsTable.id, params.data.consultationId),
        eq(consultationsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!c) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }
  if (body.data.status === "cancelled" && prev?.status !== "cancelled") {
    commsBus.emitEvent({
      type: "consultation.cancelled",
      clinicId: user.clinicId,
      consultationId: c.id,
      petId: c.petId,
    });
  }
  res.json(schemas.UpdateConsultationResponse.parse(c));
});

router.delete("/consultations/:consultationId", requireRole("admin", "vet"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.DeleteConsultationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [c] = await db
    .delete(consultationsTable)
    .where(
      and(
        eq(consultationsTable.id, params.data.consultationId),
        eq(consultationsTable.clinicId, user.clinicId),
      ),
    )
    .returning();
  if (!c) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }
  if (c.status !== "cancelled") {
    commsBus.emitEvent({
      type: "consultation.cancelled",
      clinicId: user.clinicId,
      consultationId: c.id,
      petId: c.petId,
    });
  }
  res.sendStatus(204);
});

router.get(
  "/consultations/:consultationId/anamnesis",
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const params = schemas.GetAnamnesisParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [a] = await db
      .select()
      .from(anamnesesTable)
      .where(
        and(
          eq(anamnesesTable.consultationId, params.data.consultationId),
          eq(anamnesesTable.clinicId, user.clinicId),
        ),
      );
    if (!a) {
      res.status(404).json({ error: "Anamnesis not found" });
      return;
    }
    res.json(schemas.GetAnamnesisResponse.parse(a));
  },
);

router.put(
  "/consultations/:consultationId/anamnesis",
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const params = schemas.UpsertAnamnesisParams.safeParse(req.params);
    const body = schemas.UpsertAnamnesisBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const [c] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, params.data.consultationId),
          eq(consultationsTable.clinicId, user.clinicId),
        ),
      );
    if (!c) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    const [existing] = await db
      .select()
      .from(anamnesesTable)
      .where(eq(anamnesesTable.consultationId, c.id));
    let row;
    if (existing) {
      [row] = await db
        .update(anamnesesTable)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(anamnesesTable.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(anamnesesTable)
        .values({
          ...body.data,
          consultationId: c.id,
          clinicId: user.clinicId,
          createdBy: user.id,
        })
        .returning();
    }
    res.json(schemas.UpsertAnamnesisResponse.parse(row));
  },
);

export default router;
