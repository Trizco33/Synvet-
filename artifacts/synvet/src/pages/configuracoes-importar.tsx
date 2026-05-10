import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Users, Dog, CalendarDays, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { ImportWizard, type ImportField } from "@/components/import/ImportWizard";
import { usePermissions } from "@/hooks/use-permissions";

const TUTOR_FIELDS: ImportField[] = [
  { key: "name", label: "Nome", required: true, aliases: ["nome", "tutor"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "mail"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "fone", "celular"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whats", "zap"] },
  { key: "address", label: "Endereço", aliases: ["endereco", "endereço"] },
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
          <p>· Importe na ordem: <strong>Tutores → Pacientes → Agenda</strong> (pets dependem de tutores; agenda depende de pets).</p>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="tutors" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
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
      </Tabs>
    </div>
  );
}
