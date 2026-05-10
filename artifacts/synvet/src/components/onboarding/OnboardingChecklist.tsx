import { useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetOnboardingState,
  useDismissOnboarding,
  getGetOnboardingStateQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  PawPrint,
  CalendarPlus,
  MessageSquare,
  Smartphone,
  Users,
  CreditCard,
  Check,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";

type StepId =
  | "clinic_profile"
  | "first_patient"
  | "first_consultation"
  | "comms_template"
  | "whatsapp_channel"
  | "invite_team"
  | "choose_plan";

type StepMeta = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: Record<StepId, StepMeta> = {
  clinic_profile: {
    title: "Completar dados da clínica",
    description: "Adicione CNPJ, telefone e endereço para emitir documentos.",
    href: "/app/configuracoes",
    icon: Building2,
  },
  first_patient: {
    title: "Cadastrar primeiro tutor e paciente",
    description: "Comece criando o primeiro pet com seu tutor responsável.",
    href: "/app/tutores",
    icon: PawPrint,
  },
  first_consultation: {
    title: "Agendar primeira consulta",
    description: "Marque um atendimento na agenda para testar o fluxo.",
    href: "/app/consultas",
    icon: CalendarPlus,
  },
  comms_template: {
    title: "Configurar template de mensagem",
    description: "Personalize um template para confirmações ou lembretes.",
    href: "/app/comunicacao",
    icon: MessageSquare,
  },
  whatsapp_channel: {
    title: "Conectar WhatsApp",
    description: "Conecte um canal WhatsApp para enviar mensagens automáticas.",
    href: "/app/comunicacao",
    icon: Smartphone,
  },
  invite_team: {
    title: "Convidar equipe",
    description: "Adicione veterinários e assistentes da sua clínica.",
    href: "/app/configuracoes",
    icon: Users,
  },
  choose_plan: {
    title: "Escolher plano",
    description: "Garanta seu acesso após o trial e desbloqueie todos os recursos.",
    href: "/app/configuracoes",
    icon: CreditCard,
  },
};

export function OnboardingChecklist() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const isAdmin = me?.role === "admin";

  const { data: state, isLoading } = useGetOnboardingState({
    query: {
      queryKey: getGetOnboardingStateQueryKey(),
      enabled: isAdmin,
    },
  });

  const dismiss = useDismissOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetOnboardingStateQueryKey(),
        });
      },
    },
  });

  const { doneCount, totalCount, percent } = useMemo(() => {
    const total = state?.steps.length ?? 0;
    const done = state?.steps.filter((s) => s.done).length ?? 0;
    return {
      doneCount: done,
      totalCount: total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [state]);

  if (!isAdmin || isLoading || !state || !state.visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className="relative overflow-hidden border-primary/30"
          style={{
            background:
              "linear-gradient(135deg, rgba(91,140,255,0.08) 0%, rgba(122,92,255,0.08) 100%)",
          }}
          data-testid="onboarding-checklist"
        >
          <div
            className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #5B8CFF 0%, transparent 70%)" }}
          />
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md shadow-primary/30"
                style={{ background: "linear-gradient(135deg, #5B8CFF 0%, #7A5CFF 100%)" }}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl">Comece em 7 passos</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Conclua a configuração da sua clínica para extrair o máximo da Synvet
                  durante o trial.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 w-48 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full"
                      style={{
                        background: "linear-gradient(90deg, #5B8CFF 0%, #7A5CFF 100%)",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <span
                    className="text-xs text-muted-foreground"
                    data-testid="onboarding-progress"
                  >
                    {doneCount} de {totalCount} concluídos
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => dismiss.mutate()}
              disabled={dismiss.isPending}
              aria-label="Dispensar checklist"
              data-testid="onboarding-dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {state.steps.map((step) => {
              const meta = STEPS[step.id as StepId];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <Link key={step.id} href={meta.href}>
                  <div
                    className={`group flex h-full items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer ${
                      step.done
                        ? "border-green-500/20 bg-green-500/5 opacity-70"
                        : "border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                    data-testid={`onboarding-step-${step.id}`}
                    data-done={step.done}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        step.done
                          ? "bg-green-500/20 text-green-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {step.done ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-semibold leading-tight ${
                            step.done ? "line-through" : ""
                          }`}
                        >
                          {meta.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {meta.description}
                      </p>
                    </div>
                    {!step.done && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
