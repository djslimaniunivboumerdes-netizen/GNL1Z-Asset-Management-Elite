// The instrument finder must be able to say where a tag lives — and, just as
// importantly, what it cannot say. These tests pin both halves: the drawings are
// resolved from the pre-extracted index (never by running OCR), and the gaps are
// stated rather than papered over.

import { describe, expect, it } from "vitest";
import { buildInstrumentIndex, findInstrument } from "@/lib/instrumentIndex";
import {
  instrumentContext,
  instrumentCountForUnit,
  instrumentPlacements,
  instrumentsOfUnit,
  unitOfInstrument,
  unitOfSheet,
} from "@/lib/instrumentLocation";
import { PID_INDEX } from "@/lib/pidIndex";

const index = buildInstrumentIndex();

/** An instrument whose unit (06 — liquefaction) has several drawings. */
function sampleForUnit(unitCode: string) {
  const entry = index.find((candidate) => candidate.parsed.unitCode === unitCode);
  if (!entry) throw new Error(`no instrument in unit ${unitCode} — the test data changed`);
  return entry;
}

describe("placing an instrument on the drawings", () => {
  it("knows the unit a tag belongs to", () => {
    expect(unitOfInstrument(sampleForUnit("106"))).toBe("06");
    expect(unitOfInstrument(sampleForUnit("101"))).toBe("01");
  });

  it("returns the drawings of that unit, and no other", () => {
    const placements = instrumentPlacements(sampleForUnit("106"));
    expect(placements.length).toBeGreaterThan(0);
    for (const placement of placements) {
      const sheet = PID_INDEX.sheets.find((candidate) => candidate.file === placement.file);
      expect(sheet, placement.file).toBeTruthy();
      const unitMatches =
        (placement.unit ?? null) === "06" ||
        (sheet?.equipment ?? []).some((tag) => /^X06-/i.test(tag.trim()));
      expect(unitMatches, `${placement.file} belongs to another unit`).toBe(true);
    }
  });

  it("puts a drawing with a drawing number first, because it can be cited", () => {
    const placements = instrumentPlacements(sampleForUnit("102"));
    expect(placements.length).toBeGreaterThan(1);
    expect(placements[0].drawing).toBeTruthy();
  });

  it("links each drawing to the P&ID viewer", () => {
    for (const placement of instrumentPlacements(sampleForUnit("101"))) {
      expect(placement.url.startsWith("/pids?file=")).toBe(true);
      expect(decodeURIComponent(placement.url)).toContain(placement.file);
    }
  });

  it("says which drawings ship as a vector PDF, because 18 of the 44 do not", () => {
    const placements = instrumentPlacements(sampleForUnit("106"));
    const withPdf = placements.filter((placement) => placement.localPdf);
    expect(withPdf.length).toBeLessThanOrEqual(placements.length);
    for (const placement of placements) {
      if (placement.localPdf) expect(placement.localPdf.endsWith(".pdf")).toBe(true);
    }
  });

  it("reaches most of the instrument population", () => {
    const covered = index.filter((entry) => instrumentPlacements(entry).length > 0).length;
    // 31 tags carry no readable unit code, so they cannot be placed.
    expect(covered).toBeGreaterThan(index.length * 0.9);
    expect(covered).toBe(index.length - 31);
  });

  it("admits when a tag cannot be placed", () => {
    const unplaceable = index.find((entry) => instrumentPlacements(entry).length === 0);
    expect(unplaceable).toBeTruthy();
    const context = instrumentContext(unplaceable!);
    expect(context.basis).toBe("none");
    expect(context.placements).toEqual([]);
    expect(context.summaryEn).toMatch(/no drawing could be tied/i);
    expect(context.missing.length).toBeGreaterThan(0);
  });
});

describe("what the drawings say it is connected to", () => {
  it("lists the equipment shown on those drawings", () => {
    const context = instrumentContext(sampleForUnit("106"));
    expect(context.equipmentOnDrawings.length).toBeGreaterThan(0);
    // Some tags only exist on the drawing (E520); some are in the register (X06-…).
    expect(context.equipmentOnDrawings.some((item) => item.inRegister)).toBe(true);
  });

  it("lists the piping as it was read, never cleaned up", () => {
    const context = instrumentContext(sampleForUnit("101"));
    expect(context.lines.length).toBeGreaterThan(0);
    expect(context.lines.length).toBeLessThanOrEqual(12);
    for (const line of context.lines) {
      expect(line.asRead.length).toBeGreaterThan(0);
      expect(line.file.startsWith("/pids/")).toBe(true);
    }
  });

  it("carries the nominal sizes read on those drawings", () => {
    const context = instrumentContext(sampleForUnit("101"));
    expect(context.sizes.length).toBeGreaterThan(0);
    for (const size of context.sizes) expect(size).toMatch(/^((\d+(\/\d+)?)|DN\d+)"?$/);
  });
});

describe("specifications, and where each one comes from", () => {
  it("tags every specification with its source", () => {
    for (const entry of index.slice(0, 40)) {
      const context = instrumentContext(entry);
      for (const spec of context.specs) {
        expect(["isa", "dcs", "register", "drawing"]).toContain(spec.source);
        expect(spec.value.length).toBeGreaterThan(0);
      }
    }
  });

  it("marks register facts verified and drawing facts unverified", () => {
    const context = instrumentContext(sampleForUnit("101"), "en");
    const drawing = context.specs.filter((spec) => spec.source === "drawing");
    const register = context.specs.filter((spec) => spec.source === "register");
    expect(drawing.length).toBeGreaterThan(0);
    for (const spec of drawing) expect(spec.verified).toBe(false);
    for (const spec of register) expect(spec.verified).toBe(true);
  });

  it("never claims the drawing is verified — no sheet has been signed off", () => {
    for (const entry of index.slice(0, 60)) {
      const context = instrumentContext(entry);
      expect(context.verified).toBe(false);
    }
  });

  it("states what it cannot tell you instead of leaving it blank", () => {
    const context = instrumentContext(sampleForUnit("106"));
    const joined = context.missing.join(" ");
    expect(joined).toMatch(/exact position/i);
    expect(joined).toMatch(/tapped line|ligne de piquage/i);
    expect(joined).toMatch(/range|span|étendue/i);
  });
});

describe("the drawings pointing back at the instruments", () => {
  it("counts the instruments of a unit consistently", () => {
    for (const unit of ["01", "02", "05", "06"]) {
      expect(instrumentCountForUnit(unit)).toBe(instrumentsOfUnit(unit).length);
      expect(instrumentCountForUnit(unit)).toBeGreaterThan(0);
    }
    expect(instrumentCountForUnit(null)).toBe(0);
    expect(instrumentCountForUnit("99")).toBe(0);
  });

  it("reads the unit off a drawing number", () => {
    const sheet = PID_INDEX.sheets.find((candidate) => candidate.drawing === "85-X06-10.1");
    expect(sheet).toBeTruthy();
    expect(unitOfSheet(sheet!.file)).toBe("06");
    expect(unitOfSheet("/pids/does-not-exist.pdf")).toBeNull();
  });

  it("answers a lookup both ways for the same instrument", () => {
    const entry = findInstrument(sampleForUnit("106").tag);
    expect(entry).toBeTruthy();
    const context = instrumentContext(entry!);
    expect(context.tag).toBe(entry!.tag);
  });
});
