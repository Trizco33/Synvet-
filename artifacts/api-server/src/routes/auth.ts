import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { getSupabaseAdmin } from "../lib/supabase";
import { trialEndsAtFromNow } from "../lib/billing";
import { getStripeClient, isStripeConfigured } from "../lib/stripe";

const router: IRouter = Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de cadastro. Tente novamente em 1 hora." },
});

router.post("/auth/signup", signupLimiter, async (req, res): Promise<void> => {
  const parsed = schemas.SignupUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name, clinicName } = parsed.data;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Cadastro indisponível: Supabase não configurado." });
    return;
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, clinic_name: clinicName },
    });

    if (error || !data.user) {
      const msg = error?.message ?? "Falha ao criar usuário";
      const status = /already|exists|registered/i.test(msg) ? 409 : 400;
      res.status(status).json({ error: msg });
      return;
    }

    const authId = data.user.id;
    try {
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.authId, authId));

      if (!existing) {
        const created = await db.transaction(async (tx) => {
          const [clinic] = await tx
            .insert(clinicsTable)
            .values({
              name: clinicName.trim(),
              plan: "trial",
              status: "trialing",
              trialEndsAt: trialEndsAtFromNow(),
            })
            .returning();
          await tx.insert(usersTable).values({
            authId,
            clinicId: clinic.id,
            email,
            name,
            role: "admin",
          });
          return clinic;
        });

        // Best-effort: cria Stripe Customer já no signup. Falha silenciosa —
        // o checkout/portal cria lazy se faltar.
        if (await isStripeConfigured()) {
          try {
            const stripe = await getStripeClient();
            const customer = await stripe.customers.create({
              email,
              name: created.name,
              metadata: { clinicId: created.id, ownerEmail: email, ownerName: name },
            });
            await db
              .update(clinicsTable)
              .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
              .where(eq(clinicsTable.id, created.id));
          } catch (stripeErr) {
            req.log.warn(
              { err: stripeErr, clinicId: created.id },
              "signup: falha ao criar Stripe customer (será criado no checkout)",
            );
          }
        }
      }
    } catch (dbErr) {
      req.log.error({ err: dbErr, authId }, "signup db failure — rolling back supabase user");
      try {
        await supabase.auth.admin.deleteUser(authId);
      } catch (cleanupErr) {
        req.log.error({ err: cleanupErr, authId }, "failed to rollback supabase user");
      }
      res.status(500).json({ error: "Erro interno ao criar conta. Tente novamente." });
      return;
    }

    res.status(201).json({ ok: true, userId: authId });
  } catch (err) {
    req.log.error({ err }, "signup failed");
    res.status(500).json({ error: "Erro interno ao criar conta" });
  }
});

export default router;
