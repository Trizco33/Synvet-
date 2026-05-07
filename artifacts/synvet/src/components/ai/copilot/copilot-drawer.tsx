import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, Send, X, RefreshCw, AlertCircle, Loader2, Square, User as UserIcon, Stethoscope, FileText, Syringe, FlaskConical } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AIMarkdown } from "@/components/ai/ai-markdown";
import { useCopilot } from "./copilot-provider";
import {
  fetchCopilotContext,
  streamCopilotChat,
  type CopilotContextSummary,
  type CopilotMessage,
} from "@/lib/copilot";

interface ChatMessage extends CopilotMessage {
  id: string;
  pending?: boolean;
  error?: string;
}

const QUICK_PROMPTS = [
  "Resuma o caso deste paciente.",
  "Existe algum padrão clínico recorrente?",
  "Quais exames apresentaram alteração?",
  "Há sinais neurológicos prévios?",
  "Quais medicações contínuas em uso e por quê?",
  "Sugira pontos de atenção e investigação complementar.",
];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function CopilotDrawer() {
  const { context, open, setOpen } = useCopilot();
  const [summary, setSummary] = useState<CopilotContextSummary | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [ctxError, setCtxError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load context when opened or pet/consultation changes
  useEffect(() => {
    if (!open || !context) return;
    const ac = new AbortController();
    setLoadingCtx(true);
    setCtxError(null);
    fetchCopilotContext(context.petId, context.consultationId, ac.signal)
      .then((s) => setSummary(s))
      .catch((err) => {
        if (ac.signal.aborted) return;
        setCtxError(err instanceof Error ? err.message : "Falha ao carregar contexto");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingCtx(false);
      });
    return () => ac.abort();
  }, [open, context?.petId, context?.consultationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset chat history when switching patient
  useEffect(() => {
    setMessages([]);
    setInput("");
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, [context?.petId]);

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const send = useCallback(
    async (text: string) => {
      if (!context || streaming) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = { id: newId(), role: "user", content: trimmed };
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: "",
        pending: true,
      };
      const newHistory = [...messages, userMsg];
      setMessages([...newHistory, assistantMsg]);
      setInput("");
      setStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;

      let acc = "";
      await streamCopilotChat({
        petId: context.petId,
        consultationId: context.consultationId,
        messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        signal: ac.signal,
        onDelta: (chunk) => {
          acc += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc, pending: true } : m)),
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc, pending: false } : m)),
          );
          setStreaming(false);
          abortRef.current = null;
        },
        onError: (msg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: acc, pending: false, error: msg }
                : m,
            ),
          );
          setStreaming(false);
          abortRef.current = null;
        },
      });
    },
    [context, messages, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.pending ? { ...m, pending: false, error: "Cancelado." } : m)),
    );
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) abortRef.current?.abort();
        setOpen(o);
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0 border-l border-primary/20"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,16,32,1) 0%, rgba(17,24,39,1) 60%, rgba(11,16,32,1) 100%)",
        }}
      >
        <SheetHeader className="px-5 py-4 border-b border-border/40">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md shadow-primary/30"
              style={{ background: "linear-gradient(135deg, #5B8CFF 0%, #7A5CFF 100%)" }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-lg">Synvet Copilot</SheetTitle>
                <Badge
                  variant="outline"
                  className="border-primary/40 text-primary text-[10px] uppercase tracking-wide"
                >
                  Assistivo · revise sempre
                </Badge>
              </div>
              {summary && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {summary.pet.name} · {summary.pet.species}
                  {summary.pet.breed ? ` · ${summary.pet.breed}` : ""}
                  {summary.pet.ageYears !== null ? ` · ${summary.pet.ageYears} anos` : ""}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Context summary */}
        <div className="px-5 py-3 border-b border-border/40 bg-background/30">
          {loadingCtx ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : ctxError ? (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" /> {ctxError}
            </div>
          ) : summary ? (
            <div className="space-y-2">
              {(summary.pet.allergies ||
                summary.pet.continuousMedications ||
                summary.pet.isCritical) && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.pet.isCritical && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
                      Paciente crítico
                    </Badge>
                  )}
                  {summary.pet.allergies && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                      Alergias
                    </Badge>
                  )}
                  {summary.pet.continuousMedications && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
                      Medicação contínua
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> {summary.citations.consultationsCount}
                </span>
                <span className="flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" /> {summary.citations.examsCount}
                </span>
                <span className="flex items-center gap-1">
                  <Syringe className="h-3 w-3" /> {summary.citations.vaccinesCount}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {summary.citations.recordsCount}
                </span>
                {summary.hasFocusedConsultation && (
                  <Badge variant="outline" className="ml-auto text-[10px] border-primary/40 text-primary">
                    Consulta em foco
                  </Badge>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && !loadingCtx && summary && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Pergunte sobre este paciente. O Copilot já carregou o contexto e citará as
                origens (consultas, exames, vacinas, prontuário) quando aplicável.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    disabled={streaming}
                    className="text-left text-xs rounded-lg border border-border/50 bg-card/40 hover:border-primary/40 hover:bg-primary/5 px-3 py-2 transition-colors text-foreground/80 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                {m.role === "user" ? (
                  <>
                    <UserIcon className="h-3 w-3" /> Você
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 text-primary" /> Copilot
                  </>
                )}
              </div>
              <div
                className={
                  m.role === "user"
                    ? "rounded-lg border border-border/50 bg-secondary/40 px-3 py-2 text-sm text-foreground/90 whitespace-pre-wrap"
                    : "rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
                }
              >
                {m.role === "assistant" ? (
                  <>
                    {m.content ? (
                      <AIMarkdown content={m.content} />
                    ) : m.pending ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
                      </div>
                    ) : null}
                    {m.pending && m.content && (
                      <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse align-middle" />
                    )}
                    {m.error && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3" /> {m.error}
                      </div>
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={onSubmit}
          className="border-t border-border/40 px-4 py-3 bg-background/40 space-y-2"
        >
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Pergunte sobre o paciente..."
              rows={2}
              disabled={streaming || !summary}
              className="resize-none pr-12 bg-background/60"
              data-testid="copilot-input"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {summary?.disclaimer ?? "Conteúdo assistivo. Revise sempre."}
            </p>
            {streaming ? (
              <Button type="button" size="sm" variant="outline" onClick={stop}>
                <Square className="h-3 w-3 mr-1" /> Parar
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || !summary}
                data-testid="copilot-send"
                style={{
                  background: "linear-gradient(135deg, #5B8CFF 0%, #7A5CFF 100%)",
                  color: "white",
                }}
                className="gap-1 border-0 hover:brightness-110"
              >
                <Send className="h-3 w-3" /> Enviar
              </Button>
            )}
          </div>
          {messages.length > 0 && !streaming && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Nova conversa
            </button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
