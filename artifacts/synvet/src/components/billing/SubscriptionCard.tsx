import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@workspace/api-client-react";
import { Check, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PLANS, PLAN_ORDER, STATUS_LABEL, formatBrl, type PlanId } from "@/lib/plans";

export function SubscriptionCard() {
  const { data: me, isLoading } = useGetMe();
  const billing = me?.billing;

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
  const days = billing.daysLeft ?? null;

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Plano</p>
              <p className="text-2xl font-semibold mt-1">{currentPlan?.name ?? billing.plan}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentPlan?.tagline}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
              <p className="text-lg font-medium mt-1">
                {STATUS_LABEL[billing.status] ?? billing.status}
              </p>
              {days != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {inTrial
                    ? `${days} ${days === 1 ? "dia restante" : "dias restantes"}`
                    : `Renovação em ${days} dias`}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {inTrial ? "Trial até" : "Próximo ciclo"}
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
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-1">Escolha o plano ideal</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tudo o que você usa no trial continua disponível conforme o plano escolhido.
          Pagamento online em breve.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = billing.plan === id;
            const isHighlighted = id === "pro";
            return (
              <Card
                key={id}
                className={`relative ${
                  isHighlighted ? "border-primary/50 shadow-[0_0_30px_-12px_rgba(122,92,255,0.5)]" : ""
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
                    <span className="text-sm text-muted-foreground font-normal">/mês</span>
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
                  <Button
                    className="w-full"
                    variant={isHighlighted ? "default" : "outline"}
                    disabled
                    title="Pagamento online em breve"
                    data-testid={`upgrade-${id}`}
                  >
                    {isCurrent ? "Plano atual" : "Fazer upgrade (em breve)"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Para ativar um plano agora, fale com a equipe Synvet pelo WhatsApp ou e-mail
          de suporte.
        </p>
      </div>
    </div>
  );
}
