import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  Activity,
  MessageSquareText,
  Smartphone,
  ShieldCheck,
  Zap,
  Workflow,
  ClipboardList,
  Stethoscope,
  Brain,
  ArrowRight,
  Check,
  Bot,
  CalendarCheck2,
  FileText,
  Syringe,
  AlertTriangle,
  Send,
} from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { LeadForm } from "@/components/site/lead-form";
import {
  EcgLine,
  PulseGlow,
  PawTrail,
  StethoscopeConnection,
  HeartbeatDot,
  GridFloor,
  SectionDivider,
} from "@/components/site/motion-fx";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { ShineCard } from "@/components/site/shine-card";
import { WorkflowFlow } from "@/components/site/workflow-flow";
import { StickyFeatures } from "@/components/site/sticky-features";
import { SocialProof } from "@/components/site/social-proof";
import { AIInsights } from "@/components/site/ai-insights";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

function Glow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl opacity-60 ${className}`}
    />
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      {eyebrow && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 mb-4">
          <Sparkles className="w-3 h-3" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-[1.05]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
      <PulseGlow className="-top-40 -left-40" size={700} color="#7A5CFF" intensity={0.22} />
      <PulseGlow className="-top-32 right-0" size={600} color="#5B8CFF" intensity={0.16} />
      <GridFloor opacity={0.05} />
      <PawTrail count={6} color="#7A5CFF" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(122,92,255,0.15),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-white/70 bg-white/5 border border-white/10 mb-6 backdrop-blur">
            <HeartbeatDot color="#34d399" size={8} />
            Beta privado aberto para clínicas selecionadas
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-white leading-[1.02]">
            A nova geração de
            <br />
            <span className="bg-gradient-to-r from-[#B6A6FF] via-[#7A5CFF] to-[#5B8CFF] bg-clip-text text-transparent">
              software veterinário.
            </span>
          </h1>

          <div className="relative mt-8 mx-auto max-w-3xl h-10">
            <EcgLine className="absolute inset-0 w-full h-full" color="#7A5CFF" duration={3.4} opacity={0.5} />
          </div>

          <p className="mt-4 text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Menos burocracia, mais medicina. Prontuários inteligentes, IA
            assistiva contextual, agenda integrada e a experiência mobile que sua
            clínica merece.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#solicitar-acesso">
              <Button
                size="lg"
                className="h-12 px-7 text-base bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] text-white hover:opacity-95 shadow-[0_0_40px_-8px_rgba(122,92,255,0.7)]"
                data-testid="hero-cta"
              >
                Solicitar acesso <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
            <a href="#produto">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base border-white/15 text-white/90 hover:bg-white/5 hover:text-white"
              >
                Ver demonstração
              </Button>
            </a>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-white/40">
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Sem cartão</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Migração assistida</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Funciona offline</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-16 md:mt-20"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-[#7A5CFF]/30 to-[#5B8CFF]/30 blur-3xl opacity-40 rounded-[3rem]" />
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm overflow-hidden shadow-2xl">
            <DashboardMock />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function DashboardMock() {
  const items = [
    { time: "08:30", pet: "Luna", tutor: "Ana M.", type: "Retorno" },
    { time: "09:00", pet: "Thor", tutor: "Carlos R.", type: "Vacinação" },
    { time: "09:45", pet: "Mia", tutor: "Júlia P.", type: "Consulta" },
    { time: "10:30", pet: "Bento", tutor: "Pedro L.", type: "Castração" },
  ];
  return (
    <div className="grid grid-cols-12 gap-px bg-white/5">
      <aside className="col-span-12 md:col-span-3 bg-[#0a0c14] p-5">
        <div className="text-xs uppercase tracking-wider text-white/40 mb-3">Clínica</div>
        <div className="space-y-1.5">
          {[
            { l: "Dashboard", a: true, i: Activity },
            { l: "Pacientes", a: false, i: Stethoscope },
            { l: "Consultas", a: false, i: CalendarCheck2 },
            { l: "Exames", a: false, i: FileText },
            { l: "Vacinas", a: false, i: Syringe },
          ].map((it) => (
            <div
              key={it.l}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm ${
                it.a ? "bg-[#7A5CFF]/15 text-white" : "text-white/55"
              }`}
            >
              <it.i className="w-4 h-4" />
              {it.l}
            </div>
          ))}
        </div>
      </aside>
      <main className="col-span-12 md:col-span-9 bg-[#080a11] p-6">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { l: "Consultas hoje", v: "12", d: "+3 vs ontem" },
            { l: "Pacientes ativos", v: "284", d: "8 novos" },
            { l: "Exames pendentes", v: "5", d: "Aguardando laudo" },
          ].map((k) => (
            <div key={k.l} className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
              <div className="text-[11px] text-white/40 uppercase tracking-wide">{k.l}</div>
              <div className="text-2xl font-semibold text-white mt-1">{k.v}</div>
              <div className="text-[11px] text-white/40 mt-1">{k.d}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/5">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="text-sm font-medium text-white">Agenda do dia</div>
            <div className="text-xs text-white/40">14 de maio</div>
          </div>
          <div className="divide-y divide-white/5">
            {items.map((it) => (
              <div key={it.time} className="px-4 py-2.5 flex items-center gap-4 text-sm">
                <span className="text-white/40 w-12">{it.time}</span>
                <span className="text-white font-medium flex-1">{it.pet}</span>
                <span className="text-white/50 hidden sm:inline">{it.tutor}</span>
                <span className="text-[10px] uppercase tracking-wide text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 px-2 py-0.5 rounded-full">
                  {it.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div {...fadeUp}>
      <ShineCard className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 h-full hover:bg-white/[0.04] transition-colors">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7A5CFF]/30 to-[#5B8CFF]/20 border border-[#7A5CFF]/30 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-[#B6A6FF]" />
        </div>
        <h3 className="text-lg font-medium text-white mb-1.5">{title}</h3>
        <p className="text-sm text-white/55 leading-relaxed">{children}</p>
      </ShineCard>
    </motion.div>
  );
}


function CopilotShowcase() {
  return (
    <section id="copilot" className="relative py-24 md:py-32 overflow-hidden">
      <PulseGlow className="left-1/2 -translate-x-1/2 top-10" size={600} color="#7A5CFF" intensity={0.14} />
      <StethoscopeConnection
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 hidden lg:block w-full h-40"
        color="#5B8CFF"
        opacity={0.32}
        duration={3.2}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div {...fadeUp}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-[#B6A6FF] bg-[#7A5CFF]/10 border border-[#7A5CFF]/20 mb-4">
            <Bot className="w-3 h-3" /> Synvet Copilot
          </div>
          <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight leading-[1.05]">
            Um copiloto clínico que <span className="text-white/60">conhece o paciente</span>.
          </h2>
          <p className="mt-5 text-white/60 leading-relaxed text-lg">
            O Copilot lê automaticamente o histórico do animal — consultas
            anteriores, exames com valores fora-de-range, vacinas, alergias — e
            responde suas dúvidas clínicas com contexto. Streaming em tempo real,
            citações de origem e memória persistente por paciente.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/70">
            {[
              "Pesquisa veterinária assistida em segundos",
              "Sinaliza valores laboratoriais fora-de-range automaticamente",
              "Histórico de conversas por paciente — nunca perde o raciocínio",
              "Sanitização de dados sensíveis antes do envio ao modelo",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#B6A6FF] mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...fadeUp} className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#7A5CFF]/30 to-[#5B8CFF]/20 blur-3xl opacity-50 rounded-[3rem]" />
          <div className="relative rounded-2xl border border-white/10 bg-[#0a0c14] overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#7A5CFF] to-[#5B8CFF] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Copilot · Luna</div>
                  <div className="text-[11px] text-white/40">Felina · 8 anos · Persa</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <HeartbeatDot color="#34d399" size={6} />
                Ao vivo
              </span>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="flex justify-end">
                <div className="bg-white/[0.06] border border-white/5 rounded-xl rounded-tr-sm px-3.5 py-2 max-w-[80%] text-white/85">
                  Como interpreto a creatinina alta com hematócrito normal?
                </div>
              </div>
              <div className="flex">
                <div className="bg-gradient-to-br from-[#7A5CFF]/15 to-[#5B8CFF]/10 border border-[#7A5CFF]/20 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[88%] text-white/85 leading-relaxed">
                  Luna apresenta <strong className="text-white">creatinina 2,3 mg/dL ↑</strong>{" "}
                  (ref 0.5–1.8) sem anemia, sugerindo possível disfunção renal
                  pré-clínica.
                  <span className="block text-xs text-white/40 mt-1.5">
                    Origem: exame de 12/05/2026 · consulta de 10/05/2026
                  </span>
                </div>
              </div>
              <div className="flex">
                <div className="bg-gradient-to-br from-[#7A5CFF]/15 to-[#5B8CFF]/10 border border-[#7A5CFF]/20 rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[88%] text-white/85">
                  Sugiro avaliar SDMA, urinálise (DU) e relação UPC para confirmar.
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-white/40">
                    <HeartbeatDot color="#34d399" size={6} />
                    digitando...
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-white/5 p-3 flex items-center gap-2">
              <div className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/40">
                Pergunte algo sobre Luna...
              </div>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7A5CFF] to-[#5B8CFF] flex items-center justify-center">
                <Send className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function MobileSection() {
  return (
    <section id="mobile" className="relative py-24 md:py-32 overflow-hidden">
      <PulseGlow className="-right-40 top-10" size={500} color="#5B8CFF" intensity={0.12} />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div {...fadeUp}>
          <SectionTitle
            eyebrow="Mobile-first real"
            title="Funciona no consultório, no celular e instalado como app."
            description="Synvet é um Progressive Web App: instala em qualquer celular ou tablet, funciona offline e atualiza sozinho. A mesma experiência premium em qualquer tela."
            align="left"
          />
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { i: Smartphone, t: "PWA instalável", d: "Adicionar à tela inicial" },
              { i: Zap, t: "Atualização automática", d: "Sem hard refresh" },
              { i: Activity, t: "Modo offline", d: "Continua funcionando" },
              { i: ShieldCheck, t: "Dados criptografados", d: "Em trânsito e em repouso" },
            ].map((c) => (
              <ShineCard key={c.t} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <c.i className="w-5 h-5 text-[#B6A6FF] mb-2" />
                <div className="text-sm text-white font-medium">{c.t}</div>
                <div className="text-xs text-white/50 mt-0.5">{c.d}</div>
              </ShineCard>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="relative flex justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#7A5CFF]/30 to-[#5B8CFF]/20 blur-3xl opacity-50" />
          <div className="relative w-[280px] h-[560px] rounded-[2.5rem] border border-white/10 bg-[#06070d] p-2 shadow-2xl">
            <div className="w-full h-full rounded-[2rem] bg-gradient-to-b from-[#0a0c14] to-[#06070d] overflow-hidden flex flex-col">
              <div className="px-5 pt-7 pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Hoje</div>
                  <div className="text-lg font-semibold text-white">Boa tarde, Dra.</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7A5CFF] to-[#5B8CFF]" />
              </div>
              <div className="px-5 grid grid-cols-2 gap-2 mb-3">
                {[{ l: "Consultas", v: "12" }, { l: "Pacientes", v: "284" }].map((k) => (
                  <div key={k.l} className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                    <div className="text-[10px] text-white/40 uppercase">{k.l}</div>
                    <div className="text-lg font-semibold text-white">{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-3">
                <div className="text-[11px] uppercase text-white/40 mb-2 tracking-wider">Próximas</div>
                <div className="space-y-1.5">
                  {["Luna · 14:30", "Thor · 15:00", "Mia · 15:45"].map((s) => (
                    <div key={s} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="w-7 h-7 rounded-md bg-[#7A5CFF]/15 flex items-center justify-center">
                        <Stethoscope className="w-3.5 h-3.5 text-[#B6A6FF]" />
                      </div>
                      <div className="text-xs text-white/80">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-auto border-t border-white/5 px-2 py-2.5 flex items-center justify-around">
                {[Activity, Stethoscope, CalendarCheck2, FileText, Workflow].map((Ic, i) => (
                  <Ic key={i} className={`w-4 h-4 ${i === 0 ? "text-[#B6A6FF]" : "text-white/30"}`} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="seguranca" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-10 md:p-16">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div {...fadeUp}>
              <SectionTitle
                eyebrow="Segurança e privacidade"
                title="Construído com isolamento, auditoria e zelo desde o primeiro dia."
                description="Cada clínica vive em seu próprio espaço lógico. Dados sensíveis sanitizados antes de qualquer integração com IA. Toda ação registrada com autoria e data."
                align="left"
              />
            </motion.div>
            <motion.div {...fadeUp} className="grid sm:grid-cols-2 gap-4">
              {[
                { i: ShieldCheck, t: "Multi-tenancy", d: "Isolamento total por clínica em cada query." },
                { i: Activity, t: "Auditoria", d: "Autoria, data e versionamento em cada registro." },
                { i: FileText, t: "Armazenamento seguro", d: "Laudos em bucket privado com URLs assinadas." },
                { i: Workflow, t: "RBAC granular", d: "Admin, veterinário e assistente com permissões claras." },
              ].map((c) => (
                <div key={c.t} className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                  <c.i className="w-5 h-5 text-[#B6A6FF] mb-2" />
                  <div className="text-sm text-white font-medium">{c.t}</div>
                  <div className="text-xs text-white/55 mt-1">{c.d}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "Grátis",
      sub: "para começar",
      desc: "Para autônomos e clínicas testando o Synvet.",
      features: [
        "1 veterinário",
        "Até 100 pacientes",
        "Prontuário e timeline",
        "Mobile / PWA",
      ],
      cta: "Começar agora",
      highlight: false,
    },
    {
      name: "Pro",
      price: "R$ 149",
      sub: "/mês por usuário",
      desc: "Para clínicas que querem operar com excelência.",
      features: [
        "Veterinários ilimitados (cobrança por usuário)",
        "Pacientes e exames ilimitados",
        "IA Copilot e organização inteligente",
        "WhatsApp e lembretes automáticos",
        "Suporte prioritário",
      ],
      cta: "Começar trial",
      highlight: true,
    },
    {
      name: "Clinic",
      price: "Sob consulta",
      sub: "para grupos",
      desc: "Para redes de clínicas e hospitais veterinários.",
      features: [
        "Multi-unidades com governança",
        "Onboarding e migração assistida",
        "SLA dedicado",
        "Integrações personalizadas",
      ],
      cta: "Falar com vendas",
      highlight: false,
    },
  ];
  return (
    <section id="planos" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionTitle
          eyebrow="Planos"
          title="Simples como deveria ser. Premium como sua clínica merece."
          description="Sem fidelidade. Sem letras miúdas. Cancele quando quiser."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <motion.div
              key={p.name}
              {...fadeUp}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                p.highlight
                  ? "border-[#7A5CFF]/40 bg-gradient-to-b from-[#7A5CFF]/10 to-[#5B8CFF]/5 shadow-[0_0_60px_-20px_rgba(122,92,255,0.6)]"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] text-white">
                  Mais escolhido
                </div>
              )}
              <div className="text-sm uppercase tracking-wider text-white/50">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl md:text-4xl font-semibold text-white">{p.price}</span>
                <span className="text-sm text-white/40">{p.sub}</span>
              </div>
              <p className="mt-2 text-sm text-white/55">{p.desc}</p>
              <ul className="mt-6 space-y-2.5 text-sm text-white/70 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${p.highlight ? "text-[#B6A6FF]" : "text-emerald-400"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="#solicitar-acesso" className="mt-7">
                <Button
                  className={`w-full h-11 ${
                    p.highlight
                      ? "bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] text-white hover:opacity-95"
                      : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {p.cta}
                </Button>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="solicitar-acesso" className="relative py-24 md:py-32 overflow-hidden">
      <PulseGlow className="left-1/2 -translate-x-1/2 top-0" size={700} color="#7A5CFF" intensity={0.18} />
      <PawTrail count={4} color="#5B8CFF" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a0c14] to-[#06070d] p-8 md:p-14 grid lg:grid-cols-2 gap-10">
          <div>
            <SectionTitle
              eyebrow="Vamos começar"
              title="Mostre ao seu time como uma clínica moderna funciona."
              description="Conte sua realidade e nossa equipe libera o acesso, faz o onboarding e migra seus dados sem dor."
              align="left"
            />
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                "Onboarding 1:1 com nossa equipe",
                "Importação de dados existente",
                "Treinamento da equipe incluso",
                "Suporte por WhatsApp",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2 text-white/60">
                  <Check className="w-4 h-4 mt-0.5 text-[#B6A6FF] shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div>
            <LeadForm source="landing-final-cta" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#06070d] text-white relative overflow-x-hidden">
      <SmoothScroll />
      <SiteNav />
      <main>
        <Hero />
        <WorkflowFlow />
        <SectionDivider />
        <div id="produto">
          <StickyFeatures />
        </div>
        <AIInsights />
        <CopilotShowcase />
        <MobileSection />
        <SocialProof />
        <SecuritySection />
        <PricingSection />
        <FinalCTA />
      </main>
      <SiteFooter />
      <div className="fixed bottom-6 right-6 z-40 hidden md:block">
        <Link href="/login">
          <Button variant="outline" className="border-white/10 bg-[#0a0c14]/80 backdrop-blur text-white/80 hover:bg-white/5">
            Já tenho conta
          </Button>
        </Link>
      </div>
    </div>
  );
}
