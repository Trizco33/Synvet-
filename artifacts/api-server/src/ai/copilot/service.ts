import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import { sanitize, clip } from "../sanitize";
import { COPILOT_PROMPT_VERSION, buildContextSystemMessage } from "./prompts";
import type { CopilotPetContext } from "./contextBuilder";
import { renderContextForPrompt } from "./contextBuilder";

const COPILOT_MODEL = "gpt-5-mini";
const MAX_HISTORY = 12;
const MAX_USER_MSG_CHARS = 2000;

const PRICING_USD_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-5-mini": { in: 0.00025, out: 0.002 },
  "gpt-5.4": { in: 0.0025, out: 0.01 },
  "gpt-5-nano": { in: 0.00005, out: 0.0004 },
};

function estimateCost(model: string, inTok: number, outTok: number): number {
  const p = PRICING_USD_PER_1K[model] ?? PRICING_USD_PER_1K[COPILOT_MODEL];
  return Number(((inTok / 1000) * p.in + (outTok / 1000) * p.out).toFixed(6));
}

export interface CopilotChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotChatInput {
  context: CopilotPetContext;
  messages: CopilotChatMessage[];
}

export type CopilotStreamEvent =
  | { type: "delta"; content: string }
  | {
      type: "done";
      model: string;
      promptVersion: string;
      durationMs: number;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number };
      estimatedCostUsd: number;
    }
  | { type: "error"; message: string };

function sanitizeHistory(history: CopilotChatMessage[]): CopilotChatMessage[] {
  return history.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: clip(sanitize(m.content), MAX_USER_MSG_CHARS),
  }));
}

export async function* streamCopilotChat(
  input: CopilotChatInput,
  ctx: { requestId?: string; signal?: AbortSignal },
): AsyncGenerator<CopilotStreamEvent, void, unknown> {
  const start = Date.now();
  const contextBlock = renderContextForPrompt(input.context);
  const systemMsg = buildContextSystemMessage(contextBlock);
  const safeHistory = sanitizeHistory(input.messages);
  if (safeHistory.length === 0 || safeHistory[safeHistory.length - 1].role !== "user") {
    yield { type: "error", message: "A última mensagem precisa ser do usuário." };
    return;
  }

  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const stream = await openai.chat.completions.create(
      {
        model: COPILOT_MODEL,
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: 3500,
        messages: [
          { role: "system", content: systemMsg },
          ...safeHistory.map((m) => ({ role: m.role, content: m.content })),
        ],
        ...({ reasoning_effort: "low" } as Record<string, unknown>),
      },
      ctx.signal ? { signal: ctx.signal } : undefined,
    );

    for await (const chunk of stream) {
      if (ctx.signal?.aborted) break;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        yield { type: "delta", content: delta };
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    const durationMs = Date.now() - start;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUsd = estimateCost(COPILOT_MODEL, promptTokens, completionTokens);
    logger.info(
      {
        ai: {
          provider: "openai",
          model: COPILOT_MODEL,
          operation: "copilot.chat",
          requestId: ctx.requestId,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
          estimatedCostUsd,
          historyLength: safeHistory.length,
        },
      },
      "ai.copilot.chat",
    );
    yield {
      type: "done",
      model: COPILOT_MODEL,
      promptVersion: COPILOT_PROMPT_VERSION,
      durationMs,
      usage: { promptTokens, completionTokens, totalTokens },
      estimatedCostUsd,
    };
  } catch (err) {
    if (ctx.signal?.aborted) return;
    const message = err instanceof Error ? err.message : "Falha desconhecida na IA";
    logger.error({ err, requestId: ctx.requestId }, "ai.copilot.chat failed");
    yield { type: "error", message };
  }
}
