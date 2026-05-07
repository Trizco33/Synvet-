import { getSupabaseAdmin } from "./supabase";

const BUCKET = "exams";
const READ_TTL = 60 * 60; // 1 hora — gerado sob demanda em cada read

export async function signExamPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, READ_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function signExamPaths(
  paths: Array<string | null>,
): Promise<Array<string | null>> {
  if (paths.length === 0) return [];
  const supabase = getSupabaseAdmin();
  if (!supabase) return paths.map(() => null);
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  if (unique.length === 0) return paths.map(() => null);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, READ_TTL);
  if (error || !data) return paths.map(() => null);
  const map = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}

export async function ensureExamsBucket(maxBytes: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (!existing) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: maxBytes,
    });
    return;
  }
  if (existing.file_size_limit !== maxBytes || existing.public) {
    await supabase.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: maxBytes,
    });
  }
}
