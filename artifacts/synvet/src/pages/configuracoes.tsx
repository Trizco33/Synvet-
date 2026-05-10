import {
  useGetClinic,
  useUpdateClinic,
  useGetMe,
  useListTeam,
  useUpdateTeamMember,
  useUpdateNotificationPrefs,
  getGetMeQueryKey,
  getListTeamQueryKey,
  type TeamMember,
  type UpdateTeamMemberBodyRole,
} from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Building, MapPin, Phone, FileText, Users, Sparkles, UserCircle, Bell, Upload, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { useLocation } from "wouter";

const VALID_TABS = ["geral", "equipe", "assinatura", "notificacoes"] as const;
type ConfigTab = (typeof VALID_TABS)[number];

function readTabFromUrl(): ConfigTab {
  if (typeof window === "undefined") return "geral";
  const t = new URL(window.location.href).searchParams.get("tab");
  return (VALID_TABS as readonly string[]).includes(t ?? "") ? (t as ConfigTab) : "geral";
}

const ROLE_LABEL: Record<TeamMember["role"], string> = {
  admin: "Administrador",
  vet: "Veterinário(a)",
  assistant: "Assistente",
};

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
  const { isAdmin } = usePermissions();

  const form = useForm<z.infer<typeof clinicSchema>>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      phone: "",
      address: "",
    },
  });

  useEffect(() => {
    if (clinic) {
      form.reset({
        name: clinic.name || "",
        cnpj: clinic.cnpj || "",
        phone: clinic.phone || "",
        address: clinic.address || "",
      });
    }
  }, [clinic, form]);

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

  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<ConfigTab>(readTabFromUrl);

  useEffect(() => {
    const onPop = () => setTab(readTabFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Toast quando o usuário cancela o checkout do Stripe e cai de volta na aba.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") === "cancelled") {
      toast.info("Checkout cancelado. Quando quiser, escolha um plano abaixo.");
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, []);

  const handleTabChange = (value: string) => {
    const next = (VALID_TABS as readonly string[]).includes(value)
      ? (value as ConfigTab)
      : "geral";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "geral") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", next);
    }
    setLocation(url.pathname + (url.search ? url.search : ""));
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

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="geral" data-testid="tab-geral">
            <Building className="w-4 h-4 mr-1.5" /> Geral
          </TabsTrigger>
          <TabsTrigger value="equipe" data-testid="tab-equipe">
            <Users className="w-4 h-4 mr-1.5" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="assinatura" data-testid="tab-assinatura">
            <Sparkles className="w-4 h-4 mr-1.5" /> Assinatura
          </TabsTrigger>
          <TabsTrigger value="notificacoes" data-testid="tab-notificacoes">
            <Bell className="w-4 h-4 mr-1.5" /> Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 mt-6">
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

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Importar dados
            </CardTitle>
            <CardDescription>
              Migre tutores, pacientes e agenda do seu sistema antigo via CSV.
              Validação automática e dedupe por chave natural.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/app/configuracoes/importar">
              <Button variant="outline" data-testid="link-importar">
                Abrir assistente
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            Meu Perfil
          </CardTitle>
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
              <p className="text-lg">{me?.role ? ROLE_LABEL[me.role as TeamMember["role"]] ?? me.role : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="equipe" className="space-y-6 mt-6">
          <TeamSection canManage={isAdmin} currentUserId={me?.userId} />
        </TabsContent>

        <TabsContent value="assinatura" className="space-y-6 mt-6">
          <SubscriptionCard />
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-6 mt-6">
          <NotificationsSection canManage={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationsSection({ canManage }: { canManage: boolean }) {
  const { data: me, isLoading } = useGetMe();
  const queryClient = useQueryClient();
  const updatePrefs = useUpdateNotificationPrefs();
  const trialReminder = me?.notifications?.notifyTrialReminder ?? true;

  const handleToggleTrial = (next: boolean) => {
    updatePrefs.mutate(
      { data: { notifyTrialReminder: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast.success("Preferência atualizada");
        },
        onError: () => toast.error("Falha ao atualizar preferência"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notificações por e-mail
          </CardTitle>
          <CardDescription>
            Controle quais e-mails opcionais sua clínica recebe. Recibos de pagamento, falhas de
            cobrança e convites de equipe são transacionais e não podem ser desativados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="space-y-1">
                <p className="font-medium leading-none">Lembretes de fim de trial</p>
                <p className="text-sm text-muted-foreground">
                  Avisos quando faltam 3 dias para o trial expirar e quando ele termina.
                </p>
              </div>
              <Switch
                checked={trialReminder}
                disabled={!canManage || updatePrefs.isPending}
                onCheckedChange={handleToggleTrial}
                data-testid="toggle-trial-reminder"
              />
            </div>
          )}
          {!canManage && (
            <p className="text-xs text-muted-foreground">
              Apenas administradores podem alterar as preferências da clínica.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamSection({
  canManage,
  currentUserId,
}: {
  canManage: boolean;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { data: team, isLoading } = useListTeam();
  const updateMember = useUpdateTeamMember();

  const handleRoleChange = (memberId: string, role: UpdateTeamMemberBodyRole) => {
    updateMember.mutate(
      { memberId, data: { role } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamQueryKey() });
          toast.success("Cargo atualizado");
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Erro ao atualizar cargo";
          toast.error(msg);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Equipe
        </CardTitle>
        <CardDescription>
          {canManage
            ? "Gerencie quem tem acesso e em qual cargo. Apenas administradores podem alterar cargos."
            : "Membros da clínica. Somente administradores podem alterar cargos."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !team || team.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro registrado.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {team.map((m) => {
              const isSelf = m.id === currentUserId;
              return (
                <li
                  key={m.id}
                  className="py-3 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar>
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {(m.name?.charAt(0) || m.email.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {m.name || m.email}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground ml-2">(você)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                  {canManage && !(isSelf && m.role === "admin") ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        handleRoleChange(m.id, v as UpdateTeamMemberBodyRole)
                      }
                    >
                      <SelectTrigger className="w-[180px]" data-testid={`select-role-${m.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="vet">Veterinário(a)</SelectItem>
                        <SelectItem value="assistant">Assistente</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm rounded-md border border-border px-2 py-1">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!canManage && (
          <p className="text-xs text-muted-foreground mt-3">
            Para convidar novos membros, peça ao administrador da clínica.
          </p>
        )}
        {canManage && (
          <p className="text-xs text-muted-foreground mt-3">
            Convites por e-mail são feitos pelo Supabase Auth. Após o primeiro login do
            convidado o registro aparecerá aqui automaticamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
