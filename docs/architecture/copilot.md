# Synvet Copilot (chat clínico contextual)

Chat assistivo por paciente, streaming SSE, FAB flutuante, contexto carregado
automaticamente.

## Backend

- `artifacts/api-server/src/ai/copilot/{contextBuilder,prompts,service,examParser}.ts`
- `artifacts/api-server/src/routes/copilot.ts`

Endpoints (todos `requireRole(admin|vet)` + `copilotLimiter` 30 req/min/usuário):

- `GET /ai/copilot/context/:petId?consultationId=…` → JSON com resumo do pet, contadores e preview do bloco.
- `POST /ai/copilot/chat` → SSE com eventos `ready` / `delta` / `done` / `error`.
- `GET /ai/copilot/conversations?petId=` (lista), `GET /ai/copilot/conversations/:id` (com mensagens), `DELETE /ai/copilot/conversations/:id`.

**Fora do OpenAPI/Orval** — SSE não fita codegen; frontend usa `lib/copilot.ts`
(fetch + ReadableStream + parser SSE manual). Endpoints de conversation/context
também ficaram fora por simplicidade.

**Validação manual** em `routes/copilot.ts` (regex UUID + checks) — api-server
não tem `zod` direto.

## Contexto (`contextBuilder.ts`)

Top 10 mais recentes de consultas/exames/vacinas/records filtrados por `clinicId`,
mais consulta em foco (com anamnese) se `consultationId` vier. Tudo passa por
`sanitize()` + `clip()`.

## Prompt (`prompts.ts`, versão `copilot-v1.0.0`)

Nunca diagnóstico definitivo, nunca posologia, sempre cita origem
(ex.: "(consulta de 12/05/2025)"), encerra com lembrete de avaliação clínica.
Inclui seção "Valores laboratoriais sinalizados" explicando setas ↑/↓.

## Streaming (`service.ts`)

`openai.chat.completions.create({stream:true, stream_options:{include_usage:true}})`,
async generator yielding `{type:"delta"|"done"|"error"}`. Modelo `gpt-5-mini` +
`reasoning_effort:"low"` + `max_completion_tokens:3500`. Histórico reenviado pelo
frontend é truncado p/ 12 msgs no serviço.

**AbortController end-to-end**: fechar drawer / clicar Parar / `req.on("close")`
cancela o stream OpenAI.

## Memória persistente (Phase 1)

Tabelas `copilot_conversations` (id, clinicId, petId, consultationId?, userId, title,
model, promptVersion, timestamps) + `copilot_messages` (conversationId, clinicId, role,
content, tokensIn?, tokensOut?, createdAt). **Visibilidade escopada por
`(clinicId, userId)`** — cada vet só vê suas conversas, mesmo dentro da clínica
(decisão de privacidade).

- `POST /chat` aceita `conversationId` opcional: se vier, valida ownership; se não,
  cria nova com `title = clipTitle(primeira msg user, 80c)` e devolve `conversationId`
  no evento `ready`.
- **Persistência best-effort** no `finally` do route handler — última user msg +
  assistant content (mesmo parcial em desconexão) gravados; `updatedAt` bumpado.
- Drawer ganhou popover `<History/>` no header com últimas 20 conversas (botão Nova,
  lixeira). "Nova conversa" no rodapé limpa `messages[]` E `conversationId`.
- **Fora do escopo Phase 1**: edição de título, busca em conversas, compartilhar
  entre vets.

## Parser de exames (Phase 1, `examParser.ts`)

Extrai valores numéricos (ALT/TGP, AST/TGO, FA, Creatinina, Ureia, Glicose,
Hematócrito, Hemoglobina, Plaquetas, Leucócitos, Proteínas totais, Albumina,
Bilirrubina, Colesterol, Triglicerídeos, K, Na, Ca, P, T4 total) com regex
tolerante a vírgula decimal PT-BR e separador de milhar PT-BR/EN. Compara contra
reference ranges genéricas por espécie (`dog`/`cat` via `speciesKey()`), sinaliza
`low`/`high`/`normal`/`unknown`.

`contextBuilder` enriquece `recentExams` com `parsedValues[]` + `abnormalFlags`;
`renderContextForPrompt` adiciona linha `valores: ALT 145 U/L ↑ (ref 10–100) •
Creatinina 2,3 mg/dL ↑`.

Limitações: só lê `title` + `notes` (PDFs ainda não parseados — Phase 2); ranges
genéricas; até 6 valores por exame.

## Custo/observabilidade

Cada chat loga `{provider,model,operation:"copilot.chat",requestId,promptTokens,
completionTokens,durationMs,estimatedCostUsd,historyLength}` via pino; mesmo
pricing table das outras funções IA.

## Frontend

`CopilotProvider` (React context com `setContext`/`open`/`setOpen`),
`useSetCopilotContext({petId,consultationId,label})` (hook em render — clear on
unmount), `<CopilotFab/>` (gradient, `bottom-24 md:bottom-6`, só visível com contexto),
`<CopilotDrawer/>` (Sheet lateral, header com badges crítico/alergia/medicação,
contadores de fontes, 6 quick prompts, composer com Enter-to-send + Shift+Enter
newline, "Parar" durante stream). Renderer markdown reusa `<AIMarkdown/>`.
Provider/FAB/Drawer montados em `App.tsx` dentro de `AuthProvider`. Páginas que
registram contexto: `pet-detail` (qualquer aba), `consultation-detail` (passa
`petId` + `consultationId`).

## Multi-tenancy

`buildCopilotContext` SEMPRE recebe `clinicId` e filtra todas as queries; consulta
em foco também valida `petId`.

## Preparação RAG (não implementado)

`contextBuilder` é a abstração natural — basta enriquecer `CopilotPetContext` com
`retrievedDocs[]` e `renderContextForPrompt` os concatena. Service e prompt já
tratam o contexto como bloco opaco.

## Fluxo resumido

1. Página chama `useSetCopilotContext({petId, consultationId})` em render.
2. `<CopilotFab/>` aparece bottom-right; clicando, abre `<CopilotDrawer/>`.
3. Drawer faz `GET /ai/copilot/context/:petId` → header com paciente + badges + contadores.
4. Usuário envia pergunta → `streamCopilotChat()` faz `POST /ai/copilot/chat` com
   `{petId, consultationId, conversationId?, messages}`.
5. Backend monta contexto sanitizado (filtrado por `clinicId`), abre stream OpenAI,
   repassa deltas como SSE.
6. Frontend acumula deltas no balão, marca `pending:false` no `done`.
7. "Nova conversa" zera `messages[]` E limpa `conversationId`.
8. "Histórico" abre popover com últimas 20 conversas (pet, user); clicar carrega via
   `GET /ai/copilot/conversations/:id`; lixeira chama `DELETE`.

## Gotchas

- **Reasoning models**: `gpt-5-mini` é reasoning model; sem `reasoning_effort:"low"`
  ele gasta o `max_completion_tokens` em raciocínio interno e devolve `content:""`.
  Sempre passar ambos. SDK ainda não tipa `reasoning_effort` no
  `chat.completions.create` → cast em `provider.ts`.
- **Copilot SSE fora do Orval**: `/ai/copilot/chat` é stream `text/event-stream`,
  não está no `openapi.yaml`. Sempre via `lib/copilot.ts` (fetch direto). Tipagem
  manual — não há codegen. `GET /ai/copilot/context/:petId` também ficou fora; se
  virar consumo público, mover pra spec.
- **Copilot validação manual**: `routes/copilot.ts` parseia body à mão (regex UUID +
  checks) porque api-server não tem `zod` como dep direta.
- **Copilot `req.on("close")`**: cancelamento depende do Express emitir `close` no
  socket. Em reverse-proxy com buffering agressivo, validar que o `AbortController`
  ainda dispara — caso contrário o request OpenAI continua queimando tokens.
  `X-Accel-Buffering: no` já está no response (Nginx).
- **Copilot persistência best-effort**: INSERT das mensagens roda no `finally`;
  falha é logada mas NÃO propaga (SSE já entregue). Em produção, monitorar
  `copilot persist failed` no log. A criação da conversa, ao contrário, é síncrona
  ANTES do stream — falha → 500, não consome OpenAI.
- **Copilot escopo do histórico**: `GET /ai/copilot/conversations` filtra por
  `(clinicId, petId, userId)`. Mudar pra escopo de clínica inteira exige só remover
  o filtro `userId`, mas avaliar privacidade entre vets.
- **Copilot limite de mensagens**: backend aceita até 200 msgs no body (anti-abuso);
  o serviço trunca p/ 12 internamente. Não baixar esse teto sem ajustar o frontend,
  que reenvia o histórico inteiro carregado.
- **Parser de exames — falsos positivos**: regex casa qualquer label de 2+ palavras +
  número, mas filtra pelo `ALIASES` map. Adicionar nome novo ao map é suficiente.
  Separadores exóticos (`ALT.....145`) podem falhar silenciosamente — intencional
  (zero falso positivo > inflar prompt).
