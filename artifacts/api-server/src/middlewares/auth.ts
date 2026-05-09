import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable, type User } from "@workspace/db";
import { getSupabaseAdmin } from "../lib/supabase";
import { trialEndsAtFromNow } from "../lib/billing";
import { promoteIfPendingSuperAdmin } from "../lib/seed-platform-admins";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        user: User;
      };
    }
  }
}

const DEMO_AUTH_ID = "demo-user";
const DEMO_EMAIL = "demo@synvet.app";
const DEMO_NAME = "Dra. Camila Souza";
const DEMO_CLINIC = "Clínica Synvet (Demo)";

async function ensureDemoUser(): Promise<User> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.authId, DEMO_AUTH_ID));
  if (existing) return existing;
  const [clinic] = await db
    .insert(clinicsTable)
    .values({ name: DEMO_CLINIC })
    .returning();
  const [user] = await db
    .insert(usersTable)
    .values({
      authId: DEMO_AUTH_ID,
      clinicId: clinic.id,
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      role: "admin",
    })
    .returning();
  return user;
}

async function ensureUser(params: {
  authId: string;
  email: string;
  name?: string | null;
  clinicName?: string | null;
}): Promise<User> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.authId, params.authId));
  if (existing) return existing;
  const [clinic] = await db
    .insert(clinicsTable)
    .values({
      name: params.clinicName?.trim() || `Clínica de ${params.name ?? params.email}`,
      plan: "trial",
      status: "trialing",
      trialEndsAt: trialEndsAtFromNow(),
    })
    .returning();
  const [user] = await db
    .insert(usersTable)
    .values({
      authId: params.authId,
      clinicId: clinic.id,
      email: params.email,
      name: params.name ?? null,
      role: "admin",
    })
    .returning();
  return user;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const header = req.headers.authorization;
    const token =
      header && header.toLowerCase().startsWith("bearer ")
        ? header.slice(7).trim()
        : null;

    const demoAllowed =
      process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_DEMO_AUTH === "true";

    if (!supabase) {
      // Supabase not configured at all.
      if (!demoAllowed) {
        res.status(401).json({ error: "Authentication is not configured" });
        return;
      }
      const user = await ensureDemoUser();
      req.auth = { user };
      next();
      return;
    }

    if (!token) {
      // Supabase is configured: a missing token is unauthenticated, except
      // in dev where we keep the demo user available for browsing.
      if (!demoAllowed) {
        res.status(401).json({ error: "Missing bearer token" });
        return;
      }
      const user = await ensureDemoUser();
      req.auth = { user };
      next();
      return;
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    const meta = (data.user.user_metadata ?? {}) as {
      name?: string;
      clinic_name?: string;
    };
    const user = await ensureUser({
      authId: data.user.id,
      email: data.user.email ?? `${data.user.id}@unknown`,
      name: meta.name ?? null,
      clinicName: meta.clinic_name ?? null,
    });
    // Promove para superadmin se o e-mail está em SUPERADMIN_EMAIL e a entrada
    // ainda é placeholder (pending:email).
    promoteIfPendingSuperAdmin(data.user.id, user.email).catch(() => {});
    req.auth = { user };
    next();
  } catch (err) {
    req.log.error({ err }, "Auth middleware failure");
    res.status(500).json({ error: "Auth failure" });
  }
}

export function requireAuth(req: Request): User {
  if (!req.auth) throw new Error("Auth context missing");
  return req.auth.user;
}

export function requireRole(...roles: Array<User["role"]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.auth?.user;
    if (!user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden: requires role " + roles.join("|") });
      return;
    }
    next();
  };
}
