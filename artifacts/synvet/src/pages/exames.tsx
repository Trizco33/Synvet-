import { useListExams, getListExamsQueryKey } from "@workspace/api-client-react";
import { Search, Plus, TestTube } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Exames() {
  const { data: exams, isLoading } = useListExams({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exames</h1>
          <p className="text-muted-foreground">Resultados e laudos de exames.</p>
        </div>
        <Button data-testid="button-new-exam">
          <Plus className="w-4 h-4 mr-2" />
          Novo Exame
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : exams && exams.length > 0 ? (
        <div className="space-y-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="border-border/50">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">{exam.category}</Badge>
                    <h3 className="font-semibold text-lg">{exam.title}</h3>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Paciente: {exam.petName} • Data: {format(parseISO(exam.performedAt), "dd/MM/yyyy")}
                  </div>
                </div>
                <div>
                  {exam.status === "completed" ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Concluído</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pendente</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed bg-card/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <TestTube className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-1">Nenhum exame registrado</h3>
        </div>
      )}
    </div>
  );
}
