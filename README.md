# GNL1Z Asset Management

Industrial LNG asset management platform for Sonatrach GL1/Z.

**Repository:** `https://github.com/djslimaniunivboumerdes-netizen/GNL1Z-Asset-Management`

## Features

- React + TypeScript + Vite
- Cloudflare Workers deployment
- Supabase backend
- Electron desktop support
- PWA support
- QR equipment scanning
- Industrial-ready architecture
- GitHub Actions CI/CD

## Quick Start

```bash
# 1. Clone
git clone https://github.com/djslimaniunivboumerdes-netizen/GNL1Z-Asset-Management.git
cd GNL1Z-Asset-Management

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
# Fill in your Supabase values

# 4. Run dev server
bun run dev
```

## GitHub Actions Secrets (Required for CI/CD)

Go to **Repository Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Cloudflare Workers edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID |

**Never commit these to the repository.** Use GitHub secrets only.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `CI` | PR / push to `main` | Lint, typecheck, test, build |
| `Deploy` | Push to `main` | Build & deploy to Cloudflare Workers |
| `Release` | Push tag `v*` | Build Electron apps (Windows + Linux) and create GitHub release |

## Local Wrangler Development

```bash
# Run Cloudflare Workers dev server
bun run cf:dev

# Deploy manually
bun run deploy

# Deploy to staging
bun run deploy:staging
```

## Build Desktop App

```bash
# Windows
bun run electron:build:win

# Linux
bun run electron:build:linux
```

## Project Structure

```
├── .github/workflows/      # CI/CD pipelines
├── electron/               # Electron main process
├── public/                 # Static assets (PWA icons, headers, redirects)
├── src/                    # React app source
│   ├── components/ui/      # shadcn/ui components
│   ├── contexts/           # Theme & i18n contexts
│   ├── data/               # Static data (DCS tags, equipment, manuals)
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Supabase client
│   ├── lib/                # Utility functions
│   ├── pages/              # Route pages
│   ├── worker.ts           # Cloudflare Worker entry
│   └── main.tsx            # React app entry
├── supabase/
│   ├── functions/          # Edge functions (AI DCS detection, news feed)
│   └── migrations/         # Database migrations
├── wrangler.toml           # Cloudflare Workers config
└── vite.config.ts          # Vite build config
```

## License

Proprietary — Sonatrach GL1/Z Operations.
