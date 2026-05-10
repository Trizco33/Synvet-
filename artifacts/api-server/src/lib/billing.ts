import { TRIAL_DAYS, type Clinic } from "@workspace/db";

export type BillingSource = "stripe" | "trial";

export type BillingStatusPayload = {
  plan: Clinic["plan"];
  status: Clinic["status"];
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysLeft: number | null;
  /**
   * Origem da verdade do estado de billing:
   * - "stripe": clínica tem subscription ativa; status/período vêm do webhook Stripe.
   * - "trial":  clínica ainda não fez upgrade; trialEndsAt é a fonte de verdade.
   */
  source: BillingSource;
};

export function trialEndsAtFromNow(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Resolve o estado de billing exposto ao cliente.
 *
 * Quando `stripeSubscriptionId` está presente, a clínica tem assinatura no Stripe
 * e o webhook (`/api/billing/webhook`) é a fonte de verdade — sincroniza
 * plan/status/currentPeriodEnd a cada evento. Nesse caminho ignoramos
 * `trialEndsAt` (campo histórico do trial inicial) e usamos `currentPeriodEnd`
 * para calcular `daysLeft`.
 *
 * Sem `stripeSubscriptionId`, caímos no caminho trial: a clínica nunca foi
 * cobrada, então `trialEndsAt` é a fonte de verdade.
 */
export function buildBillingStatus(clinic: Clinic): BillingStatusPayload {
  const now = Date.now();
  const hasStripeSubscription = Boolean(clinic.stripeSubscriptionId);

  if (hasStripeSubscription) {
    const periodEnd = clinic.currentPeriodEnd;
    const daysLeft = periodEnd
      ? Math.max(0, Math.ceil((periodEnd.getTime() - now) / MS_PER_DAY))
      : null;
    return {
      plan: clinic.plan,
      status: clinic.status,
      trialEndsAt: null,
      currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
      daysLeft,
      source: "stripe",
    };
  }

  const trialEnd = clinic.trialEndsAt;
  const daysLeft =
    clinic.status === "trialing" && trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now) / MS_PER_DAY))
      : null;
  return {
    plan: clinic.plan,
    status: clinic.status,
    trialEndsAt: trialEnd ? trialEnd.toISOString() : null,
    currentPeriodEnd: null,
    daysLeft,
    source: "trial",
  };
}
