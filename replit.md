# Synvet — SaaS clínico veterinário

Plataforma multi-clínica para veterinários: pacientes, tutores, agenda, anamnese
por sistemas, exames, prontuário, Copilot de IA e Comunicação (CRM via WhatsApp).
Tema dark premium, PWA, multi-tenant por `clinicId`.

## Run & operate

- `pnpm --filter @workspace/api-server run dev` — API Express (porta dinâmica via `PORT`, exposta em `/api`)
- `pnpm --filter @workspace/synvet run dev` — Frontend Vite/React
- `pnpm run typecheck` — typecheck completo
- `pnpm --filter @workspace/api-spec run codegen` — regerar hooks/Zod a partir do OpenAPI
- `pnpm --filter @workspace/db run push` — aplicar mudanças de schema (dev)

Vars:
- Obrigatória: `DATABASE_URL` (Postgres provisionado).
- Auth Supabase real (opcional): `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server, bypass RLS); `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (client).
- Sem essas vars → backend cria automaticamente clínica/usuário **demo** (apenas dev; `NODE_ENV=production` bloqueia, reativar com `ALLOW_DEMO_AUTH=true`).
- Comunicação: `COMMS_PROVIDER=mock` (default) | `evolution` (stub — ver docs).
- Back-office: `SUPERADMIN_EMAIL` (CSV opcional) — e-mails promovidos a superadmin no boot. Sem isso, ninguém vê `/admin`.
- Stripe (Fase B1): chaves vêm do Replit connector (sem env). Necessárias: `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_CLINIC_PLUS` (price IDs recurring) e `STRIPE_WEBHOOK_SECRET` (`whsec_…` do endpoint configurado no Dashboard apontando para `/api/billing/webhook`). Sem isso, checkout/portal devolvem 503.
- E-mails (Fase B3): `RESEND_API_KEY` (Resend connector) + `EMAIL_FROM` (default `Synvet <ola@synvet.app.br>`). Sem chave → provider `mock` (loga, não envia). Override: `EMAIL_PROVIDER=mock|resend`. `APP_URL` define base dos CTAs.

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- API: Express 5, Drizzle ORM, Postgres
- Auth: Supabase Auth (frontend SDK + JWT verificado no backend via `@supabase/supabase-js` admin)
- Frontend: React + Vite + Tailwind 4 + shadcn/ui + wouter + react-hook-form + zod + TanStack Query (via Orval) + recharts + date-fns + framer-motion + sonner + qrcode.react
- Validação: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (OpenAPI → React Query hooks + Zod schemas)
- PWA: `public/manifest.webmanifest` + `theme-color` no `index.html`

## Routing

- **Site institucional** (público): `/` → `pages/site/landing.tsx` (hero, features, copilot, timeline, mobile, automações, segurança, planos, CTA com lead form)
- **Login**: `/login`
- **Signup público**: `/signup` → `pages/signup.tsx` (cria clínica em trial 14d)
- **App autenticado**: `/app/*` (Dashboard `/app`, pacientes `/app/pacientes/...`, comunicação `/app/comunicacao`, etc.) — `ProtectedRoute` redireciona p/ `/login` quando deslogado
- **Back-office Synvet** (superadmins): `/admin/*` → `pages/admin/{clinicas,leads,metricas}.tsx` — `ProtectedAdminRoute` checa `useSuperAdmin()` (403 → /app)
- **PWA**: `manifest.start_url = "/app"` (instalada abre o app); `scope = "/"` permite navegar para o site também
- **Domínio**: produção em `synvet.app.br`

## Where things live

- Contrato API: `lib/api-spec/openapi.yaml`
- Hooks/schemas gerados: `lib/api-client-react/src/generated`, `lib/api-zod/src/generated` (importar via `schemas.*`)
- Schema do banco: `lib/db/src/schema/*.ts` (clinics, users, tutors, pets, consultations, anamneses, exams, vaccines, medical-records, copilot, leads, comms, **platform-admins**, **email-sends**, **import-logs**, **weigh-ins**, **prescriptions**)
- Catálogo de planos: `lib/db/src/billing.ts` (server) + `artifacts/synvet/src/lib/plans.ts` (cliente, manter em sincronia)
- Stripe (Fase B1): `artifacts/api-server/src/lib/stripe.ts` (client + helpers price↔plan), `routes/billing.ts` (checkout/portal — admin tenant), `routes/billing-webhook.ts` (raw body, montado no `app.ts` ANTES do `express.json`), schema `lib/db/src/schema/stripe-events.ts` (idempotência)
- Rotas da API: `artifacts/api-server/src/routes/{health,auth,leads,me,tutors,pets,consultations,exams,dashboard,timeline,team,storage,ai,copilot,comms,admin,billing}.ts` (auth/leads/**admin** são públicos no roteador raiz, montados ANTES do `authMiddleware` tenant — admin tem `superAdminMiddleware` próprio; **billing** segue tenant authMiddleware com `requireRole("admin")`. Webhook é montado direto no `app`, fora do router)
- Site institucional: `artifacts/synvet/src/pages/site/landing.tsx` + `components/site/{site-nav,site-footer,lead-form}.tsx`
- Middleware de auth: `artifacts/api-server/src/middlewares/{auth,super-admin}.ts`
- Billing helpers (server): `artifacts/api-server/src/lib/billing.ts` (trial dates + buildBillingStatus)
- Seed superadmins: `artifacts/api-server/src/lib/seed-platform-admins.ts` (lê `SUPERADMIN_EMAIL`)
- Banner de trial / aba Assinatura: `components/layout/TrialBanner.tsx`, `components/billing/SubscriptionCard.tsx`
- Back-office shell + páginas: `components/admin/AdminLayout.tsx`, `pages/admin/*`
- Theme/CSS: `artifacts/synvet/src/index.css` (paleta premium escura)
- Páginas: `artifacts/synvet/src/pages/*` (login, dashboard, pacientes, tutores, consultas, exames, **comunicação**, configurações + detalhes)
- Componentes clínicos: `artifacts/synvet/src/components/clinical/{clinical-alerts,clinical-timeline,file-uploader}.tsx`
- Layout: `artifacts/synvet/src/components/layout/{AppLayout,BottomNav}.tsx`
- Hooks: `artifacts/synvet/src/hooks/{use-auth,use-permissions,use-mobile,use-toast}.tsx`
- Comunicação: `artifacts/api-server/src/comms/{event-bus,templates,automations,scheduler,seed,index}.ts` + `providers/`
- Onboarding (Fase B4): `artifacts/api-server/src/routes/onboarding.ts` + `artifacts/synvet/src/components/onboarding/OnboardingChecklist.tsx` (admin-only, dispensável; coluna `users.onboardingDismissedAt`)
- Importação CSV (Fase B5): `artifacts/api-server/src/routes/import.ts` (templates + POST por kind, transação atômica, dedupe por chave natural) + `artifacts/synvet/src/components/import/ImportWizard.tsx` + `pages/configuracoes-importar.tsx` (admin-only). Auditoria em `lib/db/src/schema/import-logs.ts`. Cliente parseia com `papaparse`, detecta mojibake e oferece Windows-1252 como fallback.
- E-mails transacionais: `artifacts/api-server/src/lib/email/{index,templates,scheduler}.ts` (provider mock|resend, idempotência via `email_sends`, scheduler horário para trial-3d/trial-ended). Wired em `routes/auth.ts` (welcome) e `routes/billing-webhook.ts` (payment_succeeded/failed). Aba **Notificações** em Configurações controla `notifyTrialReminder` via `PATCH /me/notifications`.
- Auth client: `artifacts/synvet/src/lib/supabase.ts`, `src/hooks/use-auth.tsx`
- Storage client (signed upload + XHR progress): `artifacts/synvet/src/lib/storage.ts`

## Multi-tenancy & Auth

- **Tenancy por `clinicId` em toda tabela** — middleware injeta `req.auth.user` (com `clinicId` + `role`); todas as queries filtram por ele.
- **Tenant source of truth = tabela `users` no Postgres** (não JWT claims). JWT do Supabase só carrega `sub`/`email`; middleware faz lookup por `id = sub` e devolve o `clinicId` persistido. No 1º login (`ensureUser`), se o usuário não existe, cria clínica nova + vincula usuário como `admin`.
- **Postgres do Replit + Supabase Auth/Storage** — Drizzle no Postgres provisionado; Supabase só p/ Auth + Storage.
- **RBAC**: enum `users.role` = `admin | vet | assistant`. Middleware `requireRole(...roles)` (403). Frontend usa hook `usePermissions()` para gates de UI. Apenas `admin` altera cargos; admin não pode rebaixar a si mesmo.
- **Auditoria**: toda tabela de domínio tem `createdAt`, `updatedAt` (default `now()`), `createdBy` (uuid → `users.id` ON DELETE SET NULL).

## UI / PWA

- **Tema fixo dark** (`<html class="dark">`) — paleta `#0B1020 / #111827 / #5B8CFF / #7A5CFF / #F8FAFC / #94A3B8` em `.dark` do `index.css`.
- **PWA + auto-update**: `public/sw.js` registrado em produção. Cache name versionado (`synvet-shell-${BUILD_VERSION}`) — `vite.config.ts` injeta `Date.now()` via `swVersionPlugin`. `/api` nunca cacheado. Navegação é network-only quando online (cache só fallback offline). Novo SW chama `self.skipWaiting()`; `main.tsx` ouve `controllerchange` e dá `window.location.reload()` 1x. Listener global recupera de `Failed to fetch dynamically imported module` / `ChunkLoadError`.
- **Mobile**: `<BottomNav/>` fixo em `< md` (5 itens, safe-area); `AppLayout` aplica `pb-24 md:pb-8`.

## Domínio clínico (resumo)

- **Timeline clínica**: `GET /pets/:petId/timeline` agrega consultations + exams + vaccines + medical_records, normaliza para `{type,id,date,title,description,severity,sourceUrl}`, ordena desc.
- **Alertas clínicos**: `<ClinicalAlerts pet/>` lê `isCritical`, `allergies`, `continuousMedications`, `notes`. No topo do `pet-detail`.
- **Upload de laudo**: bucket privado `exams`, frontend faz `PUT` direto no Supabase via XHR (progresso/cancel/retry). Coluna durável = `exams.file_path`; backend re-assina URL fresca (TTL 1h) em cada GET via `lib/exam-files.ts`. Limite 15 MB em 3 camadas. `<FileUploader/>` encapsula tudo.

## Product

- Login (Supabase ou modo demo)
- Dashboard com KPIs, agenda do dia e atividade recente
- Pacientes: lista + busca + criar + perfil em abas (Visão Geral, Timeline clínica, Consultas, Exames, Vacinas, Prontuário, Editar)
- Tutores: lista + busca + perfil com pets vinculados, criar pet a partir do tutor
- Consultas: agenda + criar/editar/excluir + detalhe com anamnese por sistemas
- Exames: lista clínica + filtro por categoria + criação com upload
- **Comunicação**: dashboard CRM, canais WhatsApp (QR), templates, automações por evento, log de mensagens, envio de teste
- Configurações: clínica, Equipe (RBAC), perfil, sair

## Documentação detalhada

- `docs/architecture/communication.md` — módulo Comunicação (CRM/WhatsApp/automações)
- `docs/architecture/copilot.md` — Synvet Copilot (chat clínico SSE)
- `docs/architecture/ai-assist.md` — IA assistiva (4 funções)
- `docs/architecture/leads-and-signup.md` — leads do site + signup público
- `docs/architecture/billing.md` — trial automático + catálogo de planos (Fase A)
- `docs/architecture/back-office.md` — `/admin/*`, role superadmin e `platform_admins`
- `docs/architecture/emails.md` — e-mails transacionais (templates, idempotência, scheduler, opt-out)
- `docs/architecture/onboarding.md` — checklist de onboarding in-app (Fase B4)
- `docs/architecture/import.md` — assistente de importação CSV (Fase B5)

## Gotchas críticos

### Codegen / Orval
- Após mexer em `lib/api-spec/openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen` antes do typecheck.
- `lib/api-zod/src/index.ts` exporta como namespace: `import { schemas } from "@workspace/api-zod"` → `schemas.XxxBody`.
- **Orval não gera Zod schemas para tipos componentes reusáveis** (ex.: `CommsChannel`, `CommsTemplate` em arrays + responses). Para responses únicas, usar `res.json(row)` direto — tipos drizzle batem com OpenAPI.
- Hooks com `enabled` exigem `queryKey` explícito. Sempre passar `getXxxQueryKey(...)`.
- Mutations: parâmetros de path no nível raiz do objeto (`{ petId, data: { ... } }`), não dentro de `data`.
- `customInstance` não é exportado por `@workspace/api-client-react`. Para chamadas fora de hooks, usar a função gerada (ex.: `createExamSignedUpload`).
- Orval nomeia schemas Zod por `operationId`, não por `components.schemas`.

### Domínio
- `MeResponse` usa `userId` (não `id`).
- `fileSize` em `Exam` é `string` (bigint serializado). Converter `String(file.size)` ao enviar.
- `requireRole(...)` deve vir DEPOIS do `authMiddleware` na cadeia.
- Bucket `exams` precisa existir no Supabase Storage. URLs assinadas expiram rápido — gerar logo antes do `PUT`.
- Datas: helper `lib/dates.ts` converte `Date` para `YYYY-MM-DD` em colunas Drizzle `date`.

## User preferences

- UI 100% em Português-BR. Sem emojis na interface.
- Tema escuro premium é parte da identidade — não trocar para tema claro.

## Pointers

- Skill `pnpm-workspace` — estrutura do monorepo, OpenAPI, server e DB
- Skill `react-vite` — convenções do frontend (formularios, hooks Orval, dark mode)
- Skill `integrations` — antes de pedir secrets do Supabase, conferir se há um connector
