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
| Test files | 34 |
| Tests | 262 |
| Typecheck | clean (`tsc -b`) |
| Lint | clean |
| Build | PWA with 108 precache entries |

## What is covered

### Unit
| Area | File |
|---|---|
| Engineering formulas, pressure test, lifting, insulation guardrails | `engineeringCalcs.test.ts` |
| Unit conversion | `units.test.ts` |
| ISA instrument tag interpretation | `instrumentTags.test.ts` |
| Equipment register integrity | `equipmentData.test.ts` |
| Reliability KPIs (MTBF/MTTR/availability) | `reliability.test.ts` |
| Assistant knowledge, citations, verified/unverified split | `assistantKnowledge.test.ts`, `aiAgentEndpoint.test.ts` |
| P&ID index (coverage, catalogue-only sizes, tag aliasing, no guessing) | `pidIndex.test.ts` |
| Edge-function input validation and model-output sanitisation | `edgeValidation.test.ts` |
| Storage URL resolution (signed, cached, fallback) | `storageUrl.test.ts` |
| Document classification and access decisions | `documentAccess.test.ts` |
| Offline sync (idempotent paths, retry, conflict) | `sync.test.ts` |
| Auth error mapping | `authErrors.test.ts` |

### Component (jsdom, Testing Library)
`pidConnections.test.tsx`, `instruments.test.tsx`, `alertWorkflow.test.tsx`,
`equipmentDetail.test.tsx`, plus page-level coverage of loading, empty and error
states.

### Guard tests (regression nets, not feature tests)
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
| RLS enforced by Postgres | Requires applying migrations to a project; not authorised | Policies are syntax-checked and unit-tested as text, not executed |
| Storage policies | Same | Not exercised against a live bucket |
| Edge Function behaviour | Requires a deployed function and secrets | Validation and sanitisation are unit-tested; HTTP/auth paths are not |
| End-to-end (10-step spec flow) | No browser harness in the stack | Not automated; must be run manually against staging |
| Offline/reconnect on a real device | Not automatable here | Covered by unit tests with fake-indexeddb only |
| Visual/accessibility audit | No headless browser | Manual |
| Load/performance budgets | Only build-size measurement | Bundle size is tracked; runtime metrics are not |

## Manual test plan for staging (the E2E the spec asks for)

1. Administrator invites a Reliability Engineer; the new user cannot change
   their own role (expect a permission error).
2. Engineer searches instrument tag `FT-1503` → finder shows ISA meaning,
   equipment and the panels it appears on.
3. From the equipment page, open the linked P&ID → the drawing opens with the
   sizes the index read, flagged *not verified*.
4. Create a maintenance log as a technician → status `DRAFT`; submit → `SUBMITTED`.
5. Sign in as the same technician and try to approve → refused.
6. Sign in as a Reliability Engineer → approve → `APPROVED`, `reviewed_by` set.
7. Query `public.audit_log` → one row per transition, actor and role recorded.
8. Go offline, create a log and a photo, come back online → queue flushes once,
   no duplicate rows, photo path `<tag>/<user_id>/<uuid>.webp`.
9. Sign out → P&ID pages, maintenance history and photos are not readable;
   the assistant still answers from the local knowledge base.
10. Call `detect-dcs-instruments` without a token → 401; with a token twice in
    a minute → 429 after the quota; with a token and a bad `storage_path` → 400.
