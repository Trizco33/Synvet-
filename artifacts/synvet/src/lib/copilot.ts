import { supabase } from "./supabase";
import { apiBase } from "./api-base";

const BASE = apiBase();

export interface CopilotContextSummary {
  pet: {
    name: string;
    species: string;
    breed: string | null;
    sex: string;
    ageYears: number | null;
    weightKg: number | null;
    isCritical: boolean;
    neutered: boolean;
    allergies: string | null;
    continuousMedications: string | null;
    notes: string | null;
  };
  citations: {
    consultationsCount: number;
    examsCount: number;
    vaccinesCount: number;
    recordsCount: number;
    rangeFromDate: string | null;
  };
  hasFocusedConsultation: boolean;
  previewBlock: string;
  disclaimer: string;
}

export interface CopilotConversationSummary {
  id: string;
  petId: string;
  consultationId: string | null;
  title: string;
  model: string;
  promptVersion: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotConversationDetail extends CopilotConversationSummary {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let msg = fallback;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchCopilotContext(
  petId: string,
  consultationId: string | null,
  signal?: AbortSignal,
): Promise<CopilotContextSummary> {
  const url = new URL(`${BASE}/ai/copilot/context/${petId}`, window.location.origin);
  if (consultationId) url.searchParams.set("consultationId", consultationId);
  const res = await fetch(url.toString(), {
    headers: { ...(await authHeaders()) },
    signal,
  });
  return jsonOrThrow<CopilotContextSummary>(res, `Falha ao carregar contexto (${res.status})`);
}

export async function fetchCopilotConversations(
  petId: string,
  signal?: AbortSignal,
): Promise<CopilotConversationSummary[]> {
  const url = new URL(`${BASE}/ai/copilot/conversations`, window.location.origin);
  url.searchParams.set("petId", petId);
  const res = await fetch(url.toString(), {
    headers: { ...(await authHeaders()) },
    signal,
  });
  const body = await jsonOrThrow<{ items: CopilotConversationSummary[] }>(
    res,
    "Falha ao listar conversas",
  );
  return body.items;
}

export async function fetchCopilotConversation(
  id: string,
  signal?: AbortSignal,
): Promise<CopilotConversationDetail> {
  const res = await fetch(`${BASE}/ai/copilot/conversations/${id}`, {
    headers: { ...(await authHeaders()) },
    signal,
  });
  return jsonOrThrow<CopilotConversationDetail>(res, "Falha ao abrir conversa");
}

export async function deleteCopilotConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/ai/copilot/conversations/${id}`, {
    method: "DELETE",
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Falha ao apagar conversa (${res.status})`);
  }
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamCopilotChatParams {
  petId: string;
  consultationId?: string | null;
  conversationId?: string | null;
  messages: CopilotMessage[];
  signal: AbortSignal;
  onReady?: (info: { conversationId: string; isNew: boolean }) => void;
  onDelta: (chunk: string) => void;
  onDone: (meta: {
    durationMs: number;
    estimatedCostUsd: number;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    model: string;
    conversationId: string;
  }) => void;
  onError: (message: string) => void;
}

export async function streamCopilotChat(params: StreamCopilotChatParams): Promise<void> {
  const {
    petId,
    consultationId,
    conversationId,
    messages,
    signal,
    onReady,
    onDelta,
    onDone,
    onError,
  } = params;

  let res: Response;
  try {
    res = await fetch(`${BASE}/ai/copilot/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        petId,
        consultationId: consultationId ?? null,
        conversationId: conversationId ?? null,
        messages,
      }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) return;
    onError(err instanceof Error ? err.message : "Falha de rede");
    return;
  }

  if (!res.ok || !res.body) {
    let msg = `Erro ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let resolvedConvId: string | null = conversationId ?? null;

  const processEvent = (raw: string): void => {
    if (!raw.trim()) return;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const dataStr = dataLines.join("\n");
    if (!dataStr) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataStr);
    } catch {
      return;
    }
    const data = payload as Record<string, unknown>;
    if (event === "ready") {
      if (typeof data.conversationId === "string") {
        resolvedConvId = data.conversationId;
        onReady?.({
          conversationId: data.conversationId,
          isNew: !!data.isNew,
        });
      }
    } else if (event === "delta" && typeof data.content === "string") {
      onDelta(data.content);
    } else if (event === "done") {
      onDone({
        durationMs: Number(data.durationMs ?? 0),
        estimatedCostUsd: Number(data.estimatedCostUsd ?? 0),
        usage:
          (data.usage as {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          }) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: typeof data.model === "string" ? data.model : "gpt-5-mini",
        conversationId:
          typeof data.conversationId === "string"
            ? data.conversationId
            : (resolvedConvId ?? ""),
      });
    } else if (event === "error" && typeof data.message === "string") {
      onError(data.message);
    }
  };

  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel().catch(() => {});
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        processEvent(raw);
      }
    }
    if (buffer.trim()) processEvent(buffer);
  } catch (err) {
    if (signal.aborted) return;
    onError(err instanceof Error ? err.message : "Falha durante streaming");
  }
}
