# Balanced enhancement pass

This pass keeps the existing industrial visual language while fixing high-impact workflow, mobile, and loading problems.

## Expert AI GNL1 enhancement

- The assistant is named **Expert AI GNL1** and is explicitly a bounded, source-backed reference assistant, not a prediction engine or live telemetry source.
- Equipment alias normalization resolves variants such as `e 501`, `E-501`, `X01 E 501`, and `X01-E 501` to `X01-E-501`, and dotted legacy tags such as `G 780` to `X06-G-07.80`. Ambiguous short tags ask the user to choose; unknown tags are never substituted with neighbors.
- A generated knowledge index covers 77 register records, 44 local P&ID PDFs / 30 sheet references, 23 DCS panels, 23 manual titles, and 69 drawing-only tags. One Smart Flow identity conflict (`E0520` declared as `X06-E-05.30`) is kept explicit and excluded from register aliases.
- Piping count/size questions are answered only from a user-supplied line-list CSV (browser-parsed, ≤256 KB / 1000 rows; only matching rows sent). Without a CSV the assistant reports “Piping answer not yet verified” instead of inventing topology or dimensions. A derived, provenance-labeled register CSV and coverage report are published under `/data/`.
- Equipment-aware answers prioritize an explicit tag over page context and neighboring unit matches, flag missing register fields, and return source cards for equipment, P&IDs, DCS panels, manuals, CSV, and simulated alarms. Manual text is retrieved only through the existing same-origin manual-search endpoint when available.
- Chat history persists per browser tab with an eight-hour expiry, confirmed clear, copy, stop, retry, follow-up prompts, and Enter/Shift+Enter keyboard handling.
- The endpoint rebuilds evidence from its own checked index, accepts bounded history/line-list/manual snippets, returns `sources[]`, `intent`, `verifiedLineList`, and `resolution`, and applies a best-effort per-IP rate limit (`429` + `Retry-After`). Gemini narrates deterministic answers only for non-piping resolved questions; provider failures are logged and fall back to the bounded reference answer (`providerFallback: true`) instead of failing the chat.
- A dev/preview-only Vite middleware bridges `/api/ai-agent` and `/api/search-manual` to the Pages Functions so the assistant works behind the HTTPS preview proxy.
- Follow-up validation: `npm run check` passed with 16 test files / 87 tests; build passed; API smoke verified alias variants, E520 coverage gap, CSV-backed count, and unknown G781. See [AI_ASSISTANT.md](AI_ASSISTANT.md) for the full contract and safety boundaries.

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

## Senior takeover review (2026-10-29)

Full-stack + P&ID engineering review of merged `main`, implemented on branch `arena/dd66957c-gnl1z-asset-management-elite`.

- **P&ID Library shipped.** The finished 695-line P&ID catalog page (`src/pages/PIDViewer.tsx`) existed but was never routed — a gap, not a design choice. It is now reachable at `/pids` (sidebar entry + ⌘K global search), covering 30 sheets across 12 process sections with bilingual UI.
- **Local vector PDFs.** The index builder now also emits `src/data/pid_sheet_files.json`; 28/30 sheets resolve to locally served vector PDFs (`/pids/*.pdf`). The viewer prefers the local PDF (browser-native, offline-capable via the PWA image/PDF caches) and keeps Google Drive as preview/fallback; cards carry a `LOCAL` badge.
- **Dead code removed (45 files).** Unrouted pages `DigitalTwin` (fake-telemetry toy), `ProcessFlow` (superseded by Smart Flow), `PFDCoordinateCalibration` (OCR dev tool); stub components `CreateAlert`, `FastAlertPanel`, `NavLink`; 32 unused shadcn/ui files; orphan `lib/testSchedule`, `utils/extractTagCoordinates`, `data/process_nodes`, `data/processFlowCoordinates.ts`, `integrations/supabase/storage`; plus `public/manifest.json` (duplicate of the generated `manifest.webmanifest`), `capacitor.config.ts` (no Capacitor dependencies), and empty unreferenced `equipment_master.json`.
- **Dependencies slimmed (30 removed).** `reactflow`, `tesseract.js`, `zod`, `react-hook-form` + `@hookform/resolvers`, `embla-carousel-react`, `input-otp`, `vaul`, `react-day-picker`, `date-fns`, `react-resizable-panels`, 19 unused Radix packages, `eslint-config-prettier`. Both lockfiles regenerated (`package-lock.json`, `bun.lock`); npm ci drops from 1,155 to ~1,070 packages.
- **Supply chain: `npm audit` 22 → 4.** Upgraded `react-router-dom` 6 → 7.18.5 (fixes CVE-2025-68470 open-redirect; app only navigates to internal paths, tests green), `sharp` → 0.35.5, `electron` → 45, `electron-builder` + `electron-builder-squirrel-windows` → 26.18 (fixes the critical `tar` chain). Remaining 4 findings are low-severity `vite-plugin-pwa`/`workbox-build` build-tool advisories with no patched release.
- **`/api/search-manual` hardening.** Same-origin only with origin echo (wildcard `Access-Control-Allow-Origin: *` removed), per-IP rate limit (default 15/min, env `MANUAL_RATE_LIMIT_PER_MIN`, `429` + `Retry-After`), drive IDs restricted to the checked-in `MANUALS` catalogue (no arbitrary Drive pulls), ≥2-character queries, and late-rejection guards so timed-out Drive fetches cannot become unhandled rejections. Covered by a new 6-test endpoint suite.
- **Correctness fixes.** `index.html` social preview pointed at missing `/sonatrach-logo.png` (asset added to `public/`); `package.json` was missing Electron's `main` entry (`electron/main.js`), so `npm run electron:dev` could never start; Manuals search button disabled until ≥2 characters to match the API contract.

## Validation

- `npm run check`: TypeScript, ESLint (0 errors / 10 existing warnings), and Vitest (16 files / 87 tests).
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
