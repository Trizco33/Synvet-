import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && serviceRoleKey);

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
