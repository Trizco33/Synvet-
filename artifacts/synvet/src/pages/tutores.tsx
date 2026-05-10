import { useListTutors, useCreateTutor, getListTutorsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { Search, Plus, User, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const tutorSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  externalId: z.string().optional().or(z.literal("")),
});

export default function Tutores() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  const { data: tutors, isLoading } = useListTutors({ q: search || undefined });
  const createTutor = useCreateTutor();

  const form = useForm<z.infer<typeof tutorSchema>>({
    resolver: zodResolver(tutorSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      whatsapp: "",
      address: "",
      externalId: "",
    },
  });

  const onSubmit = (values: z.infer<typeof tutorSchema>) => {
    createTutor.mutate(
      {
        data: {
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          whatsapp: values.whatsapp || null,
          address: values.address || null,
          ...(isAdmin ? { externalId: values.externalId?.trim() || null } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTutorsQueryKey() });
          toast.success("Tutor cadastrado com sucesso");
          setIsCreateOpen(false);
          form.reset();
        },
        onError: (err: unknown) => {
          const msg =
            err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
              ? (err as { data: { error: string } }).data.error
              : "Erro ao cadastrar tutor";
          toast.error(msg);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutores</h1>
          <p className="text-muted-foreground">Gerencie os responsáveis pelos pacientes.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-tutor">
              <Plus className="w-4 h-4 mr-2" />
              Novo Tutor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastrar Tutor</DialogTitle>
              <DialogDescription>
                Adicione um novo responsável ao sistema.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: João da Silva" {...field} data-testid="input-tutor-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} data-testid="input-tutor-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} data-testid="input-tutor-whatsapp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="joao@email.com" {...field} data-testid="input-tutor-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro, cidade" {...field} data-testid="input-tutor-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isAdmin && (
                  <FormField
                    control={form.control}
                    name="externalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID do sistema antigo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: TUT-001 (opcional)"
                            {...field}
                            data-testid="input-tutor-external-id"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={createTutor.isPending} data-testid="button-submit-tutor">
                    {createTutor.isPending ? "Salvando..." : "Salvar Tutor"}
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
            placeholder="Buscar por nome, contato ou ID antigo..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-tutors"
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
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tutors && tutors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutors.map((tutor) => (
            <Link key={tutor.id} href={`/tutores/${tutor.id}`} data-testid={`link-tutor-${tutor.id}`}>
              <Card className="h-full hover-elevate transition-all cursor-pointer border-border/50 bg-card/50 hover:bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12 border border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {tutor.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate" data-testid={`text-tutor-name-${tutor.id}`}>
                        {tutor.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Cadastrado em {format(parseISO(tutor.createdAt), "dd/MM/yyyy")}
                      </p>
                      {tutor.externalId && (
                        <p
                          className="text-[11px] text-muted-foreground/80 font-mono truncate mt-0.5"
                          title={`ID do sistema antigo: ${tutor.externalId}`}
                          data-testid={`text-tutor-external-id-${tutor.id}`}
                        >
                          ID antigo: {tutor.externalId}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground mt-4 pt-4 border-t border-border/50">
                    {tutor.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="h-3.5 w-3.5" />
                        <span className="truncate">{tutor.phone}</span>
                      </div>
                    )}
                    {tutor.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{tutor.email}</span>
                      </div>
                    )}
                    {tutor.address && (
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{tutor.address}</span>
                      </div>
                    )}
                    {!tutor.phone && !tutor.email && !tutor.address && (
                      <div className="text-muted-foreground/50 italic">
                        Sem informações de contato adicionais
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
            <User className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhum tutor encontrado</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            {search ? "Nenhum tutor corresponde à sua busca." : "Você ainda não possui tutores cadastrados na clínica."}
          </p>
          <Button onClick={() => setIsCreateOpen(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Primeiro Tutor
          </Button>
        </div>
      )}
    </div>
  );
}
