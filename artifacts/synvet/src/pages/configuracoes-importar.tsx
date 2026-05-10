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
} from "lucide-react";
import { Link } from "wouter";
import { ImportWizard, type ImportField } from "@/components/import/ImportWizard";
import { usePermissions } from "@/hooks/use-permissions";

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
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 max-w-3xl">
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
      </Tabs>
    </div>
  );
}
