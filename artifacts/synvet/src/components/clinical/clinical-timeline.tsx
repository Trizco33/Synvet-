import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Stethoscope,
  TestTube,
  Syringe,
  FileText,
  CircleAlert,
} from "lucide-react";
import type { TimelineEvent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Filter = "all" | TimelineEvent["type"];

const TYPE_META: Record<
  TimelineEvent["type"],
  { label: string; Icon: typeof Stethoscope; color: string }
> = {
  consultation: { label: "Consultas", Icon: Stethoscope, color: "text-sky-400 bg-sky-500/10" },
  exam: { label: "Exames", Icon: TestTube, color: "text-violet-400 bg-violet-500/10" },
  vaccine: { label: "Vacinas", Icon: Syringe, color: "text-emerald-400 bg-emerald-500/10" },
  record: { label: "Prontuário", Icon: FileText, color: "text-amber-400 bg-amber-500/10" },
};

const SEVERITY: Record<NonNullable<TimelineEvent["severity"]>, string> = {
  critical: "border-red-500/50",
  warning: "border-amber-500/40",
  info: "border-border",
};

export function ClinicalTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.type === filter)),
    [events, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of visible) {
      const key = format(parseISO(e.date), "yyyy-MM");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [visible]);

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
        <CircleAlert className="h-12 w-12 opacity-20 mb-3" />
        <p>Sem eventos no histórico clínico ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <FilterChip label="Tudo" active={filter === "all"} onClick={() => setFilter("all")} />
        {(Object.keys(TYPE_META) as Array<TimelineEvent["type"]>).map((t) => (
          <FilterChip
            key={t}
            label={TYPE_META[t].label}
            active={filter === t}
            onClick={() => setFilter(t)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Sem eventos para este filtro.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(([month, items]) => (
            <div key={month}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {format(parseISO(month + "-01"), "MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              <ol className="relative border-l border-border/60 ml-3 space-y-4">
                {items.map((e) => {
                  const meta = TYPE_META[e.type];
                  return (
                    <li key={`${e.type}-${e.id}`} className="ml-6 relative">
                      <span
                        className={cn(
                          "absolute -left-9 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background",
                          meta.color,
                        )}
                      >
                        <meta.Icon className="w-3.5 h-3.5" />
                      </span>
                      <div
                        className={cn(
                          "rounded-lg border bg-card p-3",
                          SEVERITY[e.severity ?? "info"],
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{e.title}</p>
                            {e.description && (
                              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                                {e.description}
                              </p>
                            )}
                          </div>
                          <time className="text-xs text-muted-foreground shrink-0 mt-1">
                            {format(parseISO(e.date), "dd/MM HH:mm")}
                          </time>
                        </div>
                        {e.sourceUrl && (
                          <a
                            href={e.sourceUrl}
                            target={e.sourceUrl.startsWith("http") ? "_blank" : undefined}
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline mt-2 inline-block"
                          >
                            Abrir detalhe
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="h-8 px-3 text-xs"
    >
      {label}
    </Button>
  );
}
