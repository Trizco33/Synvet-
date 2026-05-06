import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { useListConsultations, getListConsultationsQueryKey } from "@workspace/api-client-react";
import { Search, Plus, CalendarDays, Clock, User, Dog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Consultas() {
  const { data: consultations, isLoading } = useListConsultations({});

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Agendada</Badge>;
      case "in_progress": return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Em Andamento</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Concluída</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Cancelada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consultas</h1>
          <p className="text-muted-foreground">Agenda de consultas da clínica.</p>
        </div>

        <Button data-testid="button-new-consultation">
          <Plus className="w-4 h-4 mr-2" />
          Nova Consulta
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : consultations && consultations.length > 0 ? (
        <div className="space-y-3">
          {consultations.map((consultation) => (
            <Link key={consultation.id} href={`/consultas/${consultation.id}`} data-testid={`link-consultation-${consultation.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer border-border/50">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center min-w-[70px] p-2 bg-secondary rounded-md border border-border/50 text-primary">
                        <span className="text-xs font-semibold uppercase">{format(parseISO(consultation.scheduledAt), "MMM")}</span>
                        <span className="text-xl font-bold leading-none">{format(parseISO(consultation.scheduledAt), "dd")}</span>
                        <span className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(consultation.scheduledAt), "HH:mm")}
                        </span>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{consultation.petName}</h3>
                          <span className="text-xs text-muted-foreground">({consultation.petSpecies})</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {consultation.tutorName}
                          </span>
                          {consultation.reason && (
                            <span className="hidden sm:block text-border">•</span>
                          )}
                          {consultation.reason && (
                            <span className="text-foreground/80 line-clamp-1">
                              Motivo: {consultation.reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end">
                      {getStatusBadge(consultation.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed bg-card/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhuma consulta encontrada</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Sua agenda está vazia no momento.
          </p>
        </div>
      )}
    </div>
  );
}
