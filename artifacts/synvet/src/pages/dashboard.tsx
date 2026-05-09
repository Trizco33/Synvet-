import { useGetDashboardSummary, useGetTodaySchedule, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dog, CalendarDays, TestTube, Users, Clock, Activity, FileText, Sparkles, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: schedule, isLoading: isLoadingSchedule } = useGetTodaySchedule();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Agendada</Badge>;
      case "in_progress": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Em Andamento</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Concluída</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Cancelada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "consultation": return <CalendarDays className="w-4 h-4 text-blue-500" />;
      case "exam": return <TestTube className="w-4 h-4 text-purple-500" />;
      case "pet_created": return <Dog className="w-4 h-4 text-green-500" />;
      case "vaccine": return <Activity className="w-4 h-4 text-amber-500" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua clínica hoje.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pacientes Totais</CardTitle>
              <Dog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-3xl font-bold" data-testid="summary-patients">{summary?.totalPatients || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consultas Hoje</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-3xl font-bold text-primary" data-testid="summary-consultations">{summary?.consultationsToday || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exames Pendentes</CardTitle>
              <TestTube className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-3xl font-bold" data-testid="summary-exams">{summary?.pendingExams || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos este Mês</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-3xl font-bold" data-testid="summary-new">{summary?.newPatientsThisMonth || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Card
          className="relative overflow-hidden border-primary/30"
          style={{
            background:
              "linear-gradient(135deg, rgba(91,140,255,0.10) 0%, rgba(122,92,255,0.10) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #7A5CFF 0%, transparent 70%)" }}
          />
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md shadow-primary/30"
                style={{ background: "linear-gradient(135deg, #5B8CFF 0%, #7A5CFF 100%)" }}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-xl">Assistente IA</CardTitle>
                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase tracking-wide">
                    Assistivo · revise sempre
                  </Badge>
                </div>
                <CardDescription className="mt-1 max-w-2xl">
                  Resuma consultas, organize anamnese, identifique padrões clínicos e gere
                  resumos longitudinais da timeline do paciente — direto dentro de cada
                  registro.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/app/consultas">
              <div className="group flex h-full flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer" data-testid="ai-shortcut-summarize">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Resumir consulta
                </div>
                <p className="text-xs text-muted-foreground">Abra uma consulta → botão no topo direito.</p>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
            <Link href="/app/consultas">
              <div className="group flex h-full flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer" data-testid="ai-shortcut-organize">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Organizar texto clínico
                </div>
                <p className="text-xs text-muted-foreground">Em Sintomas/Evolução: link "Organizar com IA".</p>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
            <Link href="/app/pacientes">
              <div className="group flex h-full flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer" data-testid="ai-shortcut-timeline">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Resumir evolução
                </div>
                <p className="text-xs text-muted-foreground">Paciente → aba Timeline → "Resumir evolução".</p>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
            <Link href="/app/pacientes">
              <div className="group flex h-full flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer" data-testid="ai-shortcut-patterns">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Detectar padrões
                </div>
                <p className="text-xs text-muted-foreground">Paciente → aba Timeline → "Detectar padrões".</p>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Agenda de Hoje</CardTitle>
              <CardDescription>Próximas consultas programadas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSchedule ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : schedule && schedule.length > 0 ? (
                <div className="space-y-4">
                  {schedule.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-secondary/50" data-testid={`schedule-item-${item.id}`}>
                      <div className="flex flex-col items-center justify-center min-w-[60px] p-2 bg-background rounded-md border border-border">
                        <Clock className="w-4 h-4 mb-1 text-muted-foreground" />
                        <span className="text-sm font-semibold">{format(parseISO(item.scheduledAt), "HH:mm")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold truncate">{item.petName}</span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline-block">({item.petSpecies})</span>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          Tutor: {item.tutorName}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
                  <p>Nenhuma consulta agendada para hoje.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>Últimas ações na clínica</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="space-y-4">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 pb-4 border-b border-border/40 last:border-0 last:pb-0" data-testid={`activity-item-${item.id}`}>
                      <div className="mt-0.5 p-2 bg-secondary rounded-full border border-border/50">
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none mb-1">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mb-1 line-clamp-1">{item.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground/70">
                          {format(parseISO(item.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p>Nenhuma atividade recente encontrada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
