import { useGetClinic, useUpdateClinic, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Building, MapPin, Phone, FileText } from "lucide-react";

const clinicSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  cnpj: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

export default function Configuracoes() {
  const { data: clinic, isLoading: clinicLoading } = useGetClinic();
  const { data: me, isLoading: meLoading } = useGetMe();
  const updateClinic = useUpdateClinic();

  const form = useForm<z.infer<typeof clinicSchema>>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      phone: "",
      address: "",
    },
  });

  useState(() => {
    if (clinic) {
      form.reset({
        name: clinic.name || "",
        cnpj: clinic.cnpj || "",
        phone: clinic.phone || "",
        address: clinic.address || "",
      });
    }
  });

  const onSubmit = (values: z.infer<typeof clinicSchema>) => {
    updateClinic.mutate(
      {
        data: {
          name: values.name,
          cnpj: values.cnpj || null,
          phone: values.phone || null,
          address: values.address || null,
        }
      },
      {
        onSuccess: () => toast.success("Configurações atualizadas com sucesso"),
        onError: () => toast.error("Erro ao atualizar configurações")
      }
    );
  };

  if (clinicLoading || meLoading) {
    return <div className="space-y-6"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as informações da clínica e seu perfil.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Dados da Clínica
          </CardTitle>
          <CardDescription>
            Informações que aparecerão em receitas, exames e documentos oficiais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Clínica</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={updateClinic.isPending}>
                  {updateClinic.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>Informações do seu usuário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nome</p>
              <p className="text-lg">{me?.name || "Não informado"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg">{me?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cargo</p>
              <p className="text-lg capitalize">{me?.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
