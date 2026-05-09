import { useGetAdminMetrics } from "@workspace/api-client-react";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0c14]/60 p-4">
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-3xl font-semibold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminMetricas() {
  const { data, isLoading } = useGetAdminMetrics();
  if (isLoading || !data) {
    return (
      <section>
        <header className="mb-5">
          <h1 className="text-2xl font-semibold">Métricas</h1>
        </header>
        <p className="text-white/40 text-sm">Carregando…</p>
      </section>
    );
  }
  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold">Métricas</h1>
        <p className="text-sm text-white/50 mt-1">Visão geral da plataforma.</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Clínicas" value={data.totalClinics} />
        <Stat label="Em trial" value={data.trialingClinics} />
        <Stat label="Ativas" value={data.activeClinics} />
        <Stat label="Pagamento pendente" value={data.pastDueClinics} />
        <Stat label="Suspensas" value={data.suspendedClinics} />
        <Stat label="Total de usuários" value={data.totalUsers} />
        <Stat label="Leads" value={data.totalLeads} hint={`+${data.leadsThisWeek} esta semana`} />
        <Stat label="Signups esta semana" value={data.signupsThisWeek} />
      </div>
    </section>
  );
}
