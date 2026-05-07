# Deploy do Synvet

Fluxo profissional: **Replit (dev) → GitHub (versionamento) → Replit Deployments (produção) → synvet.app.br (domínio)**.

---

## 1. Versionamento com GitHub

O Replit permite conectar este projeto a um repositório GitHub e sincroniza
commits automaticamente em ambos os sentidos.

### 1.1. Conectar pela primeira vez

1. No painel lateral do Replit, abra a aba **Git** (ícone de branch)
2. Clique em **Connect to GitHub**
3. Autorize o Replit a acessar sua conta
4. Crie um repositório novo (recomendado: **privado**, nome `synvet`) ou conecte a um existente vazio
5. O Replit faz o primeiro push automaticamente

### 1.2. Workflow do dia a dia

- **Commit**: aba Git → digite mensagem → **Commit & push**
- **Pull**: aba Git → **Pull** (se editou via GitHub web/outra máquina)
- **Branch**: para features grandes, criar branch via GitHub e abrir PR

### 1.3. O que NÃO vai para o GitHub

Já configurado em [`.gitignore`](./.gitignore):

- `node_modules/`, `dist/`, `.cache/`
- Qualquer arquivo `.env`, `.env.local`, `.env.production`
- Pastas internas do agente Replit (`.local/`, `.agents/`)
- Logs e arquivos temporários

> **Importante**: nunca colocar valores de produção em arquivos commitados.
> Use sempre Secrets do Replit ou Deployment Secrets.

---

## 2. Publicar (Replit Deployments)

O projeto já está configurado em `.replit` como **autoscale** — escala
automaticamente conforme tráfego e cobra apenas pelo uso.

### 2.1. Antes do primeiro publish

Garanta que estas variáveis estão definidas em **Deployment Secrets** (NÃO em
Workspace Secrets — são contextos diferentes):

| Secret | Origem | Tipo |
|---|---|---|
| `DATABASE_URL` | Postgres provisionado | servidor |
| `SESSION_SECRET` | gerado com `openssl rand -base64 48` | servidor |
| `SUPABASE_URL` | dashboard Supabase | servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | dashboard Supabase (`sb_secret_…`) | servidor |
| `VITE_SUPABASE_URL` | dashboard Supabase | bundle |
| `VITE_SUPABASE_ANON_KEY` | dashboard Supabase (`sb_publishable_…`) | bundle |
| `NODE_ENV` | `production` | servidor |

> Em produção, sem `SUPABASE_*` o backend retorna `401` (modo demo bloqueado).
> Não defina `ALLOW_DEMO_AUTH` em produção.

### 2.2. Publicar

1. Botão **Publish** no topo do Replit
2. Confirme **Autoscale**
3. Confirme as Deployment Secrets
4. Clique em **Publish**
5. Aguarde o build (~2 min) — você recebe uma URL `synvet-XXXX.replit.app`

### 2.3. Re-deploy automático após push no GitHub

1. Após o primeiro publish, abra **Settings → Deployments → Source**
2. Ative **Auto-deploy on push** apontando para `main`
3. A partir daí, todo `git push` para `main` dispara um novo build em produção

> **Recomendado**: use branches + PR. Faça merge para `main` apenas quando
> validar a feature em dev. Isso evita quebrar produção em pushes diretos.

---

## 3. Domínio próprio: `synvet.app.br`

### 3.1. Vincular no Replit

1. App publicado → **Settings → Custom Domains → Link a domain**
2. Cole `synvet.app.br` (e opcionalmente `www.synvet.app.br`)
3. O Replit mostra dois registros: um `A` (root) e um `TXT` (verificação)

### 3.2. Configurar DNS no Registro.br

1. Painel do Registro.br → seu domínio → **DNS**
2. Adicione exatamente os registros que o Replit mostrou:
   - `A` — nome `@`, valor IP fornecido pelo Replit
   - `TXT` — nome `_replit-verify` (ou conforme indicado), valor token fornecido
3. Se quiser também `www`:
   - `CNAME` — nome `www`, valor `synvet-XXXX.replit.app`

### 3.3. Aguardar e verificar

- Propagação DNS: 5 min a algumas horas (pode ser mais com Registro.br)
- Quando o painel do Replit marcar **Verified**, o TLS é provisionado
  automaticamente em ~1 minuto
- Acesse `https://synvet.app.br` — deve carregar o app

### 3.4. Gotchas com `.app.br`

- TLD `.app` (do Google) força HSTS preload — só funciona em HTTPS. O Replit
  já entrega TLS automático, mas qualquer link `http://` redireciona.
- Registro.br suporta DNSSEC opcional. Se ativar, valide que os registros
  ainda resolvem após a propagação.

---

## 4. Fluxo completo (resumo visual)

```
[Replit Workspace]  ←→  [GitHub repo synvet]
       │                       │
       │ git push              │ webhook
       ▼                       ▼
[Replit Deployments build]  ──→  [Autoscale produção]
                                       │
                                       ▼
                              https://synvet.app.br
                                  (TLS automático)
```

---

## 5. Verificação pós-deploy

Checklist após cada publish:

- [ ] `https://synvet.app.br/api/healthz` retorna `{"status":"ok"}`
- [ ] Tela de login carrega o tema dark sem flash branco
- [ ] Login real (Supabase) funciona — sem aviso de modo demo
- [ ] Upload de exame conclui e link permanece acessível após reload
- [ ] Logs em **Deployments → Logs** sem stack traces ou 500s
- [ ] PWA: ícone aparece ao "Adicionar à tela inicial" no celular

---

## 6. Operação contínua

| Necessidade | Onde |
|---|---|
| Logs de produção | painel Deployments → Logs (ou `fetchDeploymentLogs` via skill) |
| Reverter deploy | Deployments → histórico → **Rollback** |
| Migrar schema do banco | `pnpm --filter @workspace/db run push` em dev, validar, depois publish (a coluna nova vai junto) |
| Rotacionar `SUPABASE_SERVICE_ROLE_KEY` | gerar nova no Supabase → atualizar Deployment Secret → re-publish |
| Backup do Postgres | provisionar Supabase Postgres ou Neon como destino futuro (próximo passo) |

---

## 7. Próximos passos (escala)

Quando o tráfego justificar:

1. **Backups do Postgres**: migrar de Replit Postgres para Supabase Postgres
   ou Neon (ambos com PITR e snapshot diário). Trocar apenas `DATABASE_URL`.
2. **Observabilidade**: integrar Sentry para erros do frontend e backend
3. **Rate limiting**: adicionar `express-rate-limit` em endpoints sensíveis
   (`/api/storage/exams/signed-upload`, `/api/auth/*`)
4. **Helmet**: headers de segurança HTTP (`X-Frame-Options`, CSP)
5. **CDN**: imagens e assets estáticos via Cloudflare na frente do domínio
6. **CI no GitHub**: GitHub Actions para `pnpm typecheck` em PRs
   antes de mergear
