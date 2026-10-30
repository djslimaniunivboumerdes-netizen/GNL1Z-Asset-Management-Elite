# Database migrations

**Status: applied to staging, NOT applied to production.**

All eleven migrations were applied in order to a restored staging project
(`nwcpfsqsdjezkwkhxrqx`, PostgreSQL 17.6) on 2026-10-30 and verified there —
see the verification table in `docs/SECURITY.md`. Production
(`gdkqetzkhgllwbpmqmux`) has **not** been migrated: say the word and the same
sequence runs there.

## Inventory and deployment order

| # | File | Purpose |
|---|---|---|
| 1 | `20260502064646_….sql` | `equipment_test_dates`, `equipment_notes` |
| 2 | `20260503215639_….sql` | `dcs_detected_instruments` |
| 3 | `20260519000000_news_cache.sql` | `news_cache` |
| 4 | `20260524000001_auth_profiles.sql` | `profiles` + new-user trigger |
| 5 | `20260524000002_maintenance_logs.sql` | `maintenance_logs` |
| 6 | `20260524000003_equipment_images.sql` | `equipment_images` |
| 7 | `20260524000004_storage_equipment_photos.sql` | storage policies |
| 8 | `20260618000001_alerts_table.sql` | `alerts`, `fast_alerts` |
| 9 | `20260626000001_ai_responses_cache.sql` | `ai_responses_cache` |
| 10 | **`20261030000001_security_rls_hardening.sql`** | roles, least-privilege RLS, maintenance lifecycle, audit log, rate limiter, document register |
| 11 | **`20261030000002_storage_buckets_and_policies.sql`** | bucket declarations, size/MIME limits, owner-scoped writes, private document bucket |

Apply **in filename order**, 1 → 11. Both new migrations are idempotent and
contain no destructive DDL: nothing is dropped, truncated or deleted.

## Applying

```bash
supabase link --project-ref <ref>          # never link production implicitly
supabase db push                           # applies 1 → 11 in order
supabase secrets set GEMINI_API_KEY=…      # before deploying the edge function
supabase functions deploy detect-dcs-instruments
```

Order matters: **migration 10 before the edge function**, because the function
calls `public.consume_rate_limit()` and writes
`dcs_detected_instruments.detected_by`. If the function is deployed first it
fails closed (HTTP 429) with a log line naming the missing migration, so the
failure is loud rather than silent.

## Migration 10 — `security_rls_hardening.sql`

**Schema**
- `public.app_role` enum — eight plant roles.
- `profiles.role_key` (typed), `profiles.updated_at`, backfilled from the legacy
  free-text `role`; unrecognised values fall back to `maintenance_technician`.
- `maintenance_logs`: `status`, `submitted_at`, `reviewed_by`, `reviewed_at`,
  `closed_at`, `rejection_reason`. Existing rows → `IMPORTED`.
- `equipment_notes.created_by`, `equipment_notes.updated_at`.
- `fast_alerts.created_by`, `alerts.created_by`.
- `dcs_detected_instruments.detected_by`, `.verified`.
- `public.audit_log` (append-only), `public.rate_limit_counters`,
  `public.engineering_documents`.

**Functions** (all `SECURITY DEFINER` with pinned `search_path`)
`current_role_key()`, `is_admin()`, `has_any_role()`, `can_write()`,
`can_approve()`, `consume_rate_limit()`, `audit_critical_changes()`,
`guard_profile_role()`, `guard_maintenance_transition()`.

**Privileges**
- `profiles`: `anon`/`authenticated` may read the roster (without `email`) and
  update `full_name` only.
- `ai_responses_cache`: all privileges revoked from `anon`/`authenticated`.
- `news_cache`: public read kept; writes revoked from clients.
- `dcs_detected_instruments`, `rate_limit_counters`: client writes revoked.

**Added after staging verification (sections 8 and 8b)**
- `TRUNCATE` revoked from `anon` and `authenticated` on every public table —
  TRUNCATE does not evaluate RLS, so leaving it granted turned any policy
  mistake into a bulk data-loss event.
- All privileges revoked from `anon` on every public table except
  `engineering_documents`, where only SELECT is granted (documents classified
  PUBLIC). Before this, `anon` held INSERT/UPDATE/DELETE everywhere and RLS was
  the only control.
- `DELETE` revoked from `authenticated` on `maintenance_logs`,
  `equipment_notes` and `engineering_documents`; `UPDATE`/`DELETE` revoked on
  `audit_log`. Grants now match policies exactly.

**Data considerations**
- `maintenance_logs.status` is set to `IMPORTED` for every existing row — no
  record is retrospectively approved.
- `equipment_notes.created_by` stays `null` for existing rows: they remain
  readable but editable only by an administrator. No author is invented.
- `profiles.role_key` backfill is a heuristic (`role ilike '%admin%'`, …). An
  administrator must review the result after applying.

**Rollback** — see the commented block at the end of the file. It restores the
previous permissive policies; it deliberately does not drop tables or columns,
because doing so would destroy audit data.

## Migration 11 — `storage_buckets_and_policies.sql`

Declares `equipment-photos` (private), `equipment-images` (public today —
accepted risk R-02), `alert-photos` (private, previously missing) and
`restricted-documents` (private, new), each with `file_size_limit` and
`allowed_mime_types`.

Policies:
- `equipment-photos`: authenticated read; insert requires `can_write()`, a
  supported image type, ≤ 10 MB and a path of the form `<tag>/<user_id>/…`;
  delete by owner or administrator.
- `equipment-images`: public read retained; all writes administrator-only.
- `alert-photos`: authenticated read; constrained insert; administrator delete.
- `restricted-documents`: authenticated read; constrained insert (≤ 60 MB);
  administrator delete.

**Data considerations**
- Existing objects under `equipment-photos` keep their old paths
  (`<tag>/<uuid>.webp`). They stay readable to signed-in staff; only *new*
  uploads are owner-scoped. Rewriting existing paths is a data migration that
  has not been authorised.
- Setting `equipment-photos.public = false` stops public URL access. The
  application was changed in the same commit to resolve signed URLs with a
  public-URL fallback, so it works before *and* after the change.
- Buckets are never dropped on rollback: dropping a bucket deletes its objects.

## Verification results on staging (2026-10-30)

```
13/13 public tables have RLS enabled
2     policies still contain "true" — both intended (news_cache public read, admin profile update)
4/4   buckets declared with size and MIME limits
true, true, false ← consume_rate_limit('staging-probe', 2, '1 minute')
DRAFT → SUBMITTED      accepted
SUBMITTED → APPROVED   rejected (role cannot approve)
SUBMITTED → CLOSED     rejected (illegal transition)
audit_log rows: INSERT, UPDATE, DELETE — none for the rejected transitions
anon privileges in the whole schema: SELECT on engineering_documents only
```

Not verified: runtime RLS as `anon`/`authenticated` (no users or tokens were
created on staging), storage uploads, and the Edge Function.

## Verification after applying

```sql
-- 1. every table has RLS enabled and at least one policy
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and relkind = 'r' order by 1;

-- 2. no blanket policies survive
select tablename, policyname, cmd, qual, with_check from pg_policies
 where schemaname = 'public' and (qual = 'true' or with_check = 'true');

-- 3. the rate limiter answers
select public.consume_rate_limit('smoke-test', 1, interval '1 minute');

-- 4. a non-administrator cannot change a role (expect: permission denied / exception)
--    run as a test user: update public.profiles set role_key = 'administrator' where id = auth.uid();
```

## Not done

- **Production is not migrated.** Staging only.
- `password_min_length` is still 6 and `password_hibp_enabled` is false: neither
  is exposed by the management connector, so they must be set in the Supabase
  dashboard. `disable_signup` and the redirect allow-list were hardened with
  authorisation.
- The document migration (uploading the 46 RESTRICTED files) has **not** run:
  this environment has no network path to `*.supabase.co` (verified: SSL connect
  error), so the upload step cannot be executed from here. Everything else is
  ready — `scripts/upload-restricted-documents.mjs`, the private bucket, and the
  register. Run the script locally, then the public copies can be deleted.
