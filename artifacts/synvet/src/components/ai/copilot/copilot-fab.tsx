import { Sparkles } from "lucide-react";
import { useCopilot } from "./copilot-provider";

export function CopilotFab() {
  const { context, open, setOpen } = useCopilot();
  if (!context || open) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      data-testid="copilot-fab"
      aria-label="Abrir Synvet Copilot"
      className="group fixed z-40 right-4 bottom-24 md:bottom-6 flex items-center gap-2 rounded-full px-4 py-3 text-white font-semibold text-sm shadow-xl shadow-primary/30 ring-1 ring-white/10 transition-all hover:shadow-2xl hover:shadow-primary/40 hover:brightness-110 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #5B8CFF 0%, #7A5CFF 100%)",
      }}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white/30 opacity-50 group-hover:animate-ping" />
        <Sparkles className="h-5 w-5 relative" />
      </span>
      <span className="hidden sm:inline">Copilot</span>
    </button>
  );
}
