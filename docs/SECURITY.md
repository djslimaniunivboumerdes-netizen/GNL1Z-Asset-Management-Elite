# GNL1Z — security assessment and remediation

Verified 2026-10-30 against the repository at `0aa0cf5` and the Supabase
project `gdkqetzkhgllwbpmqmux` (read-only queries and configuration review; no
records were changed).

Every item below is classified as one of:

1. **Confirmed vulnerability** — exploitable by an unauthenticated or
   low-privileged party.
2. **Confirmed defect** — wrong or unsafe behaviour, not directly exploitable.
3. **Engineering validation gap** — the software is fine, the data behind it is not.
4. **Configuration problem.**
5. **Improvement opportunity.**
6. **Previously fixed** — raised by an earlier review, no longer present.

---

## A. Confirmed vulnerabilities

### V-01 · Any authenticated user could promote themselves to administrator — **FIXED**
`20260524000001_auth_profiles.sql` created
`profiles_update_own … FOR UPDATE USING (auth.uid() = id)` with **no column
restriction and no `WITH CHECK`**. `profiles.role` is a free-text column with
default `technician`. Any signed-in user could run
`update profiles set role='admin' where id = <own id>` and every later
`is_admin()`-style check would believe it.

*Fix (migration `20261030000001`):* role values moved to a typed `app_role`
enum with eight plant roles; column privileges on `profiles` restricted
(`grant update (full_name)` only); a `guard_profile_role` trigger refuses any
role change not made by an administrator; `profiles.email` is no longer
readable by the client.

### V-02 · AI response cache was world-readable and world-writable — **FIXED**
`ai_responses_cache` had `FOR SELECT USING (true)` and
`FOR INSERT/UPDATE … WITH CHECK (true)`. The anon key is public and shipped in
the browser, so anyone could read every prompt and answer (which are about
plant equipment) and any signed-in user could poison the cache with content
served to everyone else.

*Fix:* `revoke all on public.ai_responses_cache from anon, authenticated;`
and all three policies dropped. Nothing in the application reads this table
from the browser — `/api/ai-agent` caches in memory — so no functionality is
lost.

### V-03 · The DCS instrument detector was unauthenticated and wrote with the service role — **FIXED**
`supabase/config.toml` set `verify_jwt = false`, and the function reads
`SUPABASE_SERVICE_ROLE_KEY`. Anyone who knew the URL could (a) spend the Gemini
quota and (b) have the service role upsert arbitrary rows into
`dcs_detected_instruments` — the table the operator UI displays as *the*
instrument list for a panel. Combined with the table's
`FOR INSERT TO authenticated WITH CHECK (true)` policy, this was a
cache-poisoning path into an engineering screen.

*Fix:* `verify_jwt = true`; the function verifies the caller itself
(`/auth/v1/user`) so a config regression cannot silently reopen it; body size
capped at 8 KB; `panel_id` restricted to a slug; `storage_path` restricted to
relative image paths with no `..`; model output passed through
`sanitiseDetectedTags` (ISA-shaped tags only, ≤ 300, deduplicated) before it is
stored; per-user rate limit through `public.consume_rate_limit()`; generic
error codes with server-side logging; client writes to the table revoked.

### V-04 · Any authenticated user could delete fast alerts, and update all alerts — **FIXED**
`fast_alerts_delete_auth … USING (true)`, `alerts_update_auth … USING (true)`.
Alert history is an operational record.

*Fix:* delete is administrator-only; insert/update require a role with write
authority (`can_write()`), and inserts are stamped with `created_by`.

---

## B. Confirmed defects

### D-01 · Maintenance and plant records were publicly readable — **FIXED**
`maintenance_logs`, `equipment_notes`, `equipment_test_dates`,
`equipment_images`, `alerts`, `fast_alerts`, `dcs_detected_instruments` all had
`FOR SELECT USING (true)`. With a public anon key that means: not signed in,
still readable.

*Fix:* reads require `auth.role() = 'authenticated'`; writes require ownership
plus a role with write authority.

### D-02 · No lifecycle on maintenance records — **FIXED**
A row could be inserted directly with any `result`, and any author could update
it afterwards. There was no way to distinguish "typed in the field" from
"reviewed by an engineer".

*Fix:* `maintenance_logs.status` with the lifecycle
`DRAFT → SUBMITTED → REVIEWED → APPROVED|REJECTED → CLOSED`, enforced by a
trigger that rejects illegal transitions, requires an approval role for
review/approval/closure, and refuses to let a performer review or approve their
own record. Rows that predate the lifecycle are marked `IMPORTED` — **never**
`APPROVED`.

### D-03 · Uploads were unconstrained — **FIXED**
`photos_auth_upload … WITH CHECK (bucket_id = 'equipment-photos')` accepted any
size and any MIME type.

*Fix:* bucket-level `file_size_limit` and `allowed_mime_types`, plus policies
that re-check size and MIME, and write paths scoped to `<tag>/<user_id>/…`
(the application was changed to produce those paths).

### D-04 · `alert-photos` bucket had no migration — **FIXED**
The application uploads to `alert-photos` (`src/pages/AlertCenter.tsx`) but no
migration created it; it existed only in one project's dashboard state.

*Fix:* declared in `20261030000002` with size, MIME and ownership policies.

### D-05 · `supabase/config.toml` pinned a different project — **FIXED**
It declared `usaagqmwdnzgutmpuorz` while the deployed application uses
`gdkqetzkhgllwbpmqmux`. `supabase db push` would therefore have applied
migrations to the wrong database.

*Fix:* `project_id = ""` with a comment requiring an explicit
`supabase link --project-ref …`.

---

## C. Engineering validation gaps

- **G-01 · P&ID sizes are OCR readings.** 44 drawings, all image-only scans.
  Sizes are filtered to a standard NPS/DN catalogue and every sheet carries
  `verified: false`. Presented as "where to look", never as a design value.
  See `docs/PID_INDEX.md`.
- **G-02 · DCS instrument tags are AI extractions.** `verified: false`,
  confidence `ai-extracted`. The register says so in the UI.
- **G-03 · Equipment register is stale in places.** All 77 records have empty
  `last_tested` / `next_test_due`, 64/77 have `pressure_bar = 0`, 67/77 have no
  serial number, `last_updated` is 2026-04-29. Screens that compute risk from
  these fields inherit the gap.

---

## D. Configuration problems

- **C-01 · `.env` was committed.** It contained only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` — both *publishable by design* — so this was
  hygiene, not a key leak. It is now git-ignored and untracked, and
  `scripts/check-secrets.mjs` fails CI if any environment file (or any
  service-role/provider key pattern) is ever tracked again.
  **The file remains in git history**; see the rotation procedure below.
- **C-02 · CSP allows `script-src 'self' 'unsafe-eval'`** and lists a dead
  `api.anthropic.com` origin in `connect-src`. `'unsafe-eval'` is required today
  by nothing that has been verified; removing it needs a staging run.
- **C-03 · `disable_signup: false`, `password_min_length: 6`** in the Auth
  configuration for a plant application. Recommend signup off (invite only) and
  a longer minimum. **Requires authorisation to change.**
- **C-04 · Storage buckets were created by hand.** Now declared in migrations,
  but the live project's existing bucket settings are reconciled only when the
  migration is applied.

## E. Improvement opportunities

- Move `equipment-images` to private and serve DCS panels through signed URLs
  (blocked by static URL construction in `src/data/dcs_panels.ts`).
- Rate-limit the Cloudflare Functions per user rather than per IP.
- Add the `auditor` and `operations_viewer` dashboards promised by the product
  spec; the roles now exist in the database.

## F. Previously fixed (no action)

- No service-role key in the frontend (it appears only in the Edge Function,
  read from `Deno.env`).
- No `VITE_`-prefixed secret anywhere.
- Cloudflare Functions are same-origin only and Drive IDs are allow-listed.

---

## Accepted risks

| ID | Risk | Why accepted | Condition |
|---|---|---|---|
| R-01 | P&IDs, PFDs and manuals remain static public assets under `public/` | Moving them is an authorised change; the migration path is prepared but not executed | Requires the document owner's go-ahead (see below) |
| R-02 | `equipment-images` bucket stays public | DCS pages build URLs from static data; flipping it breaks the screens until that call site is reworked | Rework `dcs_panels.ts` to signed URLs, then set `public = false` |
| R-03 | `'unsafe-eval'` in the CSP | Removing it without a browser regression run could break the deployed app | Stage, run the full click-through, then remove |

## Rotation procedure (C-01)

The values in the historic `.env` are publishable and are not secrets, so
rotation is not strictly required. If you want the file out of history anyway:

1. Confirm no other credential was ever committed
   (`git log -p -- .env | grep -iE 'secret|service_role|password'`).
2. Take the anon key from the dashboard and confirm it matches the committed
   value; if a *service-role* key ever appeared anywhere, rotate it first:
   Supabase → Project Settings → API → Reset service role key.
3. Purge the file: `git filter-repo --path .env --invert-paths` (or BFG), then
   force-push and ask every clone to re-clone.
4. Rotate the anon key too if you want a clean break, and update it in
   Cloudflare Pages environment variables and every developer's local `.env`.

Steps 2–4 touch production credentials and git history — **they are not done
here and need your authorisation.**

## Document migration plan (R-01)

Executed only with the document owner's authorisation:

1. `node scripts/audit-documents.mjs` — the evidence: 46 files (17.5 MB)
   classified RESTRICTED are public today.
2. Create the private `restricted-documents` bucket (migration
   `20261030000002`, idempotent).
3. Upload each file to `restricted-documents/<class>/<filename>` preserving the
   original bytes (sha256 compared before and after).
4. Insert a row per document into `public.engineering_documents` with
   classification, drawing number, revision, source page and
   `verified = false`.
5. Point the UI at `documentUrl()` (`src/lib/documentAccess.ts`), which already
   prefers the private path and falls back to the public one.
6. Only then delete the public copies — **and note that deleting from the
   working tree does not remove them from git history**; history purging is a
   separate authorised operation.
