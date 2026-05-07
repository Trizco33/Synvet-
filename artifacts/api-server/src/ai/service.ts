import { getAIProvider } from "./provider";
import {
  SYSTEM_BASE,
  DISCLAIMER,
  PROMPT_VERSION,
  summarizeConsultationPrompt,
  organizeTextPrompt,
  summarizeTimelinePrompt,
  detectPatternsPrompt,
  type SummarizeConsultationInput,
  type OrganizeTextInput,
  type SummarizeTimelineInput,
} from "./prompts/v1";
import { sanitize, clip } from "./sanitize";

export interface AIResult {
  content: string;
  disclaimer: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  tokens: { prompt: number; completion: number; total: number };
  estimatedCostUsd: number;
}

function buildResult(
  raw: { content: string; model: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; durationMs: number; estimatedCostUsd: number },
): AIResult {
  return {
    content: raw.content,
    disclaimer: DISCLAIMER,
    model: raw.model,
    promptVersion: PROMPT_VERSION,
    durationMs: raw.durationMs,
    tokens: { prompt: raw.usage.promptTokens, completion: raw.usage.completionTokens, total: raw.usage.totalTokens },
    estimatedCostUsd: raw.estimatedCostUsd,
  };
}

function sanitizeConsultationInput(input: SummarizeConsultationInput): SummarizeConsultationInput {
  return {
    pet: {
      ...input.pet,
      allergies: sanitize(input.pet.allergies),
      continuousMedications: sanitize(input.pet.continuousMedications),
      notes: sanitize(input.pet.notes),
    },
    consultation: {
      ...input.consultation,
      reason: sanitize(input.consultation.reason),
      symptoms: sanitize(input.consultation.symptoms),
      observations: sanitize(input.consultation.observations),
      evolution: sanitize(input.consultation.evolution),
      medications: sanitize(input.consultation.medications),
    },
    anamnesis: input.anamnesis
      ? {
          neurological: sanitize(input.anamnesis.neurological),
          digestive: sanitize(input.anamnesis.digestive),
          respiratory: sanitize(input.anamnesis.respiratory),
          dermatological: sanitize(input.anamnesis.dermatological),
          general: sanitize(input.anamnesis.general),
        }
      : null,
  };
}

export async function summarizeConsultation(
  input: SummarizeConsultationInput,
  ctx: { requestId?: string },
): Promise<AIResult> {
  const safe = sanitizeConsultationInput(input);
  const raw = await getAIProvider().generate({
    system: SYSTEM_BASE,
    user: summarizeConsultationPrompt(safe),
    maxTokens: 3000,
    requestId: ctx.requestId,
    operation: "summarizeConsultation",
  });
  return buildResult(raw);
}

export async function organizeClinicalText(
  input: OrganizeTextInput,
  ctx: { requestId?: string },
): Promise<AIResult> {
  const safe: OrganizeTextInput = {
    rawText: clip(sanitize(input.rawText), 6000),
    petContext: input.petContext ?? null,
  };
  if (!safe.rawText || safe.rawText.length < 5) {
    throw Object.assign(new Error("Texto muito curto para organizar"), { statusCode: 400 });
  }
  const raw = await getAIProvider().generate({
    system: SYSTEM_BASE,
    user: organizeTextPrompt(safe),
    maxTokens: 3500,
    requestId: ctx.requestId,
    operation: "organizeClinicalText",
  });
  return buildResult(raw);
}

const MAX_EVENTS = 80;
function sanitizeTimelineInput(input: SummarizeTimelineInput): SummarizeTimelineInput {
  return {
    pet: {
      ...input.pet,
      allergies: sanitize(input.pet.allergies),
      continuousMedications: sanitize(input.pet.continuousMedications),
    },
    events: input.events.slice(0, MAX_EVENTS).map((e) => ({
      type: e.type,
      date: e.date,
      title: clip(sanitize(e.title), 200),
      description: e.description ? clip(sanitize(e.description), 400) : null,
      status: e.status,
      category: e.category,
    })),
  };
}

export async function summarizeTimeline(
  input: SummarizeTimelineInput,
  ctx: { requestId?: string },
): Promise<AIResult> {
  const safe = sanitizeTimelineInput(input);
  const raw = await getAIProvider().generate({
    system: SYSTEM_BASE,
    user: summarizeTimelinePrompt(safe),
    maxTokens: 3500,
    requestId: ctx.requestId,
    operation: "summarizeTimeline",
  });
  return buildResult(raw);
}

export async function detectClinicalPatterns(
  input: SummarizeTimelineInput,
  ctx: { requestId?: string },
): Promise<AIResult> {
  const safe = sanitizeTimelineInput(input);
  const raw = await getAIProvider().generate({
    system: SYSTEM_BASE,
    user: detectPatternsPrompt(safe),
    maxTokens: 3500,
    requestId: ctx.requestId,
    operation: "detectClinicalPatterns",
  });
  return buildResult(raw);
}
