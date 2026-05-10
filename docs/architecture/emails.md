# Emails transacionais

Envio de e-mails de ciclo de vida (boas-vindas, lembretes de trial, recibos de
pagamento, avisos de falha, convites de equipe) com idempotência forte e
provider plugável (mock em dev, Resend em produção).

## Decisões

- **Stack mínima**: HTML literal nos templates (sem React Email / MJML) para
  manter o serviço leve e sem etapa de build extra.
- **Provider abstrato**: `mock` em dev (loga, não envia) ou `resend` quando
  `RESEND_API_KEY` está presente. Lazy import do SDK Resend — só carregamos o
  pacote quando vamos enviar de fato. Override manual via `EMAIL_PROVIDER=mock|resend`.
- **Idempotência forte**: tabela `email_sends` com `unique(clinicId, template,
  idempotencyKey)`. Cada template define a chave a partir do gatilho:
  - `welcome:<authId>` — 1 por usuário, mesmo em retry de signup.
  - `trial-ending-3d:<YYYY-MM-DD do trialEndsAt>` — 1 por clínica por evento.
  - `trial-ended:<YYYY-MM-DD do trialEndsAt>` — idem.
  - `payment-succeeded:<stripeEventId>` / `payment-failed:<stripeEventId>` —
    1 por evento Stripe (Stripe pode reenviar o mesmo evento N vezes).
- **Recibos não são opt-out**: `payment-succeeded`, `payment-failed`,
  `team_invite` e `welcome` são transacionais e ignoram preferências. Apenas
  `trial-ending-3d` e `trial-ended` respeitam `clinics.notifyTrialReminder`.
- **Password reset**: tratado nativamente pelo Supabase Auth — fora do escopo
  deste serviço.
- **Falhas nunca quebram o fluxo de negócio**: `sendEmail` retorna
  `{ ok: false, error }` em caso de erro e grava `status='failed'` em
  `email_sends`. O upsert no unique index permite que a próxima tentativa
  promova `failed → sent` com sucesso.

## Onde fica

- `artifacts/api-server/src/lib/email/index.ts` — `sendEmail()`, provider
  factory, gravação idempotente.
- `artifacts/api-server/src/lib/email/templates.ts` — templates PT-BR dark
  premium (subject + HTML + text plano).
- `artifacts/api-server/src/lib/email/scheduler.ts` — `startEmailScheduler()`
  varre clínicas a cada hora; janelas:
  - `runTrialEndingReminder`: `trialEndsAt ∈ (now+71h, now+73h]`.
  - `runTrialEndedNotice`: `trialEndsAt ∈ [now-24h, now)` e sem subscription.
- `lib/db/src/schema/email-sends.ts` — schema da tabela de idempotência.
- `lib/db/src/schema/clinics.ts` — `notifyTrialReminder` boolean default true.

## Gatilhos atuais

| Template            | Onde dispara                                    | Opt-out?            |
| ------------------- | ----------------------------------------------- | ------------------- |
| `welcome`           | `routes/auth.ts` após signup                    | Não (transacional)  |
| `trial_ending_3d`   | `email/scheduler.ts` (tick horário)             | `notifyTrialReminder` |
| `trial_ended`       | `email/scheduler.ts` (tick horário)             | `notifyTrialReminder` |
| `payment_succeeded` | `routes/billing-webhook.ts` `invoice.payment_succeeded` | Não      |
| `payment_failed`    | `routes/billing-webhook.ts` `invoice.payment_failed`    | Não      |
| `team_invite`       | _Template pronto, gatilho ainda não implementado_ (rota de convite pendente) | Não |

## Configuração

| Variável             | Default                              | Descrição                                    |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| `RESEND_API_KEY`     | ausente → mock                       | Chave do connector Resend                    |
| `EMAIL_PROVIDER`     | auto-detect                          | Force `mock` ou `resend`                     |
| `EMAIL_FROM`         | `Synvet <ola@synvet.app.br>`         | Remetente (precisa estar verificado no Resend) |
| `APP_URL`            | `https://synvet.app.br`              | Base usada nos CTAs dos templates            |

Sem `RESEND_API_KEY`, o serviço entra em modo mock: o log mostra cada envio
simulado mas nenhum e-mail sai. Útil para desenvolvimento local.

## Operação

- A aba **Configurações → Notificações** (admin only) controla
  `notifyTrialReminder` por clínica via `PATCH /me/notifications`.
- Para reenviar manualmente um template após falha: apague a linha
  correspondente em `email_sends` (ou mude `status` para `failed`) e dispare o
  gatilho original — o upsert vai promover para `sent`.
- Métricas de envio: consultar `email_sends` agrupado por `template` e `status`.
