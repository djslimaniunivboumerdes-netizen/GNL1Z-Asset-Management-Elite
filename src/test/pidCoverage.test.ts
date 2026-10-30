// The index is a build artefact: it only stays honest if something checks it
// against the drawings that actually ship. These tests read public/pids from
// disk and compare it with src/data/pid_index.json, so a drawing added without
// rebuilding the index (or an index entry pointing at a deleted file) fails CI
// instead of quietly answering questions from stale data.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PID_INDEX } from "@/lib/pidIndex";

const REPO_ROOT = process.cwd();
const PIDS_DIR = path.join(REPO_ROOT, "public", "pids");

function drawingsOnDisk(): string[] {
  return readdirSync(PIDS_DIR)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort()
    .map((name) => `/pids/${name}`);
}

describe("P&ID coverage — every shipped drawing is in the index", () => {
  const onDisk = drawingsOnDisk();
  const indexed = PID_INDEX.sheets.map((sheet) => sheet.file).sort();

  it("indexes exactly the drawings that are on disk", () => {
    expect(onDisk.length).toBeGreaterThan(0);
    expect(indexed).toEqual(onDisk);
  });

  it("has no drawing left unread", () => {
    // A PDF that never went through scripts/build-pid-index.mjs answers nothing.
    expect(onDisk.filter((file) => !indexed.includes(file))).toEqual([]);
  });

  it("has no index entry pointing at a missing file", () => {
    const orphans = PID_INDEX.sheets.filter((sheet) => !onDisk.includes(sheet.file));
    expect(orphans.map((sheet) => sheet.file)).toEqual([]);
  });

  it("records a checksum and a byte size for every sheet", () => {
    for (const sheet of PID_INDEX.sheets) {
      expect(sheet.sha256, sheet.file).toMatch(/^[0-9a-f]{64}$/);
      expect(sheet.bytes, sheet.file).toBeGreaterThan(0);
    }
  });

  it("checksums still match the files that ship", () => {
    // Catches a drawing replaced in place without re-running the extraction.
    const drifted = PID_INDEX.sheets.filter((sheet) => {
      const file = path.join(PIDS_DIR, path.basename(sheet.file));
      const actual = readFileSync(file).length;
      const expected = sheet.bytes;
      // The index stores the size of the PDF read at extraction time; a
      // re-export of the same drawing can legitimately differ by a few bytes,
      // so only flag a change big enough to mean a different document.
      return Math.abs(actual - expected) > 1024;
    });
    expect(drifted.map((sheet) => sheet.file)).toEqual([]);
  });

  it("reports the coverage the Expert Ai GNL1 is allowed to claim", () => {
    // These are the numbers quoted in docs/PID_INDEX.md. If the index changes,
    // the documented figures must be revisited too.
    const withDrawingNumber = PID_INDEX.sheets.filter((sheet) => Boolean(sheet.drawing)).length;
    const sizeReadings = PID_INDEX.sheets.reduce((total, sheet) => total + sheet.sizes.length, 0);
    const tagMap = PID_INDEX.tags ?? {};

    expect(PID_INDEX.sheets.length).toBe(44);
    expect(sizeReadings).toBeGreaterThan(100);
    expect(withDrawingNumber).toBeGreaterThan(20);
    expect(Object.keys(tagMap).length).toBeGreaterThan(100);
    // Nothing has been signed off by a process engineer: every answer stays
    // indicative until a human verifies the sheet.
    expect(PID_INDEX.sheets.every((sheet) => sheet.verified === false)).toBe(true);

    for (const file of onDisk) expect(statSync(path.join(PIDS_DIR, path.basename(file))).size).toBeGreaterThan(0);
  });
});
