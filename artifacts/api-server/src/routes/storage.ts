import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { schemas } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getSupabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();
const BUCKET = "exams";
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

router.post("/storage/exams/signed-upload", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateExamSignedUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!ALLOWED_TYPES.has(parsed.data.contentType)) {
    res.status(400).json({ error: "Tipo de arquivo não suportado" });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res
      .status(503)
      .json({ error: "Storage não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY." });
    return;
  }
  const ext =
    parsed.data.filename.includes(".") && parsed.data.filename.lastIndexOf(".") > 0
      ? parsed.data.filename.slice(parsed.data.filename.lastIndexOf(".") + 1).toLowerCase()
      : "bin";
  const path = `${user.clinicId}/${randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    req.log.error({ err: error }, "Failed to create signed upload URL");
    res.status(500).json({ error: "Falha ao gerar URL de upload" });
    return;
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  res.json(
    schemas.CreateExamSignedUploadResponse.parse({
      url: data.signedUrl,
      token: data.token,
      path,
      publicUrl: pub.publicUrl,
      bucket: BUCKET,
    }),
  );
});

router.post("/storage/exams/signed-download", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.CreateExamSignedDownloadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res
      .status(503)
      .json({ error: "Storage não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY." });
    return;
  }
  const path = parsed.data.path;
  // Tenancy guard: path is "<clinicId>/<uuid>.<ext>"
  if (!path.startsWith(`${user.clinicId}/`)) {
    res.status(403).json({ error: "Acesso negado a este arquivo" });
    return;
  }
  const MAX_TTL = 60 * 60 * 24 * 7; // 7 dias
  const expiresIn = Math.min(parsed.data.expiresIn ?? 3600, MAX_TTL);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) {
    req.log.error({ err: error }, "Failed to create signed download URL");
    res.status(500).json({ error: "Falha ao gerar URL de download" });
    return;
  }
  res.json(
    schemas.CreateExamSignedDownloadResponse.parse({
      url: data.signedUrl,
      path,
      expiresIn,
    }),
  );
});

export default router;
