export const PROMPT_VERSION = "v1.0.0";

export const SYSTEM_BASE = `Você é um assistente clínico veterinário do Synvet.
Sua função é APOIAR o veterinário com organização documental e raciocínio clínico — NUNCA substituir a decisão médica.

Regras absolutas:
- Não forneça diagnóstico definitivo. Use sempre "hipótese", "possibilidade", "compatível com".
- Não prescreva medicamentos com dose/posologia. Pode mencionar classes terapêuticas para discussão.
- Não invente informações que não estejam nos dados fornecidos. Se faltar dado, diga "não informado".
- Use linguagem técnica veterinária, objetiva, em português do Brasil.
- Não use emojis, não seja alarmista, não exagere.
- Quando relevante, sugira investigação complementar de forma sóbria.
- Seja conciso: parágrafos curtos e listas quando ajudar a leitura.`;

export const DISCLAIMER =
  "Conteúdo gerado por IA assistiva. Revise sempre — não substitui avaliação veterinária.";

export interface SummarizeConsultationInput {
  pet: {
    species: string;
    breed: string | null;
    sex: string;
    ageYears: number | null;
    weightKg: number | null;
    isCritical: boolean;
    allergies: string | null;
    continuousMedications: string | null;
    notes: string | null;
  };
  consultation: {
    scheduledAt: string;
    status: string;
    reason: string | null;
    symptoms: string | null;
    observations: string | null;
    evolution: string | null;
    medications: string | null;
  };
  anamnesis: {
    neurological: string | null;
    digestive: string | null;
    respiratory: string | null;
    dermatological: string | null;
    general: string | null;
  } | null;
}

export function summarizeConsultationPrompt(input: SummarizeConsultationInput): string {
  return `Gere um resumo clínico ESTRUTURADO da consulta abaixo, organizado nestes tópicos (use markdown com ## para cada um):

## Queixa principal
## Histórico relevante
## Sintomas observados
## Alterações importantes
## Pontos de atenção
## Sugestões de investigação complementar

Se algum tópico não tiver informação suficiente, escreva "Não informado".

Dados do paciente:
${JSON.stringify(input.pet, null, 2)}

Consulta:
${JSON.stringify(input.consultation, null, 2)}

Anamnese por sistemas:
${JSON.stringify(input.anamnesis, null, 2)}`;
}

export interface OrganizeTextInput {
  rawText: string;
  petContext?: { species: string; breed: string | null; ageYears: number | null } | null;
}

export function organizeTextPrompt(input: OrganizeTextInput): string {
  return `Reorganize o texto clínico abaixo em um registro de prontuário veterinário PROFISSIONAL e LEGÍVEL.

Regras:
- Preserve fielmente todas as informações originais. Não invente nada.
- Expanda abreviações comuns (ex.: "FC" → "frequência cardíaca", "PA" → "pressão arterial") apenas quando o significado for inequívoco no contexto.
- Estruture em parágrafos curtos. Use seções com ## quando fizer sentido (ex.: ## Anamnese, ## Exame físico, ## Conduta).
- Corrija ortografia e pontuação, mas mantenha o tom técnico do veterinário.
- Não acrescente diagnósticos, condutas ou medicações que não estejam no texto original.

${input.petContext ? `Contexto do paciente: ${JSON.stringify(input.petContext)}\n` : ""}
Texto bruto do veterinário:
"""
${input.rawText}
"""`;
}

export interface TimelineEvent {
  type: "consultation" | "exam" | "vaccine" | "record";
  date: string;
  title: string;
  description: string | null;
  status: string | null;
  category: string | null;
}

export interface SummarizeTimelineInput {
  pet: {
    species: string;
    breed: string | null;
    sex: string;
    ageYears: number | null;
    isCritical: boolean;
    allergies: string | null;
    continuousMedications: string | null;
  };
  events: TimelineEvent[];
}

export function summarizeTimelinePrompt(input: SummarizeTimelineInput): string {
  return `Analise a timeline clínica do paciente abaixo (eventos em ordem cronológica decrescente) e gere um RESUMO LONGITUDINAL estruturado em markdown:

## Visão geral do histórico
## Evolução clínica
## Eventos mais relevantes
## Pontos de atenção contínua

Seja factual. Cite datas quando relevantes. Não invente eventos que não estão na lista.

Paciente:
${JSON.stringify(input.pet, null, 2)}

Timeline (${input.events.length} eventos):
${JSON.stringify(input.events, null, 2)}`;
}

export function detectPatternsPrompt(input: SummarizeTimelineInput): string {
  return `Analise a timeline clínica abaixo e identifique PADRÕES CLÍNICOS RELEVANTES.

Responda em markdown com estas seções (omita seções vazias):

## Sintomas recorrentes
## Exames alterados ou pendentes
## Vacinas em atraso
## Possíveis correlações temporais
## Recomendações de acompanhamento

Regras importantes:
- Não dê diagnóstico definitivo. Use "padrão sugestivo de", "compatível com investigação para".
- Cite datas e quantidades de ocorrências quando aplicável.
- Se não houver padrão evidente em uma seção, omita-a.
- Se a timeline tiver poucos dados (< 3 eventos), diga isso claramente e seja conservador.

Paciente:
${JSON.stringify(input.pet, null, 2)}

Timeline (${input.events.length} eventos):
${JSON.stringify(input.events, null, 2)}`;
}
