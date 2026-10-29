# Expert AI GNL1

Expert AI GNL1 is the floating assistant in the GNL1Z asset-management workspace. It is a **bounded reference assistant**, not a live plant historian, prediction engine, or operating authority.

## What it can do

- Answer questions about the static equipment register, test-schedule fields, DCS/P&ID panel references, operational-manual titles, and explicitly simulated alarms.
- Use the current equipment page or an `Ask AI` deep link as context. An explicit tag in the question takes priority over neighboring equipment in the same unit.
- Return source cards that link to the relevant equipment, DCS panel, manual directory, or Smart Flow simulation view.
- Continue a short conversation (up to six prior messages are sent to the provider).
- Keep the current chat in `sessionStorage` for the browser tab, with an eight-hour expiry and a confirmed clear action.
- Work in English and French. The UI language follows the app language toggle.
- Stop an in-flight request, retry a failed or cancelled request, copy an answer, and jump to the latest message.

## What it must not do

- Claim real-time telemetry or live plant status.
- Invent tags, pressures, materials, dates, code editions, or acceptance criteria.
- Provide a hydrotest setpoint, lift plan, sling/shackle selection, torque value, insulation thickness, bypass, or operating instruction unless that information is explicitly present in approved supplied context.
- Treat simulated alarms as real events.
- Replace approved procedures, engineering judgment, or operating authorization.

When a value is missing, the assistant says it is not recorded. When no matching reference is found, it says so instead of guessing.

## Modes

| Mode | Meaning |
| --- | --- |
| `reference` | No provider key is configured. The endpoint returns a deterministic answer built only from the supplied static context. |
| `ai` | A configured Gemini provider generated the answer from minimized reference context. |
| `cache` | The same prompt, language, history, and scoped context were answered recently. The cached answer is returned without another provider call. |

The UI labels these honestly as **Static reference**, **AI-assisted**, or **Cached answer**. It does not display fake cache-hit or zero-latency badges.

## Data boundaries

The client sends only whitelisted fields:

- Equipment tag, name, unit, section, type, testing status, selected technical values, and register maintenance dates.
- DCS panel id, title, section, and related tags.
- Manual id, title, and category. **Drive IDs are not sent.**
- Simulated alarm tag, name, unit, severity, description, and `simulated: true`.
- Current equipment tag and up to six prior chat messages.

Spare-parts records, secrets, and unrelated database fields are excluded. The provider receives only the equipment/panels/manuals selected as sources, plus a compact catalog index and the simulated alarms.

Manual titles are references only. The assistant does not retrieve or quote manual content unless that content is explicitly supplied by an approved future integration.

## API contract

`POST /api/ai-agent`

Request:

```json
{
  "prompt": "Review X01-E-501 schedule",
  "lang": "en",
  "history": [{ "role": "user", "text": "..." }],
  "contextData": {
    "currentEquipmentTag": "X01-E-501",
    "masterEquipmentCatalog": [],
    "dcsPanelsList": [],
    "operationalManualsList": [],
    "simulatedSafetyAlarms": []
  }
}
```

Response:

```json
{
  "response": "Markdown answer",
  "model": "static-reference",
  "cached": false,
  "mode": "reference",
  "sources": [
    {
      "kind": "equipment",
      "id": "X01-E-501",
      "title": "X01-E-501 — Main condenser",
      "href": "/equipment/X01-E-501"
    }
  ]
}
```

Limits and protections:

- Same-origin requests only.
- Request body ≤ 512 KB.
- Prompt 1–2000 characters.
- History ≤ 6 messages, each truncated to 1200 characters.
- Provider timeout 20 s; client timeout 25 s.
- Provider failures return `503` instead of inventing an answer.
- Responses use `Cache-Control: no-store`.
- Per-IP rate limit defaults to 20 requests/minute and returns `429` with `Retry-After`.

The rate limiter is an in-memory, per-isolate best-effort control. For production, pair it with Cloudflare WAF/rate-limiting rules or a durable store if you need global enforcement.

## Configuration

Server-side only:

- `GEMINI_API_KEY` — optional. Without it, the assistant runs in static-reference mode.
- `GEMINI_MODEL` — optional, defaults to `gemini-2.5-flash`.
- `ASSISTANT_RATE_LIMIT_PER_MIN` — optional, defaults to `20`.

Never expose these through `VITE_*` variables.

## Local development and preview

`vite.config.ts` includes a dev/preview-only middleware that bridges `/api/ai-agent` to the Cloudflare Pages Function. It honors `x-forwarded-proto` and `x-forwarded-host` so same-origin checks work behind the HTTPS preview proxy. Production deployments use the real Pages Function in `functions/api/ai-agent.ts`.

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

- `src/test/assistant.test.ts` — context selection, history bounds, session storage, follow-ups.
- `src/test/assistantChat.test.tsx` — send, source cards, retry, stop, clear, deep links.
- `src/test/aiAgentEndpoint.test.ts` — origin/payload limits, reference answers, provider minimization/cache/failure, sources, rate limiting, history bounds.
- `src/test/markdownText.test.tsx` — safe Markdown rendering and internal-only links.

Run `npm run check` for typecheck, lint, and the full test suite.
