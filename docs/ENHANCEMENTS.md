# Balanced enhancement pass

This pass keeps the existing industrial visual language while fixing high-impact workflow, mobile, and loading problems.

## Reliability and safety

- Maintenance schedules now use one date/status contract. Only a passed test can advance a schedule; failed or pending tests cannot roll dates back. Confirmed manual dates take priority.
- Schedule queries surface loading, empty, unavailable, and retry states instead of presenting missing data as “up to date”.
- Automatic alert generation requires an authenticated session and deduplicates open alerts. Dashboard rendering and background sync do not generate alerts.
- Offline logs and photos use stable client IDs and upload paths. Failed sync records are retained with actionable errors; retries do not create duplicate records after a dropped response.
- Alert observation retries reuse the observation ID and attachment path. Close/delete actions recover their busy state after network exceptions.
- Maintenance notes are authenticated and append-only in the UI, matching the existing database policies. Photo deletion is owner-only and confirmed. Historical PASS records no longer roll back a newer schedule in either the form or sync path.
- The assistant renders model output as safe React text, reports unavailable/empty responses honestly, labels simulated alarms, minimizes transmitted context, and fits small screens with keyboard dismissal.

## Mobile and usability

- Responsive equipment cards, URL-backed search/filter/sort/pagination, and formula-safe CSV export.
- Accessible global search with Ctrl/⌘K, skip link, labelled dialogs, focus/retry states, and reduced-motion support.
- Light/dark theme fixes across equipment, schedules, alerts, directories, manuals, news, and auth. Technical drawing canvases remain intentionally dark.
- One active responsive hero on Dashboard, About, and News instead of mounting every full-size slide.

## Loading and offline behavior

- Routes are lazy-loaded with keyed error boundaries and route fallbacks.
- Used hero images have generated 640/1280 px WebP derivatives; original assets are retained.
- Fonts are bundled locally; no runtime Google Fonts dependency.
- Vite PWA generates the single service worker and web manifest. The legacy hand-written worker was removed. Orientation is unrestricted, auth callbacks are excluded from navigation fallback, and images/PDFs are cached same-origin on first use.

## Final engineering/IT guardrails

- Lifting helpers return no recommendation for invalid mass or loads outside the reference table; fleet output is explicitly a screening candidate requiring an approved lift plan.
- Missing service temperature is “not assessed”, not “insulation not required”.
- Recorded pressures are reference values, not calculated hydrotest setpoints; review priorities are not fitness-for-service conclusions.
- Assistant/manual-search endpoints enforce same-origin requests and bounded payloads; the assistant no longer uses a Supabase service-role key or claims live telemetry.
- CI validates locked install, typecheck, lint, tests, and production build.

## Validation

- `npm run check`: TypeScript, ESLint (0 errors), and Vitest (10 files / 45 tests).
- `npm run build`: production bundle and generated PWA. Main application JavaScript is 701.31 kB (214.32 kB gzip), down from 1,069.79 kB (316.03 kB gzip) at baseline.
- Isolated browser review against the production preview with mocked Supabase REST/auth/storage. Final smoke review: 12 desktop/mobile/PWA checks passed with no runtime errors or backend writes; earlier workflow reviews covered search, filters, pagination, CSV, schedules, alerts, assistant, auth/news/about fit, unknown equipment, and unavailable-register honesty.
- Offline PWA review: generated worker control, linked manifest, unrestricted orientation, precached shell, offline dashboard reload, and offline lazy equipment route.
- No live Supabase project, deployment, or operational record was changed. The configured Supabase projects were inactive during review, so backend behavior was validated against migrations and isolated fixtures, not live data.

## Commands

```bash
npm ci
npm run images:optimize
npm run check
npm run build
npm run preview
```

Bun remains supported (`bun install`, `bun run dev`); both lockfiles are refreshed.
