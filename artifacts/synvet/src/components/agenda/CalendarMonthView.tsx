import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
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

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_EVENT_BG: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-300",
  in_progress: "bg-amber-500/20 text-amber-300",
  completed: "bg-green-500/20 text-green-300",
  cancelled: "bg-red-500/10 text-red-300/70",
};

const MAX_VISIBLE = 3;

interface Props {
  consultations: Consultation[];
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarMonthView({
  consultations,
  currentDate,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const monthLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 text-center">
          <span className="text-sm font-medium capitalize">{monthLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoje
        </Button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/20 border border-border/20 rounded-lg overflow-hidden">
        {days.map((day) => {
          const dayConsultations = consultations
            .filter((c) => isSameDay(parseISO(c.scheduledAt), day))
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const visible = dayConsultations.slice(0, MAX_VISIBLE);
          const overflow = dayConsultations.length - MAX_VISIBLE;

          return (
            <div
              key={day.toString()}
              className={`min-h-[72px] sm:min-h-[88px] p-1 bg-card/20 ${
                !isCurrentMonth ? "opacity-25" : ""
              }`}
            >
              <div className="flex justify-center mb-1">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    today ? "bg-primary text-white" : ""
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              <div className="space-y-0.5">
                {visible.map((c) => (
                  <Link key={c.id} href={`/consultas/${c.id}`}>
                    <div
                      className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-75 transition-opacity ${
                        STATUS_EVENT_BG[c.status] ??
                        STATUS_EVENT_BG.scheduled
                      }`}
                    >
                      <span className="font-semibold">
                        {format(parseISO(c.scheduledAt), "HH:mm")}
                      </span>
                      <span className="hidden sm:inline"> {c.petName}</span>
                    </div>
                  </Link>
                ))}
                {overflow > 0 && (
                  <p className="text-[9px] text-muted-foreground/70 px-1">
                    +{overflow} mais
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
