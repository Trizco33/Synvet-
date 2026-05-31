# Plano de Migração — Synvet para Railway + Vercel + Supabase

**Versão:** 1.0  
**Data:** 2026-05-31  
**Objetivo:** Mover o Synvet do Replit para infraestrutura própria sem perda de dados e com janela de indisponibilidade mínima (< 15 min).  
**Princípio:** Nenhum banco ou dado é apagado sem confirmação explícita.

---

## Inventário atual

| Tabela | Linhas |
|---|---|
| anamneses | 1 |
| clinics | 5 |
| comms_automations | 0 |
| comms_channels | 0 |
| comms_jobs | 0 |
| comms_messages | 0 |
| comms_templates | 0 |
| consultations | 5 |
| copilot_conversations | 0 |
| copilot_messages | 0 |
| email_sends | 0 |
| exams | 7 |
| import_logs | 21 |
| leads | 1 |
| medical_records | 2 |
| pets | 5 |
| platform_admins | 0 |
| prescriptions | 0 |
| stripe_events | 0 |
| tutors | 11 |
| users | 2 |
| vaccines | 4 |
| weigh_ins | 0 |

**Total: 23 tabelas, ~70 linhas de dados reais.**

---

## Pré-requisitos

Antes de começar, tenha em mãos:

- [ ] Acesso ao painel do Replit (para ler `DATABASE_URL`)
- [ ] Conta no [Railway](https://railway.app) com billing configurado
- [ ] Conta na [Vercel](https://vercel.com)
- [ ] Projeto Supabase existente com Auth e Storage já configurados
- [ ] `psql` instalado localmente (ou acesso ao Supabase SQL Editor)
- [ ] `pg_dump` instalado localmente (vem junto com PostgreSQL)
- [ ] Repositório do Synvet no GitHub (push do Replit → GitHub)

---

## Fase 0 — Preparação (sem downtime)

### 0.1 — Subir o código para o GitHub

No Replit:
1. Clique em **Version Control** (ícone de branch na barra lateral)
2. Conecte ao GitHub (se ainda não estiver conectado)
3. Faça commit de tudo e push para a branch `main`

### 0.2 — Obter a DATABASE_URL do Replit

No Replit, vá em **Secrets** (cadeado na barra lateral) e copie o valor de `DATABASE_URL`.  
Formato esperado: `postgresql://user:senha@host:5432/banco`  
Guarde — será usada apenas para exportação. **Não compartilhe publicamente.**

### 0.3 — Obter a string de conexão do Supabase

No painel do Supabase:
1. **Settings → Database → Connection string → URI**
2. Copie a URI e substitua `[YOUR-PASSWORD]` pela senha do banco
3. Adicione `?sslmode=require` no final se não estiver presente
4. Formato: `postgresql://postgres:[senha]@db.[ref].supabase.co:5432/postgres?sslmode=require`

Guarde como `SUPABASE_DB_URL` — será usada nas próximas etapas.

---

## Fase 1 — Exportar dados do Replit

Execute **localmente** (ou em qualquer máquina com acesso à internet):

```bash
# Substitua pela DATABASE_URL real do Replit
export REPLIT_DB="postgresql://user:senha@host:5432/banco"

# 1. Exportar schema completo (para referência — não será importado diretamente)
pg_dump "$REPLIT_DB" \
  --schema-only \
  --no-owner \
  --no-acl \
  -f backup_schema_$(date +%Y%m%d_%H%M).sql

# 2. Exportar dados (INSERT statements, sem DDL)
pg_dump "$REPLIT_DB" \
  --data-only \
  --no-owner \
  --no-acl \
  --disable-triggers \
  --column-inserts \
  -f backup_data_$(date +%Y%m%d_%H%M).sql

echo "✓ Backup concluído. Guarde os dois arquivos .sql em local seguro."
```

> **Guarde os dois arquivos em local seguro** (Google Drive, S3, e-mail criptografado).  
> Eles são seu parachute caso algo dê errado.

---

## Fase 2 — Criar schema no Supabase

O schema **não** será importado do dump — será criado pelo Drizzle para garantir que está 100% sincronizado com o código atual.

```bash
# Substitua pela string de conexão do Supabase obtida no passo 0.3
export SUPABASE_DB_URL="postgresql://postgres:[senha]@db.[ref].supabase.co:5432/postgres?sslmode=require"

# Aplicar o schema via Drizzle (cria todas as 23 tabelas)
DATABASE_URL="$SUPABASE_DB_URL" pnpm --filter @workspace/db run push
```

Responda `yes` para todas as confirmações.

**Verificar que as tabelas foram criadas:**

```bash
psql "$SUPABASE_DB_URL" -c "\dt public.*"
```

Deve listar as 23 tabelas.

---

## Fase 3 — Importar dados para o Supabase

```bash
# Importar os dados exportados do Replit para o Supabase
psql "$SUPABASE_DB_URL" \
  --single-transaction \
  -f backup_data_YYYYMMDD_HHMM.sql

# Verificar contagens (deve bater com o inventário acima)
psql "$SUPABASE_DB_URL" -c "
  SELECT relname AS tabela, n_live_tup AS linhas
  FROM pg_stat_user_tables
  ORDER BY relname;
"
```

> Se aparecer erro de FK (chave estrangeira), use a opção `--disable-triggers` ao importar:
> ```bash
> psql "$SUPABASE_DB_URL" -c "SET session_replication_role = replica;"
> psql "$SUPABASE_DB_URL" -f backup_data_YYYYMMDD_HHMM.sql
> psql "$SUPABASE_DB_URL" -c "SET session_replication_role = DEFAULT;"
> ```

---

## Fase 4 — Configurar Railway (backend)

### 4.1 — Criar o projeto

1. Acesse [railway.app](https://railway.app) → **New Project**
2. Escolha **Deploy from GitHub repo**
3. Selecione o repositório do Synvet
4. O Railway detecta o `Dockerfile` em `artifacts/api-server/` automaticamente

> Se não detectar: vá em **Settings → Build** e defina  
> `Dockerfile Path: artifacts/api-server/Dockerfile`

### 4.2 — Variáveis de ambiente no Railway

Acesse **Variables** no painel do serviço e adicione:

```
# Core
NODE_ENV=production

# Banco — Supabase Postgres
DATABASE_URL=postgresql://postgres:[senha]@db.[ref].supabase.co:5432/postgres?sslmode=require

# Supabase Auth + Storage
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service_role_key_do_painel_supabase]

# Segurança
SESSION_SECRET=[string_aleatoria_64_chars]
# Para gerar: openssl rand -hex 32

# CORS — será preenchido após criar o projeto na Vercel
# Formato: domínios separados por vírgula, SEM barra no final
ALLOWED_ORIGINS=https://synvet.app.br,https://www.synvet.app.br,https://synvet.vercel.app

# App
APP_URL=https://synvet.app.br

# Back-office
SUPERADMIN_EMAIL=[seu-email@dominio.com]

# Stripe (copiar do painel Stripe → Developers → API Keys)
STRIPE_PRICE_ESSENCIAL=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_CLINIC_PLUS=price_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx  # após configurar webhook (Fase 6)

# E-mail
RESEND_API_KEY=[chave_do_painel_resend]
EMAIL_FROM=Synvet <ola@synvet.app.br>
EMAIL_PROVIDER=resend
```

### 4.3 — Anotar a URL pública do Railway

Após o primeiro deploy bem-sucedido, o Railway gera uma URL como:  
`https://synvet-api-production.up.railway.app`

Anote — será a `VITE_API_URL` da Vercel.

---

## Fase 5 — Configurar Vercel (frontend)

### 5.1 — Criar o projeto

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório do GitHub

**Configurações de build:**

| Campo | Valor |
|---|---|
| Root Directory | *(deixar em branco — raiz do monorepo)* |
| Framework Preset | Vite |
| Build Command | `pnpm --filter @workspace/synvet run build` |
| Output Directory | `artifacts/synvet/dist/public` |
| Install Command | `pnpm install --frozen-lockfile` |

### 5.2 — Variáveis de ambiente na Vercel

```
VITE_SUPABASE_URL=https://[ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon_key_do_painel_supabase]
VITE_API_URL=https://synvet-api-production.up.railway.app
```

> As variáveis com prefixo `VITE_` são incorporadas no bundle durante o build —  
> sempre re-faça o deploy após alterá-las.

### 5.3 — Domínio custom na Vercel (synvet.app.br)

1. Na Vercel → **Settings → Domains**
2. Adicione `synvet.app.br` e `www.synvet.app.br`
3. A Vercel mostrará os registros DNS para configurar (próxima fase)

---

## Fase 6 — Domínio synvet.app.br

### 6.1 — Configurar DNS (no seu registrador/provedor)

Acesse o painel DNS do domínio (ex.: Registro.br, Cloudflare, GoDaddy) e adicione:

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `@` (raiz) | IP fornecido pela Vercel | 300 |
| CNAME | `www` | `cname.vercel-dns.com` | 300 |
| CNAME | `api` | `synvet-api-production.up.railway.app` | 300 |

> Os valores exatos de IP/CNAME serão exibidos pelo painel da Vercel após adicionar o domínio.  
> Se usar Cloudflare, mantenha proxy (nuvem laranja) desativado (cinza) inicialmente para validação.

### 6.2 — Atualizar variáveis após DNS propagar

**Railway — atualizar ALLOWED_ORIGINS e APP_URL:**
```
ALLOWED_ORIGINS=https://synvet.app.br,https://www.synvet.app.br
APP_URL=https://synvet.app.br
```

**Vercel — não precisa alterar** (o domínio custom é configurado no painel, não em env vars)

### 6.3 — Supabase — Redirect URLs

1. Painel Supabase → **Authentication → URL Configuration**
2. **Site URL**: `https://synvet.app.br`
3. **Redirect URLs** (adicionar todas):
   ```
   https://synvet.app.br/**
   https://www.synvet.app.br/**
   https://synvet.vercel.app/**
   ```

---

## Fase 7 — Stripe

### 7.1 — Atualizar webhook

1. Painel Stripe → **Developers → Webhooks**
2. Se já existe um endpoint apontando para o Replit, **edite** (não delete) a URL para:  
   `https://synvet.app.br/api/billing/webhook`  
   (ou a URL do Railway se o domínio ainda não estiver propagado)
3. Copie o **Signing secret** (`whsec_...`) e coloque em `STRIPE_WEBHOOK_SECRET` no Railway

**Eventos que o webhook precisa receber:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 7.2 — Verificar modo (Test vs Live)

- Certifique-se de que as `STRIPE_PRICE_*` são Price IDs do **modo Live** (começam com `price_`)
- O `STRIPE_WEBHOOK_SECRET` deve ser do endpoint Live

---

## Fase 8 — Resend (e-mails transacionais)

1. Painel [Resend](https://resend.com) → **Domains** → verifique se `synvet.app.br` está verificado
2. Se não estiver, adicione o domínio e configure os registros DNS (SPF, DKIM, DMARC)  
   que o Resend fornece no painel
3. `EMAIL_FROM` no Railway: `Synvet <ola@synvet.app.br>` (usando o domínio verificado)

---

## Fase 9 — Validação antes do go-live

Execute estes testes **antes** de apontar o DNS para a nova infraestrutura:

```bash
# 1. Health check do backend Railway
curl -s https://synvet-api-production.up.railway.app/api/healthz | jq .

# 2. Verificar conexão com o banco
curl -s https://synvet-api-production.up.railway.app/api/healthz

# 3. Testar signup (cria clínica nova no Supabase)
curl -s -X POST https://synvet-api-production.up.railway.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"teste-migr@synvet.app","password":"Teste@123","name":"Teste Migr","clinicName":"Clínica Teste Migração"}' | jq .

# 4. Frontend (via preview Vercel — antes de apontar DNS)
# Acesse a URL de preview da Vercel e verifique:
# - Login funciona
# - Dashboard carrega
# - Pacientes, tutores, consultas visíveis
# - Upload de exame funciona
# - /admin acessível com superadmin
```

**Checklist de validação:**

- [ ] `/api/healthz` retorna `{ "status": "ok" }`
- [ ] Login com conta existente funciona
- [ ] Dados aparecem (tutores, pets, consultas do banco migrado)
- [ ] Novo cadastro cria clínica em trial 14d
- [ ] Upload de arquivo (exame) funciona via Supabase Storage
- [ ] /admin carrega para o superadmin
- [ ] Stripe checkout não retorna 503 (se price IDs configurados)
- [ ] E-mail de boas-vindas chega (teste via signup)

---

## Fase 10 — Go-live (janela de ~10 min)

Esta é a única fase com downtime perceptível.

1. **Congelar escritas no Replit** (opcional mas ideal): se houver usuários reais ativos,
   avise que o sistema ficará em manutenção por ~10 min
2. **Exportar dados finais** (repetir Fase 1 com `pg_dump`) para capturar qualquer write
   que aconteceu após a exportação inicial
3. **Importar o delta** (linhas novas desde a primeira importação) no Supabase
4. **Apontar DNS** para a Vercel (TTL baixo — 300s — propaga em ~5 min)
5. **Validar** com os testes da Fase 9

---

## Rollback

Se algo der errado após o go-live:

1. Reverta o DNS para apontar de volta para o Replit (leva ~5 min para TTL baixo)
2. O banco do Replit **não foi apagado** — tudo ainda está lá
3. Investigue o problema com calma antes de tentar novamente

> **Nenhum dado do Replit será apagado durante este processo.**  
> O banco do Replit permanece intacto até você decidir explicitamente desativá-lo.

---

## Variáveis de ambiente — referência completa

### Railway (backend)

| Variável | Onde obter |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → URI |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | Domínios da Vercel e domínio custom (vírgula) |
| `APP_URL` | `https://synvet.app.br` |
| `SUPERADMIN_EMAIL` | Seu e-mail |
| `STRIPE_PRICE_ESSENCIAL` | Stripe Dashboard → Products → Essencial → Price ID |
| `STRIPE_PRICE_PRO` | Stripe Dashboard → Products → Pro → Price ID |
| `STRIPE_PRICE_CLINIC_PLUS` | Stripe Dashboard → Products → Clínica+ → Price ID |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → Signing secret |
| `RESEND_API_KEY` | Resend → API Keys |
| `EMAIL_FROM` | `Synvet <ola@synvet.app.br>` |
| `NODE_ENV` | `production` |

### Vercel (frontend)

| Variável | Onde obter |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `VITE_API_URL` | URL pública do Railway |

---

## Estimativa de tempo

| Fase | Tempo estimado |
|---|---|
| 0 — Preparação | 30 min |
| 1 — Exportar dados | 5 min |
| 2 — Schema no Supabase | 5 min |
| 3 — Importar dados | 5 min |
| 4 — Configurar Railway | 20 min |
| 5 — Configurar Vercel | 15 min |
| 6 — Domínio DNS | 10 min (+ propagação) |
| 7 — Stripe webhook | 10 min |
| 8 — Resend DNS | 10 min (+ propagação) |
| 9 — Validação | 15 min |
| 10 — Go-live | 10 min |
| **Total** | **~2h (+ propagação DNS)** |

DNS propaga em 5–60 min com TTL 300. Configure TTL baixo com antecedência se possível.

---

## Suporte e contatos úteis

- Railway docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- Supabase docs: https://supabase.com/docs
- Resend docs: https://resend.com/docs
- Registro.br (DNS BR): https://registro.br
