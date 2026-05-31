import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileText,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { runImport } from "@workspace/api-client-react";
import type { ImportReport } from "@workspace/api-client-react";
import { apiBase } from "@/lib/api-base";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  aliases?: string[];
};

export type ImportKind =
  | "tutors"
  | "pets"
  | "appointments"
  | "exams"
  | "vaccines"
  | "medical_records"
  | "weigh_ins"
  | "prescriptions";

type Props = {
  kind: ImportKind;
  fields: ImportField[];
  helperText?: string;
};

type Stage = "idle" | "preview" | "uploading" | "done";

async function sha256(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simples (não-criptográfico) — só para ambiente sem WebCrypto.
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `fb-${(h >>> 0).toString(16)}-${text.length}`;
}

function readAsText(file: File, encoding: "utf-8" | "windows-1252"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file, encoding);
  });
}

function looksMojibake(text: string): boolean {
  // Caracteres típicos de UTF-8 lido como Latin1 (Ã©, Ã§, Ã£…)
  return /Ã[\u0080-\u00bf\u0081-\u00ff]|Â./.test(text);
}

function autoMap(headers: string[], fields: ImportField[]): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  for (const h of headers) {
    const hn = norm(h);
    const match = fields.find(
      (f) =>
        norm(f.key) === hn ||
        norm(f.label) === hn ||
        (f.aliases || []).some((a) => norm(a) === hn),
    );
    if (match) map[h] = match.key;
  }
  return map;
}

export function ImportWizard({ kind, fields, helperText }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1252">("utf-8");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [encodingWarning, setEncodingWarning] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields],
  );

  const mappedKeys = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const missingRequired = requiredKeys.filter((k) => !mappedKeys.has(k));
  const canSubmit = missingRequired.length === 0 && rows.length > 0 && stage !== "uploading";

  const reset = () => {
    setStage("idle");
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setEncodingWarning(false);
    setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const parseFile = async (
    file: File,
    enc: "utf-8" | "windows-1252",
  ) => {
    const text = await readAsText(file, enc);
    if (enc === "utf-8" && looksMojibake(text)) {
      setEncodingWarning(true);
    } else {
      setEncodingWarning(false);
    }
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length > 0) {
      toast.error(`Erro ao ler CSV: ${parsed.errors[0]?.message ?? "formato inválido"}`);
      return;
    }
    if (parsed.data.length === 0) {
      toast.error("Arquivo vazio ou sem cabeçalho.");
      return;
    }
    if (parsed.data.length > MAX_ROWS) {
      toast.error(
        `Limite de ${MAX_ROWS} linhas por arquivo. O seu tem ${parsed.data.length}. Divida em arquivos menores.`,
      );
      return;
    }
    const headerList = parsed.meta.fields ?? Object.keys(parsed.data[0]);
    setHeaders(headerList);
    setRows(parsed.data);
    setMapping(autoMap(headerList, fields));
    setStage("preview");
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo maior que 5 MB. Divida em arquivos menores.");
      return;
    }
    setFileName(file.name);
    setReport(null);
    setEncoding("utf-8");
    await parseFile(file, "utf-8");
  };

  const handleEncodingChange = async (next: "utf-8" | "windows-1252") => {
    setEncoding(next);
    const f = fileInputRef.current?.files?.[0];
    if (f) await parseFile(f, next);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStage("uploading");
    try {
      const serialized = JSON.stringify({ kind, headers, rows, mapping });
      const fileHash = await sha256(serialized);
      const result = await runImport(kind, {
        fileName: fileName ?? null,
        fileHash,
        mapping,
        rows,
      });
      setReport(result);
      setStage("done");
      toast.success(
        `Importação concluída: ${result.created} criadas, ${result.skipped} ignoradas, ${result.errors} com erro.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao importar";
      toast.error(msg);
      setStage("preview");
    }
  };

  const downloadTemplate = () => {
    const url = `${apiBase()}/import/template/${kind}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `synvet-template-${kind}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card data-testid={`import-wizard-${kind}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {KIND_LABEL[kind]}
          </CardTitle>
          {helperText && <CardDescription>{helperText}</CardDescription>}
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" />
          Modelo CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {stage === "idle" && (
          <label className="block border-2 border-dashed border-border/60 rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              data-testid={`input-file-${kind}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Selecione um arquivo .csv</p>
            <p className="text-sm text-muted-foreground mt-1">
              Até 5 MB · até {MAX_ROWS.toLocaleString("pt-BR")} linhas
            </p>
          </label>
        )}

        {stage !== "idle" && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">{fileName}</span>
              <Badge variant="outline">{rows.length} linhas</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Trocar arquivo
            </Button>
          </div>
        )}

        {stage === "preview" && (
          <>
            {encodingWarning && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Texto parece com codificação errada</AlertTitle>
                <AlertDescription>
                  Detectamos caracteres como "Ã©" no preview. Tente reabrir como
                  Windows-1252 (Latin1) — comum em planilhas exportadas do Excel
                  brasileiro.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Codificação:</span>
              <Select value={encoding} onValueChange={(v) => void handleEncodingChange(v as typeof encoding)}>
                <SelectTrigger className="w-[200px]" data-testid={`select-encoding-${kind}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utf-8">UTF-8 (recomendado)</SelectItem>
                  <SelectItem value="windows-1252">Windows-1252 (Latin1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Mapeamento de colunas{" "}
                <span className="text-muted-foreground font-normal">
                  (CSV → campo Synvet)
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {headers.map((h) => (
                  <div
                    key={h}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-2"
                  >
                    <span className="text-sm font-mono truncate flex-1" title={h}>
                      {h}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping[h] ?? "__skip__"}
                      onValueChange={(v) =>
                        setMapping((prev) => {
                          const next = { ...prev };
                          if (v === "__skip__") delete next[h];
                          else next[h] = v;
                          return next;
                        })
                      }
                    >
                      <SelectTrigger
                        className="w-[180px]"
                        data-testid={`map-${kind}-${h}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">— Ignorar —</SelectItem>
                        {fields.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {missingRequired.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Campos obrigatórios faltando</AlertTitle>
                <AlertDescription>
                  Mapeie:{" "}
                  {missingRequired
                    .map((k) => fields.find((f) => f.key === k)?.label || k)
                    .join(", ")}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Preview (primeiras 5 linhas)</p>
              <div className="rounded-md border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="text-xs max-w-[180px] truncate">
                            {r[h] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                data-testid={`submit-import-${kind}`}
              >
                Importar {rows.length} linha{rows.length === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        )}

        {stage === "uploading" && (
          <div className="py-8 space-y-3 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Validando arquivo… se qualquer linha estiver com erro, nada será
              gravado e você corrige no relatório.
            </p>
            <Progress value={70} className="max-w-md mx-auto" />
          </div>
        )}

        {stage === "done" && report && (
          <ImportReportView report={report} onReset={reset} />
        )}
      </CardContent>
    </Card>
  );
}

const KIND_LABEL: Record<ImportKind, string> = {
  tutors: "Tutores",
  pets: "Pacientes",
  appointments: "Agenda",
  exams: "Exames",
  vaccines: "Vacinas",
  medical_records: "Prontuários",
  weigh_ins: "Pesagens",
  prescriptions: "Prescrições",
};

function ImportReportView({
  report,
  onReset,
}: {
  report: ImportReport;
  onReset: () => void;
}) {
  const errors = report.results.filter((r) => r.outcome === "error");
  const skipped = report.results.filter((r) => r.outcome === "skipped");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Total" value={report.total} />
        <SummaryTile label="Criadas" value={report.created} tone="success" />
        <SummaryTile label="Ignoradas" value={report.skipped} tone="muted" />
        <SummaryTile label="Erros" value={report.errors} tone="error" />
      </div>
      {errors.length > 0 && (
        <Section title={`Erros (${errors.length})`} icon={<XCircle className="w-4 h-4 text-destructive" />}>
          <ResultList items={errors} />
        </Section>
      )}
      {skipped.length > 0 && (
        <Section title={`Ignoradas (${skipped.length})`} icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}>
          <ResultList items={skipped} />
        </Section>
      )}
      {report.errors === 0 && report.created > 0 && (
        <Alert>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <AlertTitle>Importação concluída sem erros</AlertTitle>
          <AlertDescription>
            {report.created} registro{report.created === 1 ? "" : "s"} criado
            {report.created === 1 ? "" : "s"} com sucesso.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onReset}>
          Importar outro arquivo
        </Button>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "muted" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "error"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium mb-2 flex items-center gap-2">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function ResultList({
  items,
}: {
  items: ImportReport["results"];
}) {
  return (
    <div className="rounded-md border border-border/60 max-h-64 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Linha</TableHead>
            <TableHead>Mensagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={`${r.row}-${r.outcome}`}>
              <TableCell className="font-mono text-xs">{r.row}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {r.message ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
