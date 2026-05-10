import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useGetPet, 
  useUpdatePet, 
  getGetPetQueryKey,
  useListPetConsultations,
  useListPetExams,
  useListPetVaccines,
  useCreateVaccine,
  getListPetVaccinesQueryKey,
  useListMedicalRecords,
  useCreateMedicalRecord,
  getListMedicalRecordsQueryKey,
  useGetPetTimeline,
  getGetPetTimelineQueryKey,
  aiSummarizePetTimeline,
  aiDetectClinicalPatterns,
} from "@workspace/api-client-react";
import { AIAssistantDrawer, AITriggerButton } from "@/components/ai/ai-assistant-drawer";
import { useSetCopilotContext } from "@/components/ai/copilot/copilot-provider";
import { ClinicalAlerts } from "@/components/clinical/clinical-alerts";
import { ClinicalTimeline } from "@/components/clinical/clinical-timeline";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { 
  ArrowLeft, Dog, Cat, User, 
  Syringe, FileText, FileSearch, CalendarDays, Plus, Clock
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";

const updatePetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  species: z.string().min(1, "Espécie é obrigatória"),
  breed: z.string().optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().optional().or(z.literal("")),
  weightKg: z.coerce.number().optional().or(z.literal("")),
  neutered: z.boolean().default(false),
  isCritical: z.boolean().default(false),
  continuousMedications: z.string().optional().or(z.literal("")),
  allergies: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  externalId: z.string().optional().or(z.literal("")),
});

const createVaccineSchema = z.object({
  name: z.string().min(1, "Nome da vacina é obrigatório"),
  appliedAt: z.string().min(1, "Data de aplicação é obrigatória"),
  nextDueAt: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const createRecordSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
});

export default function PetDetail() {
  const [, params] = useRoute("/app/pacientes/:petId");
  const petId = params?.petId || "";
  const queryClient = useQueryClient();

  useSetCopilotContext(petId ? { petId, consultationId: null, label: "Paciente" } : null);

  const { data: petDetail, isLoading } = useGetPet(petId, {
    query: { enabled: !!petId, queryKey: getGetPetQueryKey(petId) }
  });

  const { data: consultations } = useListPetConsultations(petId, {
    query: { enabled: !!petId, queryKey: ["/pets", petId, "consultations"] as const }
  });

  const { data: exams } = useListPetExams(petId, {
    query: { enabled: !!petId, queryKey: ["/pets", petId, "exams"] as const }
  });

  const { data: vaccines } = useListPetVaccines(petId, {
    query: { enabled: !!petId, queryKey: getListPetVaccinesQueryKey(petId) }
  });

  const { data: records } = useListMedicalRecords(petId, {
    query: { enabled: !!petId, queryKey: getListMedicalRecordsQueryKey(petId) }
  });

  const { data: timeline } = useGetPetTimeline(petId, {
    query: { enabled: !!petId, queryKey: getGetPetTimelineQueryKey(petId) }
  });

  const updatePet = useUpdatePet();
  const createVaccine = useCreateVaccine();
  const createRecord = useCreateMedicalRecord();
  const { isAdmin } = usePermissions();

  const [isVaccineOpen, setIsVaccineOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [aiTimelineOpen, setAiTimelineOpen] = useState(false);
  const [aiPatternsOpen, setAiPatternsOpen] = useState(false);

  const editForm = useForm<z.infer<typeof updatePetSchema>>({
    resolver: zodResolver(updatePetSchema),
    defaultValues: {
      name: "",
      species: "Canina",
      breed: "",
      sex: "unknown",
      birthDate: "",
      weightKg: undefined,
      neutered: false,
      isCritical: false,
      continuousMedications: "",
      allergies: "",
      notes: "",
      externalId: "",
    },
  });

  useEffect(() => {
    if (petDetail) {
      editForm.reset({
        name: petDetail.name || "",
        species: petDetail.species || "Canina",
        breed: petDetail.breed || "",
        sex: petDetail.sex || "unknown",
        birthDate: petDetail.birthDate ? format(parseISO(petDetail.birthDate), "yyyy-MM-dd") : "",
        weightKg: petDetail.weightKg || undefined,
        neutered: petDetail.neutered || false,
        isCritical: petDetail.isCritical || false,
        continuousMedications: petDetail.continuousMedications || "",
        allergies: petDetail.allergies || "",
        notes: petDetail.notes || "",
        externalId: petDetail.externalId || "",
      });
    }
  }, [petDetail, editForm]);

  const vaccineForm = useForm<z.infer<typeof createVaccineSchema>>({
    resolver: zodResolver(createVaccineSchema),
    defaultValues: {
      name: "",
      appliedAt: format(new Date(), "yyyy-MM-dd"),
      nextDueAt: "",
      notes: "",
    }
  });

  const recordForm = useForm<z.infer<typeof createRecordSchema>>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      title: "",
      content: "",
    }
  });

  const onEditSubmit = (values: z.infer<typeof updatePetSchema>) => {
    updatePet.mutate(
      {
        petId,
        data: {
          name: values.name,
          species: values.species,
          breed: values.breed || null,
          sex: values.sex,
          birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : null,
          weightKg: values.weightKg ? Number(values.weightKg) : null,
          neutered: values.neutered,
          isCritical: values.isCritical,
          continuousMedications: values.continuousMedications || null,
          allergies: values.allergies || null,
          notes: values.notes || null,
          ...(isAdmin ? { externalId: values.externalId?.trim() || null } : {}),
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(petId) });
          toast.success("Paciente atualizado com sucesso");
        },
        onError: (err: unknown) => {
          const data = (err as { data?: { error?: string } } | undefined)?.data;
          toast.error(data?.error || "Erro ao atualizar paciente");
        }
      }
    );
  };

  const onVaccineSubmit = (values: z.infer<typeof createVaccineSchema>) => {
    createVaccine.mutate(
      {
        petId,
        data: {
          name: values.name,
          appliedAt: new Date(values.appliedAt).toISOString(),
          nextDueAt: values.nextDueAt ? new Date(values.nextDueAt).toISOString() : null,
          notes: values.notes || null,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPetVaccinesQueryKey(petId) });
          queryClient.invalidateQueries({ queryKey: getGetPetTimelineQueryKey(petId) });
          queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(petId) });
          toast.success("Vacina registrada");
          setIsVaccineOpen(false);
          vaccineForm.reset();
        },
        onError: () => toast.error("Erro ao registrar vacina")
      }
    );
  };

  const onRecordSubmit = (values: z.infer<typeof createRecordSchema>) => {
    createRecord.mutate(
      {
        petId,
        data: {
          title: values.title,
          content: values.content,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMedicalRecordsQueryKey(petId) });
          queryClient.invalidateQueries({ queryKey: getGetPetTimelineQueryKey(petId) });
          queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(petId) });
          toast.success("Prontuário registrado");
          setIsRecordOpen(false);
          recordForm.reset();
        },
        onError: () => toast.error("Erro ao registrar prontuário")
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>;
  }

  if (!petDetail) {
    return <div>Paciente não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/pacientes">
            <Button variant="ghost" size="icon" data-testid="btn-back-pets">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {petDetail.species === "Felina" ? <Cat className="h-8 w-8" /> : <Dog className="h-8 w-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{petDetail.name}</h1>
                {petDetail.sex === "male" && <span className="text-blue-500 font-bold text-xl leading-none mt-1">♂</span>}
                {petDetail.sex === "female" && <span className="text-pink-500 font-bold text-xl leading-none mt-1">♀</span>}
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Tutor: <Link href={`/tutores/${petDetail.tutor.id}`} className="hover:underline text-foreground">{petDetail.tutor.name}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <ClinicalAlerts pet={petDetail} compact />

      <AIAssistantDrawer
        open={aiTimelineOpen}
        onOpenChange={setAiTimelineOpen}
        title={`Resumo de evolução · ${petDetail.name}`}
        description="Síntese narrativa da timeline clínica gerada por IA."
        run={(signal) => aiSummarizePetTimeline(petId, { signal })}
        trigger={petId}
      />
      <AIAssistantDrawer
        open={aiPatternsOpen}
        onOpenChange={setAiPatternsOpen}
        title={`Padrões clínicos · ${petDetail.name}`}
        description="Sinais recorrentes, lacunas e sugestões de investigação detectadas pela IA."
        run={(signal) => aiDetectClinicalPatterns(petId, { signal })}
        trigger={petId}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-muted-foreground text-sm font-medium mb-1">Consultas</span>
            <span className="text-2xl font-bold">{petDetail.stats.consultationsCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-muted-foreground text-sm font-medium mb-1">Exames</span>
            <span className="text-2xl font-bold">{petDetail.stats.examsCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-muted-foreground text-sm font-medium mb-1">Vacinas</span>
            <span className="text-2xl font-bold">{petDetail.stats.vaccinesCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-muted-foreground text-sm font-medium mb-1">Última Visita</span>
            <span className="text-lg font-bold truncate w-full">
              {petDetail.stats.lastVisit ? format(parseISO(petDetail.stats.lastVisit), "dd/MM/yyyy") : "Nunca"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-7 h-auto p-1 mb-6 bg-card border border-border">
          <TabsTrigger value="overview" className="py-2">Visão Geral</TabsTrigger>
          <TabsTrigger value="timeline" className="py-2"><Clock className="w-4 h-4 mr-1 hidden md:inline" />Timeline</TabsTrigger>
          <TabsTrigger value="consultations" className="py-2">Consultas</TabsTrigger>
          <TabsTrigger value="exams" className="py-2">Exames</TabsTrigger>
          <TabsTrigger value="vaccines" className="py-2">Vacinas</TabsTrigger>
          <TabsTrigger value="records" className="py-2">Prontuário</TabsTrigger>
          <TabsTrigger value="edit" className="py-2">Editar</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Linha do tempo clínica</CardTitle>
                <CardDescription>Consultas, exames, vacinas e prontuário em ordem cronológica.</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <AITriggerButton
                  onClick={() => setAiTimelineOpen(true)}
                  label="Resumir evolução (IA)"
                />
                <AITriggerButton
                  onClick={() => setAiPatternsOpen(true)}
                  label="Detectar padrões (IA)"
                />
              </div>
            </CardHeader>
            <CardContent>
              <ClinicalTimeline events={timeline ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Ficha Clínica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Espécie</span>
                  <p className="font-medium">{petDetail.species}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Raça</span>
                  <p className="font-medium">{petDetail.breed || "Não informada"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Data Nascimento</span>
                  <p className="font-medium">{petDetail.birthDate ? format(parseISO(petDetail.birthDate), "dd/MM/yyyy") : "Não informada"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Peso</span>
                  <p className="font-medium">{petDetail.weightKg ? `${petDetail.weightKg} kg` : "Não informado"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Castrado</span>
                  <p className="font-medium">{petDetail.neutered ? "Sim" : "Não"}</p>
                </div>
                {petDetail.externalId && (
                  <div>
                    <span className="text-sm text-muted-foreground">ID do sistema antigo</span>
                    <p className="font-medium font-mono" data-testid="pet-external-id">{petDetail.externalId}</p>
                  </div>
                )}
              </div>
              
              {petDetail.allergies && (
                <div className="pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground font-medium text-destructive">Alergias</span>
                  <p className="font-medium mt-1">{petDetail.allergies}</p>
                </div>
              )}
              
              {petDetail.notes && (
                <div className="pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground font-medium">Observações Gerais</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{petDetail.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultations" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Histórico de Consultas</CardTitle>
              <Link href={`/consultas`}>
                <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Nova Consulta</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {consultations && consultations.length > 0 ? (
                <div className="space-y-4 pt-4">
                  {consultations.map(c => (
                    <Link key={c.id} href={`/consultas/${c.id}`}>
                      <div className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-lg">{format(parseISO(c.scheduledAt), "dd/MM/yyyy HH:mm")}</div>
                          <div className="text-sm text-muted-foreground mt-1">Motivo: {c.reason || "Não informado"}</div>
                        </div>
                        <Badge variant="outline">{c.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <CalendarDays className="h-12 w-12 opacity-20 mb-3" />
                  <p>Nenhuma consulta registrada para este paciente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exams" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Exames</CardTitle>
            </CardHeader>
            <CardContent>
              {exams && exams.length > 0 ? (
                <div className="space-y-4 pt-4">
                  {exams.map(e => (
                    <div key={e.id} className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{e.category}</Badge>
                          <span className="font-semibold text-lg">{e.title}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Realizado em: {format(parseISO(e.performedAt), "dd/MM/yyyy")}
                        </div>
                      </div>
                      <Badge variant={e.status === "completed" ? "default" : "outline"} className={e.status === "completed" ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" : ""}>
                        {e.status === "completed" ? "Concluído" : "Pendente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileSearch className="h-12 w-12 opacity-20 mb-3" />
                  <p>Nenhum exame registrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vaccines" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Carteira de Vacinação</CardTitle>
              <Dialog open={isVaccineOpen} onOpenChange={setIsVaccineOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Registrar Vacina</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Vacina</DialogTitle>
                  </DialogHeader>
                  <Form {...vaccineForm}>
                    <form onSubmit={vaccineForm.handleSubmit(onVaccineSubmit)} className="space-y-4">
                      <FormField
                        control={vaccineForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Vacina *</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={vaccineForm.control}
                          name="appliedAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de Aplicação *</FormLabel>
                              <FormControl><Input type="date" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vaccineForm.control}
                          name="nextDueAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Próxima Dose</FormLabel>
                              <FormControl><Input type="date" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={vaccineForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observações</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-2 flex justify-end">
                        <Button type="submit" disabled={createVaccine.isPending}>Salvar</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {vaccines && vaccines.length > 0 ? (
                <div className="space-y-4 pt-4">
                  {vaccines.map(v => (
                    <div key={v.id} className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-lg">{v.name}</div>
                        <div className="text-sm text-muted-foreground flex flex-col sm:flex-row gap-1 sm:gap-4 mt-1">
                          <span>Aplicada: {format(parseISO(v.appliedAt), "dd/MM/yyyy")}</span>
                          {v.nextDueAt && (
                            <span className="text-amber-500 font-medium">Reforço: {format(parseISO(v.nextDueAt), "dd/MM/yyyy")}</span>
                          )}
                        </div>
                        {v.notes && <p className="text-sm mt-2">{v.notes}</p>}
                      </div>
                      <Syringe className="h-8 w-8 text-primary/30 hidden sm:block" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <Syringe className="h-12 w-12 opacity-20 mb-3" />
                  <p>Nenhuma vacina registrada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Prontuário Livre</CardTitle>
              <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo Registro</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Novo Registro Médico</DialogTitle>
                  </DialogHeader>
                  <Form {...recordForm}>
                    <form onSubmit={recordForm.handleSubmit(onRecordSubmit)} className="space-y-4">
                      <FormField
                        control={recordForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título *</FormLabel>
                            <FormControl><Input placeholder="Ex: Internação, Cirurgia, etc" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={recordForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição *</FormLabel>
                            <FormControl><Textarea className="min-h-[200px]" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-2 flex justify-end">
                        <Button type="submit" disabled={createRecord.isPending}>Salvar Registro</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {records && records.length > 0 ? (
                <div className="space-y-4 pt-4">
                  {records.map(r => (
                    <div key={r.id} className="p-5 border border-border/60 bg-card rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-lg">{r.title}</h3>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                          {format(parseISO(r.createdAt), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileText className="h-12 w-12 opacity-20 mb-3" />
                  <p>Nenhum registro de prontuário.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="edit" className="mt-0">
          <Card>
            <CardHeader><CardTitle>Editar Paciente</CardTitle></CardHeader>
            <CardContent>
              <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="species"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Espécie *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Canina">Canina</SelectItem>
                                <SelectItem value="Felina">Felina</SelectItem>
                                <SelectItem value="Equina">Equina</SelectItem>
                                <SelectItem value="Silvestre">Silvestre</SelectItem>
                                <SelectItem value="Outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="breed"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Raça</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="sex"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sexo *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Macho</SelectItem>
                                <SelectItem value="female">Fêmea</SelectItem>
                                <SelectItem value="unknown">Não informado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="birthDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Nascimento</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="weightKg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso (kg)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="neutered"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Castrado</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="isCritical"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-red-500/30 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Paciente crítico</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={editForm.control}
                      name="continuousMedications"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medicações contínuas</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Ex.: Insulina, anti-hipertensivo..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="allergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alergias</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações Gerais</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isAdmin && (
                      <FormField
                        control={editForm.control}
                        name="externalId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID do sistema antigo</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Opcional"
                                {...field}
                                data-testid="input-edit-pet-external-id"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="pt-4">
                      <Button type="submit" disabled={updatePet.isPending}>
                        {updatePet.isPending ? "Salvando..." : "Salvar Alterações"}
                      </Button>
                    </div>
                  </form>
                </Form>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
