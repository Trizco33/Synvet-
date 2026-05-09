# Back-office Synvet (`/admin`)

Console interno para o time da Synvet acompanhar a plataforma. É **separado**
do RBAC por clínica (`admin | vet | assistant`): superadmins não pertencem a
uma clínica e não enxergam dados clínicos individuais — apenas agregados.

## Quem é superadmin

- Tabela `platform_admins` (PK = `auth_id` do Supabase, e-mail e nome).
- Variável `SUPERADMIN_EMAIL` (CSV opcional) é lida no boot do servidor
  (`artifacts/api-server/src/lib/seed-platform-admins.ts`):
  - Se o e-mail já existe no Supabase Auth, é inserido com o `auth_id` real.
  - Caso contrário, é gravado como `pending:<email>` e promovido na primeira
    vez que esse usuário fizer login (ver `promoteIfPendingSuperAdmin` em
    `middlewares/auth.ts`).
- Para revogar acesso, basta remover a linha em `platform_admins`.

## Stack de auth

- Middleware próprio: `artifacts/api-server/src/middlewares/super-admin.ts`.
  Ele faz JWT verify direto no Supabase + lookup em `platform_admins`. **Não
  resolve `clinicId`**, então o tenant middleware (`authMiddleware`) nunca é
  chamado para essas rotas.
- `routes/admin.ts` é montado em `routes/index.ts` **antes** do
  `authMiddleware` para evitar a tentativa de criar clínica para um
  superadmin que ainda não tem uma.

## Endpoints

| Verbo | Caminho                       | Resposta                           |
| ----- | ----------------------------- | ---------------------------------- |
| GET   | `/api/admin/me`               | `{ authId, email, name }` (200/403)|
| GET   | `/api/admin/clinics`          | Lista resumida com plano, status, contagens |
| GET   | `/api/admin/leads`            | Últimos 500 leads do site          |
| PATCH | `/api/admin/leads/:leadId`    | Atualiza `status` do lead          |
| GET   | `/api/admin/metrics`          | Agregados (clínicas, usuários, leads, signups da semana) |

Schemas OpenAPI: `AdminMeResponse`, `AdminClinicSummary`, `AdminLead`,
`UpdateAdminLeadBody`, `AdminMetrics` em `lib/api-spec/openapi.yaml`.

## Frontend

- Hook `useSuperAdmin()` (`hooks/use-super-admin.tsx`) chama `getAdminMe`;
  se 200 → `isSuperAdmin = true`, se 403 → false (sem retry).
- `<ProtectedAdminRoute>` em `App.tsx` redireciona não-superadmins para
  `/app` e não-autenticados para `/login`.
- Shell: `components/admin/AdminLayout.tsx` (header escuro "Synvet ·
  Back-office", sidebar Clínicas / Leads / Métricas).
- Páginas: `pages/admin/clinicas.tsx`, `pages/admin/leads.tsx`,
  `pages/admin/metricas.tsx`. `pages/admin/index.tsx` redireciona para
  `/admin/clinicas`.

## Seed em desenvolvimento

Sem `SUPERADMIN_EMAIL` o boot não cria superadmins automaticamente. Para
testar localmente sem Supabase real:

```bash
psql "$DATABASE_URL" -c "INSERT INTO platform_admins(auth_id, email) \
  VALUES ('demo-user', 'admin@synvet.app') ON CONFLICT DO NOTHING;"
```

`demo-user` é o `auth_id` usado pelo bypass de demo do `authMiddleware`.

## Próximos passos

- Filtros e busca nas tabelas (estado vem direto do servidor sem paginação
  por enquanto).
- Detalhe da clínica com timeline de eventos de billing.
- Ações: suspender clínica manualmente, conceder extensão de trial.
- Gráficos de coorte/retenção quando o volume justificar.
