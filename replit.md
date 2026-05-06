# Synvet — SaaS clínico veterinário

Plataforma multi-clínica para veterinários: pacientes, tutores, agenda de consultas, anamnese por sistemas, exames e prontuário, com tema escuro premium e PWA.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API Express (porta dinâmica via `PORT`, exposta em `/api`)
- `pnpm --filter @workspace/synvet run dev` — Frontend Vite/React (gerido pelo workflow)
- `pnpm run typecheck` — typecheck completo
- `pnpm --filter @workspace/api-spec run codegen` — regerar hooks/Zod a partir do OpenAPI
- `pnpm --filter @workspace/db run push` — aplicar mudanças de schema (dev)
- Vars obrigatórias: `DATABASE_URL` (Postgres provisionado).
- Vars opcionais (autenticação real Supabase): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (servidor) e `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (cliente). Sem elas o backend cria automaticamente uma clínica/usuário **demo** e o frontend exibe um aviso e libera o acesso.

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- API: Express 5, Drizzle ORM, PostgreSQL
- Auth: Supabase Auth (frontend SDK + verificação de JWT no backend via `@supabase/supabase-js` admin)
- Frontend: React + Vite + Tailwind 4 + shadcn/ui + wouter + react-hook-form + zod + TanStack Query (via Orval) + recharts + date-fns + framer-motion + sonner
- Validação: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (OpenAPI → React Query hooks + Zod schemas)
- PWA: `public/manifest.webmanifest` + `theme-color` no `index.html`

## Where things live

- Contrato API: `lib/api-spec/openapi.yaml`
- Hooks/schemas gerados: `lib/api-client-react/src/generated`, `lib/api-zod/src/generated` (importar via `schemas.*`)
- Schema do banco: `lib/db/src/schema/*.ts` (clinics, users, tutors, pets, consultations, anamneses, exams, vaccines, medical-records — todos com `clinicId`)
- Rotas da API: `artifacts/api-server/src/routes/{health,me,tutors,pets,consultations,exams,dashboard}.ts`
- Middleware de auth: `artifacts/api-server/src/middlewares/auth.ts` (Supabase JWT → user; fallback demo)
- Theme/CSS: `artifacts/synvet/src/index.css` (paleta premium escura)
- Páginas: `artifacts/synvet/src/pages/*` (login, dashboard, pacientes, tutores, consultas, exames, configurações + detalhes)
- Auth client: `artifacts/synvet/src/lib/supabase.ts`, `src/hooks/use-auth.tsx`
- Token getter: registrado em `artifacts/synvet/src/main.tsx`

## Architecture decisions

- **Multi-tenancy por `clinicId` em toda tabela** — um middleware injeta `req.auth.user` (com `clinicId`) e todas as queries filtram por ele.
- **Postgres do Replit em vez do Postgres do Supabase** — usuário pediu Supabase, mas mantemos só Auth + Storage do Supabase; persistência via Drizzle no Postgres provisionado pela plataforma. Isso simplifica deploy e usa o ambiente nativo.
- **Modo demo automático (apenas dev)** — se Supabase não estiver configurado ou não houver token, o backend cria/usa uma clínica `demo` semeada. Em `NODE_ENV=production` esse fallback é bloqueado e retorna `401`; para reativar (ex.: demos públicas) defina `ALLOW_DEMO_AUTH=true`.
- **Datas**: colunas `date` do Drizzle exigem string `YYYY-MM-DD`. Helper `lib/dates.ts` converte `Date` (vindo do zod) para esse formato em INSERT/UPDATE.
- **Tema fixo dark** (`<html class="dark">`) — paleta `#0B1020 / #111827 / #5B8CFF / #7A5CFF / #F8FAFC / #94A3B8` direto nas variáveis `.dark` do `index.css`.
- **PWA**: `public/sw.js` é registrado pelo `main.tsx` apenas em produção (`import.meta.env.PROD`); shell mínimo em cache, requests para `/api` nunca cacheados.
- **Upload de laudo**: helper `lib/storage.ts` envia o arquivo para o bucket `exams` do Supabase Storage (chave `<clinicId>/<uuid>.<ext>`), valida tipo (PDF/PNG/JPEG/WEBP/GIF) e tamanho (<=15 MB), e persiste a URL pública + `fileType` no exame. Em modo demo (sem Supabase) o upload é desabilitado e a UI cai para um campo de URL pública. Lista de exames mostra preview inline (img para imagens, iframe para PDFs).

## Product

- Login (Supabase ou modo demo)
- Dashboard com KPIs, agenda do dia e atividade recente
- Pacientes (lista + busca + criar + perfil em abas: Visão Geral, Consultas, Exames, Vacinas, Prontuário, Editar)
- Tutores (lista + busca + perfil com pets vinculados, criar pet a partir do tutor)
- Consultas (agenda + criar/editar/excluir + detalhe com anamnese por sistemas — neuro, digestivo, respiratório, dermato, geral)
- Exames (lista clínica + filtro por categoria + criação)
- Configurações da clínica e do usuário, sair

## User preferences

- UI 100% em Português-BR. Sem emojis na interface.
- Tema escuro premium é parte da identidade — não trocar para tema claro.

## Gotchas

- Após mexer no `lib/api-spec/openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen` antes do typecheck.
- `lib/api-zod/src/index.ts` exporta os schemas como namespace: `export * as schemas from "./generated/api"`. Importar como `import { schemas } from "@workspace/api-zod"` e usar `schemas.XxxBody`.
- Hooks com `enabled` exigem `queryKey` explícito (regra do `@tanstack/react-query` com Orval). Sempre passar `getXxxQueryKey(...)` junto.
- Mutations geradas pelo Orval: parâmetros de path ficam no nível raiz do objeto (`{ petId, data: { ... } }`) — não dentro de `data`.

## Pointers

- Skill `pnpm-workspace` — estrutura do monorepo, OpenAPI, server e DB
- Skill `react-vite` — convenções do frontend (formularios, hooks Orval, dark mode)
- Skill `integrations` — antes de pedir secrets do Supabase, conferir se há um connector
