# Final validation report

Date: 2026-10-29  
Scope: enhanced release candidate, isolated fixtures only. No live Supabase project, deployment, or operational record was changed.

## Automated checks

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | 0 errors, 10 existing fast-refresh warnings |
| `npm run test` | 10 files / 45 tests passed |
| `npm run build` | Passed; generated PWA worker and manifest |
| Main application JS | 701.31 kB / 214.32 kB gzip |
| Baseline main application JS | 1,069.79 kB / 316.03 kB gzip |
| PWA precache | 93 entries / 3,760.63 KiB (total precache, not initial-load size) |

## Regression coverage

- Calendar-date scheduling, status boundaries, interval arithmetic, and historical PASS non-rollback guard.
- Read-only schedule derivation, authoritative overrides, authenticated alert generation, and deduplication.
- Offline sync retention, stable IDs/paths, duplicate-response recovery, owner isolation, and PASS-only schedule updates.
- Alert submission retry idempotency, committed-insert recovery, and network-error busy-state cleanup.
- Equipment URL filters, pagination, accessible global search, safe assistant rendering, and honest unknown schedule status.
- Formula-safe CSV and screening-only lifting/insulation guardrails.
- Engineering review wording: missing pressure data does not become a setpoint or safety clearance.
- Assistant endpoint: same-origin enforcement, prompt/body bounds, context minimization, provider-key handling, context-aware caching, and unavailable-provider behavior.

## Browser/PWA review

The final production preview was reviewed with mocked Supabase REST/auth/storage. The 12-check smoke review passed: mobile dashboard rendering and overflow, assistant static-reference boundary, URL equipment filtering, desktop dashboard overflow, desktop equipment table, generated service-worker control, generated manifest orientation, offline dashboard reload, offline lazy equipment detail, no runtime errors, and no backend writes. Machine-readable results are in `docs/VALIDATION_BROWSER_PWA.json`.

Earlier isolated workflow reviews also covered search, filters, pagination, CSV, schedule/alert fixtures, assistant fit, auth/news/about fit, unknown equipment, and unavailable-register honesty. See `docs/ENHANCEMENTS.md` for the enhancement summary and `docs/PRODUCTION_READINESS.md` for work that still requires live staging and engineering approval.

## Expert AI GNL1 follow-up validation

Date: 2026-10-29. The assistant enhancement was validated separately on the production preview with the dev/preview API bridge and no provider key.

| Check | Result |
|---|---|
| `npm run check` | Passed; ESLint 0 errors / 10 existing warnings; Vitest 16 files / 87 tests |
| `npm run build` | Passed; main JS 676.08 kB / 206.29 kB gzip; AiAgentChat 84.07 kB / 18.15 kB gzip; PWA 100 entries / 3,833.65 KiB |
| API smoke | Same-origin reference 200, cross-origin 403, French reference 200; alias variants resolve `e 501` / `X01-E 501` to `X01-E-501`; E520 pipeline question without CSV returns coverage gap; CSV-backed E520 count returns 2 distinct lines; unknown G781 is not substituted |
| Component/API checks | Assistant chat tests cover launcher, reference answer, source link, CSV attach with row filtering, retry/stop/clear, and equipment-aware deep link; earlier production-preview browser smoke passed 9/9 assistant checks |

Machine-readable results are in `docs/VALIDATION_AI_ASSISTANT.json`. See `docs/AI_ASSISTANT.md` for the assistant contract and boundaries.

## Not validated

- Live Supabase auth/RLS/storage against an active project.
- Real AI provider credentials, cost, latency, or output quality.
- Cloudflare Pages deployment, custom domain, WAF/rate limiting, or rollback.
- Engineering fitness-for-service, approved test setpoints, lift plans, insulation specifications, or current P&ID revision compliance.
