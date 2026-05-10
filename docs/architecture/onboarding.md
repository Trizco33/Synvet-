# Onboarding guiado in-app (Fase B4)

Card persistente no Dashboard que guia novas clínicas pelos primeiros passos da
Synvet, encurtando o time-to-value durante o trial de 14 dias.

## UX

- Aparece no topo do Dashboard, abaixo do título.
- Visível **apenas para usuários com `role = admin`** (vet/assistant não veem).
- Mostra barra de progresso e 7 passos clicáveis. Cada passo tem ícone, título,
  descrição e CTA que navega para a página correspondente.
- Passos concluídos aparecem riscados, opacos e com check verde.
- Botão "X" no canto superior dispensa permanentemente (preferência por usuário).
- Quando todos os passos estão concluídos, o card colapsa para o estado
  "Tudo pronto" (verde, mensagem de sucesso) e some sozinho na próxima visita
  ao Dashboard. Implementado via coluna `users.onboardingCompletedSeenAt`:
  o servidor marca a coluna durante o GET quando `allDone` é detectado pela
  primeira vez, e nas chamadas seguintes devolve `visible = false`.

## Passos detectados

Cada passo é computado por `count` no tenant atual — sem flags manuais:

| id                  | concluído quando                                                    |
| ------------------- | ------------------------------------------------------------------- |
| `clinic_profile`    | `clinics.cnpj && phone && address` preenchidos                      |
| `first_patient`     | `count(pets) > 0`                                                   |
| `first_consultation`| `count(consultations) > 0`                                         |
| `comms_template`    | `count(comms_templates WHERE isSystem = false) > 0`                |
| `whatsapp_channel`  | `count(comms_channels WHERE status = 'connected') > 0`             |
| `invite_team`       | `count(users) > 1` (mais alguém além do admin fundador)            |
| `choose_plan`       | `clinics.plan != 'trial'`                                          |

## Endpoints

- `GET /api/onboarding/state` (admin) — retorna `{ steps, allDone, dismissedAt, visible }`.
- `POST /api/onboarding/dismiss` (admin) — grava `users.onboardingDismissedAt = now()` e devolve o estado atualizado.

Ambos exigem `requireRole("admin")` (DEPOIS do `authMiddleware` na cadeia).

## Persistência

Coluna `users.onboarding_dismissed_at timestamp null` (por usuário, não por
clínica — cada admin pode dispensar separadamente).

## Onde mora

- Backend: `artifacts/api-server/src/routes/onboarding.ts`, montado em `routes/index.ts` após `authMiddleware`.
- Frontend: `artifacts/synvet/src/components/onboarding/OnboardingChecklist.tsx`, embutido no topo de `pages/dashboard.tsx`.
- Schema: `lib/db/src/schema/users.ts` (coluna `onboardingDismissedAt`).
- Contrato: `OnboardingState`, `OnboardingStep` em `lib/api-spec/openapi.yaml`.

## Performance

Os 5 counts rodam em paralelo lógico (queries Drizzle simples), filtrando sempre
por `clinic_id` (todos os índices de tenant existem). O custo total é
`O(número_de_tabelas)` por chamada — aceitável para um endpoint que dispara 1x
por carregamento do Dashboard.

## Out of scope

- Tour interativo (Intro.js).
- Vídeos embedados.
- Onboarding diferente por persona (vet/assistant não veem o card).
