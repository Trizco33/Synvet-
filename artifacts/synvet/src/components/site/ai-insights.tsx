import { motion } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  Search,
  Layers,
  Brain,
} from "lucide-react";
import { ShineCard } from "./shine-card";
import { PulseGlow } from "./motion-fx";

const EASE = [0.16, 1, 0.3, 1] as const;

const PILLARS = [
  {
    i: Sparkles,
    t: "Resumo automático",
    d: "Sumariza consultas e exames em segundos, com linguagem clínica.",
  },
  {
    i: TrendingUp,
    t: "Detecção de padrões",
    d: "Sinaliza tendências longitudinais e valores fora-de-range.",
  },
  {
    i: Layers,
    t: "Evolução longitudinal",
    d: "Compara medições consecutivas e cruza com histórico vacinal.",
  },
  {
    i: Brain,
    t: "Copiloto contextual",
    d: "Lê o paciente antes de você abrir a boca. Memória persistente.",
  },
  {
    i: Search,
    t: "Pesquisa veterinária",
    d: "RAG sobre literatura clínica em desenvolvimento — beta seletivo.",
  },
];

export function AIInsights() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <PulseGlow className="left-1/2 -translate-x-1/2 -top-20" size={680} color="#7A5CFF" intensity={0.12} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 mb-4">
            <Sparkles className="w-3 h-3" />
            Inteligência clínica
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-[1.05]">
            IA pensada para medicina,
            <br />
            <span className="bg-gradient-to-r from-[#B6A6FF] via-[#7A5CFF] to-[#5B8CFF] bg-clip-text text-transparent">
              não para responder qualquer coisa.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed">
            Cinco capacidades trabalhando juntas para devolver foco ao animal.
          </p>
        </div>

        <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.t}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              className={i === 4 ? "lg:col-start-2" : ""}
            >
              <ShineCard className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 h-full">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7A5CFF]/30 to-[#5B8CFF]/15 border border-[#7A5CFF]/30 flex items-center justify-center mb-4">
                  <p.i className="w-5 h-5 text-[#B6A6FF]" />
                </div>
                <div className="text-lg font-medium text-white">{p.t}</div>
                <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{p.d}</p>
              </ShineCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
