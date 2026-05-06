import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListConsultations,
  getListConsultationsQueryKey,
  useCreateConsultation,
  useListPets,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, CalendarDays, Clock, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const newConsultationSchema = z.object({
  petId: z.string().min(1, "Selecione um paciente"),
  scheduledAt: z.string().min(1, "Informe data e hora"),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
  reason: z.string().optional().or(z.literal("")),
});

export default function Consultas() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: consultations, isLoading } = useListConsultations({});
  const { data: pets } = useListPets({});
  const createConsultation = useCreateConsultation();

  const form = useForm<z.infer<typeof newConsultationSchema>>({
    resolver: zodResolver(newConsultationSchema),
    defaultValues: {
      petId: "",
      scheduledAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      status: "scheduled",
      reason: "",
    },
  });

  const onSubmit = (values: z.infer<typeof newConsultationSchema>) => {
    createConsultation.mutate(
      {
        data: {
          petId: values.petId,
          scheduledAt: new Date(values.scheduledAt).toISOString(),
          status: values.status,
          reason: values.reason || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey() });
          toast.success("Consulta agendada");
          form.reset({
            petId: "",
            scheduledAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            status: "scheduled",
            reason: "",
          });
          setIsOpen(false);
        },
        onError: () => toast.error("Erro ao agendar consulta"),
      },
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">Agendada</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Em Andamento</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Concluída</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consultas</h1>
          <p className="text-muted-foreground">Agenda de consultas da clínica.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-consultation">
              <Plus className="w-4 h-4 mr-2" />
              Nova Consulta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova consulta</DialogTitle>
              <DialogDescription>Agende uma consulta para um paciente.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="petId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paciente</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-pet">
                            <SelectValue placeholder="Selecione o paciente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(pets ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} — {p.species}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e hora</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-scheduled-at" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Agendada</SelectItem>
                          <SelectItem value="in_progress">Em andamento</SelectItem>
                          <SelectItem value="completed">Concluída</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Ex.: check-up anual, vacinação..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createConsultation.isPending} data-testid="button-submit-consultation">
                    {createConsultation.isPending ? "Salvando..." : "Agendar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <Skeleton className="h-12 w-12 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : consultations && consultations.length > 0 ? (
        <div className="space-y-3">
          {consultations.map((consultation) => (
            <Link key={consultation.id} href={`/consultas/${consultation.id}`} data-testid={`link-consultation-${consultation.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer border-border/50">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center min-w-[70px] p-2 bg-secondary rounded-md border border-border/50 text-primary">
                        <span className="text-xs font-semibold uppercase">{format(parseISO(consultation.scheduledAt), "MMM")}</span>
                        <span className="text-xl font-bold leading-none">{format(parseISO(consultation.scheduledAt), "dd")}</span>
                        <span className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(consultation.scheduledAt), "HH:mm")}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{consultation.petName}</h3>
                          <span className="text-xs text-muted-foreground">({consultation.petSpecies})</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {consultation.tutorName}
                          </span>
                          {consultation.reason && (
                            <span className="text-foreground/80 line-clamp-1">Motivo: {consultation.reason}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>{getStatusBadge(consultation.status)}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed bg-card/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhuma consulta encontrada</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">Sua agenda está vazia no momento.</p>
        </div>
      )}
    </div>
  );
}
