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
- Schema do banco: `lib/db/src/schema/*.ts` (clinics, users, tutors, pets, consultations, anamneses, exams, vaccines, medical-records — todos com `clinicId`, `createdAt`, `updatedAt`, `createdBy`)
- Rotas da API: `artifacts/api-server/src/routes/{health,me,tutors,pets,consultations,exams,dashboard,timeline,team,storage}.ts`
- Middleware de auth: `artifacts/api-server/src/middlewares/auth.ts` (Supabase JWT → user; fallback demo; `requireRole(...)`)
- Theme/CSS: `artifacts/synvet/src/index.css` (paleta premium escura)
- Páginas: `artifacts/synvet/src/pages/*` (login, dashboard, pacientes, tutores, consultas, exames, configurações + detalhes)
- Componentes clínicos reutilizáveis: `artifacts/synvet/src/components/clinical/{clinical-alerts,clinical-timeline,file-uploader}.tsx`
- Layout: `artifacts/synvet/src/components/layout/{AppLayout,BottomNav}.tsx`
- Hooks: `artifacts/synvet/src/hooks/{use-auth,use-permissions,use-mobile,use-toast}.tsx`
- Auth client: `artifacts/synvet/src/lib/supabase.ts`, `src/hooks/use-auth.tsx`
- Storage client (signed upload + XHR progress): `artifacts/synvet/src/lib/storage.ts`
- Token getter: registrado em `artifacts/synvet/src/main.tsx`

## Architecture decisions

- **Multi-tenancy por `clinicId` em toda tabela** — middleware injeta `req.auth.user` (com `clinicId` + `role`) e todas as queries filtram por ele.
- **Postgres do Replit + Supabase Auth/Storage** — Drizzle no Postgres provisionado; Supabase só para Auth + Storage.
- **Modo demo automático (apenas dev)** — sem Supabase ou sem token, backend cria/usa clínica `demo` semeada. `NODE_ENV=production` bloqueia (`401`); reativar com `ALLOW_DEMO_AUTH=true`.
- **Datas**: helper `lib/dates.ts` converte `Date` para `YYYY-MM-DD` em colunas Drizzle `date`.
- **Tema fixo dark** (`<html class="dark">`) — paleta `#0B1020 / #111827 / #5B8CFF / #7A5CFF / #F8FAFC / #94A3B8` em `.dark` do `index.css`.
- **PWA**: `public/sw.js` registrado pelo `main.tsx` em produção; shell mínimo, `/api` nunca cacheado.
- **Auditoria**: toda tabela de domínio tem `createdAt`, `updatedAt` (default `now()`) e `createdBy` (uuid → `users.id` ON DELETE SET NULL). Inserts setam `createdBy: user.id`; updates setam `updatedAt: new Date()`.
- **RBAC**: enum `users.role` = `admin | vet | assistant`. Middleware `requireRole(...roles)` em `middlewares/auth.ts` (retorna 403). Frontend usa hook `usePermissions()` para gates de UI (`isAdmin`, `can.manageTeam`, etc.). Apenas `admin` altera cargos via `PATCH /clinic/team/:memberId`; admin não pode rebaixar a si mesmo.
- **Timeline clínica**: `GET /pets/:petId/timeline` agrega consultations + exams + vaccines + medical_records, normaliza para `{type,id,date,title,description,severity,sourceUrl}` e ordena desc. Severidade: vacina vencida = `critical`, exame `pending` ou consulta `cancelled` = `warning`, demais = `info`.
- **Alertas clínicos**: componente `<ClinicalAlerts pet/>` lê `isCritical`, `allergies`, `continuousMedications`, `notes` do pet. Usado no topo do `pet-detail` (compact). Fácil reutilizar em consulta/prontuário.
- **Upload de laudo (com progresso)**: fluxo `POST /storage/exams/signed-upload` retorna URL assinada do bucket **privado** `exams` (chave `<clinicId>/<uuid>.<ext>`). Frontend (`lib/storage.ts`) faz `PUT` direto no Supabase via `XMLHttpRequest` para reportar progresso, suportar cancelamento (`AbortController`) e retry. Após o upload, o frontend chama `POST /storage/exams/signed-download {path, expiresIn}` que valida tenancy (`path` precisa começar com `<clinicId>/`) e devolve uma URL assinada (TTL máximo 7 dias, enforced no servidor) usada como `fileUrl` exibível. **Limitação conhecida**: como `fileUrl` armazena a URL assinada, links de laudos antigos expiram após 7 dias. Próxima evolução recomendada: persistir `filePath` como coluna durável e re-assinar sob demanda no display. Componente `<FileUploader/>` reutilizável encapsula barra de progresso (shadcn `progress`), cancel, retry, remove. Em modo demo o upload é desabilitado e a UI cai para input de URL pública.
- **Mobile**: `<BottomNav/>` fixo em telas `< md` (5 itens) com safe-area; `AppLayout` aplica `pb-24 md:pb-8` para evitar sobreposição.

## Product

- Login (Supabase ou modo demo)
- Dashboard com KPIs, agenda do dia e atividade recente
- Pacientes (lista + busca + criar + perfil em abas: Visão Geral, **Timeline clínica**, Consultas, Exames, Vacinas, Prontuário, Editar)
  - Header do pet mostra `<ClinicalAlerts/>` (alergias, paciente crítico, medicação contínua, observações)
  - Edição inclui toggles `Castrado`, `Paciente crítico` e textarea `Medicações contínuas`
- Tutores (lista + busca + perfil com pets vinculados, criar pet a partir do tutor)
- Consultas (agenda + criar/editar/excluir + detalhe com anamnese por sistemas — neuro, digestivo, respiratório, dermato, geral)
- Exames (lista clínica + filtro por categoria + criação com upload com barra de progresso/cancel/retry)
- Configurações: clínica, **Equipe (RBAC: admin altera cargos)**, perfil, sair

## User preferences

- UI 100% em Português-BR. Sem emojis na interface.
- Tema escuro premium é parte da identidade — não trocar para tema claro.

## Gotchas

- Após mexer no `lib/api-spec/openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen` antes do typecheck.
- `lib/api-zod/src/index.ts` exporta os schemas como namespace: `export * as schemas from "./generated/api"`. Importar como `import { schemas } from "@workspace/api-zod"` e usar `schemas.XxxBody`.
- Hooks com `enabled` exigem `queryKey` explícito (regra do `@tanstack/react-query` com Orval). Sempre passar `getXxxQueryKey(...)` junto.
- Mutations geradas pelo Orval: parâmetros de path ficam no nível raiz do objeto (`{ petId, data: { ... } }`) — não dentro de `data`.
- `MeResponse` usa `userId` (não `id`) — ver `usePermissions()` e `configuracoes.tsx`.
- `fileSize` em `Exam` é `string` na API (bigint serializado). Converter `String(file.size)` ao enviar.
- `customInstance` não é exportado por `@workspace/api-client-react`. Para chamadas auto-fora de hooks usar a função gerada (ex.: `createExamSignedUpload`), que herda autenticação/baseUrl.
- `requireRole(...)` deve vir DEPOIS do `authMiddleware` na cadeia de middlewares (já configurado em `routes/index.ts`).
- Bucket `exams` precisa existir no Supabase Storage. URLs assinadas (`createSignedUploadUrl`) expiram rápido — gerar logo antes do `PUT`.

## Pointers

- Skill `pnpm-workspace` — estrutura do monorepo, OpenAPI, server e DB
- Skill `react-vite` — convenções do frontend (formularios, hooks Orval, dark mode)
- Skill `integrations` — antes de pedir secrets do Supabase, conferir se há um connector
