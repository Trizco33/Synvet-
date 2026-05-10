// Cliente Stripe via Replit connector. Não cachear o client — tokens podem expirar.
// Snippet base: blueprint Stripe (Replit).
import Stripe from "stripe";
import type { ClinicPlan } from "@workspace/db";
import { logger } from "./logger";

let cachedConnection:
  | { secretKey: string; publishableKey: string }
  | null = null;
let cachedAt = 0;
const CONNECTION_TTL_MS = 5 * 60 * 1000;

async function fetchConnectionCredentials(): Promise<{
  secretKey: string;
  publishableKey: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Replit connector context indisponível (Stripe)");
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });
  const data = (await response.json()) as {
    items?: Array<{
      settings?: { publishable?: string; secret?: string };
    }>;
  };
  const item = data.items?.[0];
  const secretKey = item?.settings?.secret;
  const publishableKey = item?.settings?.publishable;
  if (!secretKey || !publishableKey) {
    throw new Error(
      `Stripe ${targetEnvironment} connection não encontrada no Replit`,
    );
  }
  return { secretKey, publishableKey };
}

async function getCredentials(): Promise<{
  secretKey: string;
  publishableKey: string;
}> {
  const now = Date.now();
  if (cachedConnection && now - cachedAt < CONNECTION_TTL_MS) {
    return cachedConnection;
  }
  const creds = await fetchConnectionCredentials();
  cachedConnection = creds;
  cachedAt = now;
  return creds;
}

/**
 * Obtém um cliente Stripe novo. Não cachear o retorno em variáveis de longo prazo —
 * use a função em cada request. As credenciais em si têm cache curto interno.
 */
export async function getStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch (err) {
    logger.debug({ err }, "stripe not configured");
    return false;
  }
}

/** Mapa plan → priceId vindo de variáveis de ambiente. */
export function getStripePriceId(plan: ClinicPlan): string | null {
  switch (plan) {
    case "essencial":
      return process.env.STRIPE_PRICE_ESSENCIAL ?? null;
    case "pro":
      return process.env.STRIPE_PRICE_PRO ?? null;
    case "clinic_plus":
      return process.env.STRIPE_PRICE_CLINIC_PLUS ?? null;
    default:
      return null;
  }
}

/** Reverso: priceId → plano. Usado no webhook para descobrir o plano da subscription. */
export function getPlanByPriceId(priceId: string): ClinicPlan | null {
  if (priceId === process.env.STRIPE_PRICE_ESSENCIAL) return "essencial";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_CLINIC_PLUS) return "clinic_plus";
  return null;
}

/** Lista de Price IDs configurados (para validar o body do checkout). */
export function getConfiguredPriceIds(): string[] {
  return [
    process.env.STRIPE_PRICE_ESSENCIAL,
    process.env.STRIPE_PRICE_PRO,
    process.env.STRIPE_PRICE_CLINIC_PLUS,
  ].filter((s): s is string => Boolean(s));
}

/** Mapeia o status nativo do Stripe para o status persistido em `clinics.status`. */
export function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "canceled" | null {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return null;
    default:
      return null;
  }
}
