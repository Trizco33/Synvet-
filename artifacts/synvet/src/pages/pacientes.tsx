import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListPets,
  getListPetsQueryKey,
  getListTutorsQueryKey,
  useCreateTutor,
  useCreatePet,
  deleteTutor,
} from "@workspace/api-client-react";
import { Search, Plus, Dog, Cat, User, Scale, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

const schema = z.object({
  tutorName: z.string().min(2, "Nome do tutor é obrigatório"),
  tutorPhone: z.string().optional().or(z.literal("")),
  tutorWhatsapp: z.string().optional().or(z.literal("")),
  tutorEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  tutorAddress: z.string().optional().or(z.literal("")),
  petName: z.string().min(1, "Nome do paciente é obrigatório"),
  species: z.string().min(1, "Espécie é obrigatória"),
  breed: z.string().optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().optional().or(z.literal("")),
  weightKg: z.coerce.number().optional().or(z.literal("")),
  neutered: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

export default function Pacientes() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: pets, isLoading } = useListPets({ q: search || undefined });
  const createTutor = useCreateTutor();
  const createPet = useCreatePet();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tutorName: "",
      tutorPhone: "",
      tutorWhatsapp: "",
      tutorEmail: "",
      tutorAddress: "",
      petName: "",
      species: "Canina",
      breed: "",
      sex: "unknown",
      birthDate: "",
      weightKg: undefined,
      neutered: false,
    },
  });

  const submitting = createTutor.isPending || createPet.isPending;

  const onSubmit = async (values: FormValues) => {
    let tutorId: string | null = null;
    try {
      const tutor = await createTutor.mutateAsync({
        data: {
          name: values.tutorName,
          email: values.tutorEmail || null,
          phone: values.tutorPhone || null,
          whatsapp: values.tutorWhatsapp || null,
          address: values.tutorAddress || null,
        },
      });
      tutorId = tutor.id;
      await createPet.mutateAsync({
        data: {
          tutorId: tutor.id,
          name: values.petName,
          species: values.species,
          breed: values.breed || null,
          sex: values.sex,
          birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : null,
          weightKg: values.weightKg ? Number(values.weightKg) : null,
          neutered: values.neutered,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListTutorsQueryKey() });
      toast.success("Paciente cadastrado com sucesso");
      setIsCreateOpen(false);
      form.reset();
    } catch (err: unknown) {
      if (tutorId) {
        try {
          await deleteTutor(tutorId);
        } catch {
          // best-effort: tutor pode ficar órfão; admin pode remover depois
        }
      }
      const msg =
        err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
          ? (err as { data: { error: string } }).data.error
          : "Erro ao cadastrar paciente";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground">Gerencie os animais da clínica.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-pet">
              <Plus className="w-4 h-4 mr-2" />
              Novo Paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Paciente</DialogTitle>
              <DialogDescription>
                Preencha os dados do tutor e do paciente. Tudo é salvo de uma vez.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                    <User className="h-4 w-4 text-primary" />
                    Dados do tutor
                  </div>
                  <FormField
                    control={form.control}
                    name="tutorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: João Pedro Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tutorPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tutorWhatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="tutorEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="joao@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tutorAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, número, bairro, cidade" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                <section className="space-y-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                    <Dog className="h-4 w-4 text-primary" />
                    Dados do paciente
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="petName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do paciente *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Léo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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
                      control={form.control}
                      name="sex"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sexo *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de nascimento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
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
                    control={form.control}
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
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </section>

                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Salvando..." : "Cadastrar paciente"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar pacientes..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-pets"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t">
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pets && pets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pets.map((pet) => (
            <Link key={pet.id} href={`/pacientes/${pet.id}`} data-testid={`link-pet-${pet.id}`}>
              <Card className="h-full hover-elevate transition-all cursor-pointer border-border/50 bg-card/50 hover:bg-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {pet.species === "Felina" ? <Cat className="h-6 w-6" /> : <Dog className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg truncate" data-testid={`text-pet-name-${pet.id}`}>
                            {pet.name}
                          </h3>
                          {pet.sex === "male" && <span className="text-blue-500 font-bold leading-none">♂</span>}
                          {pet.sex === "female" && <span className="text-pink-500 font-bold leading-none">♀</span>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {pet.species}{pet.breed ? ` • ${pet.breed}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {pet.neutered && (
                      <Badge variant="secondary" className="text-xs">Castrado</Badge>
                    )}
                    {pet.weightKg && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        {pet.weightKg} kg
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 mt-4 pt-4 border-t border-border/50 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">Tutor: {pet.tutorName}</span>
                    </div>
                    {pet.tutorAddress && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="truncate">{pet.tutorAddress}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed bg-card/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Dog className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhum paciente encontrado</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            {search ? "Nenhum paciente corresponde à sua busca." : "Cadastre o primeiro paciente da clínica."}
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Paciente
          </Button>
        </div>
      )}
    </div>
  );
}
