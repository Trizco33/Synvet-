import type { ClinicPlan } from "./schema/clinics";

export type PlanFeatures = {
  copilot: boolean;
  commsWhatsapp: boolean;
  aiAssist: boolean;
  multiUser: boolean;
};

export type PlanLimits = {
  users: number;
  petsPerMonth: number | null;
  consultationsPerMonth: number | null;
  whatsappMessagesPerMonth: number | null;
};

export type PlanDefinition = {
  id: ClinicPlan;
  name: string;
  tagline: string;
  priceMonthlyBrl: number;
  features: PlanFeatures;
  limits: PlanLimits;
  highlights: string[];
  /**
   * Env var (no servidor) que carrega o Stripe Price ID recurring deste plano.
   * Trial não tem price (não é cobrado). Lookup runtime via process.env[stripePriceEnvVar].
   * Mantido como nome de var em vez do valor para não vazar IDs em código versionado
   * e permitir alternar entre test/live mode sem rebuild.
   */
  stripePriceEnvVar: string | null;
};

export const TRIAL_DAYS = 14;

/**
 * Mapeamento canônico plan ↔ env var do price ID Stripe.
 * Re-exportado para uso no servidor (lib/stripe.ts) e clientes que precisam
 * resolver o priceId em tempo de request.
 */
export const PLAN_PRICE_ENV: Partial<Record<ClinicPlan, string>> = {
  essencial: "STRIPE_PRICE_ESSENCIAL",
  pro: "STRIPE_PRICE_PRO",
  clinic_plus: "STRIPE_PRICE_CLINIC_PLUS",
};

export const PLANS: Record<ClinicPlan, PlanDefinition> = {
  trial: {
    id: "trial",
    name: "Trial",
    tagline: "14 dias grátis para experimentar tudo",
    priceMonthlyBrl: 0,
    features: { copilot: true, commsWhatsapp: true, aiAssist: true, multiUser: true },
    limits: {
      users: 5,
      petsPerMonth: null,
      consultationsPerMonth: null,
      whatsappMessagesPerMonth: 200,
    },
    highlights: [
      "Acesso completo a todas as funcionalidades",
      "Até 5 usuários",
      "Sem cartão de crédito",
      "Migração assistida de dados",
    ],
    stripePriceEnvVar: null,
  },
  essencial: {
    id: "essencial",
    name: "Essencial",
    tagline: "Para clínicas começando a digitalizar",
    priceMonthlyBrl: 149,
    features: { copilot: false, commsWhatsapp: false, aiAssist: true, multiUser: true },
    limits: {
      users: 3,
      petsPerMonth: null,
      consultationsPerMonth: null,
      whatsappMessagesPerMonth: 0,
    },
    highlights: [
      "Pacientes, tutores, agenda e prontuário",
      "Exames com upload de laudos",
      "IA assistiva (resumos e organização)",
      "Até 3 usuários",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ESSENCIAL",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "A experiência Synvet completa",
    priceMonthlyBrl: 349,
    features: { copilot: true, commsWhatsapp: true, aiAssist: true, multiUser: true },
    limits: {
      users: 10,
      petsPerMonth: null,
      consultationsPerMonth: null,
      whatsappMessagesPerMonth: 2000,
    },
    highlights: [
      "Tudo do Essencial",
      "Synvet Copilot (chat clínico contextual)",
      "Comunicação WhatsApp + automações",
      "Até 10 usuários",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_PRO",
  },
  clinic_plus: {
    id: "clinic_plus",
    name: "Clínica+",
    tagline: "Para hospitais e redes de clínicas",
    priceMonthlyBrl: 749,
    features: { copilot: true, commsWhatsapp: true, aiAssist: true, multiUser: true },
    limits: {
      users: 50,
      petsPerMonth: null,
      consultationsPerMonth: null,
      whatsappMessagesPerMonth: 10000,
    },
    highlights: [
      "Tudo do Pro",
      "Até 50 usuários",
      "Suporte dedicado e onboarding 1:1",
      "Volume estendido de WhatsApp",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_CLINIC_PLUS",
  },
};

export function getPlan(id: ClinicPlan): PlanDefinition {
  return PLANS[id];
}

export function isFeatureEnabled(plan: ClinicPlan, feature: keyof PlanFeatures): boolean {
  return PLANS[plan].features[feature];
}
