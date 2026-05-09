import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarCheck2,
  ClipboardList,
  Stethoscope,
  FileText,
  Activity,
  Brain,
  MessageSquareText,
  Repeat,
  type LucideIcon,
} from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Step {
  i: LucideIcon;
  title: string;
  desc: string;
  accent: string;
}

const STEPS: Step[] = [
  { i: CalendarCheck2, title: "Tutor agenda", desc: "Online ou via WhatsApp, 24/7.", accent: "#7A5CFF" },
  { i: ClipboardList, title: "Recepção", desc: "Check-in rápido, ficha pré-preenchida.", accent: "#7A5CFF" },
  { i: Stethoscope, title: "Consulta", desc: "Anamnese por sistemas e prontuário.", accent: "#5B8CFF" },
  { i: FileText, title: "Exames", desc: "Upload de laudos com URLs assinadas.", accent: "#5B8CFF" },
  { i: Activity, title: "Timeline", desc: "Histórico clínico completo do paciente.", accent: "#5B8CFF" },
  { i: Brain, title: "IA", desc: "Resumo, padrões e copiloto contextual.", accent: "#B6A6FF" },
  { i: MessageSquareText, title: "WhatsApp", desc: "Confirmações e lembretes automáticos.", accent: "#34d399" },
  { i: Repeat, title: "Retorno", desc: "Cadência inteligente para fidelizar.", accent: "#34d399" },
];

export function WorkflowFlow() {
  const reduce = useReducedMotion();
  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 mb-4">
            Fluxo operacional
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-[1.05]">
            Da agenda ao retorno, sem fricção.
          </h2>
          <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed">
            Um sistema desenhado para a rotina real da clínica veterinária.
            Cada passo conversa com o próximo, automaticamente.
          </p>
        </div>

        <div className="relative mt-16">
          <svg
            aria-hidden
            className="hidden lg:block absolute inset-x-0 top-[42px] w-full h-1 pointer-events-none"
            viewBox="0 0 1200 4"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="flow-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#7A5CFF" stopOpacity="0" />
                <stop offset="0.1" stopColor="#7A5CFF" stopOpacity="0.5" />
                <stop offset="0.5" stopColor="#5B8CFF" stopOpacity="0.5" />
                <stop offset="0.9" stopColor="#34d399" stopOpacity="0.5" />
                <stop offset="1" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.line
              x1="0"
              x2="1200"
              y1="2"
              y2="2"
              stroke="url(#flow-line)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: reduce ? 0 : 2.4, ease: EASE }}
            />
          </svg>

          <ol className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {STEPS.map((s, idx) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: idx * 0.06, ease: EASE }}
                className="relative"
              >
                <div className="relative flex flex-col items-center text-center group">
                  <div className="relative">
                    <div
                      className="absolute inset-0 rounded-2xl blur-xl opacity-50 group-hover:opacity-90 transition-opacity"
                      style={{ background: s.accent + "33" }}
                    />
                    <div
                      className="relative w-[84px] h-[84px] rounded-2xl border bg-[#0a0c14]/80 backdrop-blur flex items-center justify-center"
                      style={{
                        borderColor: s.accent + "40",
                        boxShadow: `inset 0 0 0 1px ${s.accent}10`,
                      }}
                    >
                      <s.i className="w-6 h-6" style={{ color: s.accent }} />
                      <span
                        className="absolute -top-2 -right-2 text-[10px] font-medium w-5 h-5 rounded-full flex items-center justify-center bg-[#0a0c14] border"
                        style={{ borderColor: s.accent + "60", color: s.accent }}
                      >
                        {idx + 1}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 text-sm font-medium text-white">{s.title}</div>
                  <div className="mt-1 text-xs text-white/50 leading-relaxed max-w-[160px]">
                    {s.desc}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
