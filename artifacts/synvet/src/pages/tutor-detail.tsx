import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { 
  useGetTutor, 
  useUpdateTutor, 
  getGetTutorQueryKey,
  useCreatePet
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { 
  User, Phone, Mail, MapPin, Edit, ArrowLeft, Plus, Dog, Cat, 
  Calendar, Scale, ShieldAlert, Activity
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const updateTutorSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

const createPetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  species: z.string().min(1, "Espécie é obrigatória"),
  breed: z.string().optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().optional().or(z.literal("")),
  weightKg: z.coerce.number().optional().or(z.literal("")),
  neutered: z.boolean().default(false),
  allergies: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export default function TutorDetail() {
  const [, params] = useRoute("/app/tutores/:tutorId");
  const tutorId = params?.tutorId || "";
  const queryClient = useQueryClient();

  const { data: tutor, isLoading } = useGetTutor(tutorId, {
    query: { enabled: !!tutorId, queryKey: getGetTutorQueryKey(tutorId) }
  });

  const updateTutor = useUpdateTutor();
  const createPet = useCreatePet();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreatePetOpen, setIsCreatePetOpen] = useState(false);

  const editForm = useForm<z.infer<typeof updateTutorSchema>>({
    resolver: zodResolver(updateTutorSchema),
    defaultValues: {
      name: tutor?.name || "",
      email: tutor?.email || "",
      phone: tutor?.phone || "",
      whatsapp: tutor?.whatsapp || "",
      address: tutor?.address || "",
    },
  });

  useEffect(() => {
    if (tutor) {
      editForm.reset({
        name: tutor.name || "",
        email: tutor.email || "",
        phone: tutor.phone || "",
        whatsapp: tutor.whatsapp || "",
        address: tutor.address || "",
      });
    }
  }, [tutor, editForm]);

  const petForm = useForm<z.infer<typeof createPetSchema>>({
    resolver: zodResolver(createPetSchema),
    defaultValues: {
      name: "",
      species: "Canina",
      breed: "",
      sex: "unknown",
      birthDate: "",
      weightKg: undefined,
      neutered: false,
      allergies: "",
      notes: "",
    },
  });

  const onEditSubmit = (values: z.infer<typeof updateTutorSchema>) => {
    updateTutor.mutate(
      {
        tutorId,
        data: {
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          address: values.address || null,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTutorQueryKey(tutorId) });
          toast.success("Tutor atualizado com sucesso");
          setIsEditOpen(false);
        },
        onError: () => {
          toast.error("Erro ao atualizar tutor");
        }
      }
    );
  };

  const onPetSubmit = (values: z.infer<typeof createPetSchema>) => {
    createPet.mutate(
      {
        data: {
          tutorId,
          name: values.name,
          species: values.species,
          breed: values.breed || null,
          sex: values.sex,
          birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : null,
          weightKg: values.weightKg ? Number(values.weightKg) : null,
          neutered: values.neutered,
          allergies: values.allergies || null,
          notes: values.notes || null,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTutorQueryKey(tutorId) });
          toast.success("Paciente cadastrado com sucesso");
          setIsCreatePetOpen(false);
          petForm.reset();
        },
        onError: () => {
          toast.error("Erro ao cadastrar paciente");
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!tutor) {
    return <div>Tutor não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/tutores">
          <Button variant="ghost" size="icon" data-testid="btn-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {tutor.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid={`tutor-name-${tutor.id}`}>{tutor.name}</h1>
            <p className="text-sm text-muted-foreground">Cadastrado em {format(parseISO(tutor.createdAt), "dd/MM/yyyy")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Informações de Contato</CardTitle>
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                  editForm.reset({
                    name: tutor.name || "",
                    email: tutor.email || "",
                    phone: tutor.phone || "",
                    whatsapp: tutor.whatsapp || "",
                    address: tutor.address || "",
                  });
                }}>
                  <Edit className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Editar Tutor</DialogTitle>
                  <DialogDescription>
                    Atualize as informações do tutor.
                  </DialogDescription>
                </DialogHeader>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="whatsapp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço Completo</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="pt-4 flex justify-end">
                      <Button type="submit" disabled={updateTutor.isPending}>
                        {updateTutor.isPending ? "Salvando..." : "Salvar Alterações"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-sm text-muted-foreground">{tutor.phone || "Não informado"}</p>
                {tutor.whatsapp && tutor.whatsapp !== tutor.phone && (
                  <p className="text-sm text-muted-foreground">WA: {tutor.whatsapp}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">E-mail</p>
                <p className="text-sm text-muted-foreground">{tutor.email || "Não informado"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Endereço</p>
                <p className="text-sm text-muted-foreground">{tutor.address || "Não informado"}</p>
              </div>
            </div>
            {tutor.externalId && (
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">ID do sistema antigo</p>
                  <p className="text-sm text-muted-foreground font-mono" data-testid="tutor-external-id">{tutor.externalId}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pets List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
            <div>
              <CardTitle className="text-lg font-semibold">Pacientes ({tutor.pets.length})</CardTitle>
              <CardDescription>Animais associados a este tutor</CardDescription>
            </div>
            <Dialog open={isCreatePetOpen} onOpenChange={setIsCreatePetOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="btn-add-pet">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Cadastrar Paciente</DialogTitle>
                  <DialogDescription>
                    Adicionar novo animal para {tutor.name}.
                  </DialogDescription>
                </DialogHeader>
                <Form {...petForm}>
                  <form onSubmit={petForm.handleSubmit(onPetSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={petForm.control}
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
                        control={petForm.control}
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
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={petForm.control}
                        name="breed"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Raça</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Poodle" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={petForm.control}
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
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={petForm.control}
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
                        control={petForm.control}
                        name="weightKg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso (kg)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="Ex: 12.5" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={petForm.control}
                      name="neutered"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Castrado</FormLabel>
                            <DialogDescription>
                              O animal já passou por procedimento de castração?
                            </DialogDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="pt-4 flex justify-end">
                      <Button type="submit" disabled={createPet.isPending}>
                        {createPet.isPending ? "Salvando..." : "Cadastrar Paciente"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            {tutor.pets.length > 0 ? (
              <div className="divide-y border-t-0">
                {tutor.pets.map(pet => (
                  <Link key={pet.id} href={`/pacientes/${pet.id}`}>
                    <div className="p-4 hover:bg-secondary/50 transition-colors flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          {pet.species === "Felina" ? <Cat className="h-6 w-6" /> : <Dog className="h-6 w-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{pet.name}</h4>
                            {pet.sex === "male" && <span className="text-blue-500 text-xs font-bold">♂</span>}
                            {pet.sex === "female" && <span className="text-pink-500 text-xs font-bold">♀</span>}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                            <span>{pet.species}{pet.breed ? ` • ${pet.breed}` : ""}</span>
                            {pet.weightKg && <span className="flex items-center gap-1"><Scale className="h-3 w-3" /> {pet.weightKg}kg</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver Prontuário
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <Dog className="h-12 w-12 opacity-20 mb-3" />
                <p>Nenhum paciente vinculado a este tutor.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
