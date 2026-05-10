import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useGetMe,
  useCreateBillingCheckout,
  useCreateBillingPortal,
} from "@workspace/api-client-react";
import { Check, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";
import {
  PLANS,
  PLAN_ORDER,
  STATUS_LABEL,
  formatBrl,
  type PlanId,
  type PayablePlanId,
} from "@/lib/plans";
import { usePermissions } from "@/hooks/use-permissions";

const STATUS_BADGE: Record<string, string> = {
  trialing: "bg-primary/15 text-primary border-primary/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past_due: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  canceled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  suspended: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function SubscriptionCard() {
  const { data: me, isLoading } = useGetMe();
  const { isAdmin } = usePermissions();
  const billing = me?.billing;
  const [pendingPlan, setPendingPlan] = useState<PayablePlanId | null>(null);
  const [portalPending, setPortalPending] = useState(false);

  const checkout = useCreateBillingCheckout();
  const portal = useCreateBillingPortal();

  if (isLoading || !billing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
          <CardDescription>Carregando informações do plano…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentPlan = PLANS[billing.plan as PlanId];
  const inTrial = billing.status === "trialing";
  const isActive = billing.status === "active";
  const needsAttention =
    billing.status === "past_due" ||
    billing.status === "suspended" ||
    billing.status === "canceled";
  const days = billing.daysLeft ?? null;

  const handleUpgrade = (planId: PayablePlanId) => {
    setPendingPlan(planId);
    checkout.mutate(
      { data: { plan: planId } },
      {
        onSuccess: ({ url }) => {
          if (url) window.location.assign(url);
          else {
            toast.error("Não foi possível abrir o checkout. Tente novamente.");
            setPendingPlan(null);
          }
        },
        onError: (err) => {
          const msg =
            err instanceof Error ? err.message : "Erro ao iniciar checkout";
          toast.error(msg);
          setPendingPlan(null);
        },
      },
    );
  };

  const handlePortal = () => {
    setPortalPending(true);
    portal.mutate(undefined, {
      onSuccess: ({ url }) => {
        setPortalPending(false);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else toast.error("Não foi possível abrir o portal de assinatura.");
      },
      onError: (err) => {
        setPortalPending(false);
        const msg =
          err instanceof Error ? err.message : "Erro ao abrir portal";
        toast.error(msg);
      },
    });
  };

  return (
    <div className="space-y-6">
      {needsAttention && isAdmin && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <p className="font-medium text-rose-200">
                {billing.status === "past_due"
                  ? "Pagamento pendente"
                  : billing.status === "canceled"
                    ? "Assinatura cancelada"
                    : "Conta suspensa"}
              </p>
              <p className="text-rose-200/80 text-xs mt-0.5">
                {billing.status === "canceled"
                  ? "Reative sua assinatura no portal Stripe para continuar usando."
                  : "Atualize seu meio de pagamento no portal Stripe para manter o acesso."}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handlePortal}
              disabled={portalPending}
              data-testid="button-resolve-payment"
            >
              {portalPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-1.5" />
              )}
              Atualizar pagamento
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Plano atual
          </CardTitle>
          <CardDescription>
            {inTrial
              ? "Você está no período de avaliação gratuita."
              : "Detalhes da sua assinatura."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Plano
              </p>
              <p className="text-2xl font-semibold mt-1">
                {currentPlan?.name ?? billing.plan}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentPlan?.tagline}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Status
              </p>
              <span
                className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                  STATUS_BADGE[billing.status] ?? STATUS_BADGE.canceled
                }`}
                data-testid="billing-status-badge"
              >
                {STATUS_LABEL[billing.status] ?? billing.status}
              </span>
              {days != null && inTrial && (
                <p className="text-xs text-muted-foreground mt-2">
                  {days} {days === 1 ? "dia restante" : "dias restantes"}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {inTrial ? "Trial até" : isActive ? "Próxima cobrança" : "Período"}
              </p>
              <p className="text-lg font-medium mt-1">
                {inTrial && billing.trialEndsAt
                  ? format(new Date(billing.trialEndsAt), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })
                  : billing.currentPeriodEnd
                    ? format(new Date(billing.currentPeriodEnd), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })
                    : "—"}
              </p>
            </div>
          </div>

          {isActive && isAdmin && (
            <div className="mt-6 pt-6 border-t border-border/60 flex justify-end">
              <Button
                variant="outline"
                onClick={handlePortal}
                disabled={portalPending}
                data-testid="button-manage-subscription"
              >
                {portalPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                )}
                Gerenciar assinatura
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-1">
          {isActive ? "Mudar de plano" : "Escolha o plano ideal"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isAdmin
            ? "Pagamento seguro via Stripe. Você pode cancelar a qualquer momento."
            : "Apenas administradores podem alterar a assinatura. Fale com o admin da clínica."}
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = billing.plan === id && isActive;
            const isHighlighted = id === "pro";
            const isPending = pendingPlan === id;
            const planSlug = id;
            return (
              <Card
                key={id}
                className={`relative ${
                  isHighlighted
                    ? "border-primary/50 shadow-[0_0_30px_-12px_rgba(122,92,255,0.5)]"
                    : ""
                }`}
                data-testid={`plan-${id}`}
              >
                {isHighlighted && (
                  <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                    Recomendado
                  </span>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.tagline}</CardDescription>
                  <p className="text-3xl font-semibold mt-2">
                    {formatBrl(plan.priceMonthlyBrl)}
                    <span className="text-sm text-muted-foreground font-normal">
                      /mês
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Plano atual
                    </Button>
                  ) : isAdmin ? (
                    <Button
                      className="w-full"
                      variant={isHighlighted ? "default" : "outline"}
                      onClick={() => handleUpgrade(planSlug)}
                      disabled={pendingPlan !== null}
                      data-testid={`upgrade-${id}`}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          Abrindo checkout…
                        </>
                      ) : isActive ? (
                        "Mudar para este plano"
                      ) : (
                        "Fazer upgrade"
                      )}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>
                      Apenas admin
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
