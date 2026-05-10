// Templates de e-mail Synvet — todos em PT-BR, paleta dark premium.
// Cada template recebe `data` tipado e retorna { subject, html, text }.
// HTML é literal (sem React Email) para manter o serviço leve e sem build extra.

export type TemplateId =
  | "welcome"
  | "trial_ending_3d"
  | "trial_ended"
  | "payment_succeeded"
  | "payment_failed"
  | "team_invite";

export type TemplateDataMap = {
  welcome: { name: string; clinicName: string; appUrl: string };
  trial_ending_3d: { name: string; clinicName: string; daysLeft: number; upgradeUrl: string };
  trial_ended: { name: string; clinicName: string; upgradeUrl: string };
  payment_succeeded: {
    name: string;
    clinicName: string;
    planName: string;
    amountBrl: string;
    invoiceUrl: string | null;
    nextChargeAt: string | null;
  };
  payment_failed: { name: string; clinicName: string; portalUrl: string };
  team_invite: {
    inviterName: string;
    clinicName: string;
    inviteeName: string | null;
    acceptUrl: string;
  };
};

export type RenderedEmail = { subject: string; html: string; text: string };

const COLORS = {
  bg: "#0B1020",
  card: "#111827",
  primary: "#5B8CFF",
  accent: "#7A5CFF",
  text: "#F8FAFC",
  muted: "#94A3B8",
  danger: "#F87171",
  success: "#34D399",
};

function shell(opts: {
  preheader?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  unsubscribeUrl?: string;
  appUrl: string;
}): string {
  const { preheader = "", bodyHtml, ctaText, ctaUrl, footerNote, unsubscribeUrl, appUrl } = opts;
  const cta =
    ctaText && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
          <tr><td>
            <a href="${ctaUrl}" style="display:inline-block;background:${COLORS.primary};color:${COLORS.text};text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;font-family:Inter,system-ui,sans-serif">${ctaText}</a>
          </td></tr>
        </table>`
      : "";
  const unsub = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:${COLORS.muted};text-decoration:underline">gerenciar notificações</a>`
    : "";
  const footerInner = [footerNote, unsub].filter(Boolean).join(" · ");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synvet</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Inter,Segoe UI,system-ui,sans-serif;color:${COLORS.text}">
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td style="padding:0 8px 24px">
        <a href="${appUrl}" style="text-decoration:none">
          <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.text}">Syn</span><span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.primary}">vet</span>
        </a>
      </td></tr>
      <tr><td style="background:${COLORS.card};border:1px solid #1F2937;border-radius:16px;padding:32px;line-height:1.6;font-size:15px;color:${COLORS.text}">
        ${bodyHtml}
        ${cta}
      </td></tr>
      <tr><td style="padding:24px 8px 0;text-align:center;font-size:12px;color:${COLORS.muted};line-height:1.6">
        Synvet — plataforma clínica veterinária<br>
        ${footerInner}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function appUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "https://synvet.app.br";
}

function unsubUrl(): string {
  return `${appUrl()}/app/configuracoes?tab=notificacoes`;
}

export function renderTemplate<T extends TemplateId>(
  template: T,
  data: TemplateDataMap[T],
): RenderedEmail {
  const url = appUrl();
  switch (template) {
    case "welcome": {
      const d = data as TemplateDataMap["welcome"];
      const html = shell({
        appUrl: url,
        preheader: `Boas-vindas à Synvet, ${d.name}.`,
        bodyHtml: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Bem-vindo(a), ${escapeHtml(d.name)}.</h1>
          <p style="margin:0 0 12px;color:${COLORS.text}">A clínica <strong>${escapeHtml(d.clinicName)}</strong> está com 14 dias de trial liberados — todas as funções incluídas, sem cartão.</p>
          <p style="margin:0 0 12px;color:${COLORS.muted}">Para começar com o pé direito:</p>
          <ul style="margin:0 0 12px;padding-left:20px;color:${COLORS.text}">
            <li>Cadastre seus primeiros tutores e pets</li>
            <li>Marque uma consulta para conhecer a anamnese por sistemas</li>
            <li>Convide a equipe (Configurações → Equipe)</li>
            <li>Conecte o WhatsApp para automações de lembretes</li>
          </ul>`,
        ctaText: "Abrir o painel",
        ctaUrl: `${d.appUrl}/app`,
        footerNote: "Você está recebendo porque criou uma conta na Synvet",
        unsubscribeUrl: unsubUrl(),
      });
      return {
        subject: `Bem-vindo(a) à Synvet, ${d.name}`,
        html,
        text: `Bem-vindo(a), ${d.name}. A clínica ${d.clinicName} está com 14 dias de trial liberados.\n\nAbra o painel: ${d.appUrl}/app\n\nGerenciar notificações: ${unsubUrl()}\n\n— Synvet`,
      };
    }
    case "trial_ending_3d": {
      const d = data as TemplateDataMap["trial_ending_3d"];
      const html = shell({
        appUrl: url,
        preheader: `Seu trial Synvet termina em ${d.daysLeft} dias.`,
        bodyHtml: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Seu trial termina em ${d.daysLeft} dias</h1>
          <p style="margin:0 0 12px">Olá, ${escapeHtml(d.name)}. O período de avaliação da <strong>${escapeHtml(d.clinicName)}</strong> termina em breve.</p>
          <p style="margin:0 0 12px;color:${COLORS.muted}">Para continuar usando todas as funções sem interrupção, escolha um plano. Você não perde nenhum dado — só a cobrança começa após o upgrade.</p>`,
        ctaText: "Escolher plano",
        ctaUrl: d.upgradeUrl,
        footerNote: "Lembrete sobre seu trial",
        unsubscribeUrl: unsubUrl(),
      });
      return {
        subject: `Seu trial Synvet termina em ${d.daysLeft} dias`,
        html,
        text: `Olá, ${d.name}. O trial da clínica ${d.clinicName} termina em ${d.daysLeft} dias.\n\nEscolha um plano: ${d.upgradeUrl}\n\nGerenciar notificações: ${unsubUrl()}\n\n— Synvet`,
      };
    }
    case "trial_ended": {
      const d = data as TemplateDataMap["trial_ended"];
      const html = shell({
        appUrl: url,
        preheader: "Seu trial Synvet terminou.",
        bodyHtml: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Seu trial terminou</h1>
          <p style="margin:0 0 12px">Olá, ${escapeHtml(d.name)}. O período gratuito da <strong>${escapeHtml(d.clinicName)}</strong> chegou ao fim.</p>
          <p style="margin:0 0 12px;color:${COLORS.muted}">Seus dados estão seguros e ficam disponíveis assim que você assinar um plano.</p>`,
        ctaText: "Ativar assinatura",
        ctaUrl: d.upgradeUrl,
        footerNote: "Aviso sobre o status da sua conta",
        unsubscribeUrl: unsubUrl(),
      });
      return {
        subject: "Seu trial Synvet terminou",
        html,
        text: `Olá, ${d.name}. O trial da clínica ${d.clinicName} terminou.\n\nAtive uma assinatura para continuar: ${d.upgradeUrl}\n\nGerenciar notificações: ${unsubUrl()}\n\n— Synvet`,
      };
    }
    case "payment_succeeded": {
      const d = data as TemplateDataMap["payment_succeeded"];
      const next = d.nextChargeAt
        ? `<p style="margin:0 0 12px;color:${COLORS.muted}">Próxima cobrança: ${escapeHtml(d.nextChargeAt)}.</p>`
        : "";
      const invoice = d.invoiceUrl
        ? `<p style="margin:0 0 12px"><a href="${d.invoiceUrl}" style="color:${COLORS.primary};text-decoration:underline">Baixar fatura (PDF)</a></p>`
        : "";
      const html = shell({
        appUrl: url,
        preheader: `Pagamento confirmado — ${d.planName}.`,
        bodyHtml: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:${COLORS.success}">Pagamento confirmado</h1>
          <p style="margin:0 0 12px">Olá, ${escapeHtml(d.name)}. Recebemos o pagamento da assinatura <strong>${escapeHtml(d.planName)}</strong> da clínica <strong>${escapeHtml(d.clinicName)}</strong>.</p>
          <p style="margin:0 0 12px;color:${COLORS.text}">Valor: <strong>${escapeHtml(d.amountBrl)}</strong></p>
          ${next}
          ${invoice}`,
        footerNote: "Recibo da sua assinatura — não é possível desativar",
        unsubscribeUrl: unsubUrl(),
      });
      return {
        subject: `Pagamento confirmado — ${d.planName}`,
        html,
        text: `Olá, ${d.name}. Pagamento da assinatura ${d.planName} (${d.amountBrl}) recebido.${d.nextChargeAt ? `\nPróxima cobrança: ${d.nextChargeAt}.` : ""}${d.invoiceUrl ? `\nFatura: ${d.invoiceUrl}` : ""}\n\nGerenciar notificações: ${unsubUrl()}\n\n— Synvet`,
      };
    }
    case "payment_failed": {
      const d = data as TemplateDataMap["payment_failed"];
      const html = shell({
        appUrl: url,
        preheader: "Falha na cobrança da sua assinatura Synvet.",
        bodyHtml: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:${COLORS.danger}">Não conseguimos processar seu pagamento</h1>
          <p style="margin:0 0 12px">Olá, ${escapeHtml(d.name)}. A cobrança da clínica <strong>${escapeHtml(d.clinicName)}</strong> falhou — possivelmente cartão expirado ou sem saldo.</p>
          <p style="margin:0 0 12px;color:${COLORS.muted}">Para evitar a suspensão do acesso, atualize a forma de pagamento agora.</p>`,
        ctaText: "Atualizar pagamento",
        ctaUrl: d.portalUrl,
        footerNote: "Aviso crítico sobre sua assinatura",
        unsubscribeUrl: unsubUrl(),
      });
      return {
        subject: "Falha na cobrança — atualize seu pagamento",
        html,
        text: `Olá, ${d.name}. A cobrança da clínica ${d.clinicName} falhou. Atualize seu cartão para evitar suspensão: ${d.portalUrl}\n\nGerenciar notificações: ${unsubUrl()}\n\n— Synvet`,
      };
    }
    case "team_invite": {
      const d = data as TemplateDataMap["team_invite"];
      const greeting = d.inviteeName ? `Olá, ${escapeHtml(d.inviteeName)}.` : "Olá.";
      const html = shell({
        appUrl: url,
        preheader: `${d.inviterName} convidou você para a clínica ${d.clinicName}.`,
        bodyHtml: `
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Você foi convidado(a) para a Synvet</h1>
          <p style="margin:0 0 12px">${greeting}</p>
          <p style="margin:0 0 12px"><strong>${escapeHtml(d.inviterName)}</strong> convidou você para a clínica <strong>${escapeHtml(d.clinicName)}</strong>.</p>`,
        ctaText: "Aceitar convite",
        ctaUrl: d.acceptUrl,
        footerNote: "Você está recebendo porque foi convidado(a) por um administrador",
        unsubscribeUrl: unsubUrl(),
      });
      return {
        subject: `${d.inviterName} te convidou para a clínica ${d.clinicName}`,
        html,
        text: `${d.inviterName} convidou você para a clínica ${d.clinicName} na Synvet.\n\nAceitar: ${d.acceptUrl}\n\nGerenciar notificações: ${unsubUrl()}\n\n— Synvet`,
      };
    }
    default: {
      // exhaustiveness check
      const _: never = template;
      throw new Error(`Template desconhecido: ${String(_)}`);
    }
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
