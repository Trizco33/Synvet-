import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { ShineCard } from "./shine-card";

const EASE = [0.16, 1, 0.3, 1] as const;

const METRICS = [
  { v: "92%", l: "menos tempo em prontuário" },
  { v: "3,4×", l: "mais consultas confirmadas" },
  { v: "<200ms", l: "resposta média de timeline" },
  { v: "99.9%", l: "uptime mensal" },
];

const TESTIMONIALS = [
  {
    quote:
      "Trocamos planilha + ERP antigo pelo Synvet em uma tarde. A equipe inteira aprendeu sozinha — é o primeiro software clínico que parece feito por veterinário.",
    name: "Dra. Marina Tavares",
    role: "Clínica Vital · São Paulo",
  },
  {
    quote:
      "O Copilot economiza pelo menos 40 minutos por dia. Ele lê o histórico, sinaliza valores fora-de-range e me devolve foco no animal, não na tela.",
    name: "Dr. Felipe Andrade",
    role: "Anclivepa · Rio de Janeiro",
  },
  {
    quote:
      "Os tutores notam a diferença. Confirmação automática, lembrete de vacina, laudo na hora. Subimos a NPS da clínica em dois meses.",
    name: "Dra. Helena Brum",
    role: "Pet Medic · Curitiba",
  },
];

const LOGOS = ["Vitalvet", "Anclivepa", "Pet Medic", "Bichos & Cia", "Vetlab", "Vivapet"];

export function SocialProof() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 mb-4">
            Confiança clínica
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-[1.05]">
            Clínicas que já mudaram a rotina com o Synvet.
          </h2>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.l}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              className="bg-[#0a0c14] p-6 md:p-8 text-center"
            >
              <div className="text-3xl md:text-4xl font-semibold bg-gradient-to-br from-white to-[#B6A6FF] bg-clip-text text-transparent">
                {m.v}
              </div>
              <div className="mt-2 text-xs md:text-sm text-white/55">{m.l}</div>
            </motion.div>
          ))}
        </div>

        {/* Logos */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
          {LOGOS.map((l) => (
            <span
              key={l}
              className="text-sm md:text-base font-medium tracking-tight text-white/45 hover:text-white/70 transition-colors"
            >
              {l}
            </span>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
            >
              <ShineCard className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 h-full">
                <Quote className="w-5 h-5 text-[#B6A6FF]/70 mb-4" />
                <p className="text-sm text-white/80 leading-relaxed">{t.quote}</p>
                <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t.name}</div>
                    <div className="text-xs text-white/45">{t.role}</div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="w-3 h-3 fill-[#B6A6FF] text-[#B6A6FF]" />
                    ))}
                  </div>
                </div>
              </ShineCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
