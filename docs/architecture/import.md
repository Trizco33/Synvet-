# Importação de dados via CSV (Fase B5)

Assistente para migrar tutores, pacientes e agenda de outros sistemas via
planilha CSV. Acessível em `/app/configuracoes/importar` (admin only).

## Fluxo

1. **Upload**: arquivo `.csv` (até 5 MB / 5.000 linhas).
2. **Preview**: cliente parseia com `papaparse`, mostra primeiras 5 linhas.
3. **Mapeamento**: cada coluna do CSV → campo Synvet (auto-detectado por
   alias / normalização sem acentos; admin pode ajustar). Campos obrigatórios
   bloqueiam o submit até serem mapeados.
4. **Submit**: cliente envia `{ fileHash, fileName, mapping, rows }` para
   `POST /api/import/:kind`. Backend valida cada linha com Zod, executa em
   uma transação Drizzle e devolve relatório linha-a-linha.
5. **Relatório**: tabela com criadas / ignoradas / com erro + motivo.

## Tipos suportados

| kind            | Campos obrigatórios            | Chave natural / dedupe                    |
|-----------------|--------------------------------|-------------------------------------------|
| `tutors`        | `name` + (`email` ou `phone`)  | `email` (lowercase) ou `phone` (dígitos)  |
| `pets`          | `name`, `species`, tutor       | `(tutorId, name)` (case-insensitive)      |
| `appointments`  | `scheduledAt`, `petName`, tutor| sem dedupe — sempre cria nova consulta    |

`tutorId` é resolvido pelo e-mail ou telefone do tutor já cadastrado. Por isso
a ordem recomendada é: **Tutores → Pacientes → Agenda**.

## Encoding

Cliente lê o arquivo primeiro como UTF-8. Se detectar mojibake (sequências
como `Ã©`, `Ã§`), exibe alerta sugerindo Windows-1252 (Latin1). Admin pode
alternar manualmente via dropdown — comum em planilhas exportadas pelo Excel
brasileiro.

## Idempotência e atomicidade

- **Fail-all (atômico)**: cada importação roda em duas passadas. **Pass 1**
  valida cada linha com Zod por kind e resolve referências (tutor por
  e-mail/telefone, pet por nome) sem gravar nada. **Pass 2** só executa se
  o Pass 1 não retornou nenhum erro: insere todas as linhas válidas em
  uma única transação, em chunks de 100. Se qualquer linha estiver
  inválida, nenhuma é gravada — o cliente recebe o relatório completo,
  corrige e reenvia.
- **Idempotência por hash**: cada execução grava `(clinicId, kind, fileHash)`
  em `import_logs` com `UNIQUE INDEX`. Reenviar o mesmo arquivo retorna
  HTTP 409 com o resumo da execução anterior — evita criar duplicatas em
  retries acidentais. Para reimportar, basta ajustar pelo menos uma linha.
- **Dedupe por chave natural** (não conta como erro):
  - tutors: e-mail (lowercase) ou telefone (só dígitos)
  - pets: prioridade `externalId` (ID do sistema antigo, com `UNIQUE INDEX
    (clinicId, externalId)`); fallback `(tutorId, name)` case-insensitive
  - appointments: sem dedupe
- **`import_logs`**: cada execução grava 1 linha de auditoria (clinicId,
  userId, kind, fileName, fileHash sha-256, rowCount, contadores por
  outcome, mapping serializado).

## Limites

- **5 MB por arquivo** — validado em 3 camadas: cliente (rejeita antes de
  parsear), `express.json({ limit: "5mb" })` global e check de
  `Content-Length` no início da rota POST.
- **5.000 linhas por arquivo** — `maxItems` no OpenAPI + Zod do backend.
  Para volumes maiores, divida em partes.
- **Chunking de DB**: inserts vão em lotes de 100 dentro de uma única
  transação (evita queries gigantes mantendo atomicidade fail-all).

## Templates

`GET /api/import/template/:kind` devolve CSV com cabeçalho + 1 linha de
exemplo (Content-Type `text/csv`). Botão "Modelo CSV" no wizard baixa direto
via `<a download>`.

## Endpoints

- `GET  /api/import/template/{kind}` — autenticado (admin) — downloads do CSV-modelo
- `POST /api/import/{kind}` — `requireRole("admin")`, retorna `ImportReport`

## Onde mexer

- Backend: `artifacts/api-server/src/routes/import.ts`
- Frontend: `artifacts/synvet/src/components/import/ImportWizard.tsx`
  + `pages/configuracoes-importar.tsx`
- Schema: `lib/db/src/schema/import-logs.ts`
- Spec: paths `/import/...` e schemas `RunImportBody`, `ImportRowResult`,
  `ImportReport` em `lib/api-spec/openapi.yaml`

## Out of scope (próxima onda)

- Importar exames, vacinas, prontuários e medicamentos contínuos.
- Conector direto com outros SaaS via API.
- Mapeamento avançado (concatenar `firstName + lastName`, splits, etc.).
- Upload assíncrono com job em background — hoje o request-response cobre o
  limite de 5k linhas em <30s típicos.
