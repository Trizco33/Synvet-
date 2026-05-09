import {
  useListAdminLeads,
  useUpdateAdminLead,
  getListAdminLeadsQueryKey,
  type UpdateAdminLeadBodyStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: UpdateAdminLeadBodyStatus; label: string }[] = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contatado" },
  { value: "converted", label: "Convertido" },
  { value: "lost", label: "Perdido" },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

export default function AdminLeads() {
  const { data, isLoading } = useListAdminLeads();
  const qc = useQueryClient();
  const updateLead = useUpdateAdminLead();

  const handleStatus = (leadId: string, status: UpdateAdminLeadBodyStatus) => {
    updateLead.mutate(
      { leadId, data: { status } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAdminLeadsQueryKey() });
          toast.success("Status atualizado");
        },
        onError: () => toast.error("Erro ao atualizar status"),
      },
    );
  };

  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-white/50 mt-1">
          Captura do site institucional. Acompanhe e atualize o status.
        </p>
      </header>
      <div className="rounded-lg border border-white/10 bg-[#0a0c14]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Clínica</th>
                <th className="px-4 py-2.5 font-medium">Mensagem</th>
                <th className="px-4 py-2.5 font-medium">Origem</th>
                <th className="px-4 py-2.5 font-medium">Quando</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-white/40">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && (!data || data.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-white/40">
                    Nenhum lead ainda.
                  </td>
                </tr>
              )}
              {data?.map((lead) => (
                <tr key={lead.id} className="hover:bg-white/5" data-testid={`admin-lead-${lead.id}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{lead.name}</p>
                    {lead.role && (
                      <p className="text-xs text-white/40">{lead.role}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    <p>{lead.email}</p>
                    {lead.phone && <p className="text-xs text-white/50">{lead.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-white/70">{lead.clinicName ?? "—"}</td>
                  <td className="px-4 py-3 text-white/60 max-w-xs">
                    <p className="line-clamp-2 text-xs">{lead.message ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{lead.source}</td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={lead.status}
                      onValueChange={(v) =>
                        handleStatus(lead.id, v as UpdateAdminLeadBodyStatus)
                      }
                    >
                      <SelectTrigger
                        className="w-[140px] h-8 bg-white/5 border-white/10"
                        data-testid={`admin-lead-status-${lead.id}`}
                      >
                        <SelectValue>{STATUS_LABEL[lead.status] ?? lead.status}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
