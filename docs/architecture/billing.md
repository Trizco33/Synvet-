# Billing — Trial, Planos e Stripe

A Fase A entregou a fundação comercial sem cobrança. A **Fase B1** liga
o Stripe (Checkout + Customer Portal + Webhook) para upgrade/downgrade
self-service. E-mails transacionais ficam na Fase B2.

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

## Stripe (Fase B1)

### Conexão

- Cliente Stripe vem do **Replit Connector** (`connector_names=stripe`).
  Helper: `artifacts/api-server/src/lib/stripe.ts` → `getStripeClient()`.
  Nunca cachear o client em variável de longo prazo — chame a função em
  cada request (credenciais têm cache curto interno de 5min).
- Modo Sandbox/Live é decidido pela conexão (campo `environment` no Replit).
  `REPLIT_DEPLOYMENT=1` força `production`, caso contrário usa `development`.

### Variáveis necessárias

| Variável                  | Onde                | Para quê                                   |
| ------------------------- | ------------------- | ------------------------------------------ |
| `STRIPE_PRICE_ESSENCIAL`  | server              | Price ID (recurring) do plano Essencial.   |
| `STRIPE_PRICE_PRO`        | server              | Price ID do plano Pro.                     |
| `STRIPE_PRICE_CLINIC_PLUS`| server              | Price ID do plano Clinic+.                 |
| `STRIPE_WEBHOOK_SECRET`   | server              | Secret do endpoint de webhook (`whsec_…`). |

Se algum `STRIPE_PRICE_*` não estiver setado, o checkout para aquele plano
retorna 503 com mensagem explicativa.

### Customer

- Criado **best-effort no signup** (rota `/auth/signup`). Falha não
  derruba o cadastro — `routes/billing.ts` recria lazy se faltar.
- Metadata: `{ clinicId, ownerEmail, ownerName }`.
- Persistido em `clinics.stripeCustomerId`.

### Endpoints

| Endpoint                       | Auth          | O que faz                                                |
| ------------------------------ | ------------- | -------------------------------------------------------- |
| `POST /api/billing/checkout`   | admin tenant  | Cria Checkout Session (mode=subscription) → `{ url }`.   |
| `POST /api/billing/portal`     | admin tenant  | Cria Billing Portal Session → `{ url }`.                 |
| `POST /api/billing/webhook`    | público (raw) | Valida assinatura, idempotência, sincroniza `clinics`.   |

O webhook é montado **direto no `app`** ANTES do `express.json()` global
(precisa de raw body). Idempotência via tabela `stripe_events` (PK = event id).

### Eventos tratados

- `checkout.session.completed` → busca subscription e sincroniza.
- `customer.subscription.created/updated/deleted/trial_will_end`
- `invoice.payment_succeeded` → marca `active`.
- `invoice.payment_failed` → marca `past_due`.

`mapSubscriptionStatus` traduz status nativo do Stripe para os 5 valores
de `clinics.status`. `getPlanByPriceId` faz o reverso priceId → plan.

### Como configurar do zero

1. Conectar Stripe via Replit Integrations (já feito — connection
   `conn_stripe_…`).
2. No Stripe Dashboard, criar 3 Products + Prices recurring (mensal) e
   colar os IDs em `STRIPE_PRICE_*`.
3. Criar webhook endpoint apontando para
   `https://<seu-dominio>/api/billing/webhook` com os eventos acima.
   Copiar o signing secret para `STRIPE_WEBHOOK_SECRET`.
4. Restart do API server e testar `POST /api/billing/checkout` como admin.

## Próximos passos (Fase B2+)

- E-mails transacionais (boas-vindas, "faltam 3 dias", "trial encerrou").
- Job diário para mover `trialing` → `past_due` quando `trialEndsAt < now`
  sem `stripeSubscriptionId` ativo.
- Aplicação real dos limites de plano (`isFeatureEnabled`) nas rotas
  de Copilot, Comunicação e AI assist, com 402/403 explicativo.
- UI de upgrade ligando `useCreateBillingCheckout` aos botões da aba
  Assinatura (Fase B2 — task #6).
