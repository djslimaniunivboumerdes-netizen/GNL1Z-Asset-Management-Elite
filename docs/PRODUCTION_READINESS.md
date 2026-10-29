# Production readiness and remaining work

Status: **enhanced release candidate**. The front end, offline behavior, and production build are validated with isolated fixtures. The configured Supabase projects were inactive during review, so live backend behavior was not exercised.

## Completed in this release

- Consistent schedule contract; PASS-only advancement; historical tests do not roll back newer passed dates in the form or sync path.
- Honest loading/empty/unavailable/retry states for schedules and alerts.
- Stable client IDs and retry paths for offline logs, equipment photos, and alert observations.
- Authenticated, append-only field-note UI matching the existing note policies; owner-only confirmed photo deletion.
- Responsive equipment register, URL filters/pagination, formula-safe CSV, accessible global search, mobile dialogs, theme fixes, and reduced-motion support.
- Lazy routes, responsive WebP heroes, local fonts, and one generated PWA worker/manifest.
- Bounded same-origin assistant/manual-search endpoints, minimized assistant context, explicit simulated-alarm labeling, and no service-role key in the assistant endpoint.
- Screening-only lifting/insulation guardrails; missing temperature is “not assessed”; out-of-table lifting loads do not receive a capped recommendation.
- CI for locked install, typecheck, lint, tests, and production build.

## P0 — required before operational production

1. **Backend authorization and RLS review.** Define viewer/technician/supervisor/admin roles. Review public reads and authenticated writes on notes, logs, alerts, schedules, DCS detections, news cache, and AI cache. Current migrations allow any authenticated user to update/delete fast alerts and update alerts/schedules; decide whether that is intentional. Add owner/supervisor constraints and audit requirements before live use.
2. **Live staging validation.** Restore/activate a staging Supabase project, apply migrations in order, verify auth, RLS, storage buckets/policies, offline sync, duplicate retries, and backup/restore. Do not test against live operational records.
3. **Engineering sign-off.** Complete `ENGINEERING_VALIDATION.md`. Verify P&ID revisions, tag mapping, pressure-test basis, intervals, lifting/insulation assumptions, code editions, and acceptance criteria against approved documents.
4. **Hosting and secrets.** Configure Cloudflare Pages (or equivalent) build output `dist/`, functions runtime, client-safe Supabase variables, optional server-side `GEMINI_API_KEY`, TLS, WAF/rate limiting, and rollback. Never expose service-role or provider keys to the browser.
5. **Storage completeness.** Verify the `alert-photos` bucket and policies exist in the target project; the checked-in migrations explicitly create `equipment-photos`, not `alert-photos`. Define orphan-photo cleanup and retention.

## P1 — strong next iteration

- Replace read-before-upsert schedule changes with a transactional database function/RPC and server-side idempotency/audit trail.
- Add append-only audit history for alert status changes, schedule overrides, and deletion events.
- Add server-side rate limits/quotas for AI and manual search; monitor provider cost and latency.
- Add error tracking, uptime checks, structured logs, and alerting for sync/API failures.
- Run a full accessibility audit (screen reader, keyboard, contrast, touch targets) and cross-browser/device matrix.
- Add live staging E2E tests for auth, RLS, storage, offline conflict recovery, and PWA update/rollback.
- Add performance budgets and bundle analysis; consider further splitting the initial register/search payload.
- Formalize data retention, privacy, backup encryption, and device-loss procedures for offline queues.

## P2 — product enhancements

- CMMS/EAM integration, work-order lifecycle, spare-parts reorder points, and barcode/QR label printing.
- P&ID revision control, redline/approval workflow, and validated instrument/line-class extraction.
- Role-based dashboards, trend analytics, and exportable inspection packs.
- Complete bilingual review of all technical strings and units.
- Design-system documentation, component gallery, and visual regression tests.

## Google sign-in ("Continue with Google") — setup checklist

The sign-in flow itself is wired end-to-end in the app (PKCE `signInWithOAuth` → `/auth/callback` code exchange → dashboard). For it to succeed, **all** of the following must hold — as of 2026-10-29 the live failure was item 1:

1. **Project active.** The configured project (`gdkqetzkhgllwbpmqmux`, client-safe URL in `.env` / Pages env) must not be paused — a paused project has *no active services*, so every auth call (Google **and** email/password) fails with a fetch error. Restore it in the Supabase dashboard (Project → Settings → General → Restore).
2. **Google provider enabled.** Authentication → Providers → Google — already enabled on this project (Google Cloud OAuth client with authorized redirect `https://<project-ref>.supabase.co/auth/v1/callback`).
3. **Redirect allow-list.** Authentication → URL Configuration must contain the exact callback of every origin used: `https://*.gnl1z-asset-management-elite.pages.dev/auth/callback`, the custom domain if any, and for local/preview testing `http://localhost:8081/**` and the Arena preview host (`https://8081-*.e2b.app/**`). `site_url` should point at the production origin.
4. **Client env.** Local `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Cloudflare Pages → Settings → Environment variables: the same two (plus optional `VITE_APP_URL`). Without them the app disables sign-in and says so instead of failing cryptically.
5. **Verify.** Signed-in state must survive a hard reload; a denied Google consent returns to `/auth/callback?error=access_denied`, which the app now surfaces verbatim with an actionable hint.

Failure messages are mapped to these exact remedies by `src/lib/authErrors.ts` (covered by `src/test/authErrors.test.ts`).

## Deployment note

The included CI validates only. No automatic deployment or release workflow is included because hosting credentials, backend approval, and change-control requirements must be configured by the owner.
