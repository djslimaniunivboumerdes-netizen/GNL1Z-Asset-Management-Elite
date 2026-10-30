#!/usr/bin/env node
// Build the P&ID index the assistant answers from.
//
// The P&ID drawings are scanned images: there is no text layer, so the only way
// to answer "which pipe sizes connect to E-520?" is to read each drawing once
// and store what was read. That is exactly what this script does — it never runs
// at query time. The assistant then answers from a static JSON file in
// microseconds, with a citation back to the drawing it came from.
//
//   # 1. read the drawings once (slow, ~15 s per sheet, resumable)
//   python3 -m venv .venv-pdf
//   .venv-pdf/bin/pip install pymupdf rapidocr-onnxruntime
//   .venv-pdf/bin/python scripts/ocr_pid_pages.py --src public/pids --out ../pid_work/ocr
//
//   # 2. turn that output into the shipped index (fast, seconds)
//   npm run pid:index -- --ocr-dir ../pid_work/ocr
//
//   # 3. optional, much better quality: re-read the drawings with Gemini vision
//   GEMINI_API_KEY=… npm run pid:index -- --backend=gemini
//
// Output:
//   src/data/pid_index.json       compact: sizes, line callouts, tags, drawing no.
//   src/data/pid_index_text.json  every OCR line, for "which drawing mentions
//                                 this?" lookups on the device (lazy-loaded — it
//                                 is never bundled into the Cloudflare function).

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OCR_DIR = process.argv.includes("--ocr-dir")
  ? process.argv[process.argv.indexOf("--ocr-dir") + 1]
  : path.join(ROOT, "pid_work", "ocr");
const BACKEND = process.argv.includes("--backend")
  ? process.argv[process.argv.indexOf("--backend") + 1]
  : "ocr";
const OUT_INDEX = path.join(ROOT, "src", "data", "pid_index.json");
const OUT_TEXT = path.join(ROOT, "src", "data", "pid_index_text.json");

/** Nominal pipe size as printed on a P&ID: 2", 1/2", 48", DN50. */
const SIZE_PATTERN = /\b(\d{1,2}(?:\s*[/.]\s*\d{1,2})?)\s*(?:["″”']|in\b)|DN\s*(\d{2,4})/gi;
/** A full line callout, e.g. 2"-FLRG-0697-1936 — OCR mangles the separators. */
const CALLOUT_PATTERN = /(\d{1,2}(?:\s*[/.]\s*\d{1,2})?)\s*["″”']?\s*[-=x*/]?\s*([A-Z0-9][A-Z0-9\-=/.]{4,26})/g;
/** Drawing numbers such as 85-X01-10.3. */
const DRAWING_PATTERN = /\b(\d{2}\s*-\s*[A-Z0-9]{2,4}\s*-\s*\d{1,3}(?:\.\d{1,2})?)\b/g;
/** Plant equipment tags: X01-E-501, E-520, G-507, E-05.15, 7X3-E-03.17 … */
const TAG_PATTERN = /\b((?:[A-Z0-9]{1,3}[-\s._]?)?[A-Z][-\s._]?\d{2}(?:\.\d{2})(?:[A-Z]{1,2})?|[A-Z][-\s._]?\d{3}(?:[A-Z]{1,2})?)\b/g;

const IGNORED_TAGS = new Set([
  "NOTES", "NOTE", "TYP", "TYPICAL", "DETAIL", "SHEET", "SCALE", "DRAWING", "REV", "DATE",
  "TO", "FROM", "PURGE", "GAS", "SEAL", "WATER", "NITROGEN", "FLARE", "VENT", "DRAIN", "AIR",
  "PN", "DN", "PSV", "PSE", "PI", "TI", "FI", "LI", "AI", "HV", "XV", "LV", "PV", "FV", "TV",
]);

/**
 * Standard nominal pipe sizes (NPS inches and DN).
 *
 * OCR happily invents 7", 33", 37" and 45" out of dimension text and garbled
 * glyphs. A size that is not a catalogue value is noise, so it is dropped
 * rather than indexed — a wrong diameter is worse than no diameter.
 */
const NPS_SIZES = new Set([
  "1/8", "1/4", "3/8", "1/2", "3/4", "1", "11/2", "2", "21/2", "3", "4", "6", "8",
  "10", "12", "14", "16", "18", "20", "22", "24", "26", "28", "30", "32", "34",
  "36", "40", "42", "48", "54", "60",
]);
const DN_SIZES = new Set([
  15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 750, 900,
]);

function normaliseSize(raw, dn) {
  if (dn) return `DN${dn}`;
  return `${raw.replace(/[\s.]/g, "")}"`;
}

/** True only for a size that exists in a piping catalogue. */
function isStandardSize(size) {
  if (size.startsWith("DN")) return DN_SIZES.has(Number(size.slice(2)));
  return NPS_SIZES.has(size.slice(0, -1));
}

function compactTag(tag) {
  return tag.toUpperCase().replace(/[\s._-]/g, "");
}

/** Tags the plant actually uses, in every spelling worth searching for. */
async function registerTagSpellings() {
  const db = JSON.parse(await readFile(path.join(ROOT, "src", "data", "gnl1z_database.json"), "utf8"));
  const knowledge = JSON.parse(await readFile(path.join(ROOT, "src", "data", "assistant_knowledge.json"), "utf8"));
  const spellings = new Map(); // compact -> canonical
  for (const item of db.equipment) {
    const canonical = item.tag;
    const short = canonical.replace(/^X\d{2}-/, "");
    for (const spelling of [canonical, short, short.replace(/-/g, " "), short.replace(/-/g, "")]) {
      spellings.set(compactTag(spelling), canonical);
    }
  }
  for (const asset of knowledge.drawingAssets ?? []) {
    spellings.set(compactTag(asset.tag), asset.tag);
  }
  return spellings;
}

/** Extract structure from one OCR document. */
function parseDocument(document, spellings) {
  const ocrLines = document.pages.flatMap((page) => page.lines.map((line) => line.t));

  const sizes = new Map(); // size -> occurrences
  const callouts = new Map(); // asRead -> { asRead, size, number }

  // Each OCR line is one text box on the drawing. Matching inside a single line
  // keeps a size from gluing itself to an unrelated code on the next line — the
  // first pass produced gems like `45"-X06311938` by doing exactly that.
  for (const rawLine of ocrLines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    for (const match of line.matchAll(SIZE_PATTERN)) {
      const size = normaliseSize(match[1] ?? "", match[2]);
      if (!isStandardSize(size)) continue;
      sizes.set(size, (sizes.get(size) ?? 0) + 1);
    }

    for (const match of line.matchAll(CALLOUT_PATTERN)) {
      const size = normaliseSize(match[1], null);
      if (!isStandardSize(size)) continue;
      const rest = (match[2] ?? "").replace(/\s/g, "");
      if (!/[A-Z]/.test(rest) || !/\d/.test(rest) || rest.length < 5) continue;
      const asRead = `${size}-${rest}`.replace(/-{2,}/g, "-");
      if (!callouts.has(asRead)) callouts.set(asRead, { asRead, size, number: rest });
    }
  }

  const haystack = `${document.title}\n${ocrLines.join("\n")}`;
  const drawing = haystack.match(DRAWING_PATTERN)?.[1]?.replace(/\s+/g, "") ?? null;

  const tags = new Set();
  for (const match of haystack.matchAll(TAG_PATTERN)) {
    const candidate = (match[1] ?? "").trim();
    if (IGNORED_TAGS.has(candidate.toUpperCase())) continue;
    const canonical = spellings.get(compactTag(candidate));
    if (canonical) tags.add(canonical);
  }

  return {
    file: document.file,
    title: document.title,
    sha256: document.sha256,
    bytes: document.bytes,
    drawing,
    pages: document.pages.length,
    equipment: [...tags].sort(),
    sizes: [...sizes.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en", { numeric: true }))
      .map(([size]) => size),
    lineCalls: [...callouts.values()].slice(0, 40),
    // Text lines are kept for retrieval only; they are never treated as data.
    lineCount: ocrLines.length,
  };
}

async function readOcrDocuments() {
  let entries;
  try {
    entries = await readdir(OCR_DIR);
  } catch {
    console.error(`No OCR output in ${OCR_DIR}. Run scripts/ocr_pid_pages.py first.`);
    process.exit(2);
  }
  const documents = [];
  for (const entry of entries.filter((name) => name.endsWith(".json"))) {
    documents.push(JSON.parse(await readFile(path.join(OCR_DIR, entry), "utf8")));
  }
  return documents.sort((a, b) => a.file.localeCompare(b.file));
}

/** Optional higher-quality pass: ask Gemini Flash to read each drawing. */
async function readWithGemini(files) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("--backend=gemini needs GEMINI_API_KEY in the environment.");
    process.exit(2);
  }
  const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";
  const schema = 'Return strict JSON: {"drawing":string|null,"equipment":[string],"lines":[{"lineNumber":string,"size":string,"service":string|null,"from":string|null,"to":string|null}]}. Read only what is printed. Use null when unreadable; never guess.';
  const documents = [];
  for (const file of files) {
    const absolute = path.join(ROOT, "public", file.replace(/^\//, ""));
    const bytes = await readFile(absolute);
    const body = {
      contents: [{
        role: "user",
        parts: [
          { text: `${schema}\n\nThis is a piping and instrumentation diagram from an LNG liquefaction train.` },
          { inline_data: { mime_type: "application/pdf", data: bytes.toString("base64") } },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    };
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!response.ok) {
      console.error(`  gemini failed for ${file}: HTTP ${response.status}`);
      continue;
    }
    const payload = await response.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error(`  gemini returned unparsable JSON for ${file}`);
      continue;
    }
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    documents.push({
      file,
      title: path.basename(file, ".pdf"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      drawing: parsed.drawing ?? null,
      pages: 1,
      equipment: (parsed.equipment ?? []).filter((tag) => typeof tag === "string"),
      sizes: [...new Set(lines.map((line) => line.size).filter(Boolean))],
      lineCalls: lines.slice(0, 40).map((line) => ({
        asRead: `${line.size ?? ""}-${line.lineNumber ?? ""}`.replace(/^-|-$/g, ""),
        size: line.size ?? null,
        number: line.lineNumber ?? null,
        service: line.service ?? null,
        from: line.from ?? null,
        to: line.to ?? null,
      })),
      lineCount: lines.length,
      verified: true,
    });
    console.log(`  gemini read ${file}`);
  }
  return documents;
}

async function main() {
  const knowledge = JSON.parse(await readFile(path.join(ROOT, "src", "data", "assistant_knowledge.json"), "utf8"));
  const spellings = await registerTagSpellings();

  let sheets;
  if (BACKEND === "gemini") {
    sheets = await readWithGemini((knowledge.pidFiles ?? []).map((file) => file.file));
  } else {
    sheets = (await readOcrDocuments()).map((document) => parseDocument(document, spellings));
  }

  // Attach the sheet identifier the knowledge base already curates, so answers
  // can cite the proper title and drawing number instead of a filename.
  const sheetsById = new Map((knowledge.pidSheets ?? []).map((sheet) => [sheet.id, sheet]));
  const filesById = new Map((knowledge.pidFiles ?? []).map((file) => [file.id, file]));
  for (const sheet of sheets) {
    const known = [...filesById.values()].find((file) => file.file === sheet.file);
    sheet.sheetId = known?.sheetId ?? null;
    const curated = sheet.sheetId ? sheetsById.get(sheet.sheetId) : null;
    // A curated drawing number always beats an OCR guess.
    sheet.drawing = curated?.drawing ?? sheet.drawing ?? null;
    sheet.titleEn = curated?.title_en ?? null;
    sheet.titleFr = curated?.title_fr ?? null;
    if (curated) {
      for (const tag of curated.equipment ?? []) if (!sheet.equipment.includes(tag)) sheet.equipment.push(tag);
    }
    sheet.verified = sheet.verified === true;
    sheet.extractedAt = sheet.extractedAt ?? new Date().toISOString();
    sheet.backend = BACKEND === "gemini" ? "gemini-vision" : "ocr-rapidocr";
  }

  // Tag → drawings it appears on. Curated mappings come first; readings taken
  // straight off a drawing are added on top so a drawing-only tag stays findable.
  const tags = {};
  const addTag = (tag, file, inRegister) => {
    if (!tag || !file) return;
    const entry = tags[tag] ?? (tags[tag] = { files: [], inRegister: false });
    if (!entry.files.includes(file)) entry.files.push(file);
    entry.inRegister = entry.inRegister || inRegister;
  };
  for (const record of knowledge.equipment ?? []) {
    for (const sheetId of record.pidSheetIds ?? []) addTag(record.tag, sheetsById.get(sheetId)?.localFile, true);
    for (const fileId of record.pidFileIds ?? []) addTag(record.tag, filesById.get(fileId)?.file, true);
  }
  for (const asset of knowledge.drawingAssets ?? []) {
    for (const sheetId of asset.pidSheetIds ?? []) addTag(asset.tag, sheetsById.get(sheetId)?.localFile, false);
    for (const fileId of asset.pidFileIds ?? []) addTag(asset.tag, filesById.get(fileId)?.file, false);
  }
  for (const sheet of sheets) {
    for (const tag of sheet.equipment) addTag(tag, sheet.file, Boolean(spellings.get(compactTag(tag))));
  }
  for (const entry of Object.values(tags)) entry.files.sort();

  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    generator: {
      backend: BACKEND === "gemini" ? "gemini-vision" : "ocr-rapidocr",
      dpi: BACKEND === "gemini" ? null : 300,
      note: BACKEND === "gemini"
        ? "Read by Gemini vision. Structured, but still requires engineering sign-off before it is treated as verified."
        : "Read by OCR over rasterised drawings and filtered to standard NPS/DN sizes. Indicative only — confirm every value on the drawing.",
    },
    sheets,
    tags,
  };

  await writeFile(OUT_INDEX, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  // Raw OCR text lives in its own file: it is only used for "which drawing
  // mentions this?" retrieval on the device, never bundled into the edge worker.
  if (BACKEND !== "gemini") {
    const documents = await readOcrDocuments();
    const text = {
      version: 1,
      generatedAt: index.generatedAt,
      sheets: documents.map((document) => ({
        file: document.file,
        lines: document.pages.flatMap((page) => page.lines.map((line) => ({ t: line.t, c: line.c }))),
      })),
    };
    await writeFile(OUT_TEXT, `${JSON.stringify(text)}\n`, "utf8");
  }

  const withSizes = sheets.filter((sheet) => sheet.sizes.length > 0).length;
  console.log(`\nwrote ${path.relative(ROOT, OUT_INDEX)} — ${sheets.length} sheets, ${withSizes} with pipe sizes`);
  console.log(`       ${sheets.reduce((total, sheet) => total + sheet.sizes.length, 0)} size readings, ${sheets.reduce((total, sheet) => total + sheet.lineCalls.length, 0)} line callouts`);
  console.log(`       ${Object.keys(tags).length} equipment tags mapped to at least one drawing`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
