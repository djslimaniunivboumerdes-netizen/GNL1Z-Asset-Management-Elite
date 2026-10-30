# Testing

## Running

```bash
npm run check          # typecheck + lint + unit/component tests  (CI runs this)
npm run test           # tests only
npm run test:watch     # TDD loop
npm run build          # production build + PWA generation
node scripts/check-secrets.mjs      # secret hygiene gate (also in CI)
node scripts/audit-documents.mjs    # static document exposure report (read-only)
```

## Baseline

| Metric | Value |
|---|---|
| Test files | 44 |
| Tests | 377 |
| Typecheck | clean (`tsc -b`) |
| Lint | clean (0 errors, 7 pre-existing warnings) |
| Build | PWA with 111 precache entries |

## What is covered

### Unit
| Area | File |
|---|---|
| Engineering formulas, pressure test, lifting, insulation guardrails | `engineeringCalcs.test.ts` |
| Unit conversion | `units.test.ts` |
| ISA instrument tag interpretation | `instrumentTags.test.ts` |
| Instrument ↔ drawing placement, provenance of every specification, stated gaps | `instrumentLocation.test.ts` |
| The eight instrument traceability cases and the rules that must never break | `instrumentTraceability.test.ts` |
| Drawing provenance from both the instrument and the P&ID viewer | `drawingProvenance.test.tsx` |
| Assistant instrument answers: sources, gaps, no exact-sheet claim, no leak | `assistantInstrument.test.ts`, `aiAgentEndpoint.test.ts` |
| Classification parity between the migration script and the app | `documentClassParity.test.ts` |
| Equipment register integrity | `equipmentData.test.ts` |
| Reliability KPIs (MTBF/MTTR/availability) | `reliability.test.ts` |
| Assistant knowledge, citations, verified/unverified split | `assistantKnowledge.test.ts`, `aiAgentEndpoint.test.ts` |
| P&ID index (catalogue-only sizes, tag aliasing, no guessing) | `pidIndex.test.ts` |
| P&ID coverage — every PDF in `public/pids` has an index entry, no orphans, checksums present, no silent re-export | `pidCoverage.test.ts` |
| Edge-function input validation and model-output sanitisation | `edgeValidation.test.ts` |
| Storage URL resolution (signed, cached, fallback) | `storageUrl.test.ts` |
| Document classification and access decisions | `documentAccess.test.ts` |
| Offline sync (idempotent paths, retry, conflict) | `sync.test.ts` |
| Auth error mapping | `authErrors.test.ts` |

### Component (jsdom, Testing Library)
`pidConnections.test.tsx`, `instruments.test.tsx` (card drawings, Locate dialog,
`?unit=NN`, "has a drawing" filter), `alertWorkflow.test.tsx`,
`equipmentDetail.test.tsx`, plus page-level coverage of loading, empty and error
states.

### Guard tests (regression nets, not feature tests)
### Staging (Supabase, `nwcpfsqsdjezkwkhxrqx`)
The full migration set was applied in filename order and verified with the
queries in `docs/DATABASE_MIGRATIONS.md`: RLS on 13/13 tables, no unintended
blanket policies, 4 buckets with limits, the rate limiter, the maintenance
lifecycle (legal transition accepted, two illegal transitions rejected) and the
audit triggers. Results are tabulated in `docs/SECURITY.md`.

| Guard | File |
|---|---|
| SQL migrations: RLS on every table, no blanket `USING (true)`/`WITH CHECK (true)`, roles defined, rollback documented | `migrations.test.ts` |
| Repository hygiene: no tracked `.env`, placeholders only in `.env.example`, no key patterns in source, JWT required in `config.toml` | `repoHygiene.test.ts` |

`migrations.test.ts` replays `create policy` / `drop policy` statements **in
document order** to compute the effective policy set — otherwise the
idempotent "drop then re-create" pattern in the hardening migrations reads as
"nothing is in force".

## Known gaps — NOT VERIFIED

| Gap | Why | Consequence |
|---|---|---|
| Storage upload/download against a live bucket | Needs a signed-URL round trip from a networked client; the sandbox has no egress to `*.supabase.co` | Bucket configuration and policies are verified by SQL; no object has been uploaded or fetched |
| Document migration | Same reason — the upload must run on your machine | 46 RESTRICTED files are still public; `scripts/upload-restricted-documents.mjs` and `docs/DOCUMENT_MIGRATION.md` are ready |
| Edge Function behaviour | Requires a deployed function and secrets (`GEMINI_API_KEY`) | Validation, sanitisation and error mapping are unit-tested; HTTP/auth paths are not |
| Browser flow (sign-in, photo upload, offline queue, PDF rendering) | No browser harness in the stack and no egress | Steps 1, 2, 3, 8, 9 and 10 of the plan below are manual |
| Offline/reconnect on a real device | Not automatable here | Covered by unit tests with fake-indexeddb only |
| Visual/accessibility audit | No headless browser | Manual |
| Load/performance budgets | Only build-size measurement | Bundle size is tracked; runtime metrics are not |

Solved since the previous pass: **RLS behaviour at runtime is no longer a gap.**
It is verified by impersonating each role inside a transaction (see below), not
by minting JWTs.

---

## Staging results — two-tier access model (2026-10-30)

Run against `nwcpfsqsdjezkwkhxrqx` (`gnl1z-staging`) after applying
`20261030000003_two_tier_access_model.sql`. Each probe impersonates a real
account inside a transaction that is rolled back:

```sql
begin;
set local role 'authenticated';
set local request.jwt.claim.sub   = '<user uuid>';
set local request.jwt.claim.role  = 'authenticated';
-- … the operation under test …
rollback;
```

Four staging accounts exist for this (administrator, maintenance_technician,
operations_viewer, auditor). `P0001` = refused by a trigger (clear message),
`42501` = refused by RLS/privileges.

### Maintenance technician

| Action | Expected | Result |
|---|---|---|
| Create an alert | allowed | **ALLOWED** |
| Create a maintenance/test record | allowed | **ALLOWED** |
| Submit own draft record (DRAFT → SUBMITTED) | allowed | **ALLOWED** |
| Review/approve a submitted record | refused | **DENIED P0001** — "Only an administrator can review, approve or close a maintenance record." |
| Change the official test-date register | refused | **DENIED 42501** |
| Add an engineering document | refused | **DENIED 42501** |
| Read a RESTRICTED document | allowed | **ALLOWED** (1 row) |

### Operations viewer (previously could not raise anything at all)

| Action | Expected | Result |
|---|---|---|
| Create an alert | allowed | **ALLOWED** |
| Create a maintenance/test record | allowed | **ALLOWED** |
| Edit a colleague's record | no effect | **rows changed = 0** (RLS filtered it, no error) |
| Change the official test-date register | refused | **DENIED 42501** |
| Add an engineering document | refused | **DENIED 42501** |
| Read a RESTRICTED document | allowed | **ALLOWED** (1 row) |

### Administrator

| Action | Expected | Result |
|---|---|---|
| Create an alert | allowed | **ALLOWED** |
| Change the official test-date register | allowed | **ALLOWED** |
| Add an engineering document | allowed | **ALLOWED** |
| Review a submitted record | allowed | **ALLOWED** |
| Approve a record the administrator performed himself | refused | **DENIED P0001** — "You cannot review or approve a record you performed." |
| Delete an alert | allowed | **ALLOWED** (1 row) |

### Auditor

| Action | Expected | Result |
|---|---|---|
| Create an alert | refused | **DENIED 42501** |
| Create a maintenance/test record | refused | **DENIED 42501** |
| Read a RESTRICTED document | hidden | **0 rows** |
| Read the audit log | allowed | **ALLOWED** (5 rows) |

### Anonymous

| Action | Expected | Result |
|---|---|---|
| Read a RESTRICTED document | hidden | **0 rows** |
| Read a PUBLIC document | allowed | **1 row** |
| Read maintenance records | refused | **DENIED 42501** |
| Create an alert | refused | **DENIED 42501** |

**27 probes, 27 expected outcomes, 0 surprises** — with one deliberate design
consequence, recorded below.

### What this changed, and the trade-off

Writes used to be gated on `public.can_write()` (every engineer and technician,
but *not* operators). Approvals were gated on `public.can_approve()` (five
engineering roles). The plant asked for two levels, so now:

- official data and documents → **administrator only**;
- alerts and maintenance/test records → **every plant user**;
- **approvals → administrator only**.

That last line is a real change of working practice: a reliability engineer can
no longer approve a maintenance record. If you want a reviewer tier, it is one
predicate (`public.is_admin()` → a `reviewer` role check) — say the word and it
will be added as a third tier rather than quietly left as it is.

---

## Manual test plan for staging — status

The database half is done (above). The browser half cannot be automated here:
no headless browser and no egress to `*.supabase.co`. Run these against the
preview or your own machine, signed in as the staging accounts.

| # | Step | Status |
|---|---|---|
| 1 | Administrator changes a role; a user cannot change their own | **NOT RUN** — needs a browser. The database half is verified: the trigger refuses with "Only an administrator can change a user role." |
| 2 | Instrument finder (`FT-1503`) shows ISA meaning, equipment, panels | **NOT RUN** — component logic is unit-tested; must be eyeballed once |
| 3 | Equipment page → linked P&ID opens with its sizes, flagged not verified | **NOT RUN** — the resolution path is unit-tested (`documentRegistry.test.ts`); the local fallback serves 26 of 44 drawings, the other 18 open from Drive |
| 4 | Technician creates a log (DRAFT) and submits it (SUBMITTED) | **VERIFIED IN SQL** (technician probes 2 and 3) |
| 5 | Same technician tries to approve → refused | **VERIFIED IN SQL** (DENIED P0001) |
| 6 | Administrator approves → APPROVED, `reviewed_by` set | **VERIFIED IN SQL** (admin probe 4) |
| 7 | `audit_log` records one row per transition | **VERIFIED IN SQL** — 5 audit rows exist on staging from the lifecycle probes |
| 8 | Offline: create a log and a photo, reconnect, queue flushes once | **NOT RUN** — needs a browser and a service worker; unit-tested with fake-indexeddb |
| 9 | Signed out: P&IDs, history and photos unreadable; assistant still answers | **VERIFIED IN SQL** for data (anonymous probes); the UI half is **NOT RUN** |
| 10 | `detect-dcs-instruments`: 401 without a token, 429 after quota, 400 on a bad path | **NOT RUN** — the function is not deployed (no `GEMINI_API_KEY`); validation is unit-tested |

### Staging accounts (for the manual run)

`admin.staging@gnl1z.test`, `technician.staging@gnl1z.test`,
`operator.staging@gnl1z.test`, `auditor.staging@gnl1z.test` — four accounts
created on staging only, `mailer_autoconfirm` is on there so no mailbox is
needed. Set a password in the dashboard (Authentication → Users → … → Reset /
send password) or create your own; role is on `public.profiles.role_key`.

**These were removed on 2026-10-30** together with the two `maintenance_logs`
and two `engineering_documents` fixtures they had created. Staging currently
holds 0 users. Recreate them with the SQL in
`supabase/migrations/20261030000003_two_tier_access_model.sql` (the seed
block), or insert by hand, then re-run the probes. The `audit_log` was kept —
do not truncate it to "clean up"; it is the evidence the probes happened.

Manual staging run for the instrument work (no browser automation available):

1. Start the preview (`npx vite --host 0.0.0.0 --port 8081`).
2. Open `/instruments?q=LIC101204` → the card lists `85-X01-…` chips; press
   **Locate** → drawings, equipment, piping, specifications with sources, and
   the three gaps.
3. Open `/instruments?unit=06` → 81 instruments across trains 1/2/3/5/6, every
   chip a unit-06 drawing.
4. Toggle **Has a drawing** → the count drops by exactly 31.
5. Open a drawing from `/pids?file=…` → the provenance block (revision "not
   recorded", checksum, extraction, verification) and the "instruments of unit
   NN" link, which returns to step 3.
6. Ask Expert AI "where is LIC101204?" → a reference-mode answer that offers
   the drawings as a unit-level lead and states what it cannot tell you.
