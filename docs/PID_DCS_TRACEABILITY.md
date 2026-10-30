# P&ID, DCS and instrumentation traceability

Scope: how a tag, a line, a drawing, a piece of equipment and a maintenance
record are connected in this application, and how much of each connection can
be trusted.

## The model

```
   P&ID drawing ────── equipment tag ────── equipment record ────── maintenance history
        │                   │                      │                        │
   line callout        instrument tag          DCS panel              inspection / test
   (sizes, service)    (ISA function)         (screenshot)           (status lifecycle)
        │                   │                      │
        └──── engineering_documents ──── dcs_detected_instruments ──┘
             (revision, page,           (tags + confidence)
              classification)
```

All of it is queryable from two places:

- **Equipment → Connections tab** (`src/components/PidConnections.tsx`): which
  drawings carry this tag, what sizes and line callouts were read on them, and
  which DCS panels show its instruments.
- **Instrument finder** (`/instruments`): search a tag, get the ISA meaning, the
  equipment it belongs to, the panels it appears on — and, since 2026-10-30, the
  drawings that cover its unit, what those drawings show around it, and a
  "Locate" panel listing every specification with its source.
- **Drawing → instruments** (`/pids?file=…`): each indexed sheet deep-links to
  `/instruments?unit=NN`, listing the instruments of that unit.

## What is implemented

| Requirement | Status | Where |
|---|---|---|
| OCR text extraction | **Done** | `scripts/ocr_pid_pages.py`, 44/44 sheets at 300 dpi |
| Coverage of shipped drawings | **Done — verified 2026-10-30** | `src/test/pidCoverage.test.ts`: 44 PDFs on disk = 44 indexed, 0 orphans, figures in `docs/PID_INDEX.md` |
| Tag recognition | **Done** | `scripts/build-pid-index.mjs`, 193 tags mapped |
| Line number recognition | **Done (indicative)** | 521 line callouts, OCR digits unreliable |
| Equipment identification | **Done** | register tags + drawing-only assets (`E520`, …) |
| Instrument-symbol detection | **NOT DONE** | would need vector or symbol-template matching; not attempted |
| Document revision identification | **Partial** | drawing numbers curated; revision not OCR'd per sheet |
| Search by tag and equipment | **Done** | `connectionsForTag`, `searchPidText` |
| Instrument → drawing placement | **Done (unit-level)** | `src/lib/instrumentLocation.ts`: 497 of 528 tags placed, 31 unplaceable |
| Drawing → instrument list | **Done** | `instrumentCountForUnit`, `/instruments?unit=NN` |
| Source-page references | **Done** | every answer cites sheet + `/pids?file=…` |
| Confidence scoring | **Partial** | per-sheet `verified` flag; no per-reading confidence yet |
| Manual correction / reviewer approval | **NOT DONE** | no UI for correcting an OCR reading |

## Placing an instrument on a drawing

The question "where is this instrument?" is answered **at unit level**, and the
answer says so. `src/lib/instrumentLocation.ts` ties a tag to the drawings of its
unit in two ways, because a sheet can be identified either way:

1. **Drawing number** — `LIC101204` is in unit `01`, so every sheet numbered
   `85-X01-…` is a candidate (13 of the 44 sheets carry no readable number).
2. **Equipment on the sheet** — every sheet showing equipment known to be in the
   instrument's unit, which is what catches the sheets without a number.

Measured on the current corpus (528 indexed instruments):

| Figure | Value | How it was measured |
|---|---|---|
| Instruments with at least one drawing | **497 / 528** | `instrumentContext().placements.length > 0` |
| Instruments no drawing can be tied to | **31** | no readable unit code in the tag |
| Drawings per instrument | 1–7 | one unit has 6–7 sheets |
| Instruments of a unit | e.g. unit 06 → 81 across trains 1/2/3/5/6 | `instrumentCountForUnit` |

What this does **not** do, and why:

- **It never says "this tag is on this sheet".** Instrument bubbles are graphics.
  Measured: of 466 tags carrying a 5-or-more-digit number, 434 appear nowhere in
  the drawing text; the 32 that "match" are coincidental substrings inside line
  numbers and service text (`6X051051938` contains `10519`). So the panel states
  that the exact position is unknown and tells the engineer to open the drawing
  and look for the loop number.
- **It never says "this instrument is tapped into line X".** Loop numbers are
  1–3 digits, and a 3-digit search matches 137 of 200 sheets — noise. The lines
  read on the drawing are listed as *what the drawing carries*, explicitly not
  asserted as this instrument's connection.
- **Nothing is marked verified.** Every specification row carries a source badge
  — ISA tag, DCS scan, Register, or Drawing (OCR) — and only the equipment
  register rows are marked verified. The panel ends with the unavailable fields
  (calibrated range, span, model, datasheet) rather than leaving them blank.

## Instrument register fields

| Field | Source | Verified |
|---|---|---|
| Tag number | drawing OCR / DCS vision | no |
| ISA interpretation | `src/lib/instrumentTags.ts` (deterministic) | decoding only — **not** proof of function |
| Plant-specific interpretation | `src/data/dcs_tags.ts`, `dcs_equipment_map.ts` | curated |
| Service, unit, process line | not extracted | — |
| Associated equipment | curated map + register | derived |
| P&ID number | curated drawing numbers, OCR fallback | mixed |
| P&ID revision | **not captured** | — |
| DCS panel | `src/data/dcs_panels.ts` | curated |
| Loop number | parsed from the tag (`parseInstrumentTag`) | decoded — **not** proof of the loop folder |
| Unit / section | parsed from the tag + `UNIT_CATALOGUE` | decoded, cross-checked against the register |
| Signal type, range, units, alarms | **not captured** | — |
| Extraction confidence | `verified` boolean per sheet | no per-tag confidence |
| Verification status | `verified: false` everywhere | **nothing is verified yet** |

ISA tag decoding is *not* evidence of the real instrument function: two plants
use the same letters differently, and a decoded tag says nothing about range,
service or loop. The UI states this wherever it shows a decoded meaning.

## Trust states, in code

```ts
type Verification = {
  verified: false            // every indexed sheet today
  method: "rapidocr" | "gemini-vision"
  confidence?: number        // reserved, not populated
  reviewedBy?: string        // set only when an engineer signs off
}
```

The assistant and the UI derive their wording from this flag. An unverified
reading is always presented with:
1. the drawing it came from (title + drawing number + link),
2. a statement that no engineer has signed it off,
3. a warning that OCR confuses digits and separators,
4. the instruction to treat it as a pointer to where to look, not a design value.

The piping line list supplied by the user (`src/lib/lineListCsv.ts`) remains the
only verified size source and takes precedence whenever it is present.

## Database support

`public.engineering_documents` (migration `20261030000001`) is the register this
traceability will hang from: `doc_type`, `tag`, `drawing_no`, `revision`,
`revision_date`, `classification`, `storage_path`, `source_page`,
`extraction_method`, `extraction_confidence`, `verified`, `verified_by`,
`verified_at`. It is created but **not populated** — populating it is part of the
document migration that needs authorisation.

## Remaining work, in priority order

1. **Reviewer approval UI** — let an engineer correct an OCR reading and flip
   `verified` to true, with `verified_by` / `verified_at` recorded.
2. **Per-reading confidence** — store a score per size/callout instead of one
   flag per sheet; let the UI dim low-confidence readings.
3. **Revision capture** — OCR the title-block revision per sheet and compare it
   against the approved revision list.
4. **Line-level graph** — a `lines` table (line number, from, to, size, service,
   class) parsed from the line list, so "what is connected to E-520" can be
   answered from verified data instead of OCR.
5. **Instrument attributes** — loop, range, units, signal type, from the loop
   diagrams or the DCS export.
