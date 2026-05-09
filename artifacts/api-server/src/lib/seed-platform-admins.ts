import { db, platformAdminsTable } from "@workspace/db";
import { logger } from "./logger";
import { getSupabaseAdmin } from "./supabase";

/**
 * Garante que o e-mail definido em SUPERADMIN_EMAIL exista em platform_admins.
 * Tenta primeiro encontrar o usuário no Supabase para obter o auth_id real.
 * Se não encontrar (usuário ainda não cadastrado), cria entrada placeholder com
 * authId = `pending:<email>` que é trocada na primeira chamada de upsertOnLogin.
 */
export async function seedPlatformAdmins(): Promise<void> {
  const raw = process.env.SUPERADMIN_EMAIL;
  if (!raw) return;
  const emails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return;

  const supabase = getSupabaseAdmin();
  for (const email of emails) {
    try {
      let authId: string | null = null;
      if (supabase) {
        // listUsers paginado — buscar por e-mail
        const { data, error } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (!error) {
          const found = data.users.find(
            (u) => u.email?.toLowerCase() === email,
          );
          if (found) authId = found.id;
        }
      }
      const finalAuthId = authId ?? `pending:${email}`;
      await db
        .insert(platformAdminsTable)
        .values({ authId: finalAuthId, email, name: null })
        .onConflictDoNothing({ target: platformAdminsTable.authId });
      logger.info({ email, authId: finalAuthId }, "platform admin seeded");
    } catch (err) {
      logger.warn({ err, email }, "failed to seed platform admin");
    }
  }
}

/**
 * Promove o usuário para superadmin se o e-mail dele estiver em SUPERADMIN_EMAIL
 * e ainda não houver entrada com authId real (apenas pending).
 */
export async function promoteIfPendingSuperAdmin(
  authId: string,
  email: string,
): Promise<void> {
  const raw = process.env.SUPERADMIN_EMAIL;
  if (!raw) return;
  const emails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.includes(email.toLowerCase())) return;
  try {
    await db
      .insert(platformAdminsTable)
      .values({ authId, email: email.toLowerCase(), name: null })
      .onConflictDoNothing({ target: platformAdminsTable.authId });
  } catch (err) {
    logger.warn({ err, email }, "failed to promote pending superadmin");
  }
}
