import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useGetConsultation, 
  useUpdateConsultation, 
  useGetAnamnesis,
  useUpsertAnamnesis,
  getGetConsultationQueryKey,
  getGetAnamnesisQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  ArrowLeft, CalendarDays, Clock, User, Dog, Cat, FileText, Activity
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";

export default function ConsultationDetail() {
  const [, params] = useRoute("/consultas/:consultationId");
  const consultationId = params?.consultationId || "";
  const queryClient = useQueryClient();

  const { data: consultation, isLoading: isLoadingConsultation } = useGetConsultation(consultationId, {
    query: { enabled: !!consultationId, queryKey: getGetConsultationQueryKey(consultationId) }
  });

  const { data: anamnesis, isLoading: isLoadingAnamnesis } = useGetAnamnesis(consultationId, {
    query: { enabled: !!consultationId, queryKey: getGetAnamnesisQueryKey(consultationId) }
  });

  const updateConsultation = useUpdateConsultation();
  const upsertAnamnesis = useUpsertAnamnesis();

  const [notes, setNotes] = useState({
    reason: "",
    symptoms: "",
    observations: "",
    evolution: "",
    medications: ""
  });

  const [anamnesisData, setAnamnesisData] = useState({
    neurological: "",
    digestive: "",
    respiratory: "",
    dermatological: "",
    general: ""
  });

  const initConsultation = useRef(false);
  const initAnamnesis = useRef(false);

  useEffect(() => {
    if (consultation && !initConsultation.current) {
      setNotes({
        reason: consultation.reason || "",
        symptoms: consultation.symptoms || "",
        observations: consultation.observations || "",
        evolution: consultation.evolution || "",
        medications: consultation.medications || ""
      });
      initConsultation.current = true;
    }
  }, [consultation]);

  useEffect(() => {
    if (anamnesis && !initAnamnesis.current) {
      setAnamnesisData({
        neurological: anamnesis.neurological || "",
        digestive: anamnesis.digestive || "",
        respiratory: anamnesis.respiratory || "",
        dermatological: anamnesis.dermatological || "",
        general: anamnesis.general || ""
      });
      initAnamnesis.current = true;
    }
  }, [anamnesis]);

  const handleSaveConsultation = () => {
    updateConsultation.mutate(
      {
        consultationId,
        data: notes
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(consultationId) });
          toast.success("Consulta salva com sucesso");
        },
        onError: () => toast.error("Erro ao salvar consulta")
      }
    );
  };

  const handleSaveAnamnesis = () => {
    upsertAnamnesis.mutate(
      {
        consultationId,
        data: anamnesisData
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAnamnesisQueryKey(consultationId) });
          toast.success("Anamnese salva com sucesso");
        },
        onError: () => toast.error("Erro ao salvar anamnese")
      }
    );
  };

  if (isLoadingConsultation) {
    return <div className="space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!consultation) {
    return <div>Consulta não encontrada</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/consultas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detalhes da Consulta</h1>
          <div className="flex items-center gap-4 text-muted-foreground text-sm mt-1">
            <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {format(parseISO(consultation.scheduledAt), "dd/MM/yyyy")}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {format(parseISO(consultation.scheduledAt), "HH:mm")}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Paciente</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {consultation.pet.species === "Felina" ? <Cat className="h-6 w-6" /> : <Dog className="h-6 w-6" />}
                </div>
                <div>
                  <Link href={`/pacientes/${consultation.petId}`} className="font-semibold text-lg hover:underline">{consultation.pet.name}</Link>
                  <p className="text-sm text-muted-foreground">{consultation.pet.species}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Raça:</span> <span>{consultation.pet.breed || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Idade:</span> <span>{consultation.pet.birthDate ? format(parseISO(consultation.pet.birthDate), "dd/MM/yyyy") : "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tutor:</span> <Link href={`/tutores/${consultation.tutor.id}`} className="hover:underline">{consultation.tutor.name}</Link></div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Motivo da Consulta</Label>
                <Textarea 
                  value={notes.reason} 
                  onChange={(e) => setNotes({ ...notes, reason: e.target.value })} 
                  placeholder="Por que o paciente veio à clínica?" 
                  className="resize-none h-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Sintomas</Label>
                <Textarea 
                  value={notes.symptoms} 
                  onChange={(e) => setNotes({ ...notes, symptoms: e.target.value })} 
                  placeholder="Sintomas relatados..." 
                  className="resize-none h-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Medicamentos Prescritos</Label>
                <Textarea 
                  value={notes.medications} 
                  onChange={(e) => setNotes({ ...notes, medications: e.target.value })} 
                  placeholder="Receituário..." 
                  className="resize-none h-20"
                />
              </div>
              <Button onClick={handleSaveConsultation} className="w-full" disabled={updateConsultation.isPending}>
                {updateConsultation.isPending ? "Salvando..." : "Salvar Informações"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Anamnese e Exame Físico
                </CardTitle>
                <CardDescription>Avaliação sistêmica detalhada</CardDescription>
              </div>
              <Button size="sm" onClick={handleSaveAnamnesis} disabled={upsertAnamnesis.isPending || isLoadingAnamnesis}>
                {upsertAnamnesis.isPending ? "Salvando..." : "Salvar Anamnese"}
              </Button>
            </CardHeader>
            <CardContent className="pt-4 flex-1">
              {isLoadingAnamnesis ? (
                <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : (
                <Accordion type="single" collapsible className="w-full" defaultValue="general">
                  <AccordionItem value="general">
                    <AccordionTrigger className="font-semibold hover:no-underline">Sistema Geral</AccordionTrigger>
                    <AccordionContent>
                      <Textarea 
                        value={anamnesisData.general} 
                        onChange={(e) => setAnamnesisData({ ...anamnesisData, general: e.target.value })} 
                        placeholder="Estado geral, linfonodos, mucosas, hidratação..." 
                        className="min-h-[120px] resize-y"
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="digestive">
                    <AccordionTrigger className="font-semibold hover:no-underline">Sistema Digestivo</AccordionTrigger>
                    <AccordionContent>
                      <Textarea 
                        value={anamnesisData.digestive} 
                        onChange={(e) => setAnamnesisData({ ...anamnesisData, digestive: e.target.value })} 
                        placeholder="Apetite, vômitos, fezes, palpação abdominal..." 
                        className="min-h-[120px] resize-y"
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="respiratory">
                    <AccordionTrigger className="font-semibold hover:no-underline">Sistema Respiratório & Cardíaco</AccordionTrigger>
                    <AccordionContent>
                      <Textarea 
                        value={anamnesisData.respiratory} 
                        onChange={(e) => setAnamnesisData({ ...anamnesisData, respiratory: e.target.value })} 
                        placeholder="Frequência cardíaca/respiratória, tosse, ausculta..." 
                        className="min-h-[120px] resize-y"
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="dermatological">
                    <AccordionTrigger className="font-semibold hover:no-underline">Sistema Dermatológico</AccordionTrigger>
                    <AccordionContent>
                      <Textarea 
                        value={anamnesisData.dermatological} 
                        onChange={(e) => setAnamnesisData({ ...anamnesisData, dermatological: e.target.value })} 
                        placeholder="Pelagem, ectoparasitas, lesões cutâneas..." 
                        className="min-h-[120px] resize-y"
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="neurological">
                    <AccordionTrigger className="font-semibold hover:no-underline">Sistema Neurológico & Locomotor</AccordionTrigger>
                    <AccordionContent>
                      <Textarea 
                        value={anamnesisData.neurological} 
                        onChange={(e) => setAnamnesisData({ ...anamnesisData, neurological: e.target.value })} 
                        placeholder="Marcha, reflexos, claudicação, dor à palpação..." 
                        className="min-h-[120px] resize-y"
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <div className="mt-8 space-y-2">
                <Label className="text-base font-semibold">Evolução / Observações Finais</Label>
                <Textarea 
                  value={notes.evolution} 
                  onChange={(e) => setNotes({ ...notes, evolution: e.target.value })} 
                  placeholder="Conclusão da consulta e plano terapêutico..." 
                  className="min-h-[150px] resize-y"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
