# Synvet

> SaaS clínico veterinário multi-tenant. Tema escuro premium, PWA, RBAC, auditoria, timeline clínica.

[![Stack](https://img.shields.io/badge/stack-pnpm%20%7C%20Node%2024%20%7C%20TS%205.9-2D3748)]()
[![Frontend](https://img.shields.io/badge/frontend-React%20%7C%20Vite%20%7C%20Tailwind%204-5B8CFF)]()
[![Backend](https://img.shields.io/badge/backend-Express%205%20%7C%20Drizzle%20%7C%20Postgres-7A5CFF)]()
[![Auth](https://img.shields.io/badge/auth-Supabase-3ECF8E)]()

---

## Visão geral

Plataforma para clínicas veterinárias com cadastro de pacientes e tutores, agenda
de consultas, anamnese por sistemas, exames com upload, vacinas, prontuário,
timeline clínica unificada e gestão de equipe com RBAC.

Cada clínica é isolada por `clinicId` em todas as tabelas; o backend injeta o
contexto da clínica a partir do JWT do Supabase e nunca confia em parâmetros
do cliente para cross-tenancy.

## Stack

- **Monorepo**: pnpm workspaces, Node 24, TypeScript 5.9
- **Frontend**: React + Vite + Tailwind 4 + shadcn/ui + wouter + react-hook-form + zod + TanStack Query (Orval) + recharts + framer-motion + sonner
- **Backend**: Express 5, Drizzle ORM, Postgres
- **Auth + Storage**: Supabase (JWT no backend via service role; SDK no frontend com chave anon)
- **Contrato API**: OpenAPI → Orval gera hooks React Query + schemas Zod
- **PWA**: manifest + service worker mínimo

## Estrutura do monorepo

```
artifacts/
  api-server/      Express API (porta dinâmica, exposta em /api)
  synvet/          Frontend React + Vite (PWA)
  mockup-sandbox/  Vite isolado para preview de componentes (dev)
lib/
  api-spec/        OpenAPI fonte da verdade
  api-client-react/ Hooks gerados pelo Orval
  api-zod/         Schemas Zod gerados pelo Orval
  db/              Schema Drizzle + cliente Postgres
scripts/           Utilitários (post-merge, etc.)
```

Consulte [`replit.md`](./replit.md) para o mapa detalhado de arquivos e decisões.

## Requisitos

- Node 24 (gerenciado pelo Replit / nvm)
- pnpm 10+
- Postgres acessível via `DATABASE_URL`
- (Opcional) Projeto Supabase com bucket privado `exams`

## Setup local

```bash
pnpm install                              # instalar dependências
cp .env.example .env.local                # preencher com seus valores
pnpm --filter @workspace/db run push      # aplicar schema no Postgres
pnpm --filter @workspace/api-spec run codegen   # gerar hooks/zod do OpenAPI
```

> No Replit, os workflows já cuidam de iniciar API + frontend. Não rode
> `pnpm dev` na raiz — use os botões de Run ou os workflows individuais.

## Comandos principais

| Comando | O que faz |
|---|---|
| `pnpm --filter @workspace/api-server run dev` | API Express (porta vem de `PORT`, exposta em `/api`) |
| `pnpm --filter @workspace/synvet run dev` | Frontend Vite/React |
| `pnpm run typecheck` | Typecheck completo (libs + artifacts) |
| `pnpm --filter @workspace/api-spec run codegen` | Regerar hooks Orval + schemas Zod a partir do OpenAPI |
| `pnpm --filter @workspace/db run push` | Aplicar mudanças de schema no Postgres (dev) |

## Variáveis de ambiente

Veja [`.env.example`](./.env.example) para a lista completa. Resumo:

| Variável | Onde | Obrigatória |
|---|---|---|
| `DATABASE_URL` | servidor | sim |
| `SESSION_SECRET` | servidor | sim |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | servidor | recomendada (sem ela, modo demo) |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | bundle | recomendada |
| `ALLOW_DEMO_AUTH` | servidor | só dev |
| `NODE_ENV=production` | servidor | obrigatória em deploy |

> **Nunca** colocar `SUPABASE_SERVICE_ROLE_KEY` em variável `VITE_*` — ela vai
> para o bundle do navegador. A chave de servidor começa com `sb_secret_` e a
> de cliente com `sb_publishable_`.

## Decisões de arquitetura

- **Multi-tenancy por `clinicId`** em todas as tabelas; middleware injeta `req.auth.user`.
- **Tenant source of truth** = `users.clinic_id` no Postgres (não JWT claims). O bind acontece no primeiro login (`ensureUser`).
- **Postgres do Replit** para domínio + **Supabase** apenas para Auth e Storage.
- **Tema dark fixo** (`<html class="dark">`) — paleta premium documentada em `replit.md`.
- **Auditoria**: toda tabela tem `createdAt`, `updatedAt`, `createdBy` (FK em `users.id`).
- **RBAC**: enum `users.role` = `admin | vet | assistant`, com `requireRole(...)` no backend e `usePermissions()` no frontend.
- **Storage durável**: `exams.file_path` é a coluna persistida; o backend re-assina URLs (TTL 1h) a cada read — links nunca expiram para o usuário.
- **Limite de upload em 3 camadas**: cliente (15 MB), bucket (`file_size_limit`), MIME whitelist no signed-upload.

Detalhes completos: [`replit.md`](./replit.md).

## Deploy

Caminho atual: **Replit Deployments (autoscale) + GitHub para versionamento + domínio próprio `synvet.app.br`**.

Passo a passo completo: [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Segurança

Política de divulgação responsável e checklist: [`SECURITY.md`](./SECURITY.md).

## Roadmap próximo

1. Fluxo de convites para múltiplos usuários por clínica (UPDATE em `users.clinic_id`)
2. IA assistiva para sugestão de anamnese e diagnósticos prováveis
3. Telemedicina (videochamada veterinário ↔ tutor)
4. Módulo financeiro (cobrança por consulta, plano da clínica)
5. Webhooks de exames laboratoriais (integrações B2B)
6. App mobile nativo (Expo) reutilizando `@workspace/api-client-react`

## Licença

Proprietário. Todos os direitos reservados.
