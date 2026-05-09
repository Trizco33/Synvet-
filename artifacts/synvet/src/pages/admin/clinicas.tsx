import { useListAdminClinics } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABEL, PLANS, type PlanId } from "@/lib/plans";

const STATUS_CLASS: Record<string, string> = {
  trialing: "bg-primary/15 text-primary border-primary/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past_due: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  suspended: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  canceled: "bg-white/5 text-white/50 border-white/10",
};

export default function AdminClinicas() {
  const { data, isLoading } = useListAdminClinics();
  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold">Clínicas</h1>
        <p className="text-sm text-white/50 mt-1">
          Todas as clínicas da plataforma — assinaturas, trials e contagens.
        </p>
      </header>
      <div className="rounded-lg border border-white/10 bg-[#0a0c14]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Clínica</th>
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Trial até</th>
                <th className="px-4 py-2.5 font-medium text-right">Usuários</th>
                <th className="px-4 py-2.5 font-medium text-right">Pets</th>
                <th className="px-4 py-2.5 font-medium">Criada</th>
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
                    Nenhuma clínica ainda.
                  </td>
                </tr>
              )}
              {data?.map((c) => (
                <tr key={c.id} className="hover:bg-white/5" data-testid={`admin-clinic-${c.id}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-white/40 font-mono">{c.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">{PLANS[c.plan as PlanId]?.name ?? c.plan}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                        STATUS_CLASS[c.status] ?? "bg-white/5 border-white/10"
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {c.trialEndsAt
                      ? format(new Date(c.trialEndsAt), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.usersCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.petsCount}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceToNow(new Date(c.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
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
