# Start here

This ZIP contains the enhanced GNL1Z Asset Management Elite source and a tested production build.

## Included

- React/TypeScript/Vite source, Supabase migrations, Cloudflare Pages Functions, Electron entry files, and PWA configuration
- `dist/` — production build generated from this source
- `docs/` — enhancement notes, production-readiness checklist, engineering validation checklist, and validation report
- `.env.example` — safe environment template
- `.github/workflows/ci.yml` — validation CI

## Excluded intentionally

- `.env` and real credentials
- `node_modules/`, `.git/`, logs, caches, and TypeScript build info
- Live Supabase data and deployment secrets

## Run locally

```bash
npm ci
npm run preview
```

Open the printed local URL, normally `http://localhost:8081`. The preview serves the included `dist/` build.

To rebuild from source:

```bash
cp .env.example .env
# Fill in client-safe Supabase values.
npm run check
npm run build
npm run preview
```

For development with hot reload, use `npm run dev` (port 8080).

## Before production use

1. Read `docs/PRODUCTION_READINESS.md`.
2. Review backend RLS/roles, storage buckets, backups, and hosting secrets in a staging project.
3. Complete `docs/ENGINEERING_VALIDATION.md` with the responsible process/inspection/rigging engineers.
4. Deploy `dist/` plus the `functions/` runtime together if assistant/manual-search APIs are required. Review `docs/AI_ASSISTANT.md` for Expert AI GNL1 boundaries, server-side variables, and rate limiting.
5. Run live staging acceptance tests before connecting operational users.

The ZIP is a release candidate, not a production certification.
