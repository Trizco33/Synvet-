import { createExamSignedUpload } from "@workspace/api-client-react";
import { supabaseConfigured } from "./supabase";

export const EXAMS_BUCKET = "exams";

export type UploadedFile = {
  url: string;
  type: string;
  size: number;
  path: string;
};

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export type UploadOptions = {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

export async function uploadExamFile(
  file: File,
  opts: UploadOptions = {},
): Promise<UploadedFile> {
  if (!supabaseConfigured) {
    throw new Error(
      "Upload requer Supabase configurado. Configure VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ou informe URL pública.",
    );
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Tipo de arquivo não suportado (use PDF, PNG, JPEG, WEBP, GIF).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Arquivo maior que 15 MB.");
  }

  const signed = await createExamSignedUpload({
    filename: file.name,
    contentType: file.type,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.url, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Falha no upload (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Falha de rede no upload"));
    xhr.onabort = () => reject(new Error("Upload cancelado"));
    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });

  return {
    url: signed.publicUrl,
    type: file.type,
    size: file.size,
    path: signed.path,
  };
}
