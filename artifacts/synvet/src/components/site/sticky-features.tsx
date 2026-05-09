import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ClipboardList,
  Brain,
  Activity,
  FileText,
  MessageSquareText,
  Workflow,
  Stethoscope,
  Syringe,
  AlertTriangle,
  CalendarCheck2,
  type LucideIcon,
} from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Feature {
  key: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  mock: "prontuario" | "ia" | "timeline" | "exames" | "comms" | "tenancy";
}

const FEATURES: Feature[] = [
  {
    key: "prontuario",
    icon: ClipboardList,
    eyebrow: "Prontuário",
    title: "Anamnese estruturada por sistemas.",
    desc: "Neurológico, cardiorrespiratório, digestivo, dermato e geral. Tudo em um único registro coeso.",
    bullets: ["Templates clínicos por espécie", "Versão e auditoria automática", "Busca instantânea no histórico"],
    mock: "prontuario",
  },
  {
    key: "ia",
    icon: Brain,
    eyebrow: "IA assistiva",
    title: "Copilot que lê o paciente antes de você.",
    desc: "Sumariza consultas, detecta valores fora-de-range e sugere próximos passos com citações de origem.",
    bullets: ["Streaming em tempo real", "Memória persistente por paciente", "Sanitização de dados sensíveis"],
    mock: "ia",
  },
  {
    key: "timeline",
    icon: Activity,
    eyebrow: "Timeline clínica",
    title: "A história do animal em uma linha.",
    desc: "Consultas, exames, vacinas e prontuário cronológicos, com alertas automáticos de criticidade.",
    bullets: ["Filtros por tipo e severidade", "Indicadores visuais de alerta", "Exportação para tutores"],
    mock: "timeline",
  },
  {
    key: "exames",
    icon: FileText,
    eyebrow: "Exames",
    title: "Laudos seguros, links que não quebram.",
    desc: "Upload com barra de progresso, retomada e URLs assinadas regeradas a cada acesso.",
    bullets: ["Bucket privado por clínica", "TTL curto reassinado on-demand", "Marcações automáticas de fora-de-range"],
    mock: "exames",
  },
  {
    key: "comms",
    icon: MessageSquareText,
    eyebrow: "WhatsApp + CRM",
    title: "Sua clínica conversa sem você lembrar.",
    desc: "Templates, automações por evento, agendamento e histórico de mensagens em um só lugar.",
    bullets: ["Confirmação 24h antes da consulta", "Lembretes de vacina por espécie", "Notificação automática de exame pronto"],
    mock: "comms",
  },
  {
    key: "tenancy",
    icon: Workflow,
    eyebrow: "Multi-clínica",
    title: "Equipe organizada, dados isolados.",
    desc: "Admin, veterinário e assistente com permissões claras. Cada clínica em seu próprio espaço lógico.",
    bullets: ["RBAC granular", "Auditoria com autoria e data", "Onboarding e migração assistida"],
    mock: "tenancy",
  },
];

export function StickyFeatures() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>("[data-feature-step]"),
    );
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number(visible.target.getAttribute("data-feature-step"));
          if (!Number.isNaN(idx)) setActive(idx);
        }
      },
      {
        rootMargin: "-40% 0px -40% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    items.forEach((it) => observer.observe(it));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 mb-4">
            Por dentro do produto
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-[1.05]">
            Cada parte do Synvet, em detalhes.
          </h2>
        </div>

        <div ref={containerRef} className="relative grid lg:grid-cols-12 gap-10">
          {/* Steps (mobile + desktop side) */}
          <div className="lg:col-span-5 space-y-24 md:space-y-32">
            {FEATURES.map((f, idx) => (
              <div
                key={f.key}
                data-feature-step={idx}
                className="min-h-[200px]"
              >
                <div className="inline-flex items-center gap-2 text-xs text-[#B6A6FF] uppercase tracking-wider mb-3">
                  <f.icon className="w-3.5 h-3.5" />
                  {f.eyebrow}
                </div>
                <h3 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-3 text-white/60 leading-relaxed">{f.desc}</p>
                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#7A5CFF] mt-2 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                {/* Mobile-only inline mock */}
                <div className="lg:hidden mt-6">
                  <FeatureMock kind={f.mock} />
                </div>
              </div>
            ))}
          </div>

          {/* Sticky mock (desktop) */}
          <div className="hidden lg:block lg:col-span-7">
            <div className="sticky top-28">
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-br from-[#7A5CFF]/20 to-[#5B8CFF]/15 blur-3xl opacity-50 rounded-[3rem]" />
                <div className="relative rounded-2xl border border-white/10 bg-[#0a0c14] overflow-hidden shadow-2xl min-h-[460px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={FEATURES[active]?.key ?? "x"}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.45, ease: EASE }}
                    >
                      <FeatureMock kind={FEATURES[active]!.mock} />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="mt-4 flex justify-center gap-1.5">
                  {FEATURES.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        i === active ? "w-8 bg-[#B6A6FF]" : "w-3 bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureMock({ kind }: { kind: Feature["mock"] }) {
  if (kind === "prontuario") return <ProntuarioMock />;
  if (kind === "ia") return <IAMock />;
  if (kind === "timeline") return <TimelineMock />;
  if (kind === "exames") return <ExamesMock />;
  if (kind === "comms") return <CommsMock />;
  return <TenancyMock />;
}

function MockHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        {sub && <div className="text-[11px] text-white/40">{sub}</div>}
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-white/10" />
        <span className="w-2 h-2 rounded-full bg-white/10" />
        <span className="w-2 h-2 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

function ProntuarioMock() {
  const sistemas = [
    { l: "Neurológico", v: "Reflexos preservados. Sem alterações." },
    { l: "Cardiorrespiratório", v: "FC 142 bpm · FR 28 mrpm · Sopro grau II/VI." },
    { l: "Digestivo", v: "Apetite seletivo há 3 dias. Sem vômitos." },
    { l: "Dermato", v: "Lesão eritematosa em região dorsolombar." },
  ];
  return (
    <div>
      <MockHeader title="Anamnese · Luna" sub="Felina · 8 anos · Persa" />
      <div className="p-5 space-y-3 text-sm">
        {sistemas.map((s) => (
          <div key={s.l} className="rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/40">{s.l}</span>
              <span className="text-[10px] text-emerald-400">salvo</span>
            </div>
            <p className="mt-1 text-white/85 leading-relaxed">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IAMock() {
  return (
    <div>
      <MockHeader title="Copilot · Luna" sub="Streaming · contexto carregado" />
      <div className="p-5 space-y-4 text-sm">
        <div className="flex justify-end">
          <div className="bg-white/[0.06] border border-white/5 rounded-xl rounded-tr-sm px-3.5 py-2 max-w-[80%] text-white/85">
            Resuma a evolução de Luna nos últimos 90 dias.
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#7A5CFF]/15 to-[#5B8CFF]/10 border border-[#7A5CFF]/20 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-white/85 leading-relaxed">
          Luna apresenta <strong className="text-white">creatinina ascendente</strong> em 3 medições
          consecutivas, com hematócrito estável. Padrão sugere disfunção renal pré-clínica.
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { l: "Cr", v: "1.6 → 2.3", c: "amber" },
              { l: "ALT", v: "82 → 145", c: "amber" },
              { l: "Hct", v: "39 → 38", c: "emerald" },
            ].map((k) => (
              <div key={k.l} className={`rounded-md border px-2 py-1.5 ${k.c === "amber" ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                <div className="text-[10px] text-white/50 uppercase">{k.l}</div>
                <div className={`text-xs font-medium ${k.c === "amber" ? "text-amber-300" : "text-emerald-300"}`}>{k.v}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/40 mt-2">
            Origem: 3 exames bioquímicos · 2 consultas de retorno
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineMock() {
  const events = [
    { i: Stethoscope, t: "Consulta de retorno", d: "12/05", sev: "info" },
    { i: FileText, t: "Bioquímico completo", d: "10/05", sev: "warning" },
    { i: Syringe, t: "Vacina V4 reforço", d: "20/02", sev: "info" },
    { i: AlertTriangle, t: "Alergia identificada", d: "08/01", sev: "critical" },
  ];
  const sevColor = (s: string) =>
    s === "critical"
      ? "border-rose-500/30 text-rose-300 bg-rose-500/10"
      : s === "warning"
        ? "border-amber-500/30 text-amber-300 bg-amber-500/10"
        : "border-[#7A5CFF]/30 text-[#B6A6FF] bg-[#7A5CFF]/10";
  return (
    <div>
      <MockHeader title="Timeline · Luna" sub="2026 · 14 eventos" />
      <div className="p-5">
        <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-white/5">
          {events.map((e) => (
            <div key={e.t} className="relative flex gap-3">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${sevColor(e.sev)}`}>
                <e.i className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-white truncate">{e.t}</span>
                  <span className="text-[11px] text-white/40 shrink-0">{e.d}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExamesMock() {
  return (
    <div>
      <MockHeader title="Exames · Luna" sub="Bucket privado · URLs assinadas" />
      <div className="p-5 space-y-3 text-sm">
        {[
          { t: "Bioquímico_completo_2026-05-10.pdf", s: "1.2 MB", st: "concluído", p: 100 },
          { t: "Hemograma_2026-04-22.pdf", s: "820 KB", st: "concluído", p: 100 },
          { t: "Urinalise_2026-05-12.pdf", s: "643 KB", st: "enviando", p: 64 },
        ].map((f) => (
          <div key={f.t} className="rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#B6A6FF] shrink-0" />
                <span className="text-white/85 truncate">{f.t}</span>
              </div>
              <span className={`text-[10px] uppercase tracking-wider ${f.st === "concluído" ? "text-emerald-400" : "text-[#B6A6FF]"}`}>
                {f.st}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.st === "concluído" ? "bg-emerald-400/70" : "bg-[#7A5CFF]"}`}
                  style={{ width: `${f.p}%`, transition: "width 600ms ease-out" }}
                />
              </div>
              <span className="text-[10px] text-white/40">{f.s}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommsMock() {
  const msgs = [
    { who: "Synvet", text: "Olá Ana! Confirmando consulta da Luna amanhã às 14:30.", time: "10:02", out: false },
    { who: "Ana", text: "Confirmado! Obrigada.", time: "10:04", out: true },
    { who: "Synvet", text: "Lembrete: vacina V4 da Luna vence em 7 dias.", time: "ontem", out: false },
  ];
  return (
    <div>
      <MockHeader title="Comunicação · WhatsApp" sub="Automações · 4 ativas" />
      <div className="p-5 space-y-3 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.out ? "justify-end" : ""}`}>
            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${m.out ? "bg-emerald-500/15 border border-emerald-500/20 text-emerald-100" : "bg-white/[0.05] border border-white/5 text-white/85"}`}>
              <div>{m.text}</div>
              <div className="text-[10px] text-white/40 mt-1">{m.time}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck2 className="w-3 h-3" /> consultation.created → mensagem enviada
          </span>
          <span className="text-emerald-400">entregue</span>
        </div>
      </div>
    </div>
  );
}

function TenancyMock() {
  const team = [
    { n: "Dra. Marina", r: "admin", c: "from-[#7A5CFF] to-[#5B8CFF]" },
    { n: "Dr. Felipe", r: "vet", c: "from-[#5B8CFF] to-[#34d399]" },
    { n: "João", r: "assistant", c: "from-white/30 to-white/10" },
  ];
  return (
    <div>
      <MockHeader title="Equipe · Clínica Vital" sub="3 membros · RBAC ativo" />
      <div className="p-5 space-y-3 text-sm">
        {team.map((m) => (
          <div key={m.n} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${m.c}`} />
              <div>
                <div className="text-white/85 font-medium">{m.n}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">{m.r}</div>
              </div>
            </div>
            <span className="text-[10px] text-white/40">isolado por clinicId</span>
          </div>
        ))}
        <div className="pt-2 text-[11px] text-white/40 flex items-center gap-1.5">
          <Workflow className="w-3 h-3" /> auditoria com autoria e data em todo registro
        </div>
      </div>
    </div>
  );
}
