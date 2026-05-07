# Política de Segurança — Synvet

## Reportar uma vulnerabilidade

Encontrou um problema de segurança? Por favor, **não abra issue público**.

Envie um email descrevendo o problema, passos para reproduzir e impacto
estimado para o responsável do projeto. Resposta em até 72 horas úteis.

## Modelo de ameaça resumido

Synvet é multi-tenant; o ataque mais grave seria **vazamento cross-tenant**
(uma clínica acessar dados de outra). Toda mudança crítica deve ser revisada
sob essa lente.

## Garantias atuais

### Autenticação

- JWT do Supabase verificado server-side com `SUPABASE_SERVICE_ROLE_KEY` em todo request autenticado
- Em produção (`NODE_ENV=production`), modo demo é bloqueado (retorna `401`); reativar exige `ALLOW_DEMO_AUTH=true` explícito
- O `clinicId` é resolvido a partir do `users.clinic_id` no Postgres, **nunca** de claims do JWT — atacante que forge claims customizados não consegue cross-tenant

### Multi-tenancy

- Toda tabela de domínio tem coluna `clinic_id`
- Toda query filtra por `eq(table.clinicId, user.clinicId)` — convenção verificada por code review
- Foreign keys com `ON DELETE CASCADE` para `clinics` garantem isolamento na exclusão

### RBAC

- Enum `users.role` = `admin | vet | assistant`
- Middleware `requireRole(...roles)` em rotas mutativas (consultations, exams, team)
- `admin` não pode rebaixar a si mesmo (evita lock-out)
- Frontend usa `usePermissions()` apenas para esconder UI; **toda autorização real é no backend**

### Storage de exames (Supabase)

- Bucket `exams` é **privado**
- Path no formato `<clinicId>/<uuid>.<ext>` — força tenancy via convenção de chave
- `POST /storage/exams/signed-upload` valida MIME (PDF, PNG, JPEG, WEBP, GIF)
- `POST /exams` valida que `filePath` começa com `<clinicId>/` (recusa 403 se não)
- Bucket tem `file_size_limit = 15 MB` enforced server-side (configurado no boot via `ensureExamsBucket`)
- URLs assinadas têm TTL de 1h, geradas sob demanda a cada read — não há URL persistida que fique exposta

### Auditoria

- Todas as tabelas têm `created_by`, `created_at`, `updated_at` populados pelo backend
- Logs estruturados via `pino` com request ID, método, URL e status — disponíveis em produção via Replit Deployments

### Segredos

- `.gitignore` proíbe commit de `.env*` (exceto `.env.example` que só tem placeholders)
- Chave `sb_secret_*` (service role) **nunca** em variável `VITE_*` — vazaria no bundle
- Chave `sb_publishable_*` (anon) é a única exposta no cliente
- `SESSION_SECRET` deve ter ≥32 bytes aleatórios (gerar com `openssl rand -base64 48`)

## Recomendações pendentes (próximo hardening)

1. **Helmet** — adicionar `app.use(helmet({ contentSecurityPolicy: false }))` para headers seguros (X-Frame-Options, X-Content-Type-Options, etc.)
2. **Rate limiting** — `express-rate-limit` em `/api/storage/exams/signed-upload` e qualquer endpoint que toque Supabase (custo)
3. **CORS allowlist** — hoje `cors()` aceita qualquer origem. Em produção, restringir a `https://synvet.app.br` via variável `ALLOWED_ORIGINS`
4. **Body size limits explícitos** — `express.json({ limit: "1mb" })` para bloquear payloads gigantes
5. **CSP** — Content-Security-Policy específica para o frontend (após mapear todas as origens externas: Supabase, fonts, etc.)
6. **Auditoria de dependências** — rodar `pnpm audit` no CI; integrar Dependabot ou Renovate
7. **Sentry** — captura de erros em produção com contexto de usuário (sem PII sensível)
8. **Backups testados** — validar restore mensal do Postgres
