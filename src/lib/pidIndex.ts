// src/lib/pidIndex.ts
//
// The P&ID drawings are scanned images — there is no text layer to search. So
// every drawing was read once (scripts/ocr_pid_pages.py →
// scripts/build-pid-index.mjs) and the result is stored as static data.
//
// Nothing here runs OCR. A question such as "which pipe sizes connect to E-520?"
// is answered from this file in microseconds, and the answer always names the
// drawing it came from so the reading can be checked at source.
//
// Accuracy contract: unless a sheet carries `verified: true` (a human has signed
// the extraction off, or it was read by the vision backend and reviewed), the
// data is *indicative*: OCR on a dense drawing misreads digits and separators.
// Callers must surface that, never present it as a design value, and always
// offer the drawing itself.

import indexJson from "../data/pid_index.json";
import { compactTag } from "./equipmentAliases";

export interface PidLineCall {
  /** Exactly what was read on the drawing, kept for traceability. */
  asRead: string;
  size: string | null;
  number: string | null;
  service?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface PidSheetIndex {
  file: string;
  title: string;
  sha256: string;
  bytes: number;
  drawing: string | null;
  pages: number;
  /** Equipment tags read on, or known to belong to, this drawing. */
  equipment: string[];
  /** Nominal pipe sizes found on the drawing, most frequent first. */
  sizes: string[];
  lineCalls: PidLineCall[];
  lineCount: number;
  sheetId: string | null;
  titleEn: string | null;
  titleFr: string | null;
  /** True only when a human (or the vision backend + review) signed it off. */
  verified: boolean;
  extractedAt: string;
  backend: string;
}

export interface PidIndex {
  version: number;
  generatedAt: string;
  generator: { backend: string; dpi: number | null; note: string };
  sheets: PidSheetIndex[];
  tags: Record<string, { files: string[]; inRegister: boolean }>;
}

export const PID_INDEX = indexJson as unknown as PidIndex;

const SHEETS_BY_FILE = new Map(PID_INDEX.sheets.map((sheet) => [sheet.file, sheet]));

/** Compact-tag lookup so "E 520", "E-520" and "X06-E-520" all resolve. */
const TAGS_BY_COMPACT = new Map<string, string>();
for (const tag of Object.keys(PID_INDEX.tags ?? {})) {
  TAGS_BY_COMPACT.set(compactTag(tag), tag);
  TAGS_BY_COMPACT.set(compactTag(tag.replace(/^X\d{2}-/, "")), tag);
}

export interface PidCoverage {
  sheets: number;
  indexed: number;
  verified: number;
  sizes: number;
  lineCalls: number;
  tags: number;
  backend: string;
  generatedAt: string;
  note: string;
}

export function pidCoverage(): PidCoverage {
  const sheets = PID_INDEX.sheets;
  return {
    sheets: sheets.length,
    indexed: sheets.filter((sheet) => sheet.sizes.length > 0 || sheet.lineCalls.length > 0).length,
    verified: sheets.filter((sheet) => sheet.verified).length,
    sizes: sheets.reduce((total, sheet) => total + sheet.sizes.length, 0),
    lineCalls: sheets.reduce((total, sheet) => total + sheet.lineCalls.length, 0),
    tags: Object.keys(PID_INDEX.tags ?? {}).length,
    backend: PID_INDEX.generator.backend,
    generatedAt: PID_INDEX.generatedAt,
    note: PID_INDEX.generator.note,
  };
}

export function pidSheetByFile(file: string): PidSheetIndex | null {
  return SHEETS_BY_FILE.get(file) ?? null;
}

/** "X06 E 520" and "E 520" mean the same drawing-only tag. */
function tagKeys(tag: string): string[] {
  const keys = [compactTag(tag)];
  const withoutTrain = compactTag(tag).replace(/^X\d{2}/, "");
  if (withoutTrain && withoutTrain !== keys[0]) keys.push(withoutTrain);
  return keys;
}

/** Drawings a tag appears on — curated mapping first, then readings off the sheet. */
export function pidSheetsForTag(tag: string): PidSheetIndex[] {
  for (const key of tagKeys(tag)) {
    const canonical = TAGS_BY_COMPACT.get(key);
    const files = canonical ? PID_INDEX.tags?.[canonical]?.files ?? [] : [];
    const sheets = files.map((file) => SHEETS_BY_FILE.get(file)).filter((sheet): sheet is PidSheetIndex => Boolean(sheet));
    if (sheets.length > 0) return sheets;
  }

  // Fall back to tags read directly off a drawing but not in the tag map.
  const wanted = tagKeys(tag);
  return PID_INDEX.sheets.filter((sheet) => sheet.equipment.some((candidate) => wanted.includes(compactTag(candidate))));
}

export interface PidConnections {
  tag: string;
  /** The tag as it is written in the register, when it is known there. */
  canonicalTag: string | null;
  sheets: PidSheetIndex[];
  /** Distinct nominal sizes across every drawing, most frequent first. */
  sizes: string[];
  lineCalls: Array<PidLineCall & { file: string }>;
  /** True only when every contributing drawing has been signed off. */
  verified: boolean;
  /** True when no drawing was found at all — callers must say so plainly. */
  empty: boolean;
}

/**
 * What the drawings say is connected to a tag.
 *
 * This is the answer behind "what pipe sizes are connected to E-520?". It never
 * invents a value: an empty result means the drawings were not readable for that
 * tag, and the caller has to say that instead of guessing.
 */
export function connectionsForTag(tag: string): PidConnections {
  const canonicalTag = TAGS_BY_COMPACT.get(compactTag(tag)) ?? null;
  const sheets = pidSheetsForTag(tag);
  const counts = new Map<string, number>();
  const lineCalls: Array<PidLineCall & { file: string }> = [];

  for (const sheet of sheets) {
    for (const size of sheet.sizes) counts.set(size, (counts.get(size) ?? 0) + 1);
    for (const call of sheet.lineCalls) lineCalls.push({ ...call, file: sheet.file });
  }

  const sizes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en", { numeric: true }))
    .map(([size]) => size);

  return {
    tag,
    canonicalTag,
    sheets,
    sizes,
    lineCalls: lineCalls.slice(0, 40),
    verified: sheets.length > 0 && sheets.every((sheet) => sheet.verified),
    empty: sheets.length === 0,
  };
}

export interface PidTextHit {
  file: string;
  title: string;
  snippet: string;
  confidence: number;
  matches: number;
}

/**
 * Which drawings *mention* a string. Loads the raw OCR lines lazily — that file
 * is deliberately kept out of the edge bundle — and is used for "where do I find
 * X?" rather than for reading values.
 */
export async function searchPidText(query: string, limit = 8): Promise<PidTextHit[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const { default: textJson } = await import("../data/pid_index_text.json");
  const text = textJson as unknown as {
    sheets: Array<{ file: string; lines: Array<{ t: string; c: number }> }>;
  };

  const hits: PidTextHit[] = [];
  for (const sheet of text.sheets ?? []) {
    let matches = 0;
    let best = 0;
    let snippet = "";
    for (const line of sheet.lines) {
      if (!line.t.toLowerCase().includes(needle)) continue;
      matches += 1;
      if (line.c > best) {
        best = line.c;
        snippet = line.t;
      }
    }
    if (matches === 0) continue;
    hits.push({
      file: sheet.file,
      title: SHEETS_BY_FILE.get(sheet.file)?.title ?? sheet.file.replace(/^\/pids\//, "").replace(/\.pdf$/, ""),
      snippet,
      confidence: best,
      matches,
    });
  }

  return hits.sort((a, b) => b.matches - a.matches || b.confidence - a.confidence).slice(0, limit);
}
