import { useState } from "react";
import {
  useListExams,
  getListExamsQueryKey,
  useCreateExam,
  useListPets,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, TestTube } from "lucide-react";
import { format, parseISO } from "date-fns";

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

const EXAM_CATEGORIES = [
  "Hemograma",
  "Bioquímico",
  "Urinálise",
  "Imagem",
  "Citologia",
  "Microbiologia",
  "Outros",
];

const newExamSchema = z.object({
  petId: z.string().min(1, "Selecione um paciente"),
  title: z.string().min(2, "Informe o título"),
  category: z.string().min(1, "Selecione a categoria"),
  status: z.enum(["pending", "completed"]),
  performedAt: z.string().min(1, "Informe a data"),
  fileUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export default function Exames() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: exams, isLoading } = useListExams({});
  const { data: pets } = useListPets({});
  const createExam = useCreateExam();

  const form = useForm<z.infer<typeof newExamSchema>>({
    resolver: zodResolver(newExamSchema),
    defaultValues: {
      petId: "",
      title: "",
      category: "Hemograma",
      status: "pending",
      performedAt: format(new Date(), "yyyy-MM-dd"),
      fileUrl: "",
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof newExamSchema>) => {
    createExam.mutate(
      {
        data: {
          petId: values.petId,
          title: values.title,
          category: values.category,
          status: values.status,
          performedAt: new Date(values.performedAt).toISOString(),
          fileUrl: values.fileUrl || null,
          fileType: null,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
          toast.success("Exame registrado");
          form.reset({
            petId: "",
            title: "",
            category: "Hemograma",
            status: "pending",
            performedAt: format(new Date(), "yyyy-MM-dd"),
            fileUrl: "",
            notes: "",
          });
          setIsOpen(false);
        },
        onError: () => toast.error("Erro ao registrar exame"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exames</h1>
          <p className="text-muted-foreground">Resultados e laudos de exames.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-exam">
              <Plus className="w-4 h-4 mr-2" />
              Novo Exame
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo exame</DialogTitle>
              <DialogDescription>
                Registre um exame e, opcionalmente, anexe a URL pública do laudo (PDF/imagem).
              </DialogDescription>
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
                          <SelectTrigger data-testid="select-exam-pet">
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
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex.: Hemograma completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXAM_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="performedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL do laudo (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas adicionais..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createExam.isPending} data-testid="button-submit-exam">
                    {createExam.isPending ? "Salvando..." : "Registrar exame"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : exams && exams.length > 0 ? (
        <div className="space-y-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="border-border/50">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">{exam.category}</Badge>
                    <h3 className="font-semibold text-lg">{exam.title}</h3>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Paciente: {exam.petName} • Data: {format(parseISO(exam.performedAt), "dd/MM/yyyy")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {exam.fileUrl && (
                    <a
                      href={exam.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Abrir laudo
                    </a>
                  )}
                  {exam.status === "completed" ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                      Concluído
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Pendente
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed bg-card/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <TestTube className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhum exame registrado</h3>
        </div>
      )}
    </div>
  );
}
