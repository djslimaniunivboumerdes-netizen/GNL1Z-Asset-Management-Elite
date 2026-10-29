# Expert AI GNL1

Expert AI GNL1 is the floating assistant in the GNL1Z asset-management workspace. It is a **bounded reference assistant**, not a live plant historian, prediction engine, or operating authority.

## What it can do

- Resolve equipment naming variants such as `e 501`, `E-501`, `E501`, `X01 E 501`, `X01-E 501`, and `X01-E-501` to the same register tag, and dotted legacy tags such as `G 780` to `X06-G-07.80`.
- Answer questions about the static equipment register, test-schedule fields, DCS/P&ID references, operational-manual references, and explicitly simulated alarms.
- Answer piping count and connected pipe-size questions **only** from a user-supplied line-list CSV. Without one, it reports a coverage gap instead of inventing a count or size.
- Use the current equipment page or an `Ask AI` deep link as context. An explicit tag in the question takes priority over page context and neighboring equipment.
- Return source cards that link to equipment, P&ID PDFs, DCS panels, the manual directory, the derived register CSV, or a supplied line list.
- Continue a short conversation (up to six prior messages are sent to the provider).
- Keep the current chat in `sessionStorage` for the browser tab, with an eight-hour expiry and a confirmed clear action.
- Work in English and French. The UI language follows the app language toggle.
- Stop an in-flight request, retry a failed or cancelled request, copy an answer, and jump to the latest message.

## Source coverage and limits

The assistant ships with a generated knowledge index (`src/data/assistant_knowledge.json`) built from the repository's checked sources:

- 77 equipment register records (`src/data/gnl1z_database.json`).
- 44 local P&ID PDF files and 30 curated P&ID sheet references. The PDFs are vector-only and **not text-indexed**; a filename or sheet match does not verify connections, line counts, or pipe sizes.
- 23 DCS panel references with pre-scanned instrument tags. Images are not re-verified in the answer.
- 23 operational-manual titles. Manual text is retrieved only through the existing same-origin `/api/search-manual` endpoint when available; failures degrade to title references.
- 69 drawing-only tags that appear on P&IDs/DCS/Smart Flow but are not in the 77-record register. These are kept separate from register records.

A machine-readable coverage report is published at `/data/assistant_coverage.json`. A derived, provenance-labeled equipment register CSV is available at `/data/gnl1z_equipment_register.csv`; it is **not** an original source document.

### Piping questions

Questions such as “How many pipelines associated with E-520?” or “What piping sizes are connected to G 781?” are handled deterministically:

1. Resolve the tag. Unknown tags are reported as not found; ambiguous short tags ask the user to choose. The assistant never substitutes a nearby tag (for example, `G781` is not silently treated as `G780`).
2. If a line-list CSV is attached, count distinct line numbers in `from`/`to` columns and list recorded sizes with CSV row citations. Counts and sizes are only as complete as the supplied CSV.
3. If no line list is loaded, return “Piping answer not yet verified” and point to the matched P&ID/manual references.

Attach a CSV/TSV line list with columns such as `line`, `from`, `to`, `size` (English or French headers are accepted). Files are parsed in the browser (≤256 KB, ≤1000 rows); only matching rows (≤200) are sent to the API. The raw file is not uploaded.

### Identity conflict kept explicit

Smart Flow declares `E0520` / `106-E05.20` with database tag `X06-E-05.30`, while a separate drawing asset `E520` exists. The conflicting flow alias is **excluded from register aliases** and attached only to the drawing-only `E520` asset. The conflict is recorded in the knowledge index and coverage report; the assistant does not silently merge the two identities.

## What it must not do

- Claim real-time telemetry or live plant status.
- Invent tags, pressures, materials, dates, code editions, acceptance criteria, pipeline counts, or pipe sizes.
- Infer piping topology from a P&ID filename, co-listed equipment, or a drawing-only tag.
- Provide a hydrotest setpoint, lift plan, sling/shackle selection, torque value, insulation thickness, bypass, or operating instruction unless that information is explicitly present in approved supplied context.
- Treat simulated alarms as real events.
- Replace approved procedures, engineering judgment, or operating authorization.

When a value is missing, the assistant says it is not recorded. When no matching reference is found, it says so instead of guessing.

## Modes

| Mode | Meaning |
| --- | --- |
| `reference` | Deterministic answer built only from checked sources. Used when no provider key is configured, for piping count/size questions, and for unknown/ambiguous tags. |
| `ai` | A configured Gemini provider narrates the deterministic, source-backed answer. It is instructed not to add unsupported facts. |
| `cache` | The same prompt, language, history, and scoped context were answered recently. The cached answer is returned without another provider call. |

The UI labels these honestly as **Static reference**, **AI-assisted**, or **Cached answer**. It does not display fake cache-hit or zero-latency badges.

## Data boundaries

The client sends only whitelisted fields:

- Prompt, language, up to six prior chat messages, and current equipment tag.
- Matching line-list rows (line number, from/to, size, service, spec, insulation) and file name, when a CSV is attached.
- Optional manual snippets returned by the same-origin manual-search endpoint.
- Simulated alarm tag, name, unit, severity, description, and `simulated: true`.

The server rebuilds evidence from its own checked knowledge index; it does not trust client-supplied equipment values. Spare-parts records, secrets, Drive IDs, and unrelated database fields are excluded from provider context.

## API contract

`POST /api/ai-agent`

Request:

```json
{
  "prompt": "How many pipelines associated with E-520?",
  "lang": "en",
  "history": [{ "role": "user", "text": "..." }],
  "contextData": {
    "currentEquipmentTag": "X01-E-501",
    "simulatedSafetyAlarms": []
  },
  "lineList": {
    "fileName": "line-list.csv",
    "rows": [{ "row": 2, "lineNumber": "L-100", "from": "E-520", "to": "R-792", "size": "DN 80" }]
  },
  "manualEvidence": [{ "id": "S01", "title": "S01 — MEA", "snippets": ["..."] }]
}
```

Response:

```json
{
  "response": "Markdown answer",
  "model": "static-reference",
  "cached": false,
  "mode": "reference",
  "intent": "line_count",
  "verifiedLineList": false,
  "resolution": { "status": "resolved", "tags": [{ "input": "E-520", "tag": "E520" }] },
  "providerFallback": true,
  "sources": [
    { "kind": "pid", "id": "x06-1", "title": "85-X06-10.1 — E520 R792 R793", "href": "/pids/E520 R792 R793.pdf" }
  ]
}
```

Limits and protections:

- Same-origin requests only.
- Request body ≤ 512 KB.
- Prompt 1–2000 characters.
- History ≤ 6 messages, each truncated to 1200 characters.
- Line list ≤ 200 rows; manual evidence ≤ 5 manuals × 3 snippets × 500 characters.
- Provider timeout 20 s; client timeout 25 s.
- Provider failures are logged server-side and fall back to the bounded reference answer (`mode: "reference"` with `providerFallback: true`) instead of failing the chat; `503` is returned only if no reference answer exists.
- Responses use `Cache-Control: no-store`.
- Per-IP rate limit defaults to 20 requests/minute and returns `429` with `Retry-After`.

The rate limiter is an in-memory, per-isolate best-effort control. For production, pair it with Cloudflare WAF/rate-limiting rules or a durable store if you need global enforcement.

## Configuration

Server-side only:

- `GEMINI_API_KEY` — optional. Without it, the assistant runs in static-reference mode.
- `GEMINI_MODEL` — optional, defaults to `gemini-2.5-flash`.
- `ASSISTANT_RATE_LIMIT_PER_MIN` — optional, defaults to `20`.

Never expose these through `VITE_*` variables.

## Rebuilding the knowledge index

```bash
node scripts/build-assistant-index.mjs
```

The script reads the register, DCS panel/tag data, manual titles, P&ID sheet metadata, Smart Flow tags, and local P&ID filenames, then writes:

- `src/data/assistant_knowledge.json`
- `public/data/gnl1z_equipment_register.csv` (derived, BOM-prefixed, provenance-labeled)
- `public/data/assistant_coverage.json`

Re-run it after changing the register, DCS panels, manuals, or P&ID filenames. The build does not invent connectivity; it only indexes references that already exist in the repository.

## Local development and preview

`vite.config.ts` includes a dev/preview-only middleware that bridges `/api/ai-agent` and `/api/search-manual` to the Cloudflare Pages Functions. It honors `x-forwarded-proto` and `x-forwarded-host` so same-origin checks work behind the HTTPS preview proxy. Production deployments use the real Pages Functions in `functions/api/`.

## Deep links

Pages can open the assistant with context:

```ts
window.dispatchEvent(
  new CustomEvent("gnl1z:ask-ai", {
    detail: { prompt: "Review the schedule for X01-E-501", equipmentTag: "X01-E-501" },
  }),
);
```

Equipment Detail and Smart Flow already use this pattern.

## Tests

- `src/test/equipmentAliases.test.ts` — alias keys, format variants, ambiguity, unknown tags, page-context fallback.
- `src/test/lineListCsv.test.ts` — delimiter detection, deduplication, size normalization, missing-column warnings.
- `src/test/assistantKnowledge.test.ts` — intent detection, coverage-gap answers, CSV-backed counts/sizes, unknown tags, French boundaries.
- `src/test/assistant.test.ts` — context selection, history bounds, session storage, follow-ups.
- `src/test/assistantChat.test.tsx` — send, source cards, CSV attach with row filtering, retry, stop, clear, deep links.
- `src/test/aiAgentEndpoint.test.ts` — origin/payload limits, reference answers, provider minimization/cache/failure, sources, rate limiting, history bounds, piping coverage gap, CSV-backed deterministic answers.
- `src/test/markdownText.test.tsx` — safe Markdown rendering and internal-only links.

Run `npm run check` for typecheck, lint, and the full test suite.
