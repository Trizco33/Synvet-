import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle,
  Plus,
  QrCode,
  Power,
  Trash2,
  Send,
  Zap,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  useCommsDashboard,
  useListCommsChannels,
  useCreateCommsChannel,
  useDeleteCommsChannel,
  useConnectCommsChannel,
  useDisconnectCommsChannel,
  useListCommsTemplates,
  useCreateCommsTemplate,
  useUpdateCommsTemplate,
  useDeleteCommsTemplate,
  useListCommsAutomations,
  useUpdateCommsAutomation,
  useListCommsMessages,
  useCommsTestSend,
  getCommsDashboardQueryKey,
  getListCommsChannelsQueryKey,
  getListCommsTemplatesQueryKey,
  getListCommsAutomationsQueryKey,
  getListCommsMessagesQueryKey,
  type CommsChannel,
  type CommsTemplate,
  type CommsAutomation,
  type CommsMessage,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";

// ===================== helpers =====================

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  connected: { label: "Conectado", tone: "success" },
  connecting: { label: "Conectando", tone: "warning" },
  disconnected: { label: "Desconectado", tone: "muted" },
  error: { label: "Erro", tone: "danger" },
  queued: { label: "Na fila", tone: "muted" },
  scheduled: { label: "Agendada", tone: "muted" },
  sending: { label: "Enviando", tone: "warning" },
  sent: { label: "Enviada", tone: "success" },
  delivered: { label: "Entregue", tone: "success" },
  read: { label: "Lida", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
};

function StatusBadge({ status }: { status: string }) {
  const conf = STATUS_LABEL[status] ?? { label: status, tone: "muted" as const };
  const cls =
    conf.tone === "success"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : conf.tone === "warning"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : conf.tone === "danger"
          ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
          : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{conf.label}</Badge>;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const TRIGGER_LABEL: Record<string, string> = {
  "consultation.created": "Consulta agendada",
  "consultation.confirmed": "Consulta confirmada",
  "consultation.cancelled": "Consulta cancelada",
  "exam.created": "Exame criado",
  "exam.ready": "Exame pronto",
  "vaccine.created": "Vacina aplicada",
  "vaccine.due": "Vacina próxima do vencimento",
  "pet.birthday": "Aniversário do pet",
};

// ===================== page =====================

export default function ComunicacaoPage() {
  const { isAdmin, role } = usePermissions();
  const canEditTemplates = isAdmin || role === "vet";
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
            <MessageCircle className="w-7 h-7 text-primary" />
            Comunicação
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Conecte o WhatsApp da clínica, configure templates e ligue automações para falar com tutores em escala.
            Versão V1: provider mock funcional para validar fluxos. Para envio real, configure um provider externo.
          </p>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="channels"><ChannelsTab canManage={isAdmin} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab canEdit={canEditTemplates} canDelete={isAdmin} /></TabsContent>
        <TabsContent value="automations"><AutomationsTab canManage={isAdmin} /></TabsContent>
        <TabsContent value="messages"><MessagesTab canSendTest={canEditTemplates} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== overview tab =====================

function OverviewTab() {
  const { data, isLoading } = useCommsDashboard();
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }
  if (!data) return null;
  const tiles = [
    { label: "Canais", value: `${data.channels.connected}/${data.channels.total}`, hint: "conectados", icon: Power },
    { label: "Templates", value: data.templates.total, hint: "ativos", icon: FileText },
    { label: "Automações", value: `${data.automations.enabled}/${data.automations.total}`, hint: "ligadas", icon: Zap },
    { label: "Mensagens (30d)", value: data.messages.last30d, hint: `${data.messages.sent} enviadas · ${data.messages.failed} falhas`, icon: Send },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
              <t.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas mensagens</CardTitle>
          <CardDescription>Eventos recentes processados pelo módulo</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma mensagem ainda. Conecte um canal e ative uma automação para começar.
            </p>
          ) : (
            <MessageList items={data.recent} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== channels tab =====================

function ChannelsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useListCommsChannels();
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const createMut = useCreateCommsChannel({
    mutation: {
      onSuccess: () => {
        toast.success("Canal criado");
        setCreating(false);
        setDisplayName("");
        setPhoneNumber("");
        qc.invalidateQueries({ queryKey: getListCommsChannelsQueryKey() });
        qc.invalidateQueries({ queryKey: getCommsDashboardQueryKey() });
      },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao criar canal"),
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;
  const channels = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Canais conectados</h2>
          <p className="text-sm text-muted-foreground">Cada clínica pode ter um WhatsApp dedicado.</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo canal
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum canal cadastrado. {canManage ? "Crie um canal WhatsApp para começar." : "Peça ao administrador da clínica para configurar."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} canManage={canManage} />
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo canal WhatsApp</DialogTitle>
            <DialogDescription>
              O canal começa desconectado. Após criar, clique em "Conectar" para gerar o QR.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ch-name">Nome de exibição</Label>
              <Input id="ch-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: WhatsApp principal" />
            </div>
            <div>
              <Label htmlFor="ch-phone">Telefone (opcional)</Label>
              <Input id="ch-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+55 11 99999-9999" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button
              onClick={() =>
                createMut.mutate({
                  data: {
                    kind: "whatsapp_qr",
                    displayName: displayName || null,
                    phoneNumber: phoneNumber || null,
                  },
                })
              }
              disabled={createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelCard({ channel, canManage }: { channel: CommsChannel; canManage: boolean }) {
  const qc = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState<{ qrString: string | null; message: string | null } | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListCommsChannelsQueryKey() });
    qc.invalidateQueries({ queryKey: getCommsDashboardQueryKey() });
  };
  const connectMut = useConnectCommsChannel({
    mutation: {
      onSuccess: (resp) => {
        setQrPayload({ qrString: resp.qrString ?? null, message: resp.message ?? null });
        setQrOpen(true);
        invalidate();
      },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao conectar"),
    },
  });
  const disconnectMut = useDisconnectCommsChannel({
    mutation: {
      onSuccess: () => { toast.success("Canal desconectado"); invalidate(); },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao desconectar"),
    },
  });
  const deleteMut = useDeleteCommsChannel({
    mutation: {
      onSuccess: () => { toast.success("Canal removido"); invalidate(); },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao remover"),
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {channel.displayName ?? "WhatsApp"}
              <StatusBadge status={channel.status} />
            </CardTitle>
            <CardDescription className="mt-1">
              Provider: <span className="font-mono text-xs">{channel.provider}</span>
              {channel.phoneNumber ? <> · {channel.phoneNumber}</> : null}
            </CardDescription>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Remover este canal? Mensagens já enviadas continuam no histórico.")) {
                  deleteMut.mutate({ channelId: channel.id });
                }
              }}
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {channel.lastError && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">
              Último erro: {channel.lastError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Última conexão: {formatDateTime(channel.lastConnectedAt)}
          </p>
          {canManage && (
            <div className="flex gap-2 pt-1">
              {channel.status !== "connected" ? (
                <Button size="sm" onClick={() => connectMut.mutate({ channelId: channel.id })} disabled={connectMut.isPending}>
                  {connectMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Conectar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => disconnectMut.mutate({ channelId: channel.id })} disabled={disconnectMut.isPending}>
                  {disconnectMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Power className="w-4 h-4 mr-2" />}
                  Desconectar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie este código com o WhatsApp do celular da clínica em <strong>Aparelhos conectados</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrPayload?.qrString ? (
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={qrPayload.qrString} size={224} level="M" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">QR indisponível.</div>
            )}
            {qrPayload?.message && (
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                {qrPayload.message}
              </p>
            )}
            {channel.provider === "mock" && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30">
                MockProvider — canal já marcado como conectado para testes
              </Badge>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===================== templates tab =====================

function TemplatesTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useListCommsTemplates();
  const [editing, setEditing] = useState<CommsTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListCommsTemplatesQueryKey() });
    qc.invalidateQueries({ queryKey: getCommsDashboardQueryKey() });
  };

  if (isLoading) return <Skeleton className="h-40" />;
  const templates = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates de mensagem</h2>
          <p className="text-sm text-muted-foreground">
            Use <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{tutor_first_name}}"}</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{pet_name}}"}</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{scheduled_at}}"}</code>, etc.
          </p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-2" /> Novo template</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <Card
            key={t.id}
            className={canEdit ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}
            onClick={() => { if (canEdit) setEditing(t); }}
          >
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {t.name}
                {t.isSystem && <Badge variant="outline" className="text-xs">padrão</Badge>}
                {!t.enabled && <Badge variant="outline" className="text-xs bg-muted">desativado</Badge>}
              </CardTitle>
              <CardDescription className="font-mono text-xs">{t.slug} · {t.category}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(editing || creating) && (
        <TemplateDialog
          template={editing}
          canDelete={canDelete}
          open={true}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { invalidate(); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  template,
  canDelete,
  open,
  onClose,
  onSaved,
}: {
  template: CommsTemplate | null;
  canDelete: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!template;
  const [name, setName] = useState(template?.name ?? "");
  const [slug, setSlug] = useState(template?.slug ?? "");
  const [category, setCategory] = useState(template?.category ?? "transactional");
  const [body, setBody] = useState(template?.body ?? "");
  const [enabled, setEnabled] = useState(template?.enabled ?? true);
  const createMut = useCreateCommsTemplate({
    mutation: {
      onSuccess: () => { toast.success("Template criado"); onSaved(); },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao criar"),
    },
  });
  const updateMut = useUpdateCommsTemplate({
    mutation: {
      onSuccess: () => { toast.success("Template salvo"); onSaved(); },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao salvar"),
    },
  });
  const deleteMut = useDeleteCommsTemplate({
    mutation: {
      onSuccess: () => { toast.success("Template removido"); onSaved(); },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao remover"),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Identificador (slug)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={isEdit} />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="transactional / reminder / campaign" />
          </div>
          <div>
            <Label>Corpo</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis disponíveis: {"{{tutor_name}}"}, {"{{tutor_first_name}}"}, {"{{pet_name}}"}, {"{{pet_species}}"}, {"{{scheduled_at}}"}, {"{{vaccine_name}}"}, {"{{due_at}}"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="tpl-enabled" />
            <Label htmlFor="tpl-enabled">Ativo</Label>
          </div>
        </div>
        <DialogFooter className="justify-between">
          <div>
            {isEdit && canDelete && !template?.isSystem && (
              <Button
                variant="outline"
                className="text-rose-300"
                onClick={() => {
                  if (template && confirm("Remover este template?")) deleteMut.mutate({ templateId: template.id });
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remover
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => {
                if (isEdit && template) {
                  updateMut.mutate({ templateId: template.id, data: { name, category, body, enabled } });
                } else {
                  createMut.mutate({ data: { slug, name, body, category, enabled } });
                }
              }}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== automations tab =====================

function AutomationsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: autos, isLoading } = useListCommsAutomations();
  const { data: tpls } = useListCommsTemplates();
  const updateMut = useUpdateCommsAutomation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCommsAutomationsQueryKey() });
        qc.invalidateQueries({ queryKey: getCommsDashboardQueryKey() });
      },
      onError: (err: Error) => toast.error(err.message ?? "Falha ao salvar automação"),
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;
  const items = autos?.items ?? [];
  const tplById: Record<string, CommsTemplate> = {};
  for (const t of tpls?.items ?? []) tplById[t.id] = t;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma automação cadastrada. As automações padrão são criadas junto com o primeiro canal.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Automações disparam quando um evento acontece no sistema. Toda regra começa <strong>desligada</strong>: revise o template e ligue manualmente.
      </p>
      {items.map((a: CommsAutomation) => {
        const tpl = tplById[a.templateId];
        return (
          <Card key={a.id}>
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  {a.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Disparo: <strong>{TRIGGER_LABEL[a.trigger] ?? a.trigger}</strong></span>
                  <span>Template: {tpl?.name ?? "(removido)"}</span>
                  {a.offsetMinutes !== 0 && <span>Atraso: {a.offsetMinutes} min</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{a.enabled ? "Ligada" : "Desligada"}</span>
                <Switch
                  checked={a.enabled}
                  disabled={!canManage || updateMut.isPending}
                  onCheckedChange={(v) => updateMut.mutate({ automationId: a.id, data: { enabled: v } })}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ===================== messages tab =====================

function MessagesTab({ canSendTest }: { canSendTest: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useListCommsMessages({ limit: 100 });
  const { data: channels } = useListCommsChannels();
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testBody, setTestBody] = useState("Mensagem de teste do Synvet.");
  const [testChannelId, setTestChannelId] = useState<string>("");
  const testMut = useCommsTestSend({
    mutation: {
      onSuccess: () => {
        toast.success("Mensagem enfileirada");
        setTestOpen(false);
        qc.invalidateQueries({ queryKey: getListCommsMessagesQueryKey() });
        qc.invalidateQueries({ queryKey: getCommsDashboardQueryKey() });
      },
      onError: (err: Error) => toast.error(err.message ?? "Falha no envio"),
    },
  });

  if (isLoading) return <Skeleton className="h-60" />;
  const items = data?.items ?? [];
  const channelOptions = channels?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mensagens</h2>
          <p className="text-sm text-muted-foreground">Histórico de envios — automações + testes manuais.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => qc.invalidateQueries({ queryKey: getListCommsMessagesQueryKey() })}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          {canSendTest && (
            <Button onClick={() => { setTestChannelId(channelOptions[0]?.id ?? ""); setTestOpen(true); }} disabled={channelOptions.length === 0}>
              <Send className="w-4 h-4 mr-2" /> Enviar teste
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><MessageList items={items} /></CardContent></Card>
      )}

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem de teste</DialogTitle>
            <DialogDescription>
              A mensagem é enfileirada e processada pelo scheduler (até 15s). Use o número WhatsApp completo (ex.: 5511999999999).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Canal</Label>
              <select
                className="w-full bg-background border border-border rounded-md h-9 px-2 text-sm"
                value={testChannelId}
                onChange={(e) => setTestChannelId(e.target.value)}
              >
                {channelOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName ?? "WhatsApp"} ({c.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Destino</Label>
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="5511999999999" />
            </div>
            <div>
              <Label>Corpo</Label>
              <Textarea value={testBody} onChange={(e) => setTestBody(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => testMut.mutate({ data: { channelId: testChannelId, toAddress: testTo, body: testBody } })}
              disabled={testMut.isPending || !testChannelId || !testTo || !testBody}
            >
              {testMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageList({ items }: { items: CommsMessage[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Para</TableHead>
          <TableHead>Mensagem</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDateTime(m.sentAt ?? m.createdAt)}
            </TableCell>
            <TableCell className="text-sm">{m.toAddress}</TableCell>
            <TableCell className="text-sm max-w-md">
              <span className="line-clamp-2">{m.body}</span>
              {m.errorMessage && (
                <span className="block text-xs text-rose-300 mt-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {m.errorMessage}
                </span>
              )}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5">
                {(m.status === "sent" || m.status === "delivered" || m.status === "read") && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <StatusBadge status={m.status} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
