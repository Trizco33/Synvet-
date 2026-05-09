import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, platformAdminsTable, type PlatformAdmin } from "@workspace/db";
import { getSupabaseAdmin } from "../lib/supabase";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      superAdmin?: PlatformAdmin;
    }
  }
}

export async function isSuperAdmin(authId: string): Promise<PlatformAdmin | null> {
  const [row] = await db
    .select()
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.authId, authId));
  return row ?? null;
}

export async function superAdminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado." });
      return;
    }
    const header = req.headers.authorization;
    const token =
      header && header.toLowerCase().startsWith("bearer ")
        ? header.slice(7).trim()
        : null;
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    const admin = await isSuperAdmin(data.user.id);
    if (!admin) {
      res.status(403).json({ error: "Acesso restrito a superadmins" });
      return;
    }
    req.superAdmin = admin;
    next();
  } catch (err) {
    req.log.error({ err }, "super-admin middleware failure");
    res.status(500).json({ error: "Auth failure" });
  }
}

export function requireSuperAdmin(req: Request): PlatformAdmin {
  if (!req.superAdmin) throw new Error("SuperAdmin context missing");
  return req.superAdmin;
}
