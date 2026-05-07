import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, Copy, RefreshCw, AlertCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AIMarkdown } from "./ai-markdown";

export interface AIResultPayload {
  content: string;
  disclaimer: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  estimatedCostUsd: number;
  tokens: { prompt: number; completion: number; total: number };
}

interface AIAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Async function that returns the AI result. Receives an AbortSignal. */
  run: (signal: AbortSignal) => Promise<AIResultPayload>;
  /** Optional re-render trigger key — when changes, drawer auto-runs again. */
  trigger?: string | number;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: AIResultPayload }
  | { kind: "error"; message: string };

export function AIAssistantDrawer({
  open,
  onOpenChange,
  title,
  description,
  run,
  trigger,
}: AIAssistantDrawerProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const lastTriggerRef = useRef<string | number | undefined>(undefined);

  const execute = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ kind: "loading" });
    try {
      const data = await run(ctrl.signal);
      if (!ctrl.signal.aborted) setState({ kind: "success", data });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setState({ kind: "error", message });
    }
  }, [run]);

  useEffect(() => {
    if (open && (state.kind === "idle" || trigger !== lastTriggerRef.current)) {
      lastTriggerRef.current = trigger;
      void execute();
    }
    if (!open) {
      abortRef.current?.abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trigger]);

  const cancel = () => {
    abortRef.current?.abort();
    setState({ kind: "idle" });
    onOpenChange(false);
  };

  const copy = async () => {
    if (state.kind !== "success") return;
    try {
      await navigator.clipboard.writeText(state.data.content);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0 bg-card border-l"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold leading-tight truncate">
                  {title}
                </SheetTitle>
                {description ? (
                  <SheetDescription className="text-xs mt-0.5 leading-snug">
                    {description}
                  </SheetDescription>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wide border-amber-500/40 text-amber-300 bg-amber-500/10"
            >
              Assistivo · revise sempre
            </Badge>
            {state.kind === "success" ? (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {state.data.model} · {(state.data.durationMs / 1000).toFixed(1)}s · ~$
                {state.data.estimatedCostUsd.toFixed(4)}
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state.kind === "loading" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Pensando…
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-9/12" />
              <div className="pt-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full mt-2" />
                <Skeleton className="h-3 w-10/12 mt-1" />
              </div>
            </div>
          ) : state.kind === "error" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="w-4 h-4" />
                Não foi possível gerar
              </div>
              <p className="text-xs text-muted-foreground">{state.message}</p>
              <Button size="sm" variant="outline" onClick={execute}>
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : state.kind === "success" ? (
            <AIMarkdown content={state.data.content} />
          ) : null}
        </div>

        <div className="px-6 py-4 border-t bg-card/50 space-y-3">
          {state.kind === "success" ? (
            <p className="text-[11px] text-muted-foreground leading-snug">
              {state.data.disclaimer}
            </p>
          ) : null}
          <div className="flex items-center gap-2 justify-end">
            {state.kind === "loading" ? (
              <Button variant="ghost" size="sm" onClick={cancel}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            ) : (
              <>
                {state.kind === "success" ? (
                  <Button variant="ghost" size="sm" onClick={copy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={execute}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerar
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface AITriggerButtonProps {
  onClick: () => void;
  label: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm";
  className?: string;
}

export function AITriggerButton({
  onClick,
  label,
  variant = "outline",
  size = "sm",
  className,
}: AITriggerButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant={variant}
      size={size}
      className={`gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 ${className ?? ""}`}
    >
      <Sparkles className="w-4 h-4 text-primary" />
      {label}
    </Button>
  );
}
