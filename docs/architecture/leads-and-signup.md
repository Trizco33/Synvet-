# Leads (site institucional) & Auth signup

## Leads

- `POST /leads` (público, antes do `authMiddleware`) grava em `leads` (id, name,
  email, phone?, clinicName?, role?, message?, source default `landing`,
  status default `new`).
- Rate limit: 20 req/h por IP via `leadsLimiter`.
- Validação Zod via `schemas.CreateLeadBody` (gerado pelo OpenAPI).
- Notificação por email é TODO (sem SMTP/Resend agora — ler `leads.created_at`
  periodicamente ou plugar webhook depois).
- Frontend: `<LeadForm/>` chama `createLead()` (função fetch gerada), Toast de
  sucesso/erro, `source` identifica origem (`landing-cta`, `landing-final-cta`, etc).

## Auth signup

- `POST /auth/signup` (público, antes do `authMiddleware`) cria usuário no Supabase com
  `email_confirm: true` e, em transação, cria `clinics` + `users` (role `admin`) no
  Postgres.
- Compensação: se o INSERT falha após Supabase criar o usuário, chama
  `supabase.auth.admin.deleteUser` para evitar conta órfã.
- Rate limit: 10 req/h por IP via `signupLimiter` em `routes/auth.ts`.
- Frontend (`pages/login.tsx`): após `signupUser`, faz `signInWithPassword` automático
  e redireciona pra `/`.
- Cadastro unificado em `/pacientes`: dialog "Novo Paciente" cria tutor + pet
  sequencialmente; rollback do tutor via `deleteTutor` se o pet falhar (best-effort).
