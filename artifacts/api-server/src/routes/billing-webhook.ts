// Webhook Stripe — montado direto no app com express.raw() ANTES do express.json().
// Não usa authMiddleware. Idempotência por stripe_events.id.
//
// Logging: usamos `req.log` (pino-http child logger com requestId) em todo o
// fluxo do handler para permitir correlacionar todos os logs de um único webhook
// através do mesmo request id. O logger global só é usado em paths que não têm
// acesso ao request (ex.: módulo seed).
import express, { type Express, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Logger } from "pino";
import { db, clinicsTable, stripeEventsTable } from "@workspace/db";
import { getStripeClient, getPlanByPriceId, mapSubscriptionStatus } from "../lib/stripe";

async function syncSubscriptionToClinic(
  subscription: Stripe.Subscription,
  log: Logger,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.stripeCustomerId, customerId));
  if (!clinic) {
    log.warn(
      { customerId, subscriptionId: subscription.id },
      "stripe webhook: clínica não encontrada para customer",
    );
    return;
  }

  const mapped = mapSubscriptionStatus(subscription.status);
  if (!mapped) {
    log.info(
      { status: subscription.status, subscriptionId: subscription.id },
      "stripe webhook: status sem mapeamento — ignorando",
    );
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  // current_period_end migrou do nível subscription para o item na API basil/clover.
  // Lemos do item primeiro; fallback para o nível subscription se ainda existir.
  const itemPeriodEnd = (
    item as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined
  )?.current_period_end;
  const subPeriodEnd = (
    subscription as Stripe.Subscription & { current_period_end?: number }
  ).current_period_end;
  const periodEndUnix = itemPeriodEnd ?? subPeriodEnd ?? null;

  await db
    .update(clinicsTable)
    .set({
      status: mapped,
      plan: plan ?? clinic.plan,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : clinic.currentPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(clinicsTable.id, clinic.id));

  log.info(
    {
      clinicId: clinic.id,
      subscriptionId: subscription.id,
      status: mapped,
      plan: plan ?? clinic.plan,
    },
    "stripe webhook: clinic billing sincronizado",
  );
}

async function handleEvent(event: Stripe.Event, log: Logger): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.trial_will_end": {
      await syncSubscriptionToClinic(event.data.object as Stripe.Subscription, log);
      return;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id ?? null;
      if (!subId) return;
      // Falha aqui DEVE propagar (500 → Stripe retenta) — não engolir.
      const stripe = await getStripeClient();
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncSubscriptionToClinic(sub, log);
      return;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      if (!subId) return;
      const stripe = await getStripeClient();
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncSubscriptionToClinic(sub, log);
      return;
    }
    default:
      log.debug({ type: event.type }, "stripe webhook: evento ignorado");
  }
}

export function mountBillingWebhook(app: Express): void {
  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response): Promise<void> => {
      const log = req.log as Logger;
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        log.error("STRIPE_WEBHOOK_SECRET não configurado");
        res.status(503).send("webhook secret missing");
        return;
      }
      const sig = req.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") {
        res.status(400).send("missing signature");
        return;
      }

      let event: Stripe.Event;
      try {
        const stripe = await getStripeClient();
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
      } catch (err) {
        log.warn({ err }, "stripe webhook: assinatura inválida");
        res.status(400).send("invalid signature");
        return;
      }

      // Pré-check de idempotência: se já está registrado, devolve 200 sem reprocessar.
      // Os handlers em si são idempotentes (UPDATE por subscription state), então
      // mesmo se o registro acontecer entre check e insert, reprocessar é seguro.
      const [existing] = await db
        .select({ id: stripeEventsTable.id })
        .from(stripeEventsTable)
        .where(eq(stripeEventsTable.id, event.id));
      if (existing) {
        log.debug({ id: event.id, type: event.type }, "stripe webhook: duplicado");
        res.json({ received: true, duplicate: true });
        return;
      }

      try {
        await handleEvent(event, log);
      } catch (err) {
        // Falha transitória → 500 faz o Stripe retentar. NÃO marcar como processado.
        log.error(
          { err, id: event.id, type: event.type },
          "stripe webhook: handler falhou — retornando 500 para retry",
        );
        res.status(500).send("handler error");
        return;
      }

      // Só marca como processado APÓS sucesso. onConflictDoNothing absorve
      // race entre retries concorrentes (writes são idempotentes mesmo se
      // duplicarem por uma fração de segundo).
      await db
        .insert(stripeEventsTable)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing({ target: stripeEventsTable.id });

      res.json({ received: true });
    },
  );
}
