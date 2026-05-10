import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldAlert,
  Users,
  Dog,
  CalendarDays,
  FlaskConical,
  Syringe,
  FileText,
  ArrowLeft,
  History,
  Scale,
  Pill,
} from "lucide-react";
import { Link } from "wouter";
import { ImportWizard, type ImportField } from "@/components/import/ImportWizard";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListImportHistory,
  useGetImportHistoryDetail,
  getGetImportHistoryDetailQueryKey,
} from "@workspace/api-client-react";
import type {
  ImportHistoryEntry,
  ImportHistoryDetail,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Download, Loader2 } from "lucide-react";

const KIND_LABELS: Record<ImportHistoryEntry["kind"], string> = {
  tutors: "Tutores",
  pets: "Pacientes",
  appointments: "Agenda",
  exams: "Exames",
  vaccines: "Vacinas",
  medical_records: "Prontuários",
  weigh_ins: "Pesagens",
  prescriptions: "Prescrições",
};

const TUTOR_FIELDS: ImportField[] = [
  { key: "name", label: "Nome", required: true, aliases: ["nome", "tutor"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "mail"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "fone", "celular"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whats", "zap"] },
  { key: "address", label: "Endereço", aliases: ["endereco", "endereço"] },
  { key: "externalId", label: "ID do sistema antigo", aliases: ["externalid", "idexterno", "codigo", "código"] },
];

const PET_FIELDS: ImportField[] = [
  { key: "name", label: "Nome do pet", required: true, aliases: ["nome", "pet"] },
  { key: "species", label: "Espécie", required: true, aliases: ["especie", "especies", "tipo"] },
  { key: "breed", label: "Raça", aliases: ["raca", "raça"] },
  { key: "sex", label: "Sexo", aliases: ["sexo", "genero"] },
  { key: "birthDate", label: "Nascimento (YYYY-MM-DD)", aliases: ["nascimento", "datadenascimento", "birthdate"] },
  { key: "weightKg", label: "Peso (kg)", aliases: ["peso", "peso_kg"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail", "emailtutor"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone", "telefonetutor"] },
  { key: "externalId", label: "ID do sistema antigo", aliases: ["externalid", "idexterno", "codigo", "código"] },
  { key: "notes", label: "Observações", aliases: ["notas", "observacoes", "obs"] },
];

const APPT_FIELDS: ImportField[] = [
  { key: "scheduledAt", label: "Data/hora (ISO 8601)", required: true, aliases: ["data", "datahora", "scheduledat"] },
  { key: "petName", label: "Nome do pet", required: true, aliases: ["pet", "paciente"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone"] },
  { key: "reason", label: "Motivo", aliases: ["motivo", "queixa"] },
  { key: "status", label: "Status", aliases: ["status", "situacao"] },
];

const EXAM_FIELDS: ImportField[] = [
  { key: "performedAt", label: "Data do exame (YYYY-MM-DD)", required: true, aliases: ["data", "performedat", "datadoexame"] },
  { key: "petName", label: "Nome do pet", required: true, aliases: ["pet", "paciente"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail", "emailtutor"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone", "telefonetutor"] },
  { key: "title", label: "Título do exame", required: true, aliases: ["titulo", "nome", "exame"] },
  { key: "category", label: "Categoria", required: true, aliases: ["categoria", "tipo"] },
  { key: "status", label: "Status (pending/completed)", aliases: ["status", "situacao"] },
  { key: "fileUrl", label: "URL do laudo (opcional)", aliases: ["url", "fileurl", "laudo", "link"] },
  { key: "notes", label: "Observações", aliases: ["notas", "observacoes", "obs"] },
];

const VACCINE_FIELDS: ImportField[] = [
  { key: "appliedAt", label: "Data de aplicação (YYYY-MM-DD)", required: true, aliases: ["data", "appliedat", "dataaplicacao"] },
  { key: "petName", label: "Nome do pet", required: true, aliases: ["pet", "paciente"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail", "emailtutor"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone", "telefonetutor"] },
  { key: "vaccine", label: "Vacina", required: true, aliases: ["vacina", "nome", "name"] },
  { key: "nextDueAt", label: "Próxima dose (YYYY-MM-DD)", aliases: ["nextdueat", "proximadose", "proxima"] },
  { key: "notes", label: "Observações (lote, fabricante…)", aliases: ["notas", "observacoes", "obs", "lote"] },
];

const WEIGH_IN_FIELDS: ImportField[] = [
  { key: "weighedAt", label: "Data da pesagem (YYYY-MM-DD ou DD/MM/AAAA)", required: true, aliases: ["data", "weighedat", "datadapesagem"] },
  { key: "petName", label: "Nome do pet", required: true, aliases: ["pet", "paciente"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail", "emailtutor"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone", "telefonetutor"] },
  { key: "weightKg", label: "Peso (kg)", required: true, aliases: ["peso", "peso_kg", "pesokg", "weight"] },
  { key: "notes", label: "Observações", aliases: ["notas", "observacoes", "obs"] },
];

const PRESCRIPTION_FIELDS: ImportField[] = [
  { key: "prescribedAt", label: "Data da prescrição (YYYY-MM-DD ou DD/MM/AAAA)", required: true, aliases: ["data", "prescribedat", "dataprescricao"] },
  { key: "petName", label: "Nome do pet", required: true, aliases: ["pet", "paciente"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail", "emailtutor"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone", "telefonetutor"] },
  { key: "medication", label: "Medicamento", required: true, aliases: ["medicamento", "remedio", "remédio", "droga", "farmaco", "fármaco"] },
  { key: "dosage", label: "Posologia", required: true, aliases: ["posologia", "dose", "dosagem"] },
  { key: "duration", label: "Duração", required: true, aliases: ["duracao", "duração", "tempo", "periodo", "período"] },
  { key: "notes", label: "Observações", aliases: ["notas", "observacoes", "obs"] },
];

const RECORD_FIELDS: ImportField[] = [
  { key: "recordedAt", label: "Data (YYYY-MM-DD ou ISO)", aliases: ["data", "recordedat", "datadoatendimento"] },
  { key: "petName", label: "Nome do pet", required: true, aliases: ["pet", "paciente"] },
  { key: "tutorEmail", label: "E-mail do tutor", aliases: ["tutoremail", "emailtutor"] },
  { key: "tutorPhone", label: "Telefone do tutor", aliases: ["tutorphone", "telefonetutor"] },
  { key: "title", label: "Título", required: true, aliases: ["titulo", "assunto"] },
  { key: "content", label: "Conteúdo", required: true, aliases: ["conteudo", "texto", "anotacao", "descricao"] },
];

export default function ConfiguracoesImportar() {
  const { isAdmin } = usePermissions();

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Alert variant="destructive">
          <ShieldAlert className="w-4 h-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Apenas administradores da clínica podem importar dados em massa.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/app/configuracoes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Configurações
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Importar dados</h1>
        <p className="text-muted-foreground">
          Migre tutores, pacientes e agenda do seu sistema antigo via planilha
          CSV. Validamos o arquivo inteiro antes de gravar — se qualquer linha
          estiver com erro, nada é salvo e você corrige no relatório.
        </p>
      </div>

      <Alert>
        <AlertTitle>Como preparar seu arquivo</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>· Exporte como CSV (separador vírgula).</p>
          <p>· Codificação UTF-8 (preferida) ou Windows-1252.</p>
          <p>· Limite de 5 MB e até 5.000 linhas por arquivo. Para volumes maiores, divida em partes.</p>
          <p>· Importe na ordem: <strong>Tutores → Pacientes → Agenda / Exames / Vacinas / Prontuários</strong> (todo registro clínico depende do paciente já cadastrado).</p>
          <p>· Para deduplicar registros migrados, preencha o <strong>ID do sistema antigo</strong>: ele tem prioridade sobre e-mail/telefone na hora de identificar duplicatas.</p>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="tutors" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 max-w-4xl">
          <TabsTrigger value="tutors" data-testid="import-tab-tutors">
            <Users className="w-4 h-4 mr-1.5" />
            Tutores
          </TabsTrigger>
          <TabsTrigger value="pets" data-testid="import-tab-pets">
            <Dog className="w-4 h-4 mr-1.5" />
            Pacientes
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="import-tab-appointments">
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="exams" data-testid="import-tab-exams">
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Exames
          </TabsTrigger>
          <TabsTrigger value="vaccines" data-testid="import-tab-vaccines">
            <Syringe className="w-4 h-4 mr-1.5" />
            Vacinas
          </TabsTrigger>
          <TabsTrigger value="medical_records" data-testid="import-tab-medical-records">
            <FileText className="w-4 h-4 mr-1.5" />
            Prontuários
          </TabsTrigger>
          <TabsTrigger value="weigh_ins" data-testid="import-tab-weigh-ins">
            <Scale className="w-4 h-4 mr-1.5" />
            Pesagens
          </TabsTrigger>
          <TabsTrigger value="prescriptions" data-testid="import-tab-prescriptions">
            <Pill className="w-4 h-4 mr-1.5" />
            Prescrições
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tutors" className="mt-6">
          <ImportWizard
            kind="tutors"
            fields={TUTOR_FIELDS}
            helperText="Dedupe automático por e-mail (case-insensitive) ou telefone normalizado."
          />
        </TabsContent>
        <TabsContent value="pets" className="mt-6">
          <ImportWizard
            kind="pets"
            fields={PET_FIELDS}
            helperText="Cada pet precisa do e-mail ou telefone do tutor já cadastrado. Importe os tutores primeiro."
          />
        </TabsContent>
        <TabsContent value="appointments" className="mt-6">
          <ImportWizard
            kind="appointments"
            fields={APPT_FIELDS}
            helperText="Data/hora em ISO 8601 (ex.: 2026-05-20T14:30:00-03:00). Pet identificado por nome dentro do tutor."
          />
        </TabsContent>
        <TabsContent value="exams" className="mt-6">
          <ImportWizard
            kind="exams"
            fields={EXAM_FIELDS}
            helperText="Exames são sempre criados (sem dedupe). Identifique o pet por nome + e-mail/telefone do tutor já cadastrado."
          />
        </TabsContent>
        <TabsContent value="vaccines" className="mt-6">
          <ImportWizard
            kind="vaccines"
            fields={VACCINE_FIELDS}
            helperText="Dedupe automático por (pet, vacina, data de aplicação) — registros idênticos não são reimportados."
          />
        </TabsContent>
        <TabsContent value="medical_records" className="mt-6">
          <ImportWizard
            kind="medical_records"
            fields={RECORD_FIELDS}
            helperText="Texto livre datado. Cada linha gera um registro novo (sem dedupe). A data preserva a do sistema antigo."
          />
        </TabsContent>
        <TabsContent value="weigh_ins" className="mt-6">
          <ImportWizard
            kind="weigh_ins"
            fields={WEIGH_IN_FIELDS}
            helperText="Cada pesagem é um ponto na curva de evolução — sem dedupe. Identifique o pet por nome + e-mail/telefone do tutor já cadastrado."
          />
        </TabsContent>
        <TabsContent value="prescriptions" className="mt-6">
          <ImportWizard
            kind="prescriptions"
            fields={PRESCRIPTION_FIELDS}
            helperText="Cada linha gera uma prescrição nova (sem dedupe). Identifique o pet por nome + e-mail/telefone do tutor já cadastrado."
          />
        </TabsContent>
      </Tabs>

      <ImportHistory />
    </div>
  );
}

function ImportHistory() {
  const { data, isLoading, isError } = useListImportHistory();
  const [detailLogId, setDetailLogId] = useState<string | null>(null);

  return (
    <Card data-testid="import-history-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <History className="w-5 h-5" />
          Histórico de importações
        </CardTitle>
        <CardDescription>
          Últimas 50 execuções da clínica — útil para auditoria e para
          reconciliar reimportações do mesmo arquivo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar o histórico</AlertTitle>
            <AlertDescription>Tente recarregar a página.</AlertDescription>
          </Alert>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma importação realizada ainda. Quando você importar um arquivo
            CSV, ele aparecerá aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Criadas</TableHead>
                  <TableHead className="text-right">Atualizadas</TableHead>
                  <TableHead className="text-right">Ignoradas</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry) => (
                  <TableRow
                    key={entry.id}
                    data-testid={`import-history-row-${entry.id}`}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {entry.userName ?? entry.userEmail ?? "—"}
                      </div>
                      {entry.userName && entry.userEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {entry.userEmail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {KIND_LABELS[entry.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="truncate text-sm"
                          title={entry.fileName ?? undefined}
                        >
                          {entry.fileName ?? "(sem nome)"}
                        </span>
                        {entry.isReimport ? (
                          <Badge
                            variant="outline"
                            className="text-amber-400 border-amber-500/50"
                            data-testid={`reimport-badge-${entry.id}`}
                          >
                            Reimportação
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {entry.rowCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-emerald-400">
                      {entry.createdCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {entry.updatedCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {entry.skippedCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {entry.errorCount > 0 ? (
                        <span className="text-destructive">
                          {entry.errorCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailLogId(entry.id)}
                        data-testid={`import-history-detail-${entry.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ImportDetailDialog
        logId={detailLogId}
        onClose={() => setDetailLogId(null)}
      />
    </Card>
  );
}

function csvEscapeCell(v: string): string {
  if (v.includes('"') || v.includes(",") || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function buildResultsCsv(detail: ImportHistoryDetail): string {
  const headers = ["row", "outcome", "message", "id"];
  const lines = [headers.join(",")];
  for (const r of detail.results ?? []) {
    lines.push(
      [
        String(r.row),
        r.outcome,
        csvEscapeCell(r.message ?? ""),
        csvEscapeCell(r.id ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function downloadResultsCsv(detail: ImportHistoryDetail) {
  const csv = buildResultsCsv(detail);
  // BOM para o Excel reconhecer UTF-8.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = format(new Date(detail.createdAt), "yyyyMMdd-HHmm");
  const a = document.createElement("a");
  a.href = url;
  a.download = `synvet-import-${detail.kind}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const OUTCOME_LABEL: Record<string, string> = {
  created: "Criada",
  updated: "Atualizada",
  skipped: "Ignorada",
  error: "Erro",
};

const OUTCOME_CLASS: Record<string, string> = {
  created: "text-emerald-400",
  updated: "text-sky-400",
  skipped: "text-muted-foreground",
  error: "text-destructive",
};

function ImportDetailDialog({
  logId,
  onClose,
}: {
  logId: string | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading, isError } = useGetImportHistoryDetail(
    logId ?? "",
    {
      query: {
        enabled: !!logId,
        queryKey: getGetImportHistoryDetailQueryKey(logId ?? ""),
      },
    },
  );

  return (
    <Dialog open={!!logId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes da importação</DialogTitle>
          <DialogDescription>
            Relatório linha-a-linha de uma execução do wizard. Permite
            auditar exatamente quais linhas foram criadas, ignoradas
            ou rejeitadas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !detail ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar os detalhes</AlertTitle>
            <AlertDescription>
              Tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border rounded-md p-3 bg-muted/30">
              <div>
                <div className="text-xs text-muted-foreground">Tipo</div>
                <div className="font-medium">{KIND_LABELS[detail.kind]}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Quando</div>
                <div className="font-medium">
                  {format(new Date(detail.createdAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Arquivo</div>
                <div className="font-medium truncate" title={detail.fileName ?? undefined}>
                  {detail.fileName ?? "(sem nome)"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Usuário</div>
                <div className="font-medium truncate">
                  {detail.userName ?? detail.userEmail ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Linhas</div>
                <div className="font-medium tabular-nums">{detail.rowCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Criadas</div>
                <div className="font-medium text-emerald-400 tabular-nums">
                  {detail.createdCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ignoradas</div>
                <div className="font-medium tabular-nums">
                  {detail.skippedCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Erros</div>
                <div className="font-medium text-destructive tabular-nums">
                  {detail.errorCount}
                </div>
              </div>
            </div>

            {detail.results && detail.results.length > 0 ? (
              <>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadResultsCsv(detail)}
                    data-testid="import-detail-download-csv"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Baixar CSV
                  </Button>
                </div>
                <div className="overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 text-right">Linha</TableHead>
                        <TableHead className="w-32">Resultado</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead className="w-64">ID gerado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.results.map((r) => (
                        <TableRow key={r.row} data-testid={`detail-row-${r.row}`}>
                          <TableCell className="text-right tabular-nums text-sm">
                            {r.row}
                          </TableCell>
                          <TableCell className={`text-sm ${OUTCOME_CLASS[r.outcome] ?? ""}`}>
                            {OUTCOME_LABEL[r.outcome] ?? r.outcome}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.message ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground truncate">
                            {r.id ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <Alert>
                <AlertTitle>Detalhes indisponíveis</AlertTitle>
                <AlertDescription>
                  Esta importação foi executada antes da gravação do
                  relatório linha-a-linha. Apenas os contadores
                  agregados estão disponíveis.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
