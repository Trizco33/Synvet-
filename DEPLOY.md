# Deploy do Synvet — Railway + Vercel + Supabase

Guia passo a passo para hospedar o Synvet completamente fora do Replit.

## Arquitetura de produção

```
Usuário → Vercel (Frontend React/Vite)
              ↓ fetch para VITE_API_URL
          Railway (Backend Express)
              ↓ DATABASE_URL
          Supabase Postgres
              ↓ Auth JWT / Storage
          Supabase (Auth + Storage)
```

---

## 1. Preparar o repositório

O Railway e a Vercel precisam de acesso ao código. Duas opções:

**Opção A — GitHub (recomendado):**
1. Crie um repositório no GitHub
2. No Replit, clique em **Version Control** → conecte ao GitHub e faça push

**Opção B — CLI do Railway/Vercel:**
- Fazer deploy via CLI apontando para a pasta local (não requer GitHub)

---

## 2. Supabase — banco e auth

Você já tem um projeto Supabase. O que precisa:

### 2a. String de conexão do banco (para o Railway)
1. No painel Supabase → **Settings → Database**
2. Em "Connection string", escolha **URI** e copie
3. O formato é: `postgresql://postgres:[senha]@db.[ref].supabase.co:5432/postgres`
4. Adicione `?sslmode=require` no final se não tiver
5. Guarde — essa será a `DATABASE_URL` do Railway

### 2b. Configurar Redirect URLs no Supabase Auth
1. No painel Supabase → **Authentication → URL Configuration**
2. Em **Site URL**, coloque o domínio do Vercel: `https://synvet.vercel.app` (ou seu domínio custom)
3. Em **Redirect URLs**, adicione:
   - `https://synvet.vercel.app/**`
   - `https://seu-dominio.com.br/**` (se tiver domínio próprio)

---

## 3. Railway — backend API

### 3a. Criar serviço
1. Acesse [railway.app](https://railway.app) → **New Project**
2. Escolha **Deploy from GitHub repo** e selecione o repositório
3. O Railway detectará o `Dockerfile` em `artifacts/api-server/`

### 3b. Variáveis de ambiente no Railway

Vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | String de conexão do Supabase Postgres (passo 2a) |
| `SUPABASE_URL` | URL do seu projeto Supabase (ex.: `https://xyzxyz.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key do Supabase (Settings → API) |
| `SESSION_SECRET` | String aleatória longa (ex.: rode `openssl rand -hex 32`) |
| `ALLOWED_ORIGINS` | `https://synvet.vercel.app,https://seu-dominio.com.br` |
| `APP_URL` | `https://synvet.vercel.app` (ou domínio custom) |
| `SUPERADMIN_EMAIL` | Seu e-mail (para acesso ao /admin) |
| `STRIPE_PRICE_ESSENCIAL` | Price ID do plano Essencial no Stripe |
| `STRIPE_PRICE_PRO` | Price ID do plano Pro no Stripe |
| `STRIPE_PRICE_CLINIC_PLUS` | Price ID do plano Clínica+ no Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` do endpoint de webhook Stripe |
| `RESEND_API_KEY` | Chave da API Resend (para e-mails) |
| `EMAIL_FROM` | `Synvet <ola@synvet.app.br>` |

> **Stripe:** configure o endpoint de webhook no Dashboard Stripe apontando para
> `https://seu-servico.up.railway.app/api/billing/webhook`

### 3c. Aplicar schema no banco (primeira vez)
Após o primeiro deploy, rode as migrations no Railway:

```bash
# Via Railway CLI
railway run pnpm --filter @workspace/db run push
```

Ou localmente com a DATABASE_URL do Supabase:
```bash
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
```

### 3d. Anotar a URL do Railway
Após o deploy, o Railway fornece uma URL pública como:
`https://synvet-api-production.up.railway.app`

Guarde-a — será a `VITE_API_URL` do Vercel.

---

## 4. Vercel — frontend

### 4a. Criar projeto
1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório GitHub
3. Configure:
   - **Root Directory**: `artifacts/synvet`
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: deixe em branco (Vercel detecta pnpm)

> **Atenção:** A Vercel precisa do monorepo inteiro para resolver os `workspace:*`.
> Deixe o **Root Directory** em branco na tela de importação e configure o build
> command como:
> ```
> pnpm --filter @workspace/synvet run build
> ```
> E o output directory como `artifacts/synvet/dist/public`.

### 4b. Variáveis de ambiente na Vercel

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xyzxyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key do Supabase (Settings → API) |
| `VITE_API_URL` | URL do Railway (ex.: `https://synvet-api-production.up.railway.app`) |

### 4c. Domínio custom (opcional)
1. Na Vercel → **Domains** → adicione `synvet.app.br` ou seu domínio
2. Configure o DNS conforme instruções da Vercel
3. Atualize `ALLOWED_ORIGINS` no Railway e **Site URL** no Supabase

---

## 5. Checklist final

- [ ] `DATABASE_URL` no Railway aponta para Supabase Postgres
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no Railway
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` na Vercel
- [ ] `VITE_API_URL` na Vercel aponta para a URL do Railway
- [ ] `ALLOWED_ORIGINS` no Railway inclui o domínio da Vercel
- [ ] **Redirect URLs** no Supabase Auth incluem o domínio Vercel
- [ ] Schema do banco aplicado (`pnpm --filter @workspace/db run push`)
- [ ] Webhook Stripe configurado apontando para Railway `/api/billing/webhook`
- [ ] `SUPERADMIN_EMAIL` definido no Railway

---

## Variáveis que NÃO precisam ir para produção

- `COMMS_PROVIDER` — default `mock` já funciona
- `ALLOW_DEMO_AUTH` — nunca habilitar em produção
- Nenhuma variável `REPL_*` — código ignora em produção

---

## Atualizar depois de mudanças no código

- **Railway**: redeploy automático a cada push na branch configurada
- **Vercel**: redeploy automático a cada push
- **Schema do banco**: se tiver novas colunas/tabelas, rode `pnpm --filter @workspace/db run push` com a DATABASE_URL de produção antes ou logo após o deploy
