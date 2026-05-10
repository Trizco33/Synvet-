import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { PLANS, type ClinicPlan } from "@workspace/db";
import {
  getStripeClient,
  getStripePriceId,
  isStripeConfigured,
} from "../lib/stripe";

const router: IRouter = Router();

function appOrigin(req: import("express").Request): string {
  // Em produção/dev preview o usuário acessa via proxy Replit. Forward host respeita o domínio público.
  const xfHost = req.get("x-forwarded-host") ?? req.get("host");
  const xfProto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${xfProto}://${xfHost}`;
}

/**
 * Garante que a clínica tem um `stripeCustomerId` — cria se faltar.
 *
 * Idempotência: a criação usa `idempotency_key = clinic:<id>` para que
 * múltiplas chamadas concorrentes (signup + primeiro checkout, retry após
 * timeout, etc.) NÃO gerem clientes duplicados no Stripe. O Stripe devolve
 * o mesmo Customer para a mesma idempotency_key dentro de 24h.
 *
 * Esta é a fonte de verdade do contrato signup→customer: signup tenta
 * best-effort criar o customer, mas se falhar (rede, connector), o primeiro
 * checkout/portal cria de forma idempotente. Garante eventual consistência
 * sem nunca duplicar.
 */
export async function ensureStripeCustomer(
  clinicId: string,
  email: string,
  name: string,
): Promise<string> {
  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId));
  if (!clinic) throw new Error("Clínica não encontrada");
  if (clinic.stripeCustomerId) return clinic.stripeCustomerId;

  const stripe = await getStripeClient();
  const customer = await stripe.customers.create(
    {
      email,
      name: clinic.name,
      metadata: { clinicId, ownerEmail: email, ownerName: name },
    },
    { idempotencyKey: `clinic-customer:${clinicId}` },
  );
  await db
    .update(clinicsTable)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(clinicsTable.id, clinicId));
  return customer.id;
}

router.post(
  "/billing/checkout",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    if (!(await isStripeConfigured())) {
      res.status(503).json({ error: "Stripe não configurado" });
      return;
    }
    const plan = String(req.body?.plan ?? "").trim() as ClinicPlan;
    const validPlans: ClinicPlan[] = ["essencial", "pro", "clinic_plus"];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: "Plano inválido" });
      return;
    }
    const priceId = getStripePriceId(plan);
    if (!priceId) {
      res.status(503).json({
        error: `Plano ${PLANS[plan].name} ainda não configurado no Stripe`,
      });
      return;
    }
    try {
      const customerId = await ensureStripeCustomer(
        user.clinicId,
        user.email,
        user.name ?? user.email,
      );
      const stripe = await getStripeClient();
      const origin = appOrigin(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.clinicId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/app/configuracoes/assinatura/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/app/configuracoes?tab=assinatura&checkout=cancelled`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { clinicId: user.clinicId },
        },
        metadata: { clinicId: user.clinicId },
      });
      if (!session.url) {
        res.status(500).json({ error: "Stripe não retornou URL de checkout" });
        return;
      }
      res.json({ url: session.url });
    } catch (err) {
      req.log.error({ err }, "billing checkout failed");
      res.status(500).json({ error: "Falha ao criar sessão de checkout" });
    }
  },
);

router.post(
  "/billing/portal",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    if (!(await isStripeConfigured())) {
      res.status(503).json({ error: "Stripe não configurado" });
      return;
    }
    try {
      const customerId = await ensureStripeCustomer(
        user.clinicId,
        user.email,
        user.name ?? user.email,
      );
      const stripe = await getStripeClient();
      const origin = appOrigin(req);
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/app/configuracoes?tab=assinatura`,
      });
      res.json({ url: portal.url });
    } catch (err) {
      req.log.error({ err }, "billing portal failed");
      res.status(500).json({ error: "Falha ao abrir portal de assinatura" });
    }
  },
);

export default router;
