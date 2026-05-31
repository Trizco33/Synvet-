import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface Consultation {
  id: string;
  scheduledAt: string;
  status: string;
  petName: string;
}

const STATUS_EVENT: Record<string, string> = {
  scheduled:
    "bg-blue-500/15 text-blue-300 border-l-2 border-l-blue-500/70",
  in_progress:
    "bg-amber-500/15 text-amber-300 border-l-2 border-l-amber-500/70",
  completed:
    "bg-green-500/15 text-green-300 border-l-2 border-l-green-500/70",
  cancelled:
    "bg-red-500/10 text-red-300/70 border-l-2 border-l-red-500/50",
};

interface Props {
  consultations: Consultation[];
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarWeekView({
  consultations,
  currentDate,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const rangeLabel = `${format(weekStart, "d MMM", { locale: ptBR })} – ${format(
    weekEnd,
    "d MMM yyyy",
    { locale: ptBR },
  )}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 text-center">
          <span className="text-sm font-medium capitalize">{rangeLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label="Próxima semana"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoje
        </Button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2">
        <div className="flex gap-1.5 min-w-[700px] md:min-w-0 md:grid md:grid-cols-7">
          {days.map((day) => {
            const dayConsultations = consultations
              .filter((c) => isSameDay(parseISO(c.scheduledAt), day))
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
            const today = isToday(day);

            return (
              <div
                key={day.toString()}
                className="flex flex-col min-w-[120px] md:min-w-0"
              >
                <div
                  className={`text-center py-2 px-1 rounded-t-lg border border-b-0 ${
                    today
                      ? "bg-primary/15 border-primary/30"
                      : "bg-secondary/30 border-border/30"
                  }`}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      today ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <p
                    className={`text-lg font-bold leading-tight ${
                      today ? "text-primary" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </p>
                </div>

                <div className="flex-1 min-h-[180px] border border-border/30 rounded-b-lg p-1.5 space-y-1.5 bg-card/20">
                  {dayConsultations.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/30">
                        —
                      </span>
                    </div>
                  ) : (
                    dayConsultations.map((c) => (
                      <Link key={c.id} href={`/consultas/${c.id}`}>
                        <div
                          className={`rounded text-[11px] px-1.5 py-1 cursor-pointer hover:opacity-75 transition-opacity ${
                            STATUS_EVENT[c.status] ?? STATUS_EVENT.scheduled
                          }`}
                        >
                          <p className="font-semibold leading-tight">
                            {format(parseISO(c.scheduledAt), "HH:mm")}
                          </p>
                          <p className="truncate leading-tight">{c.petName}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
