import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

export interface AIProvider {
  readonly name: string;
  generate(params: {
    system: string;
    user: string;
    maxTokens?: number;
    requestId?: string;
    operation: string;
  }): Promise<{
    content: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    durationMs: number;
    estimatedCostUsd: number;
  }>;
}

const DEFAULT_MODEL = "gpt-5-mini";

const PRICING_USD_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-5-mini": { in: 0.00025, out: 0.002 },
  "gpt-5.4": { in: 0.0025, out: 0.01 },
  "gpt-5-nano": { in: 0.00005, out: 0.0004 },
};

function estimateCost(model: string, inTok: number, outTok: number): number {
  const p = PRICING_USD_PER_1K[model] ?? PRICING_USD_PER_1K[DEFAULT_MODEL];
  return Number(((inTok / 1000) * p.in + (outTok / 1000) * p.out).toFixed(6));
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  constructor(private model: string = DEFAULT_MODEL) {}

  async generate(params: {
    system: string;
    user: string;
    maxTokens?: number;
    requestId?: string;
    operation: string;
  }) {
    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: this.model,
      max_completion_tokens: params.maxTokens ?? 3000,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      ...({ reasoning_effort: "low" } as Record<string, unknown>),
    });
    const durationMs = Date.now() - start;
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      const err = new Error(
        "A IA não retornou conteúdo (provavelmente esgotou o orçamento de raciocínio). Tente novamente.",
      ) as Error & { statusCode?: number };
      err.statusCode = 502;
      throw err;
    }
    const usage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };
    const estimatedCostUsd = estimateCost(this.model, usage.promptTokens, usage.completionTokens);
    logger.info(
      {
        ai: {
          provider: this.name,
          model: this.model,
          operation: params.operation,
          requestId: params.requestId,
          ...usage,
          durationMs,
          estimatedCostUsd,
        },
      },
      "ai.generate",
    );
    return { content, model: this.model, usage, durationMs, estimatedCostUsd };
  }
}

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!cachedProvider) cachedProvider = new OpenAIProvider();
  return cachedProvider;
}
