import { supabase } from "./supabase";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

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

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Falha ao carregar contexto (${res.status})`);
  }
  return res.json();
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamCopilotChatParams {
  petId: string;
  consultationId?: string | null;
  messages: CopilotMessage[];
  signal: AbortSignal;
  onDelta: (chunk: string) => void;
  onDone: (meta: {
    durationMs: number;
    estimatedCostUsd: number;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    model: string;
  }) => void;
  onError: (message: string) => void;
}

export async function streamCopilotChat(params: StreamCopilotChatParams): Promise<void> {
  const { petId, consultationId, messages, signal, onDelta, onDone, onError } = params;
  let res: Response;
  try {
    res = await fetch(`${BASE}/ai/copilot/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(await authHeaders()),
      },
      body: JSON.stringify({ petId, consultationId: consultationId ?? null, messages }),
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
      // ignore
    }
    onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

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
    if (event === "delta" && typeof data.content === "string") {
      onDelta(data.content);
    } else if (event === "done") {
      onDone({
        durationMs: Number(data.durationMs ?? 0),
        estimatedCostUsd: Number(data.estimatedCostUsd ?? 0),
        usage: (data.usage as {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        }) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: typeof data.model === "string" ? data.model : "gpt-5-mini",
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
