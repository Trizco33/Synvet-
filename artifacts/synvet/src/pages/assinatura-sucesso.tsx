import { useEffect, useState } from "react";
import {
  useGetMe,
  getGetMeQueryKey,
  getMe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { PLANS, type PlanId } from "@/lib/plans";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export default function AssinaturaSucesso() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const timedOut = elapsed >= POLL_TIMEOUT_MS;

  const { data: me, isError, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      queryFn: () => getMe(),
      refetchInterval: (query) => {
        const data = query.state.data as
          | { billing?: { status?: string } }
          | undefined;
        if (data?.billing?.status === "active") return false;
        if (timedOut) return false;
        return POLL_INTERVAL_MS;
      },
      refetchIntervalInBackground: false,
    },
  });

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  }, [queryClient]);

  useEffect(() => {
    if (me?.billing?.status === "active") return;
    if (timedOut) return;
    const t = setInterval(() => setElapsed((e) => e + 1000), 1000);
    return () => clearInterval(t);
  }, [me?.billing?.status, timedOut]);

  const isActive = me?.billing?.status === "active";
  const errorMessage =
    isError && error instanceof Error ? error.message : null;
  const planId = (me?.billing?.plan ?? "trial") as PlanId;
  const planInfo = PLANS[planId];

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card className="border-primary/30">
        <CardHeader className="text-center">
          {errorMessage && !isActive ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-rose-300" />
              </div>
              <CardTitle className="mt-4 text-2xl">
                Erro ao verificar pagamento
              </CardTitle>
              <CardDescription>
                Não conseguimos confirmar o status agora ({errorMessage}). O
                pagamento provavelmente foi processado — recarregue em instantes
                ou abra a aba Assinatura.
              </CardDescription>
            </>
          ) : isActive ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center animate-in fade-in zoom-in duration-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
              </div>
              <CardTitle className="mt-4 text-2xl">
                Assinatura ativa
              </CardTitle>
              <CardDescription>
                Bem-vindo ao plano {planInfo?.name ?? planId}. Seu pagamento foi
                confirmado.
              </CardDescription>
            </>
          ) : timedOut ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-amber-300" />
              </div>
              <CardTitle className="mt-4 text-2xl">Quase lá</CardTitle>
              <CardDescription>
                O Stripe confirmou o pagamento, mas a sincronização ainda está em
                curso. Recarregue em alguns instantes.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
              <CardTitle className="mt-4 text-2xl">
                Confirmando pagamento
              </CardTitle>
              <CardDescription>
                Aguarde enquanto o Stripe nos avisa que tudo deu certo. Pode levar
                alguns segundos.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {isActive && planInfo && (
            <div className="rounded-md border border-border/60 p-4 text-sm bg-muted/20">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Plano contratado
              </p>
              <p className="text-lg font-semibold mt-1">{planInfo.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {planInfo.tagline}
              </p>
            </div>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/app/configuracoes?tab=assinatura">
              <Button variant="outline">Ver detalhes da assinatura</Button>
            </Link>
            <Link href="/app">
              <Button>Ir para o painel</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
