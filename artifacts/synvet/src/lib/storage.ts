import { supabase, supabaseConfigured } from "./supabase";

export const EXAMS_BUCKET = "exams";

export type UploadedFile = {
  url: string;
  type: string;
};

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function uploadExamFile(
  file: File,
  clinicId: string,
): Promise<UploadedFile> {
  if (!supabaseConfigured) {
    throw new Error(
      "Upload de arquivos requer Supabase configurado. Use a URL pública abaixo ou configure VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.",
    );
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Tipo de arquivo não suportado (use PDF, PNG, JPEG, WEBP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Arquivo maior que 15 MB.");
  }
  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${clinicId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(EXAMS_BUCKET)
    .upload(key, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error(`Falha ao enviar arquivo: ${error.message}`);
  }
  const { data } = supabase.storage.from(EXAMS_BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, type: file.type };
}
