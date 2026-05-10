import { Link, useLocation } from "wouter";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { useGetMe, useCreateBillingPortal } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { useState } from "react";

export function TrialBanner() {
  const { data: me } = useGetMe();
  const [location] = useLocation();
  const { isAdmin } = usePermissions();
  const portal = useCreateBillingPortal();
  const [pending, setPending] = useState(false);
  const billing = me?.billing;
  if (!billing) return null;
  if (location.startsWith("/app/configuracoes")) return null;

  const openPortal = () => {
    setPending(true);
    portal.mutate(undefined, {
      onSuccess: ({ url }) => {
        setPending(false);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else toast.error("Não foi possível abrir o portal");
      },
      onError: (err) => {
        setPending(false);
        const msg = err instanceof Error ? err.message : "Erro ao abrir portal";
        toast.error(msg);
      },
    });
  };

  if (billing.status === "trialing") {
    const days = billing.daysLeft ?? 0;
    const urgent = days <= 3;
    return (
      <div
        className={`border-b ${
          urgent
            ? "bg-amber-500/10 border-amber-500/30 text-amber-100"
            : "bg-primary/10 border-primary/20 text-foreground"
        }`}
        data-testid="trial-banner"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className={`w-4 h-4 ${urgent ? "text-amber-300" : "text-primary"}`} />
            <span>
              Você está no <strong>Trial gratuito</strong>.{" "}
              {days > 0 ? (
                <>
                  Faltam <strong>{days}</strong> {days === 1 ? "dia" : "dias"} para escolher um plano.
                </>
              ) : (
                <>Seu trial termina hoje.</>
              )}
            </span>
          </div>
          <Link href="/app/configuracoes?tab=assinatura">
            <Button size="sm" variant={urgent ? "default" : "outline"} className="h-8">
              Ver planos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (
    billing.status === "past_due" ||
    billing.status === "suspended" ||
    billing.status === "canceled"
  ) {
    const message =
      billing.status === "past_due"
        ? "Pagamento pendente — atualize seu cartão para manter o acesso."
        : billing.status === "suspended"
          ? "Conta suspensa — atualize sua assinatura para reativar."
          : "Assinatura cancelada — reative para continuar usando.";
    return (
      <div
        className="bg-rose-500/10 border-b border-rose-500/30 text-rose-100"
        data-testid="trial-banner-past-due"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-300" />
            <span>{message}</span>
          </div>
          {isAdmin ? (
            <Button
              size="sm"
              className="h-8"
              onClick={openPortal}
              disabled={pending}
              data-testid="button-banner-portal"
            >
              {pending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Atualizar pagamento
            </Button>
          ) : (
            <Link href="/app/configuracoes?tab=assinatura">
              <Button size="sm" className="h-8">
                Ver detalhes
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}
