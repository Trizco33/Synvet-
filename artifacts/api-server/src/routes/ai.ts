import { Router, type IRouter, type Request } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import {
  db,
  petsTable,
  consultationsTable,
  anamnesesTable,
  examsTable,
  vaccinesTable,
  medicalRecordsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  summarizeConsultation,
  organizeClinicalText,
  summarizeTimeline,
  detectClinicalPatterns,
} from "../ai/service";

const router: IRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.user.id ?? req.ip ?? "anon",
  message: { error: "Limite de uso da IA atingido. Aguarde alguns segundos." },
});

router.use("/ai", aiLimiter, requireRole("admin", "vet"));

function ageYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Number((ms / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));
}

async function loadPetForClinic(petId: string, clinicId: string) {
  const [pet] = await db
    .select()
    .from(petsTable)
    .where(and(eq(petsTable.id, petId), eq(petsTable.clinicId, clinicId)));
  return pet ?? null;
}

router.post(
  "/ai/consultations/:consultationId/summary",
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const params = schemas.AiSummarizeConsultationParams.safeParse(
      req.params,
    );
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    try {
      const [consultation] = await db
        .select()
        .from(consultationsTable)
        .where(
          and(
            eq(consultationsTable.id, params.data.consultationId),
            eq(consultationsTable.clinicId, user.clinicId),
          ),
        );
      if (!consultation) {
        res.status(404).json({ error: "Consulta não encontrada" });
        return;
      }
      const pet = await loadPetForClinic(consultation.petId, user.clinicId);
      if (!pet) {
        res.status(404).json({ error: "Paciente não encontrado" });
        return;
      }
      const [anamnesis] = await db
        .select()
        .from(anamnesesTable)
        .where(eq(anamnesesTable.consultationId, consultation.id));
      const result = await summarizeConsultation(
        {
          pet: {
            species: pet.species,
            breed: pet.breed,
            sex: pet.sex,
            ageYears: ageYears(pet.birthDate),
            weightKg: pet.weightKg,
            isCritical: pet.isCritical,
            allergies: pet.allergies,
            continuousMedications: pet.continuousMedications,
            notes: pet.notes,
          },
          consultation: {
            scheduledAt: consultation.scheduledAt.toISOString(),
            status: consultation.status,
            reason: consultation.reason,
            symptoms: consultation.symptoms,
            observations: consultation.observations,
            evolution: consultation.evolution,
            medications: consultation.medications,
          },
          anamnesis: anamnesis ?? null,
        },
        { requestId: req.id?.toString() },
      );
      res.json(schemas.AiSummarizeConsultationResponse.parse(result));
    } catch (err) {
      req.log.error({ err }, "ai.summarizeConsultation failed");
      const status = (err as { statusCode?: number }).statusCode ?? 502;
      res.status(status).json({ error: "Falha ao gerar resumo. Tente novamente." });
    }
  },
);

router.post("/ai/organize-text", async (req, res): Promise<void> => {
  const body = schemas.AiOrganizeTextBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    const ctx = body.data.petContext;
    const result = await organizeClinicalText(
      {
        rawText: body.data.rawText,
        petContext: ctx
          ? {
              species: ctx.species,
              breed: ctx.breed ?? null,
              ageYears: ctx.ageYears ?? null,
            }
          : null,
      },
      { requestId: req.id?.toString() },
    );
    res.json(schemas.AiOrganizeTextResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "ai.organizeText failed");
    const status = (err as { statusCode?: number }).statusCode ?? 502;
    res.status(status).json({ error: "Falha ao organizar texto. Tente novamente." });
  }
});

async function buildPetTimelineForAI(petId: string, clinicId: string) {
  const pet = await loadPetForClinic(petId, clinicId);
  if (!pet) return null;
  const [consults, exams, vaccines, records] = await Promise.all([
    db
      .select()
      .from(consultationsTable)
      .where(
        and(eq(consultationsTable.petId, pet.id), eq(consultationsTable.clinicId, clinicId)),
      ),
    db
      .select()
      .from(examsTable)
      .where(and(eq(examsTable.petId, pet.id), eq(examsTable.clinicId, clinicId))),
    db
      .select()
      .from(vaccinesTable)
      .where(and(eq(vaccinesTable.petId, pet.id), eq(vaccinesTable.clinicId, clinicId))),
    db
      .select()
      .from(medicalRecordsTable)
      .where(
        and(eq(medicalRecordsTable.petId, pet.id), eq(medicalRecordsTable.clinicId, clinicId)),
      ),
  ]);
  const events: Array<{
    type: "consultation" | "exam" | "vaccine" | "record";
    date: string;
    title: string;
    description: string | null;
    status: string | null;
    category: string | null;
  }> = [];
  for (const c of consults) {
    events.push({
      type: "consultation",
      date: c.scheduledAt.toISOString(),
      title: c.reason?.trim() || `Consulta ${c.status}`,
      description: c.observations || c.symptoms || null,
      status: c.status,
      category: null,
    });
  }
  for (const e of exams) {
    events.push({
      type: "exam",
      date: new Date(e.performedAt).toISOString(),
      title: e.title,
      description: e.notes || null,
      status: e.status,
      category: e.category,
    });
  }
  for (const v of vaccines) {
    events.push({
      type: "vaccine",
      date: new Date(v.appliedAt).toISOString(),
      title: `Vacina: ${v.name}`,
      description: v.nextDueAt ? `Próxima dose: ${v.nextDueAt}` : v.notes || null,
      status: null,
      category: null,
    });
  }
  for (const r of records) {
    events.push({
      type: "record",
      date: r.createdAt.toISOString(),
      title: r.title,
      description: r.content.length > 400 ? r.content.slice(0, 400) + "…" : r.content,
      status: null,
      category: r.sourceType,
    });
  }
  events.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return {
    pet: {
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      ageYears: ageYears(pet.birthDate),
      isCritical: pet.isCritical,
      allergies: pet.allergies,
      continuousMedications: pet.continuousMedications,
    },
    events,
  };
}

router.post("/ai/pets/:petId/timeline-summary", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.AiSummarizePetTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const data = await buildPetTimelineForAI(params.data.petId, user.clinicId);
    if (!data) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    if (data.events.length === 0) {
      res.status(400).json({ error: "Sem eventos suficientes na timeline" });
      return;
    }
    const result = await summarizeTimeline(data, { requestId: req.id?.toString() });
    res.json(schemas.AiSummarizePetTimelineResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "ai.summarizeTimeline failed");
    const status = (err as { statusCode?: number }).statusCode ?? 502;
    res.status(status).json({ error: "Falha ao resumir timeline. Tente novamente." });
  }
});

router.post("/ai/pets/:petId/clinical-patterns", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const params = schemas.AiDetectClinicalPatternsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const data = await buildPetTimelineForAI(params.data.petId, user.clinicId);
    if (!data) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    if (data.events.length === 0) {
      res.status(400).json({ error: "Sem eventos suficientes na timeline" });
      return;
    }
    const result = await detectClinicalPatterns(data, { requestId: req.id?.toString() });
    res.json(schemas.AiDetectClinicalPatternsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "ai.detectPatterns failed");
    const status = (err as { statusCode?: number }).statusCode ?? 502;
    res.status(status).json({ error: "Falha ao detectar padrões. Tente novamente." });
  }
});

export default router;
