import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadExamFile, type UploadedFile } from "@/lib/storage";
import { supabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

type Props = {
  onUploaded: (file: UploadedFile) => void;
  onCleared?: () => void;
  current?: UploadedFile | null;
  accept?: string;
  disabled?: boolean;
};

export function FileUploader({
  onUploaded,
  onCleared,
  current,
  accept = "application/pdf,image/*",
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const start = async (file: File) => {
    setLastFile(file);
    setError(null);
    setProgress(0);
    setUploading(true);
    abortRef.current = new AbortController();
    try {
      const result = await uploadExamFile(file, {
        signal: abortRef.current.signal,
        onProgress: (p) => setProgress(p),
      });
      onUploaded(result);
      toast.success("Arquivo enviado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const clear = () => {
    setProgress(0);
    setError(null);
    setLastFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onCleared?.();
  };

  const isImage = current?.type?.startsWith("image/");

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void start(f);
        }}
        data-testid="input-file-uploader"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading || !supabaseConfigured}
          data-testid="button-file-uploader-pick"
        >
          <Upload className="w-4 h-4 mr-2" />
          {current ? "Trocar arquivo" : "Enviar arquivo"}
        </Button>
        {uploading && (
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        )}
        {!uploading && error && lastFile && (
          <Button type="button" variant="ghost" size="sm" onClick={() => void start(lastFile)}>
            <RotateCcw className="w-4 h-4 mr-1" /> Tentar novamente
          </Button>
        )}
        {!uploading && current && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X className="w-4 h-4 mr-1" /> Remover
          </Button>
        )}
        {current && !uploading && (
          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1 truncate max-w-[280px]"
          >
            {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            Ver arquivo
          </a>
        )}
      </div>
      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">Enviando... {progress}%</p>
        </div>
      )}
      {error && !uploading && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {!supabaseConfigured && (
        <p className="text-xs text-muted-foreground">
          Modo demo: upload desabilitado. Informe uma URL pública abaixo.
        </p>
      )}
    </div>
  );
}
