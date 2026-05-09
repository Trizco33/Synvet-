# Billing — Trial e Planos (Fase A)

A Fase A entrega a fundação comercial da Synvet sem cobrança online. O
gateway de pagamento (Stripe) e e-mails transacionais ficam para a Fase B.

## Modelo

- Toda clínica nasce em **trial de 14 dias** com `plan = 'trial'` e
  `status = 'trialing'`.
- Tabela `clinics` armazena: `plan`, `status`, `trialEndsAt`, `stripeCustomerId`,
  `stripeSubscriptionId`, `currentPeriodEnd`.
- Catálogo dos planos vive em `lib/db/src/billing.ts` (`PLANS`,
  `TRIAL_DAYS`, `isFeatureEnabled`). O frontend tem uma cópia estática em
  `artifacts/synvet/src/lib/plans.ts` (sem dependências de servidor).

### Status

| status        | Significado                                                |
| ------------- | ---------------------------------------------------------- |
| `trialing`    | Em período de avaliação — `trialEndsAt` define o fim.      |
| `active`      | Assinatura paga ativa — `currentPeriodEnd` no próximo ciclo.|
| `past_due`    | Pagamento pendente.                                        |
| `canceled`    | Cancelada pelo cliente (sem cobrança futura).              |
| `suspended`   | Acesso bloqueado (atraso prolongado).                      |

## Planos

| plan          | Preço/mês | Features principais                                     |
| ------------- | --------- | ------------------------------------------------------- |
| `trial`       | R$ 0      | Tudo liberado por 14 dias, até 5 usuários.              |
| `essencial`   | R$ 149    | Pacientes/agenda/prontuário + IA assistiva, 3 usuários. |
| `pro`         | R$ 349    | Tudo + Copilot + Comunicação WhatsApp, 10 usuários.     |
| `clinic_plus` | R$ 749    | Tudo + 50 usuários + suporte dedicado.                  |

`isFeatureEnabled(plan, 'copilot' | 'commsWhatsapp' | 'aiAssist' | 'multiUser')`
no servidor permite gates por plano (a aplicação em features é incremental).

## Fluxos

### Signup público

1. Usuário visita `/signup` (página dedicada — também há CTA "Começar
   trial grátis" na landing e link no /login).
2. POST `/api/auth/signup` cria usuário no Supabase Auth, depois insere
   `clinics` com `plan='trial'`, `status='trialing'`, `trialEndsAt = now + 14d`,
   e o `users` com `role='admin'`.
3. Frontend faz `signInWithPassword` e redireciona para `/app`.

### Visualização do trial no app

- `GET /api/me` retorna `billing { plan, status, trialEndsAt, currentPeriodEnd, daysLeft }`.
- `<TrialBanner>` (em `components/layout/TrialBanner.tsx`) é montado dentro
  do `AppLayout` e mostra o countdown durante `trialing` (urgente nos últimos
  3 dias) ou aviso vermelho em `past_due`/`suspended`. Some na própria página
  de Configurações para evitar duplicidade.
- A aba **Assinatura** em `/app/configuracoes?tab=assinatura` exibe o plano
  atual, dias restantes e o grid dos planos pagos. O botão "Fazer upgrade"
  está desabilitado (placeholder até a Fase B). Para ativar um plano agora,
  o cliente fala com a equipe via WhatsApp.

## Onde mexer

- Schema/colunas: `lib/db/src/schema/clinics.ts`
- Catálogo: `lib/db/src/billing.ts` (servidor) e
  `artifacts/synvet/src/lib/plans.ts` (frontend, manter em sincronia)
- Helpers de servidor: `artifacts/api-server/src/lib/billing.ts`
  (`trialEndsAtFromNow`, `buildBillingStatus`)
- UI: `components/layout/TrialBanner.tsx`,
  `components/billing/SubscriptionCard.tsx`, `pages/signup.tsx`

## Próximos passos (Fase B)

- Conector Stripe (Replit integration) → checkout sessions e webhooks
  atualizando `status`, `currentPeriodEnd`, `stripeCustomerId/SubscriptionId`.
- Envio de e-mail (boas-vindas, "faltam 3 dias", "trial encerrou").
- Job diário para mover `trialing` → `past_due` quando `trialEndsAt < now`
  e nenhum `stripeSubscriptionId` ativo.
- Aplicação real dos limites de plano (`isFeatureEnabled`) nas rotas
  de Copilot, Comunicação e AI assist, com 402/403 explicativo.
