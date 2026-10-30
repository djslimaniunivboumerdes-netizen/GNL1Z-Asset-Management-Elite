# Deployment

Two independent deployables. They do not have to move together, but the
database must lead the Edge Function (see order below).

## 1. Frontend + Pages Functions → Cloudflare Pages

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output | `dist` |
| Node version | 22 |
| Environment | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` for installs |

**Environment variables (Pages → Settings → Environment variables).** Only
`VITE_`-prefixed values reach the browser:

| Name | Client-safe | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | anon/publishable key — safe to expose, protected by RLS |
| `VITE_SUPABASE_PROJECT_ID` | yes | cosmetic |
| `VITE_APP_URL` | yes | canonical origin for OAuth redirects (e.g. `https://gnl1z.pages.dev`) |
| `GEMINI_API_KEY` | **no** | server-side only, used by `/api/ai-agent` |
| `ALLOWED_ORIGIN` | **no** | origin echoed by the Pages Functions; set it in production |

Never create a `VITE_`-prefixed variable whose value is a secret: Vite inlines
every `VITE_*` value into the bundle.

**Deploy:** connect the repo; every push to `main` builds. `.github/workflows/ci.yml`
must be green first — it is validation only, it does not deploy.

**Headers** live in `public/_headers` (CSP, `nosniff`, `X-Frame-Options`,
Permissions-Policy). Two known items: `script-src 'unsafe-eval'` and a stale
`api.anthropic.com` entry in `connect-src` (accepted risk R-03).

## 2. Supabase

```bash
# one time per machine
supabase login
supabase link --project-ref <ref>        # config.toml deliberately pins nothing

# migrations, in filename order
supabase db push

# secrets (server-side only)
supabase secrets set GEMINI_API_KEY=...
supabase secrets set ALLOWED_ORIGIN=https://your-origin.pages.dev

# functions
supabase functions deploy detect-dcs-instruments
```

**Order for this release**

1. `supabase db push` — applies, in filename order:

   | Migration | What it does |
   |---|---|
   | `…20261030000001_security_rls_hardening.sql` | `app_role` enum, role helpers, least-privilege RLS on every table, maintenance lifecycle, append-only audit log, rate limiter, `engineering_documents` |
   | `…20261030000002_storage_buckets_and_policies.sql` | declares the four buckets with size/MIME limits and their policies |
   | `…20261030000003_two_tier_access_model.sql` | administrator manages official data and documents; every plant user creates alerts and maintenance records; auditor reads only |
2. `supabase functions deploy detect-dcs-instruments`.
3. Deploy the frontend (it works before or after — signed URLs fall back to
   public URLs — but the fallback is only needed until step 1 lands).
4. Sign in as an administrator and review `profiles.role_key` (the backfill is a
   heuristic over the legacy free-text `role`). **Do not skip this**: with the
   two-tier model, whoever holds `administrator` is the only person who can
   amend the test-date register, manage documents and approve maintenance
   records.

**Auth configuration** (dashboard): add every origin that must sign in to
`uri_allow_list` — production, `*.pages.dev`, and any preview host — and remove
the stale ones. `disable_signup` and `password_min_length` are unchanged from
their current values and need your authorisation to modify.

## Rollback

| Component | Rollback |
|---|---|
| Frontend | Cloudflare Pages → Deployments → Roll back to previous deployment |
| Edge Function | `supabase functions deploy` the previous version from git |
| Migrations | Run the commented `ROLLBACK` block in each migration. It restores the previous permissive policies; it does not drop tables or columns. **Take a snapshot first:** Dashboard → Database → Backups, or `supabase db dump -f backup.sql` |

Neither migration deletes data, so no restore is required to move backwards —
but a snapshot before touching a live database is cheap insurance.

## Health checks after release

- `GET /health` → `{"status":"ok","app":"GNL1Z Asset Management"}`
- Sign in survives a hard reload.
- `/pids` opens a drawing; the assistant answers an equipment question and cites
  a source.
- Instrument detection: signed in → works; signed out → clear "Sign in required".
- Photos render (signed URL) and upload to `<tag>/<user_id>/…`.

## Environments

| Role | Project ref | Name | State |
|---|---|---|---|
| Production | `gdkqetzkhgllwbpmqmux` | *(unchanged)* | ACTIVE_HEALTHY, PG 17.6.1.121 |
| Staging | `nwcpfsqsdjezkwkhxrqx` | `gnl1z-staging` | ACTIVE_HEALTHY, PG 17.6 — restored 2026-10-30 |
| Dormant / unused | `kdfwqpnfrkmpsnwhtqjy`, `tsxpfvfnstcmumoxdpgd` | — | untouched |

### Staging (`nwcpfsqsdjezkwkhxrqx`) — what was done to it

It was one of the account's dormant projects; nothing of yours was deleted or
purged to prepare it. On 2026-10-30 it was restored and brought to the same
schema as the repository:

1. All **11 migrations** in `supabase/migrations/` applied, in filename order.
2. Verified on the live database: **RLS enabled on 13/13 public tables**, 2
   intentional `true` policies, 4 storage buckets with size/MIME limits,
   `consume_rate_limit('staging-probe', 2, '1 minute')` → `true, true, false`,
   maintenance lifecycle transitions DRAFT→SUBMITTED accepted and
   SUBMITTED→APPROVED / SUBMITTED→CLOSED rejected with no audit rows.
3. Two defects the migrations missed were found there and fixed in the
   migration files (**S-05** `TRUNCATE` held by `anon`/`authenticated`,
   **S-06** `anon` holding INSERT/UPDATE/DELETE on every application table).

Auth on staging differs from production **on purpose**, so test users can be
created without a mail server:

| Setting | Staging | Production | Why |
|---|---|---|---|
| `site_url` | `http://localhost:8081` | production origin | local dev server |
| `mailer_autoconfirm` | `true` | `false` | no SMTP configured; test users confirm instantly |
| `disable_signup` | `false` | `true` | staging needs self-service test accounts |
| `uri_allow_list` | localhost:8081/5173, `8081-*.e2b.app`, `*.pages.dev` | production origins only | previews and local dev |

**Keep those four settings off production.** `mailer_autoconfirm: true` on a
project with real users would let anyone confirm an account for an address they
do not own.

### Pointing the app at staging

```bash
# .env.local — never commit it (scripts/check-secrets.mjs fails CI if you do)
VITE_SUPABASE_URL=https://nwcpfsqsdjezkwkhxrqx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<staging publishable/anon key>   # Dashboard → Project Settings → API
VITE_ALLOWED_ORIGIN=http://localhost:8081
```

Restart the dev server after changing these; Vite only reads env at boot.

### Migration history is empty on staging — expected

The migrations were applied through the SQL API, which does not write to the
migration bookkeeping table, so `supabase db push` on staging would re-apply
them from the beginning. Every migration is idempotent (`if not exists`,
`drop policy if exists`, `DO` blocks, `add column if not exists`), so a re-run is
safe, but run `supabase db push --dry-run` first if you would rather see the
plan. Production is untouched: **no migration has been applied to
`gdkqetzkhgllwbpmqmux`.**

### Cost

Staging is currently **running**. Two active projects fit the free plan; if you
would rather not pay for idle capacity, pause it from the dashboard (or say the
word and it can be paused for you) — restoration takes a couple of minutes and
nothing is lost.
