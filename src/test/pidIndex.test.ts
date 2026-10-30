import { describe, expect, it } from "vitest";
import {
  PID_INDEX, connectionsForTag, pidCoverage, pidSheetByFile, pidSheetsForTag, searchPidText,
} from "@/lib/pidIndex";

describe("P&ID index — the drawings were read once, not on every question", () => {
  it("covers every local drawing", () => {
    const coverage = pidCoverage();
    expect(coverage.sheets).toBe(44);
    expect(coverage.indexed).toBe(44);
    // Nothing has been signed off by a process engineer yet.
    expect(coverage.verified).toBe(0);
    expect(coverage.sizes).toBeGreaterThan(100);
    expect(coverage.tags).toBeGreaterThan(100);
  });

  it("only stores sizes that exist in a piping catalogue", () => {
    const sizes = new Set(PID_INDEX.sheets.flatMap((sheet) => sheet.sizes));
    expect(sizes.size).toBeGreaterThan(5);
    for (const size of sizes) expect(size).toMatch(/^((\d+(\/\d+)?)|DN\d+)"?$/);
    // OCR invented 7", 33", 37" and 45" on the first pass — they are not NPS sizes.
    for (const bogus of ['7"', '33"', '37"', '45"', '5"']) expect(sizes.has(bogus)).toBe(false);
    expect(sizes.has('6"')).toBe(true);
  });

  it("answers the E-520 question and names the drawing it came from", () => {
    const connections = connectionsForTag("E-520");
    expect(connections.canonicalTag).toBe("E520");
    expect(connections.empty).toBe(false);
    expect(connections.sheets.map((sheet) => sheet.file)).toContain("/pids/E520 R792 R793.pdf");
    expect(connections.sheets[0].drawing).toBe("85-X06-10.1");
    expect(connections.sizes).toContain('6"');
    // Indicative, not signed off — callers must say so.
    expect(connections.verified).toBe(false);
    expect(connections.lineCalls.length).toBeGreaterThan(0);
    for (const call of connections.lineCalls) expect(call.asRead).toContain('"');
  });

  it("resolves every spelling an operator types", () => {
    const expected = connectionsForTag("E-520").sheets.map((sheet) => sheet.file);
    for (const spelling of ["E-520", "E 520", "E520", "X06 E 520", "x06-e-520"]) {
      expect(pidSheetsForTag(spelling).map((sheet) => sheet.file), spelling).toEqual(expected);
    }
  });

  it("says nothing rather than inventing a size for a tag on no drawing", () => {
    const connections = connectionsForTag("X02-P-03.12B");
    expect(connections.empty).toBe(true);
    expect(connections.sizes).toEqual([]);
    expect(connections.lineCalls).toEqual([]);
  });

  it("does not guess for a tag that does not exist at all", () => {
    const connections = connectionsForTag("Z-999");
    expect(connections.empty).toBe(true);
    expect(connections.canonicalTag).toBeNull();
  });

  it("maps a drawing back to its readings", () => {
    const sheet = pidSheetByFile("/pids/E520 R792 R793.pdf");
    expect(sheet?.title).toBe("E520 R792 R793");
    expect(sheet?.equipment).toContain("E520");
    expect(pidSheetByFile("/pids/nope.pdf")).toBeNull();
  });

  it("finds which drawings mention a string, for people who know the plant better than the index", async () => {
    // Equipment balloons are graphics: OCR mangled "E-520" into fragments, so
    // this retrieval is a "where do I look?" aid, not a tag lookup.
    const hits = await searchPidText("NOTES");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].snippet.toLowerCase()).toContain("notes");
    expect(hits[0].file.startsWith("/pids/")).toBe(true);
    // Too short to be meaningful.
    expect(await searchPidText("x")).toEqual([]);
  });

  it("keeps the compact index small enough to bundle into the edge worker", () => {
    // The raw OCR lines live in pid_index_text.json, loaded lazily on the device.
    expect(JSON.stringify(PID_INDEX).length).toBeLessThan(400_000);
    expect(PID_INDEX.sheets.every((sheet) => typeof sheet.verified === "boolean")).toBe(true);
  });
});
