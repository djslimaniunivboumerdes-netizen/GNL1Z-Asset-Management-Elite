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

1. `supabase db push` (applies `…20261030000001` then `…20261030000002`).
2. `supabase functions deploy detect-dcs-instruments`.
3. Deploy the frontend (it works before or after — signed URLs fall back to
   public URLs — but the fallback is only needed until step 1 lands).
4. Sign in as an administrator and review `profiles.role_key` (the backfill is a
   heuristic over the legacy free-text `role`).

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

There is no staging project today. The four Supabase projects owned by the
account are: `gdkqetzkhgllwbpmqmux` (active, PG 17.6.1.121) and three dormant
projects — `kdfwqpnfrkmpsnwhtqjy`, `tsxpfvfnstcmumoxdpgd`,
`nwcpfsqsdjezkwkhxrqx`. Restoring one as staging is a dashboard operation and
has **not** been done: it changes project state and needs authorisation.
