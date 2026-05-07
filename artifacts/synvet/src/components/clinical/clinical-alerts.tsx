import { AlertTriangle, Pill, ShieldAlert, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type PetLike = {
  isCritical?: boolean | null;
  allergies?: string | null;
  continuousMedications?: string | null;
  notes?: string | null;
};

type Props = {
  pet: PetLike;
  compact?: boolean;
  className?: string;
};

type Alert = {
  key: string;
  label: string;
  detail?: string;
  tone: "critical" | "warning" | "info";
  Icon: typeof AlertTriangle;
};

const TONE: Record<Alert["tone"], string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

export function ClinicalAlerts({ pet, compact, className }: Props) {
  const alerts: Alert[] = [];
  if (pet.isCritical) {
    alerts.push({
      key: "critical",
      label: "Paciente crítico",
      tone: "critical",
      Icon: ShieldAlert,
    });
  }
  if (pet.allergies?.trim()) {
    alerts.push({
      key: "allergies",
      label: "Alergias",
      detail: pet.allergies,
      tone: "critical",
      Icon: AlertTriangle,
    });
  }
  if (pet.continuousMedications?.trim()) {
    alerts.push({
      key: "meds",
      label: "Medicação contínua",
      detail: pet.continuousMedications,
      tone: "warning",
      Icon: Pill,
    });
  }
  if (pet.notes?.trim()) {
    alerts.push({
      key: "notes",
      label: "Observações",
      detail: pet.notes,
      tone: "info",
      Icon: FileText,
    });
  }

  if (alerts.length === 0) return null;

  if (compact) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {alerts.map((a) => (
          <span
            key={a.key}
            title={a.detail}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
              TONE[a.tone],
            )}
          >
            <a.Icon className="w-3.5 h-3.5" />
            {a.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2 md:grid-cols-2", className)}>
      {alerts.map((a) => (
        <div
          key={a.key}
          className={cn("rounded-lg border px-3 py-2 flex gap-2", TONE[a.tone])}
        >
          <a.Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{a.label}</p>
            {a.detail && <p className="opacity-90 whitespace-pre-wrap">{a.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
