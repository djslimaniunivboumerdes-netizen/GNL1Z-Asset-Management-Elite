# Production readiness and remaining work

Status: **enhanced release candidate, verified on staging — not deployed to
production.** The front end, offline behaviour and production build are
validated by tests. The full migration set is applied to the staging project
`nwcpfsqsdjezkwkhxrqx`, where the access model, the lifecycle and the audit
trail were exercised with real role impersonation. **Production has not been
touched**: no migration, no data change, no key rotation, no deployment.

## Completed in this release

- Consistent schedule contract; PASS-only advancement; historical tests do not roll back newer passed dates in the form or sync path.
- Honest loading/empty/unavailable/retry states for schedules and alerts.
- Stable client IDs and retry paths for offline logs, equipment photos, and alert observations.
- Authenticated, append-only field-note UI matching the existing note policies; owner-only confirmed photo deletion.
- Responsive equipment register, URL filters/pagination, formula-safe CSV, accessible global search, mobile dialogs, theme fixes, and reduced-motion support.
- Lazy routes, responsive WebP heroes, local fonts, and one generated PWA worker/manifest.
- Bounded same-origin assistant/manual-search endpoints, minimized assistant context, explicit simulated-alarm labeling, and no service-role key in the assistant endpoint.
- Screening-only lifting/insulation guardrails; missing temperature is "not assessed"; out-of-table lifting loads do not receive a capped recommendation.
- CI for locked install, typecheck, lint, tests, secret hygiene and production build.
- P&ID knowledge layer: all 44 drawings pre-extracted once, cited to their sheet, coverage proven by test.

## Security remediation — status

Detail, evidence and accepted risks: `docs/SECURITY.md`. Probe results:
`docs/TESTING.md`.

| Finding | Classification | Status | Evidence |
|---|---|---|---|
| Any user could set `profiles.role = 'admin'` (self-promotion) | vulnerability | **Fixed** | Typed `app_role` enum, column privileges revoked, guard trigger; staging raises "Only an administrator can change a user role." |
| `ai_responses_cache` world-readable and world-writable | vulnerability | **Fixed** | Privileges revoked, policies dropped; `repoHygiene`/`migrations` guard tests |
| `detect-dcs-instruments` unauthenticated, wrote with the service role | vulnerability | **Fixed** | JWT required in `config.toml` and in-function; validation + sanitisation + rate limit unit-tested |
| Any authenticated user could delete fast alerts / update all alerts | vulnerability | **Fixed** | Delete admin-only; update limited to the author or an administrator |
| Maintenance, notes, test dates, photos, DCS detections publicly readable | defect | **Fixed** | Reads require authentication; verified anonymous gets `42501` |
| No maintenance lifecycle | defect | **Fixed** | Trigger-enforced lifecycle; legacy rows marked `IMPORTED`, never `APPROVED` |
| No audit trail | defect | **Fixed** | Append-only `public.audit_log`; 5 rows observed on staging |
| Storage uploads unconstrained | defect | **Fixed** | Bucket size/MIME limits plus policy checks, owner-scoped paths |
| `alert-photos` bucket missing from migrations | defect | **Fixed** | Declared in `20261030000002`; 4 buckets verified on staging |
| `supabase/config.toml` pinned the wrong project | defect | **Fixed** | Left blank; `supabase link` is required |
| `anon`/`authenticated` held `TRUNCATE` on every table (S-05) | defect | **Fixed** | Found only on the live database; revoked, guarded by test |
| `anon` held INSERT/UPDATE/DELETE on every table (S-06) | defect | **Fixed** | `anon` now holds one privilege schema-wide |
| Official equipment data writable by every engineer/technician | defect | **Fixed** | Two-tier model: administrator only (`20261030000003`) |
| Operators could not raise an alert at all | defect | **Fixed** | Two-tier model: every plant user; verified for `operations_viewer` |
| `.env` tracked by git | config | **Fixed, with residue** | Ignored and untracked; **still in git history** — owner declined the purge |
| P&IDs/PFDs served as static public assets | vulnerability | **Prepared, not executed** | Tooling and runbook ready; upload needs a networked machine |
| `unsafe-eval` in CSP, dead `api.anthropic.com` origin | config | **Accepted risk R-03** | Needs a staged regression run |
| `password_min_length: 6`, HIBP off | config | **Unchanged** | Not exposed by the management tooling; dashboard action |
| Google OAuth client secret returned by the management API | config | **OPEN** | Treat as exposed to token holders; rotate in Google Cloud Console |

**Applied to a database?** Only to **staging** (`nwcpfsqsdjezkwkhxrqx`, restored
from a dormant project for this purpose). Production has received nothing.

## P0 — still required before operational production

1. **Run the document migration on staging, then production.** 46 files
   (17.5 MB) still sit in `public/`. Runbook: `docs/DOCUMENT_MIGRATION.md`.
   Archive — do not delete — the originals until the app has been exercised
   through a signed-in session.
2. **Deploy the DCS edge function and set its secrets** (`GEMINI_API_KEY`,
   `ALLOWED_ORIGIN`), then re-run probe 10 of the manual plan (401 / 429 / 400).
3. **Engineering sign-off.** Complete `ENGINEERING_VALIDATION.md`: P&ID
   revisions, tag mapping, pressure-test basis, inspection intervals, lifting
   and insulation assumptions, code editions, acceptance criteria. **0 of 44
   P&ID sheets are human-verified** — every value the assistant quotes is
   indicative and says so.
4. **Browser pass on staging.** Steps 1, 2, 3, 8, 9 and 10 of
   `docs/TESTING.md` cannot be automated here (no headless browser, no egress
   from the sandbox). They need one click-through on a networked machine.
5. **Role backfill review.** `profiles.role_key` is backfilled from the legacy
   free-text `role` column by a heuristic. An administrator must review every
   account before production use — especially anyone who ends up
   `administrator`.
6. **Hosting and secrets.** Cloudflare Pages build output `dist/`, functions
   runtime, client-safe `VITE_*` variables only, TLS, WAF/rate limiting,
   rollback. Never expose a service-role key to the browser.

## P1 — strong next iteration

- Replace read-before-upsert schedule changes with a transactional database function/RPC and server-side idempotency/audit trail.
- Add append-only audit history for alert status changes, schedule overrides, and deletion events.
- Add server-side rate limits/quotas for AI and manual search; monitor provider cost and latency.
- Add error tracking, uptime checks, structured logs, and alerting for sync/API failures.
- Run a full accessibility audit (screen reader, keyboard, contrast, touch targets) and cross-browser/device matrix.
- Add live staging E2E tests for auth, RLS, storage, offline conflict recovery, and PWA update/rollback.
- Add performance budgets and bundle analysis; consider further splitting the initial register/search payload.
- Formalize data retention, privacy, backup encryption, and device-loss procedures for offline queues.
- Give the UI a role-aware surface: the database enforces the two tiers, but the
  client does not yet read `profiles.role_key`, so an administrator sees the
  same controls as everyone else.

## P2 — product enhancements

- CMMS/EAM integration, work-order lifecycle, spare-parts reorder points, and barcode/QR label printing.
- P&ID revision control, redline/approval workflow, and validated instrument/line-class extraction.
- Role-based dashboards, trend analytics, and exportable inspection packs.
- Complete bilingual review of all technical strings and units.
- Design-system documentation, component gallery, and visual regression tests.

## Google sign-in ("Continue with Google") — setup checklist

The sign-in flow itself is wired end-to-end in the app (PKCE `signInWithOAuth` → `/auth/callback` code exchange → dashboard). For it to succeed, **all** of the following must hold:

1. **Project active.** The configured project must not be paused — a paused project has *no active services*, so every auth call (Google **and** email/password) fails with a fetch error. Restore it in the Supabase dashboard (Project → Settings → General → Restore).
2. **Google provider enabled.** Authentication → Providers → Google — enabled on the production project (Google Cloud OAuth client with authorized redirect `https://<project-ref>.supabase.co/auth/v1/callback`).
3. **Redirect allow-list.** Authentication → URL Configuration must contain the exact callback of every origin used: `https://*.gnl1z-asset-management-elite.pages.dev/auth/callback`, the custom domain if any, and for local/preview testing `http://localhost:8081/**` and preview hosts (`https://8081-*.e2b.app/**`). `site_url` should point at the production origin.
4. **Client env.** Local `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Cloudflare Pages → Settings → Environment variables: the same two (plus optional `VITE_APP_URL`). Without them the app disables sign-in and says so instead of failing cryptically.
5. **Verify.** Signed-in state must survive a hard reload; a denied Google consent returns to `/auth/callback?error=access_denied`, which the app surfaces verbatim with an actionable hint.

Failure messages are mapped to these exact remedies by `src/lib/authErrors.ts` (covered by `src/test/authErrors.test.ts`).

---

## Safe deployment checklist

Run in this order. Every step has a verification and a way back. **Nothing here
has been run against production.**

### 0. Before you start

- [ ] Snapshot production: Dashboard → Database → Backups, or
      `supabase db dump -f backup-$(date +%F).sql`.
- [ ] Confirm the tag you are deploying (`git log -1`) and that CI is green on it.
- [ ] Have the previous Cloudflare Pages deployment identified for rollback.

### 1. Migrations (staging first, then production)

```bash
supabase link --project-ref <ref>
supabase db push --dry-run          # read the plan
supabase db push                    # applies 20261030000001, …002, …003
```

- [ ] `20261030000001_security_rls_hardening.sql`
- [ ] `20261030000002_storage_buckets_and_policies.sql`
- [ ] `20261030000003_two_tier_access_model.sql`

Verify after each:

```sql
select count(*) filter (where relrowsecurity) as rls_on, count(*) as tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r';      -- expect rls_on = tables

select id, public, file_size_limit from storage.buckets order by id;   -- 4 rows

select public.is_plant_user() is not null as helper_present;
```

Rollback: the commented `ROLLBACK` block at the end of each migration. It
restores the previous policies; it does not drop tables or columns. **Take the
snapshot anyway** — it is cheap.

### 2. Roles

- [ ] Review every `profiles.role_key` (the backfill is a heuristic).
- [ ] Confirm at least one administrator exists and can sign in.
- [ ] Confirm test/dormant accounts are removed or demoted.

### 3. Auth configuration (dashboard, production only)

- [ ] `disable_signup = true` (already set on production).
- [ ] `uri_allow_list` contains only the production origin plus the callbacks
      you actually use (production was pruned from 16 entries to 8).
- [ ] `password_min_length` ≥ 12 and HIBP on — **not settable through the
      tooling used here; do it in the dashboard.**
- [ ] `mailer_autoconfirm` stays **false** on production (it is `true` on
      staging only, so test accounts need no mailbox).

### 4. Edge function and secrets

```bash
supabase secrets set GEMINI_API_KEY=… ALLOWED_ORIGIN=https://<your-origin>
supabase functions deploy detect-dcs-instruments
```

- [ ] `verify_jwt = true` in `supabase/config.toml` (it is).
- [ ] `ALLOWED_ORIGIN` is your origin, not `*`.
- [ ] Probe: no token → 401; two calls in a minute → 429; bad `storage_path` → 400.

### 5. Front end

- [ ] Cloudflare Pages: build command `npm run build`, output `dist/`.
- [ ] Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
      optional `VITE_APP_URL`. **No `VITE_` variable may ever hold a
      service-role key.**
- [ ] After deploying: `GET /health` → `{"status":"ok","app":"GNL1Z Asset Management"}`.
- [ ] Sign in survives a hard reload; signed-out users get clear refusals, not
      blank screens.

### 6. Documents (last, and reversible)

- [ ] `node scripts/audit-documents.mjs` → confirm 46 RESTRICTED.
- [ ] `--limit 1 --upload --verify` rehearsal.
- [ ] `--upload --verify --register` full run.
- [ ] Open several drawings through the app while signed in.
- [ ] `--verify --archive-dir <outside public/>` — **only then**, and keep the
      archive until step 7 passes.

### 7. Post-deployment

- [ ] `/pids` opens a drawing; the assistant cites a sheet.
- [ ] Instrument detection works signed in, refuses clearly signed out.
- [ ] Photo upload lands at `<tag>/<user_id>/<uuid>.webp`.
- [ ] `public.audit_log` is receiving rows.
- [ ] No secrets in the built bundle: `grep -rIl 'service_role\|sb_secret_' dist/`
      prints nothing.

### Deployment note

CI validates only. There is no automatic deployment or release workflow because
hosting credentials, backend approval and change control belong to the owner.
