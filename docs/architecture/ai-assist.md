# IA assistiva (camada 1 — 4 funções)

Resumo de consulta, organizar texto clínico livre, resumo longitudinal de timeline,
detecção de padrões.

- Provider abstraction em `artifacts/api-server/src/ai/{provider.ts, service.ts, sanitize.ts, prompts/v1.ts}`.
- Modelo padrão `gpt-5-mini` com `reasoning_effort:"low"` + `max_completion_tokens` 3000–3500
  (reasoning models gastam budget em "pensamento" — sem `low` o `content` volta vazio).
- Acesso via Replit AI Integrations (`@workspace/integrations-openai-ai-server`, sem
  chave do usuário).
- Endpoints: `POST /ai/consultations/:id/summary`, `POST /ai/organize-text`,
  `POST /ai/pets/:petId/timeline-summary`, `POST /ai/pets/:petId/clinical-patterns`.
  Todos `requireRole(admin|vet)` + rate limit 20 req/min/usuário.
- **Sanitização obrigatória** (`sanitize.ts`): remove UUIDs, emails, `clinicId`, IDs
  internos antes do LLM.
- **Disclaimer** em toda resposta ("Conteúdo gerado por IA assistiva. Revise sempre…").
- **Observabilidade**: cada chamada loga `{provider, model, operation, requestId,
  promptTokens, completionTokens, durationMs, estimatedCostUsd}` via `pino`; pricing
  table em `provider.ts`.
- **Limite timeline**: máx 80 eventos enviados ao LLM.

## Frontend

- `<AIAssistantDrawer/>` (Sheet shadcn) + `<AITriggerButton/>` em `components/ai/`.
- Estados loading/success/error, copiar, regenerar, cancelar via `AbortController`,
  badge "Assistivo · revise sempre", renderer markdown próprio (`ai-markdown.tsx`).
- Integrado em `pet-detail` (Timeline: Resumir + Detectar padrões) e
  `consultation-detail` (Resumir + "Organizar com IA" inline em Sintomas/Evolução).

## Gotchas

- **Funções fetch geradas vs hooks**: para chamar em event handlers (não em render),
  usar funções `aiSummarizeConsultation`, `aiOrganizeText` etc — não `useAi*`.
