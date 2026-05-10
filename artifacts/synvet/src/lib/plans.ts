export type PlanId = "trial" | "essencial" | "pro" | "clinic_plus";

export type PlanInfo = {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthlyBrl: number;
  highlights: string[];
};

export const PLANS: Record<PlanId, PlanInfo> = {
  trial: {
    id: "trial",
    name: "Trial",
    tagline: "14 dias grátis para experimentar tudo",
    priceMonthlyBrl: 0,
    highlights: [
      "Acesso completo a todas as funcionalidades",
      "Até 5 usuários",
      "Sem cartão de crédito",
      "Migração assistida de dados",
    ],
  },
  essencial: {
    id: "essencial",
    name: "Essencial",
    tagline: "Para clínicas começando a digitalizar",
    priceMonthlyBrl: 149,
    highlights: [
      "Pacientes, tutores, agenda e prontuário",
      "Exames com upload de laudos",
      "IA assistiva (resumos e organização)",
      "Até 3 usuários",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "A experiência Synvet completa",
    priceMonthlyBrl: 349,
    highlights: [
      "Tudo do Essencial",
      "Synvet Copilot (chat clínico contextual)",
      "Comunicação WhatsApp + automações",
      "Até 10 usuários",
    ],
  },
  clinic_plus: {
    id: "clinic_plus",
    name: "Clínica+",
    tagline: "Para hospitais e redes de clínicas",
    priceMonthlyBrl: 749,
    highlights: [
      "Tudo do Pro",
      "Até 50 usuários",
      "Suporte dedicado e onboarding 1:1",
      "Volume estendido de WhatsApp",
    ],
  },
};

/**
 * Planos pagáveis (não inclui trial). Fonte única para gating de UI e
 * tipagem dos slugs aceitos pelo /billing/checkout. Manter alinhado com
 * PLAN_PRICE_ENV em lib/db/src/billing.ts.
 */
export const PAYABLE_PLAN_IDS = ["essencial", "pro", "clinic_plus"] as const;
export type PayablePlanId = (typeof PAYABLE_PLAN_IDS)[number];

export const PLAN_ORDER: PayablePlanId[] = [...PAYABLE_PLAN_IDS];

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

export const STATUS_LABEL: Record<string, string> = {
  trialing: "Em trial",
  active: "Ativo",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
  suspended: "Suspenso",
};
