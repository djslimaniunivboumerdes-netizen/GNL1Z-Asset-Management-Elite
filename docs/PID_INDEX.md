# P&ID index — how the assistant answers drawing questions

**Status (2026-10-30):** 44 drawings indexed by OCR. **0 verified** — no extraction has
been signed off by a process engineer yet.

## The problem

The P&ID library is 44 scanned PDFs. There is **no text layer** in any of them
(verified with `pypdf`: 0 extractable characters per sheet), so a question like
*"what pipe sizes are connected to E-520?"* can only be answered by reading the
image — and re-reading an image on every question is slow, expensive and
non-deterministic.

## The approach: read once, store, cite

```
scripts/ocr_pid_pages.py    rasterise + OCR each drawing once   (~15 s/sheet, resumable)
        ↓  pid_work/ocr/<sheet>.json  (not committed)
scripts/build-pid-index.mjs parse → filter → resolve tags        (seconds)
        ↓
src/data/pid_index.json       compact: sizes, callouts, tags, drawing no.  (committed)
src/data/pid_index_text.json  every OCR line, for on-device retrieval       (committed)
        ↓
src/lib/pidIndex.ts           query layer (connectionsForTag, searchPidText)
        ↓
assistant + UI               instant answers, every value cited to its drawing
```

- **No OCR at query time.** The assistant reads static JSON; responses are
  deterministic and fast, and work offline.
- **Every answer names its drawing** (title, drawing number, link) so the reading
  can be checked at source.
- **Sources were consolidated, not duplicated.** The local repository PDFs
  (`public/pids/`) are byte-identical to the Drive copies for the indexed sheets
  and are served from the same origin, so they are the extraction source. The
  per-equipment PDFs in Supabase Storage (`equipment/E-501.pdf`, …) are the better
  *display* source for a single tag — the UI links the sheet; Storage keeps the
  per-equipment crops.

## Trust model

| State | Meaning | Badge in the UI |
|---|---|---|
| `verified: false` | Read by OCR over a raster; filtered to standard NPS/DN sizes. Indicative only. | amber *"OCR reading — not verified"* |
| `verified: true` | Read by the vision backend **and** reviewed by a process engineer. | emerald *"reviewed extraction"* |

An unverified reading is presented as **where to look on the drawing**, never as a
design or work-permit value. The assistant says so in every answer, and the
fallback for a tag with no readable callout is to refuse rather than guess.

## Coverage — verified 2026-10-30

Every drawing that ships was checked against the index that ships. Measured by
`src/test/pidCoverage.test.ts` (6 tests, part of `npm run check`), which reads
the filesystem rather than trusting the index:

| Check | Result |
|---|---|
| PDFs in `public/pids` | **44** |
| Sheets in `src/data/pid_index.json` | **44** |
| Drawings on disk with no index entry | **0** |
| Index entries pointing at a missing file | **0** |
| Sheets with a sha256 + byte size | **44 / 44** |
| Sheets whose byte size drifted > 1 KB from the file on disk | **0** |
| Sheets carrying a drawing number | **32 / 44** (12 sheets have no number on the title block) |
| Nominal size readings | **191** |
| Tags in the tag → drawing map | **193** |
| Sheets verified by a process engineer | **0 / 44** |

So: **all 44 P&IDs are covered.** A drawing dropped into `public/pids` without
re-running `npm run pid:index` now fails CI instead of silently answering
questions from a stale index.

Coverage is *not* the same as correctness: 0 / 44 sheets are signed off, so every
value the assistant quotes stays indicative and cites its drawing. The 12 sheets
without a drawing number are still answerable — they are cited by filename and
title instead.

## Reproducing / upgrading

```bash
# 1. read the drawings (resumable — only new/changed PDFs are re-read)
python3 -m venv .venv-pdf
.venv-pdf/bin/pip install pymupdf rapidocr-onnxruntime
.venv-pdf/bin/python scripts/ocr_pid_pages.py --src public/pids --out ../pid_work/ocr --dpi 300

# 2. rebuild the shipped index
npm run pid:index -- --ocr-dir ../pid_work/ocr
```

**Upgrade to verified data** (much better on dense callouts: line numbers, service,
from/to per line):

```bash
GEMINI_API_KEY=… npm run pid:index -- --backend=gemini
```

That writes `verified: true` per sheet. Flip the flag to `true` only after an
engineer compares a sample against the drawings; the builder never decides that
for you.

## Known limits

- OCR confuses digits and separators on dense callouts (`5`/`S`, `-`/`=`), so
  **line numbers are indicative**; nominal sizes survive filtering better.
- Equipment balloons are graphics: searching the raw text for `E520` returns
  nothing even on the sheet that carries E-520. Tag → drawing mapping therefore
  comes from the curated knowledge base plus filename/tag reads, not from text search.
- Sizes are filtered to a standard NPS/DN catalogue, which removes OCR noise
  (`7"`, `33"`, `37"`, `45"` appeared in the first pass).
- The raw-text file is 363 KB and is **lazy-loaded on the device only** — it is
  never bundled into the Cloudflare Pages Function.
