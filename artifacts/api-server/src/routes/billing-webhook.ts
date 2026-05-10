// Webhook Stripe — montado direto no app com express.raw() ANTES do express.json().
// Não usa authMiddleware. Idempotência por stripe_events.id.
import express, { type Express, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, clinicsTable, stripeEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getStripeClient, getPlanByPriceId, mapSubscriptionStatus } from "../lib/stripe";

async function syncSubscriptionToClinic(
  subscription: Stripe.Subscription,
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
    logger.warn(
      { customerId, subscriptionId: subscription.id },
      "stripe webhook: clínica não encontrada para customer",
    );
    return;
  }

  const mapped = mapSubscriptionStatus(subscription.status);
  if (!mapped) {
    logger.info(
      { status: subscription.status, subscriptionId: subscription.id },
      "stripe webhook: status sem mapeamento — ignorando",
    );
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  // current_period_end vive no item (basil API). Fallback para subscription se existir.
  const periodEndUnix =
    (item as Stripe.SubscriptionItem & { current_period_end?: number } | undefined)
      ?.current_period_end ?? null;

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

  logger.info(
    {
      clinicId: clinic.id,
      subscriptionId: subscription.id,
      status: mapped,
      plan: plan ?? clinic.plan,
    },
    "stripe webhook: clinic billing sincronizado",
  );
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.trial_will_end": {
      await syncSubscriptionToClinic(event.data.object as Stripe.Subscription);
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
      try {
        const stripe = await getStripeClient();
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscriptionToClinic(sub);
      } catch (err) {
        logger.warn({ err, subId }, "falha ao buscar subscription do invoice");
      }
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
      try {
        const stripe = await getStripeClient();
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscriptionToClinic(sub);
      } catch (err) {
        logger.warn({ err, subId }, "falha ao buscar subscription do checkout");
      }
      return;
    }
    default:
      logger.debug({ type: event.type }, "stripe webhook: evento ignorado");
  }
}

export function mountBillingWebhook(app: Express): void {
  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response): Promise<void> => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        logger.error("STRIPE_WEBHOOK_SECRET não configurado");
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
        logger.warn({ err }, "stripe webhook: assinatura inválida");
        res.status(400).send("invalid signature");
        return;
      }

      // Idempotência — se já processado, retornar 200 sem reprocessar.
      try {
        const inserted = await db
          .insert(stripeEventsTable)
          .values({ id: event.id, type: event.type })
          .onConflictDoNothing({ target: stripeEventsTable.id })
          .returning();
        if (inserted.length === 0) {
          logger.debug({ id: event.id, type: event.type }, "stripe webhook: duplicado");
          res.json({ received: true, duplicate: true });
          return;
        }
      } catch (err) {
        logger.error({ err, id: event.id }, "falha ao registrar evento stripe");
        res.status(500).send("internal");
        return;
      }

      try {
        await handleEvent(event);
        res.json({ received: true });
      } catch (err) {
        logger.error({ err, id: event.id, type: event.type }, "stripe webhook: handler falhou");
        // Devolver 500 faz o Stripe retentar — bom para erros transitórios.
        res.status(500).send("handler error");
      }
    },
  );
}
