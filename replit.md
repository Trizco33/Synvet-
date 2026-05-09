# Synvet — SaaS clínico veterinário

Plataforma multi-clínica para veterinários: pacientes, tutores, agenda, anamnese por sistemas, exames, prontuário e Copilot de IA. Tema dark premium, PWA.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API Express (porta dinâmica via `PORT`, exposta em `/api`)
- `pnpm --filter @workspace/synvet run dev` — Frontend Vite/React (gerido pelo workflow)
- `pnpm run typecheck` — typecheck completo
- `pnpm --filter @workspace/api-spec run codegen` — regerar hooks/Zod a partir do OpenAPI
- `pnpm --filter @workspace/db run push` — aplicar mudanças de schema (dev)

Vars:
- Obrigatória: `DATABASE_URL` (Postgres provisionado).
- Auth Supabase real (opcional):
  - **Servidor**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`, bypass RLS, NUNCA no frontend)
  - **Cliente**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`sb_publishable_…`, OK no bundle)
- Sem essas vars, backend cria automaticamente clínica/usuário **demo** e o frontend libera o acesso com aviso.

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- API: Express 5, Drizzle ORM, Postgres
- Auth: Supabase Auth (frontend SDK + JWT verificado no backend via `@supabase/supabase-js` admin)
- Frontend: React + Vite + Tailwind 4 + shadcn/ui + wouter + react-hook-form + zod + TanStack Query (via Orval) + recharts + date-fns + framer-motion + sonner
- Validação: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (OpenAPI → React Query hooks + Zod schemas)
- PWA: `public/manifest.webmanifest` + `theme-color` no `index.html`

## Where things live

- Contrato API: `lib/api-spec/openapi.yaml`
- Hooks/schemas gerados: `lib/api-client-react/src/generated`, `lib/api-zod/src/generated` (importar via `schemas.*`)
- Schema do banco: `lib/db/src/schema/*.ts` (clinics, users, tutors, pets, consultations, anamneses, exams, vaccines, medical-records, copilot — todos com `clinicId`, `createdAt`, `updatedAt`, `createdBy`; `copilot_messages` é append-only)
- Rotas da API: `artifacts/api-server/src/routes/{health,me,tutors,pets,consultations,exams,dashboard,timeline,team,storage,ai,copilot}.ts` (copilot = CRUD de conversas + chat SSE)
- Middleware de auth: `artifacts/api-server/src/middlewares/auth.ts` (Supabase JWT → user; fallback demo; `requireRole(...)`)
- Theme/CSS: `artifacts/synvet/src/index.css` (paleta premium escura)
- Páginas: `artifacts/synvet/src/pages/*` (login, dashboard, pacientes, tutores, consultas, exames, configurações + detalhes)
- Componentes clínicos: `artifacts/synvet/src/components/clinical/{clinical-alerts,clinical-timeline,file-uploader}.tsx`
- Layout: `artifacts/synvet/src/components/layout/{AppLayout,BottomNav}.tsx`
- Hooks: `artifacts/synvet/src/hooks/{use-auth,use-permissions,use-mobile,use-toast}.tsx`
- Auth client: `artifacts/synvet/src/lib/supabase.ts`, `src/hooks/use-auth.tsx`
- Storage client (signed upload + XHR progress): `artifacts/synvet/src/lib/storage.ts`
- Token getter: registrado em `artifacts/synvet/src/main.tsx`

## Architecture decisions

### Multi-tenancy & Auth
- **Tenancy por `clinicId` em toda tabela** — middleware injeta `req.auth.user` (com `clinicId` + `role`); todas as queries filtram por ele.
- **Tenant source of truth = tabela `users` no Postgres** (não JWT claims). JWT do Supabase só carrega `sub`/`email`; middleware faz lookup por `id = sub` e devolve o `clinicId` persistido. No 1º login (`ensureUser`), se o usuário não existe, cria clínica nova + vincula usuário como `admin`. Trocar de clínica/aceitar convite exige UPDATE explícito em `users.clinic_id`.
- **Postgres do Replit + Supabase Auth/Storage** — Drizzle no Postgres provisionado; Supabase só p/ Auth + Storage.
- **Modo demo automático (apenas dev)** — sem Supabase ou sem token, backend usa clínica `demo` semeada. `NODE_ENV=production` bloqueia (401); reativar com `ALLOW_DEMO_AUTH=true`.
- **RBAC**: enum `users.role` = `admin | vet | assistant`. Middleware `requireRole(...roles)` (403). Frontend usa hook `usePermissions()` para gates de UI. Apenas `admin` altera cargos via `PATCH /clinic/team/:memberId`; admin não pode rebaixar a si mesmo.
- **Auditoria**: toda tabela de domínio tem `createdAt`, `updatedAt` (default `now()`), `createdBy` (uuid → `users.id` ON DELETE SET NULL). Inserts setam `createdBy`; updates setam `updatedAt: new Date()`.

### UI / PWA
- **Tema fixo dark** (`<html class="dark">`) — paleta `#0B1020 / #111827 / #5B8CFF / #7A5CFF / #F8FAFC / #94A3B8` em `.dark` do `index.css`.
- **PWA + auto-update**: `public/sw.js` registrado em produção. Cache name versionado (`synvet-shell-${BUILD_VERSION}`) — `vite.config.ts` injeta `Date.now()` via `swVersionPlugin` (substitui `__BUILD_VERSION__` após build). `/api` nunca cacheado. **Navegação é network-only quando online** (cache só fallback offline) — evita HTML stale com chunks antigos. Novo SW chama `self.skipWaiting()`; `main.tsx` ouve `controllerchange` e dá `window.location.reload()` 1x. Checa `reg.update()` a cada 60s. Listener global de `error` recupera de "Failed to fetch dynamically imported module"/"ChunkLoadError" forçando reload (flag em `sessionStorage` evita loop). Resultado: usuário não precisa hard-refresh após deploy.
- **Mobile**: `<BottomNav/>` fixo em `< md` (5 itens, safe-area); `AppLayout` aplica `pb-24 md:pb-8`.
- **Datas**: helper `lib/dates.ts` converte `Date` para `YYYY-MM-DD` em colunas Drizzle `date`.

### Domínio clínico
- **Timeline clínica**: `GET /pets/:petId/timeline` agrega consultations + exams + vaccines + medical_records, normaliza para `{type,id,date,title,description,severity,sourceUrl}`, ordena desc. Severidade: vacina vencida = `critical`; exame `pending` ou consulta `cancelled` = `warning`; demais = `info`.
- **Alertas clínicos**: `<ClinicalAlerts pet/>` lê `isCritical`, `allergies`, `continuousMedications`, `notes`. No topo do `pet-detail` (compact); reusável em consulta/prontuário.
- **Upload de laudo (com progresso, durável)**:
  - `POST /storage/exams/signed-upload` → URL assinada do bucket privado `exams` (chave `<clinicId>/<uuid>.<ext>`).
  - Frontend (`lib/storage.ts`) faz `PUT` direto no Supabase via `XMLHttpRequest` (progresso, cancel, retry).
  - **Coluna durável = `exams.file_path`**: frontend envia `filePath` no `POST /exams` (tenancy guard server-side: precisa começar com `<clinicId>/`); backend re-assina URL fresca (TTL 1h) em cada `GET /exams` e timeline via `lib/exam-files.ts` (`signExamPath`/`signExamPaths` em batch). Links nunca expiram do ponto de vista do usuário.
  - `fileUrl` no schema = fallback legado p/ registros antigos sem `filePath`. `POST /storage/exams/signed-download` permanece p/ preview no dialog de criação.
  - **Limite 15 MB** em 3 camadas: (1) frontend `MAX_BYTES`, (2) bucket `file_size_limit` (aplicado via `ensureExamsBucket` no boot), (3) MIME whitelist no `signed-upload`.
  - `<FileUploader/>` encapsula progress bar + cancel + retry + remove. Modo demo desabilita upload.

### IA assistiva (camada 1 — 4 funções)
- Resumo de consulta, organizar texto clínico livre, resumo longitudinal de timeline, detecção de padrões.
- Provider abstraction em `artifacts/api-server/src/ai/{provider.ts, service.ts, sanitize.ts, prompts/v1.ts}`.
- Modelo padrão `gpt-5-mini` com `reasoning_effort:"low"` + `max_completion_tokens` 3000–3500 (reasoning models gastam budget em "pensamento" — sem `low` o `content` volta vazio).
- Acesso via Replit AI Integrations (`@workspace/integrations-openai-ai-server`, sem chave do usuário).
- Endpoints: `POST /ai/consultations/:id/summary`, `POST /ai/organize-text`, `POST /ai/pets/:petId/timeline-summary`, `POST /ai/pets/:petId/clinical-patterns`. Todos `requireRole(admin|vet)` + rate limit 20 req/min/usuário.
- **Sanitização obrigatória** (`sanitize.ts`): remove UUIDs, emails, `clinicId`, IDs internos antes do LLM.
- **Disclaimer** em toda resposta ("Conteúdo gerado por IA assistiva. Revise sempre…").
- **Observabilidade**: cada chamada loga `{provider, model, operation, requestId, promptTokens, completionTokens, durationMs, estimatedCostUsd}` via `pino`; pricing table em `provider.ts`.
- **Limite timeline**: máx 80 eventos enviados ao LLM.
- Frontend: `<AIAssistantDrawer/>` (Sheet shadcn) + `<AITriggerButton/>` em `components/ai/`. Estados loading/success/error, copiar, regenerar, cancelar via `AbortController`, badge "Assistivo · revise sempre", renderer markdown próprio (`ai-markdown.tsx`). Integrado em `pet-detail` (Timeline: Resumir + Detectar padrões) e `consultation-detail` (Resumir + "Organizar com IA" inline em Sintomas/Evolução).

### Synvet Copilot (chat clínico contextual)
- Chat assistivo por paciente, streaming SSE, FAB flutuante, contexto carregado automaticamente.
- Backend: `artifacts/api-server/src/ai/copilot/{contextBuilder,prompts,service,examParser}.ts` + `routes/copilot.ts`.
- Endpoints (todos `requireRole(admin|vet)` + `copilotLimiter` 30 req/min/usuário, in-memory):
  - `GET /ai/copilot/context/:petId?consultationId=…` → JSON com resumo do pet, contadores e preview do bloco.
  - `POST /ai/copilot/chat` → SSE com eventos `ready` / `delta` / `done` / `error`.
  - `GET /ai/copilot/conversations?petId=` (lista), `GET /ai/copilot/conversations/:id` (com mensagens), `DELETE /ai/copilot/conversations/:id`.
- **Fora do OpenAPI/Orval** — SSE não fita codegen; frontend usa `lib/copilot.ts` (fetch + ReadableStream + parser SSE manual). Endpoints de conversation/context também ficaram fora por simplicidade.
- **Validação manual** em `routes/copilot.ts` (regex UUID + checks) — api-server não tem `zod` direto.
- **Contexto** (`contextBuilder.ts`): top 10 mais recentes de consultas/exames/vacinas/records filtrados por `clinicId`, mais consulta em foco (com anamnese) se `consultationId` vier. Tudo passa por `sanitize()` + `clip()`.
- **Prompt** (`prompts.ts`, versão `copilot-v1.0.0`): nunca diagnóstico definitivo, nunca posologia, sempre cita origem (ex.: "(consulta de 12/05/2025)"), encerra com lembrete de avaliação clínica. Inclui seção "Valores laboratoriais sinalizados" explicando setas ↑/↓.
- **Streaming** (`service.ts`): `openai.chat.completions.create({stream:true, stream_options:{include_usage:true}})`, async generator yielding `{type:"delta"|"done"|"error"}`. Modelo `gpt-5-mini` + `reasoning_effort:"low"` + `max_completion_tokens:3500`. Histórico reenviado pelo frontend é truncado p/ 12 msgs no serviço.
- **AbortController** end-to-end: fechar drawer / clicar Parar / `req.on("close")` cancela o stream OpenAI.
- **Memória persistente** (Phase 1): tabelas `copilot_conversations` (id, clinicId, petId, consultationId?, userId, title, model, promptVersion, timestamps) + `copilot_messages` (conversationId, clinicId, role, content, tokensIn?, tokensOut?, createdAt). **Visibilidade escopada por `(clinicId, userId)`** — cada vet só vê suas conversas, mesmo dentro da clínica (decisão de privacidade).
  - `POST /chat` aceita `conversationId` opcional: se vier, valida ownership; se não, cria nova com `title = clipTitle(primeira msg user, 80c)` e devolve `conversationId` no evento `ready`.
  - **Persistência best-effort** no `finally` do route handler — última user msg + assistant content (mesmo parcial em desconexão) gravados; `updatedAt` bumpado.
  - Drawer ganhou popover `<History/>` no header com últimas 20 conversas (botão Nova, lixeira). "Nova conversa" no rodapé limpa `messages[]` E `conversationId`.
  - **Fora do escopo Phase 1**: edição de título, busca em conversas, compartilhar entre vets.
- **Parser de exames** (Phase 1, `examParser.ts`): extrai valores numéricos (ALT/TGP, AST/TGO, FA, Creatinina, Ureia, Glicose, Hematócrito, Hemoglobina, Plaquetas, Leucócitos, Proteínas totais, Albumina, Bilirrubina, Colesterol, Triglicerídeos, K, Na, Ca, P, T4 total) com regex tolerante a vírgula decimal PT-BR e separador de milhar PT-BR/EN. Compara contra reference ranges genéricas por espécie (`dog`/`cat` via `speciesKey()`), sinaliza `low`/`high`/`normal`/`unknown`. `contextBuilder` enriquece `recentExams` com `parsedValues[]` + `abnormalFlags`; `renderContextForPrompt` adiciona linha `valores: ALT 145 U/L ↑ (ref 10–100) • Creatinina 2,3 mg/dL ↑`. Limitações: só lê `title` + `notes` (PDFs ainda não parseados — Phase 2); ranges genéricas; até 6 valores por exame.
- **Custo/observabilidade**: cada chat loga `{provider,model,operation:"copilot.chat",requestId,promptTokens,completionTokens,durationMs,estimatedCostUsd,historyLength}` via pino; mesmo pricing table das outras funções IA.
- **Frontend**: `CopilotProvider` (React context com `setContext`/`open`/`setOpen`), `useSetCopilotContext({petId,consultationId,label})` (hook em render — clear on unmount), `<CopilotFab/>` (gradient, `bottom-24 md:bottom-6`, só visível com contexto), `<CopilotDrawer/>` (Sheet lateral, header com badges crítico/alergia/medicação, contadores de fontes, 6 quick prompts, composer com Enter-to-send + Shift+Enter newline, "Parar" durante stream). Renderer markdown reusa `<AIMarkdown/>`. Provider/FAB/Drawer montados em `App.tsx` dentro de `AuthProvider`. Páginas que registram contexto: `pet-detail` (qualquer aba), `consultation-detail` (passa `petId` + `consultationId`).
- **Multi-tenancy**: `buildCopilotContext` SEMPRE recebe `clinicId` e filtra todas as queries; consulta em foco também valida `petId`.
- **Preparação RAG** (não implementado): `contextBuilder` é a abstração natural — basta enriquecer `CopilotPetContext` com `retrievedDocs[]` e `renderContextForPrompt` os concatena. Service e prompt já tratam o contexto como bloco opaco.

## Auth signup

- `POST /auth/signup` (público, antes do `authMiddleware`) cria usuário no Supabase com `email_confirm: true` e, em transação, cria `clinics` + `users` (role `admin`) no Postgres.
- Compensação: se o INSERT falha após Supabase criar o usuário, chama `supabase.auth.admin.deleteUser` para evitar conta órfã.
- Rate limit: 10 req/h por IP via `signupLimiter` em `routes/auth.ts`.
- Frontend (`pages/login.tsx`): após `signupUser`, faz `signInWithPassword` automático e redireciona pra `/`.
- Cadastro unificado em `/pacientes`: dialog "Novo Paciente" cria tutor + pet sequencialmente; rollback do tutor via `deleteTutor` se o pet falhar (best-effort).

## Product

- Login (Supabase ou modo demo)
- Dashboard com KPIs, agenda do dia e atividade recente
- Pacientes: lista + busca + criar + perfil em abas (Visão Geral, **Timeline clínica**, Consultas, Exames, Vacinas, Prontuário, Editar)
  - Header mostra `<ClinicalAlerts/>`; edição inclui toggles `Castrado`, `Paciente crítico` e textarea `Medicações contínuas`.
- Tutores: lista + busca + perfil com pets vinculados, criar pet a partir do tutor
- Consultas: agenda + criar/editar/excluir + detalhe com anamnese por sistemas (neuro, digestivo, respiratório, dermato, geral)
- Exames: lista clínica + filtro por categoria + criação com upload (progresso/cancel/retry)
- Configurações: clínica, **Equipe (RBAC)**, perfil, sair

## Synvet Copilot — fluxo resumido

1. Página chama `useSetCopilotContext({petId, consultationId})` em render.
2. `<CopilotFab/>` aparece bottom-right; clicando, abre `<CopilotDrawer/>`.
3. Drawer faz `GET /ai/copilot/context/:petId` → header com paciente + badges + contadores.
4. Usuário envia pergunta → `streamCopilotChat()` faz `POST /ai/copilot/chat` com `{petId, consultationId, conversationId?, messages}`.
5. Backend monta contexto sanitizado (filtrado por `clinicId`), abre stream OpenAI, repassa deltas como SSE.
6. Frontend acumula deltas no balão, marca `pending:false` no `done`.
7. "Nova conversa" zera `messages[]` E limpa `conversationId`.
8. "Histórico" abre popover com últimas 20 conversas (pet, user); clicar carrega via `GET /ai/copilot/conversations/:id`; lixeira chama `DELETE`.

## User preferences

- UI 100% em Português-BR. Sem emojis na interface.
- Tema escuro premium é parte da identidade — não trocar para tema claro.

## Gotchas

### Codegen / Orval
- Após mexer em `lib/api-spec/openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen` antes do typecheck.
- `lib/api-zod/src/index.ts` exporta como namespace: `import { schemas } from "@workspace/api-zod"` → `schemas.XxxBody`.
- Hooks com `enabled` exigem `queryKey` explícito (regra `@tanstack/react-query` com Orval). Sempre passar `getXxxQueryKey(...)`.
- Mutations: parâmetros de path no nível raiz do objeto (`{ petId, data: { ... } }`), não dentro de `data`.
- `customInstance` não é exportado por `@workspace/api-client-react`. Para chamadas fora de hooks, usar a função gerada (ex.: `createExamSignedUpload`) — herda auth/baseUrl.
- Orval nomeia schemas Zod por `operationId`, não por `components.schemas`. Ex.: `AiResult` reutilizado vira `AiSummarizeConsultationResponse` etc.

### Domínio
- `MeResponse` usa `userId` (não `id`).
- `fileSize` em `Exam` é `string` (bigint serializado). Converter `String(file.size)` ao enviar.
- `requireRole(...)` deve vir DEPOIS do `authMiddleware` na cadeia de middlewares.
- Bucket `exams` precisa existir no Supabase Storage. URLs assinadas (`createSignedUploadUrl`) expiram rápido — gerar logo antes do `PUT`.

### IA / Copilot
- **Reasoning models**: `gpt-5-mini` é reasoning model; sem `reasoning_effort:"low"` ele gasta o `max_completion_tokens` em raciocínio interno e devolve `content:""`. Sempre passar ambos. SDK ainda não tipa `reasoning_effort` no `chat.completions.create` → cast em `provider.ts`.
- **Funções fetch geradas vs hooks**: para chamar em event handlers (não em render), usar funções `aiSummarizeConsultation`, `aiOrganizeText` etc — não `useAi*`.
- **Copilot SSE fora do Orval**: `/ai/copilot/chat` é stream `text/event-stream`, não está no `openapi.yaml`. Sempre via `lib/copilot.ts` (fetch direto). Tipagem manual — não há codegen. `GET /ai/copilot/context/:petId` também ficou fora; se virar consumo público, mover pra spec.
- **Copilot validação manual**: `routes/copilot.ts` parseia body à mão (regex UUID + checks) porque api-server não tem `zod` como dep direta. Não importar `zod` lá sem antes adicionar ao package.
- **Copilot `req.on("close")`**: cancelamento depende do Express emitir `close` no socket. Em reverse-proxy com buffering agressivo, validar que o `AbortController` ainda dispara — caso contrário o request OpenAI continua queimando tokens. `X-Accel-Buffering: no` já está no response (Nginx).
- **Copilot persistência best-effort**: INSERT das mensagens roda no `finally`; falha é logada mas NÃO propaga (SSE já entregue). Em produção, monitorar `copilot persist failed` no log. A criação da conversa, ao contrário, é síncrona ANTES do stream — falha → 500, não consome OpenAI.
- **Copilot escopo do histórico**: `GET /ai/copilot/conversations` filtra por `(clinicId, petId, userId)`. Mudar pra escopo de clínica inteira exige só remover o filtro `userId`, mas avaliar privacidade entre vets.
- **Copilot limite de mensagens**: backend aceita até 200 msgs no body (anti-abuso); o serviço trunca p/ 12 internamente. Não baixar esse teto sem ajustar o frontend, que reenvia o histórico inteiro carregado.
- **Parser de exames — falsos positivos**: regex casa qualquer label de 2+ palavras + número, mas filtra pelo `ALIASES` map. Adicionar nome novo ao map é suficiente. Separadores exóticos (`ALT.....145`) podem falhar silenciosamente — intencional (zero falso positivo > inflar prompt).

## Pointers

- Skill `pnpm-workspace` — estrutura do monorepo, OpenAPI, server e DB
- Skill `react-vite` — convenções do frontend (formularios, hooks Orval, dark mode)
- Skill `integrations` — antes de pedir secrets do Supabase, conferir se há um connector
