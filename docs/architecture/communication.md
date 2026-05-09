# Módulo Comunicação (CRM veterinário)

Plataforma de mensagens multi-canal para clínicas: WhatsApp via QR (V1), eventos de domínio
disparam automações que renderizam templates e entregam via provider plugável.

## Arquitetura

```
            domain routes (consultations, vaccines, exams)
                       │ commsBus.emitEvent(...)
                       ▼
                    EventBus (in-process EventEmitter, tipado)
                       │
                       ▼
            automations.ts  ← lê comms_automations enabled
                       │ resolve template + tutor + canal
                       ▼
            comms_messages (status=queued/scheduled) + comms_jobs (kind=send_message)
                       │
                       ▼
            scheduler.ts (poll 15s, claim otimista, retry 3x backoff 60s)
                       │
                       ▼
            provider.send()  ← MockProvider (V1) ou EvolutionProvider (stub)
                       │
                       ▼
            comms_messages.status = sent | delivered | failed
```

Tudo in-process. Para escalar multi-instância, trocar EventBus + scheduler por
BullMQ/Redis Streams ou Temporal sem mexer nas rotas.

## Tabelas (`lib/db/src/schema/comms.ts`)

- **comms_channels** — `(clinicId, kind, provider, status, externalId, phoneNumber, displayName, lastConnectedAt, lastError, meta)`. Kinds: `whatsapp_qr | whatsapp_official | email | sms | push`.
- **comms_templates** — `(clinicId, slug, name, channel, category, body, variables[], isSystem, enabled)`. Slug único por clínica. Renderer `{{var}}` simples (sem lógica).
- **comms_automations** — `(clinicId, name, trigger, templateId, channelId?, offsetMinutes, config, enabled)`. Triggers = mesmos `CommsEvent.type` do bus.
- **comms_messages** — `(clinicId, channelId, automationId?, templateId?, tutorId?, petId?, consultationId?, direction, toAddress, body, status, errorMessage, providerMessageId, scheduledFor, sentAt, deliveredAt, readAt)`.
- **comms_jobs** — fila in-DB: `(clinicId, kind, payload, status, attempts, maxAttempts, lockedAt, lockedBy, scheduledFor, lastError)`.

Todas têm `clinicId` + `createdAt/updatedAt` + `createdBy` onde aplicável. Indexes em
filtros frequentes: `(clinicId)`, `(clinicId, status)`, `(clinicId, trigger, enabled)`,
`(status, scheduledFor)` para o scheduler.

## Provider abstraction

`comms/providers/types.ts`:

```ts
interface CommsProvider {
  name: string;
  send(input): Promise<{providerMessageId, status, errorMessage?}>;
  connect(input): Promise<{qrString, expiresAt, status, message?}>;
  disconnect(input): Promise<void>;
  refreshStatus(input): Promise<{status, phoneNumber?, lastError?}>;
}
```

Factory `getProvider(name)` resolve por env `COMMS_PROVIDER` (default `mock`).
Disponíveis hoje: `mock`, `evolution` (stub).

### MockProvider (V1)

- `send` sempre `sent`, loga preview do body.
- `connect` devolve string fictícia + flipa canal para `connected` na rota.
- Útil para validar todo o pipeline (events → automations → jobs → mensagens) sem
  spend, sem terceiros, sem QR real.

### EvolutionProvider (stub)

Não implementado. Comentários no arquivo descrevem o fluxo real (POST /instance/create,
GET /instance/connect/:id, POST /message/sendText, webhook de status).
Para ativar:
```
export EVOLUTION_API_URL=https://sua-evolution.example.com
export EVOLUTION_API_KEY=<global apikey>
export COMMS_PROVIDER=evolution
```
Cada clínica tem uma *instance* na Evolution; o `externalId` do canal armazena o nome.

> Honestidade: WhatsApp Business **oficial** (Meta Cloud API) e WhatsApp QR via Baileys
> embutido **não foram implementados** nesta versão. Mock cobre o fluxo; Evolution/Z-API
> é o caminho recomendado para envio real em produção.

## Eventos disponíveis

| Trigger | Origem (rota) | Vars extras |
|---|---|---|
| `consultation.created` | `POST /consultations` | `scheduled_at` |
| `consultation.cancelled` | `PATCH /consultations/:id` (status=cancelled), `DELETE /consultations/:id` | — |
| `vaccine.created` | `POST /pets/:petId/vaccines` | `vaccine_name`, `due_at` |
| `vaccine.due` | (futuro: scan diário de `nextDueAt`) | `vaccine_name`, `due_at` |
| `exam.ready` | (futuro: PATCH /exams/:id) | — |
| `pet.birthday` | (futuro: scan diário) | — |

`consultation.confirmed` e `exam.ready` estão no enum mas ainda não emitidos
(consultations não tem status `confirmed`; exames não têm PATCH de status).

## Templates default (seed por clínica)

Inseridos automaticamente no **primeiro POST /comms/channels** da clínica
(`seedClinicTemplates` é idempotente):

- `consultation_created` — Confirmação ao agendar
- `consultation_reminder_24h` — Lembrete 24h antes (sem trigger automático ainda)
- `consultation_cancelled` — Aviso de cancelamento
- `exam_ready` — Aviso de exame disponível
- `vaccine_due_d7` — Lembrete de vacina (D-7)
- `pet_birthday` — Aniversário

`seedClinicAutomations` cria 4 regras correspondentes **desabilitadas por padrão** —
clínica revisa o texto e liga manualmente.

## Endpoints (`routes/comms.ts`)

Todos sob `authMiddleware` + filtro por `clinicId`:

- `GET /comms/dashboard` — contadores 30d + recentes
- `GET/POST /comms/channels`, `PATCH/DELETE /comms/channels/:channelId`
- `POST /comms/channels/:channelId/connect` — devolve `{channel, qrString, expiresAt, message}`. Mock: já retorna `connected`.
- `POST /comms/channels/:channelId/disconnect`
- `GET/POST /comms/templates`, `PATCH/DELETE /comms/templates/:templateId`
- `GET/POST /comms/automations`, `PATCH/DELETE /comms/automations/:automationId`
- `GET /comms/messages?status&tutorId&petId&limit`
- `POST /comms/test-send` — admin/vet, fila uma mensagem manual

RBAC: criar/remover/conectar canais e gerenciar automações é `admin`. Templates: `admin|vet`.

## Frontend

Página única `pages/comunicacao.tsx` com 5 tabs (Visão geral, Canais, Templates,
Automações, Mensagens). Componentes inline para velocidade — extrair para
`components/comms/` quando crescer. QR exibido com `qrcode.react` em modal;
mock sinalizado com badge "MockProvider".

## Gotchas

- **Orval não gera Zod schemas para tipos reusáveis** (CommsChannel, CommsTemplate,
  CommsAutomation, CommsMessage não têm export em `@workspace/api-zod`). Routes usam
  `res.json(row)` direto — drizzle types já batem com OpenAPI. Hooks/types do
  `@workspace/api-client-react` funcionam normal.
- **Scheduler é single-instance.** Em multi-replica, dois workers podem reivindicar o
  mesmo job se o UPDATE otimista falhar (improvável mas possível). Migrar para
  `FOR UPDATE SKIP LOCKED` ou queue real.
- **`scheduledFor` no passado** = job processa imediatamente no próximo tick (até 15s).
- **Tutor sem telefone** = automation skipped silenciosamente (log debug).
- **Channel sem `connected`** = job throw → retry → eventual `failed`. Use o card do
  canal pra reconectar e os jobs `pending` voltam a tentar.
- **Mock auto-connected** é só na rota `/connect` (campo `provider === "mock"`).
  EvolutionProvider precisa de webhook real para flipar status.
- **Variáveis do template** são extraídas com regex no save (`extractVariables`). Se
  o usuário editar `body` sem mexer em `variables[]`, recomputamos automaticamente.
