# GNL1Z Asset Management Elite — architecture

Verified against the repository at `0aa0cf5` (2026-10-30). This document
describes what is actually built, not what was intended.

## 1. Shape of the system

```
                       ┌──────────────────────────────────────────┐
  Browser / PWA  ──────▶  React 18 + TypeScript SPA (Vite)         │
  (offline-first)│      │  19 routes, 24 libs, IndexedDB via Dexie │
                 │      └────────────┬─────────────────────────────┘
                 │                   │  fetch (same origin)
                 │      ┌────────────▼─────────────────────────────┐
                 │      │  Cloudflare Pages Functions (Workers)    │
                 │      │   /api/ai-agent   /api/news              │
                 │      │   /api/search-manual  /health            │
                 │      └────────────┬─────────────────────────────┘
                 │                   │  Gemini (server-side key only)
                 │      ┌────────────▼─────────────────────────────┐
                 └─────▶│  Supabase (Postgres + Auth + Storage)    │
                        │   Edge Fn: detect-dcs-instruments        │
                        └──────────────────────────────────────────┘
```

**Everything the browser renders about the plant comes from static, versioned
data committed to the repository.** Equipment register, P&ID index, DCS tags,
manual metadata and process coordinates are JSON/TS modules in `src/data`. The
database is used for what is genuinely per-user and mutable: maintenance logs,
test dates, notes, alerts, photos, DCS detections.

That split is deliberate: an operator in a plant with no signal still gets the
register, the drawings and the instrument index.

## 2. Frontend

| Concern | Where | Notes |
|---|---|---|
| Routing | `src/App.tsx` | 19 routes, lazy-loaded pages |
| Auth | `src/contexts/AuthContext.tsx` | Supabase email/OAuth, PKCE |
| i18n | `src/contexts/I18nContext.tsx` | EN/FR, industrial vocabulary |
| Offline | `src/lib/db.ts` (Dexie), `src/lib/sync.ts` | stable client IDs, retry queue, idempotent upload paths |
| Equipment register | `src/data/gnl1z_database.json` (292 KB), `src/data/index.ts` | 77 equipment records |
| P&ID knowledge | `src/data/pid_index.json` + `pid_index_text.json`, `src/lib/pidIndex.ts` | built offline, never OCR'd at runtime |
| Instruments | `src/lib/instrumentIndex.ts`, `src/lib/instrumentTags.ts` | ISA-5.1 decoding + plant conventions |
| Assistant | `src/lib/assistantKnowledge.ts` (client) + `functions/api/ai-agent.ts` (server) | deterministic answers first, Gemini narration second |
| Documents | `src/lib/documentAccess.ts`, `src/lib/storageUrl.ts` | classification + signed URLs |

**State:** no global store. React context for auth/i18n, local state and
IndexedDB elsewhere. That keeps the bundle small and the failure modes obvious.

## 3. Backend

### Cloudflare Pages Functions (`functions/`)
- `api/ai-agent.ts` — intent detection, deterministic (knowledge-backed) answers,
  in-memory cache, Gemini narration. `line_sizes` / `line_count` / `pid` intents
  are answered without any model call.
- `api/news.ts`, `api/search-manual.ts` — same-origin only, allow-listed Drive
  IDs, per-IP limits.
- `health.ts`.

### Supabase Edge Function (`supabase/functions/`)
- `detect-dcs-instruments` — Gemini vision over a DCS panel image, result
  sanitised and cached. Requires a JWT (see `docs/SECURITY.md`).

### Postgres
Nine migrations, `20260502…` → `20261030…`. Tables: `profiles`,
`maintenance_logs`, `equipment_test_dates`, `equipment_notes`,
`equipment_images`, `alerts`, `fast_alerts`, `dcs_detected_instruments`,
`news_cache`, `ai_responses_cache`, plus `audit_log`,
`rate_limit_counters` and `engineering_documents` added in this phase.

## 4. Storage buckets

| Bucket | Public | Holds | Created by |
|---|---|---|---|
| `equipment-images` | yes (accepted risk R-02) | DCS panel screenshots, P&ID copies | dashboard; now declared in migration |
| `equipment-photos` | no (after migration) | equipment photographs | migration 20261030000002 |
| `alert-photos` | no (after migration) | incident photographs | migration 20261030000002 — **was missing from migrations** |
| `restricted-documents` | no | classified P&IDs, PFDs, manuals | migration 20261030000002 |

## 5. Where trust is established

| Data | Source | Verified? |
|---|---|---|
| Equipment register | CSV imported into `src/data` | plant master data; `last_updated` 2026-04-29 |
| Pipe sizes from line list | user CSV → `src/lib/lineListCsv.ts` | **yes** — the only verified size source |
| Pipe sizes from drawings | OCR of the P&ID scans | **no** — `verified: false`, always flagged |
| DCS instrument tags | Gemini vision over panel screenshots | **no** — `verified: false` |
| DCS tag → equipment mapping | committed map + index | derived, indicative |
| Maintenance records | user input | lifecycle-gated (draft → submitted → reviewed → approved) |

Nothing in the application approves an engineering decision. A record only
reaches `APPROVED` when a role with approval authority moves it there, and never
by the person who performed the work.

## 6. Non-goals

The application does not control plant equipment, write to a DCS or SIS, change
setpoints, bypass alarms or interlocks, certify equipment as safe, or replace an
approved operating procedure. There is no code path that could: no write target
other than the Supabase tables listed above exists.
