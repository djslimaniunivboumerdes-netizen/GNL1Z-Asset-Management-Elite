# GNL1Z Asset Management Elite

Industrial LNG asset-management web app for Sonatrach GL1/Z, built with React, TypeScript, Vite, Supabase, Dexie, and a generated PWA.

**Status:** enhanced release candidate. The UI, offline workflow, and build are validated with isolated fixtures; live backend authorization and engineering sign-off are still required before operational production use.

## Quick start

```bash
npm ci
cp .env.example .env
# Fill in the Supabase project URL and publishable/anon key.
npm run dev
```

Bun is also supported (`bun install`, `bun run dev`). The npm lockfile is the canonical CI lockfile.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite development server on port 8080 |
| `npm run check` | TypeScript + ESLint + Vitest |
| `npm run build` | Typecheck, production bundle, and generated PWA in `dist/` |
| `npm run preview` | Serve the production build on port 8081 |
| `npm run images:optimize` | Regenerate used responsive WebP hero derivatives |
| `npm run electron:build:win` | Windows desktop package |
| `npm run electron:build:linux` | Linux desktop package |

## Environment

Client variables are documented in `.env.example`. Only the Supabase publishable/anon key belongs in browser-facing variables. Never expose a Supabase service-role key or AI provider key through `VITE_*`.

Optional Cloudflare Pages Function variables:

- `GEMINI_API_KEY` — server-side AI provider key. Without it, Expert AI GNL1 returns bounded static-reference answers only. Piping count/size answers always require a user-supplied line-list CSV and stay deterministic even when a key is configured.
- `GEMINI_MODEL` — optional provider model override.
- `ASSISTANT_RATE_LIMIT_PER_MIN` — optional per-IP assistant rate limit, default `20`.

See [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md) for equipment alias normalization, source coverage, line-list CSV ingestion, data boundaries, modes, API contract, and the local preview bridge. Rebuild the knowledge index with `node scripts/build-assistant-index.mjs` after changing register/DCS/manual/P&ID references.

## Deployment

`npm run build` produces the static/PWA assets in `dist/`. The `functions/` directory contains Cloudflare Pages Functions for the assistant, manual search, and health endpoint. A static-only deployment will still serve the register and offline shell, but `/api/*` endpoints require a compatible functions runtime.

Before deployment, review [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md), apply backend migrations only to a reviewed staging project, configure secrets in the hosting platform, and verify the live auth/storage/RLS workflows.

## CI

`.github/workflows/ci.yml` runs locked installation, typecheck, lint, regression tests, and the production build on pull requests and pushes to `main`. Deployment/release workflows are intentionally not included until hosting and backend approval are configured.

## Documentation

- [START_HERE.md](START_HERE.md) — ZIP contents and local run instructions
- [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md) — completed enhancement pass
- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) — prioritized remaining work
- [docs/ENGINEERING_VALIDATION.md](docs/ENGINEERING_VALIDATION.md) — process/P&ID/engineering assumptions and sign-off checklist
- [docs/VALIDATION_REPORT.md](docs/VALIDATION_REPORT.md) — final validation results

## Safety notice

This application is decision support, not a control system, fitness-for-service assessment, approved test procedure, lift plan, or operating authorization. Simulated process alarms are not live telemetry. Engineering outputs must be verified against approved site procedures, current P&IDs, manufacturer data, and competent-engineer review.

## License

Proprietary — Sonatrach GL1/Z Operations.
