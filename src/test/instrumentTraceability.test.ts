// Reproducible validation of instrument → P&ID traceability.
//
// The eight cases below are the ones an engineer would actually challenge:
// a tag with one drawing, a tag with several, a multi-train unit, a tag with no
// unit code, one of the 31 unresolved tags, a tag whose digits happen to occur
// inside a line number, a tag backed by the register, and a tag with nothing
// behind it.
//
// The rules being defended:
//   · a drawing is offered because it covers the instrument's UNIT, never
//     because the tag was read on it;
//   · no line is ever presented as the instrument's connection;
//   · no association is made from a numeric substring;
//   · "verified" means an approved register record or a human sign-off — and
//     there is no human sign-off anywhere in this corpus yet.

import { describe, expect, it } from "vitest";
import { buildInstrumentIndex, findInstrument, type InstrumentEntry } from "@/lib/instrumentIndex";
import {
  instrumentContext,
  instrumentCountForUnit,
  instrumentPlacements,
  instrumentsOfUnit,
  provenanceGaps,
  sheetProvenance,
  shortChecksum,
  unitOfInstrument,
} from "@/lib/instrumentLocation";
import { PID_INDEX } from "@/lib/pidIndex";
import { getEquipmentByTag } from "@/data/index";

const index = buildInstrumentIndex();
const files = (entry: InstrumentEntry) => instrumentPlacements(entry).map((p) => p.file).sort();

const withSheets = (count: number | ((n: number) => boolean)) => {
  const wanted = typeof count === "number" ? (n: number) => n === count : count;
  const entry = index.find((candidate) => wanted(instrumentPlacements(candidate).length));
  if (!entry) throw new Error("no instrument matches that sheet count — the corpus changed");
  return entry;
};

/** Every instrument of a given tag unit code, e.g. "106". */
const inUnitCode = (unitCode: string) => index.filter((entry) => entry.parsed.unitCode === unitCode);

describe("the eight validation cases", () => {
  it("1 — a readable unit code with a single drawing", () => {
    const entry = withSheets(1);
    const context = instrumentContext(entry);
    expect(context.unitCode).toMatch(/^\d{3}$/);
    expect(context.placements).toHaveLength(1);
    expect(context.basis).toBe("unit");
    // One drawing, and it is the one that covers the unit.
    expect(context.placements[0].unit).toBe(unitOfInstrument(entry));
    expect(context.placements[0].url).toContain("/pids?file=");
  });

  it("2 — several drawings of the same unit, and none from another", () => {
    const entry = withSheets((n) => n >= 3);
    const context = instrumentContext(entry);
    const unit = unitOfInstrument(entry);
    expect(context.placements.length).toBeGreaterThanOrEqual(3);
    for (const placement of context.placements) {
      // Every drawing is listed for a stated reason: either it is numbered for
      // this unit, or it shows equipment of this unit.
      const justified = placement.matchedByUnitDrawing || placement.matchedEquipment.length > 0;
      expect(justified, `${placement.file} is listed with no reason`).toBe(true);
      expect(placement.matchedUnit).toBe(unit);
      const sheet = PID_INDEX.sheets.find((candidate) => candidate.file === placement.file)!;
      const showsUnitEquipment = (sheet.equipment ?? []).some((tag) =>
        new RegExp(`^X${unit}-`, "i").test(tag.trim()),
      );
      expect(placement.unit === unit || showsUnitEquipment, `${placement.file} is not a unit ${unit} drawing`).toBe(true);
    }
    // No duplicates, and every entry is either a drawing number or a title.
    expect(new Set(context.placements.map((p) => p.file)).size).toBe(context.placements.length);
    for (const placement of context.placements) {
      expect(placement.drawing ?? placement.title).toBeTruthy();
    }
  });

  it("3 — a multi-train unit keeps every train on the same drawings", () => {
    // Unit 06 runs on trains 1, 2, 3, 5 and 6; a drawing does not know its train.
    const train1 = inUnitCode("106")[0];
    const train2 = inUnitCode("206")[0];
    expect(train1).toBeTruthy();
    expect(train2).toBeTruthy();
    expect(unitOfInstrument(train1)).toBe("06");
    expect(unitOfInstrument(train2)).toBe("06");
    expect(files(train1)).toEqual(files(train2));

    // Every instrument of that unit, whichever the train, is counted.
    const counted = ["106", "206", "306", "506", "606"].reduce((sum, code) => sum + inUnitCode(code).length, 0);
    expect(instrumentCountForUnit("06")).toBe(counted);
    expect(instrumentsOfUnit("06").length).toBe(counted);
    // The train comes from the tag, never from the drawing.
    expect(train1.parsed.train).toBe("1");
    expect(train2.parsed.train).toBe("2");
  });

  it("4 — a tag with no readable unit code is not placed anywhere", () => {
    const entry = index.find((candidate) => !candidate.parsed.unitCode);
    expect(entry).toBeTruthy();
    const context = instrumentContext(entry!);
    expect(context.placements).toEqual([]);
    expect(context.basis).toBe("none");
    expect(context.lines).toEqual([]);
    expect(context.missing[0]).toMatch(/no drawing could be tied/i);
    // It says what it does not know instead of pointing at a random drawing.
    expect(context.summaryEn).toMatch(/no drawing could be tied/i);
    expect(context.specs.some((spec) => spec.source === "drawing")).toBe(false);
  });

  it("5 — all 31 unresolved tags declare they are unresolved", () => {
    const unresolved = index.filter((entry) => instrumentPlacements(entry).length === 0);
    expect(unresolved).toHaveLength(31);
    for (const entry of unresolved) {
      const context = instrumentContext(entry);
      expect(context.basis).toBe("none");
      expect(context.placements).toEqual([]);
      expect(context.specs.some((spec) => spec.source === "drawing")).toBe(false);
      expect(context.missing.join(" ")).toMatch(/no drawing could be tied/i);
    }
    // They are units no drawing covers: 940 (fuel gas), 111 (flare), and odd ones.
    const units = new Set(unresolved.map((entry) => entry.parsed.unitCode ?? "none"));
    expect(units.has("940")).toBe(true);
    expect(units.has("111")).toBe(true);
    expect(units.has("none")).toBe(true);
    for (const unit of units) {
      if (unit === "none") continue;
      expect(PID_INDEX.sheets.some((sheet) => sheet.drawing?.includes(`X${unit.slice(1)}`))).toBe(false);
    }
  });

  it("6 — a tag whose digits occur inside a line number is not 'found' on that sheet", () => {
    // Find a real coincidence: a tag whose digits appear inside a line callout.
    const coincidence = index.find((entry) => {
      const digits = entry.tag.replace(/\D/g, "");
      if (digits.length < 4) return false;
      return PID_INDEX.sheets.some((sheet) => sheet.lineCalls.some((call) => (call.number ?? "").includes(digits)));
    });
    expect(coincidence, "no numeric coincidence in the corpus — the guard cannot be exercised").toBeTruthy();

    const context = instrumentContext(coincidence!);
    // The placement still exists, but only because of the unit…
    expect(context.placements.length).toBeGreaterThan(0);
    for (const placement of context.placements) {
      // Listed by unit, or by equipment of that unit — never because the digits
      // of the tag happen to occur in one of its line numbers.
      expect(placement.matchedByUnitDrawing || placement.matchedEquipment.length > 0).toBe(true);
      expect(placement.matchedUnit).toBe(unitOfInstrument(coincidence!));
    }
    // The coincidental line numbers are shown as what the drawing carries,
    // never as this instrument's line.
    const digits = coincidence!.tag.replace(/\D/g, "");
    const hits = context.lines.filter((line) => (line.number ?? "").includes(digits));
    for (const line of hits) expect(line.file.startsWith("/pids/")).toBe(true);
    // …and nothing claims the tag was read on a sheet.
    expect(context.verified).toBe(false);
    expect(context.summaryEn).not.toMatch(/appears on|is shown on|found on/i);
    expect(context.specs.some((spec) => spec.labelEn === "Tag read on drawing")).toBe(false);
  });

  it("6b — placement never depends on the loop or on any digit of the tag", () => {
    // Change the loop of a tag: the drawing set must not move. If any digit
    // matching were happening, it would.
    const entry = withSheets((n) => n >= 2);
    const loop = entry.parsed.loop ?? "1";
    const mutated = loop.replace(/\d/g, (digit) => String((Number(digit) + 7) % 10));
    const mutatedTag = entry.tag.replace(loop, mutated);
    const fake: InstrumentEntry = {
      ...entry,
      tag: mutatedTag,
      parsed: { ...entry.parsed, loop: mutated },
    };
    expect(mutatedTag).not.toBe(entry.tag);
    expect(files(fake)).toEqual(files(entry));
  });

  it("7 — a tag backed by the register carries the register facts", () => {
    const entry = index.find((candidate) =>
      candidate.equipment.some((item) => item.dbTag && getEquipmentByTag(item.dbTag)),
    );
    expect(entry).toBeTruthy();
    const context = instrumentContext(entry!);
    const registerSpecs = context.specs.filter((spec) => spec.source === "register");
    expect(registerSpecs.length).toBeGreaterThan(0);
    for (const spec of registerSpecs) expect(spec.verified).toBe(true);
    // A register row is a real record, and the equipment link opens.
    const related = context.specs.find((spec) => spec.labelEn === "Related equipment");
    expect(related).toBeTruthy();
    expect(getEquipmentByTag(related!.value)).toBeTruthy();
  });

  it("8 — a tag with no equipment association says so instead of inventing one", () => {
    const entry = inUnitCode("940")[0];
    expect(entry).toBeTruthy();
    const context = instrumentContext(entry!);
    expect(context.equipmentOnDrawings).toEqual([]);
    expect(context.specs.some((spec) => spec.labelEn === "Related equipment")).toBe(false);
    // The unit is still decoded — it is why nothing else could be found.
    expect(context.specs.some((spec) => spec.labelEn === "Unit code" && spec.value === "940")).toBe(true);
    expect(context.missing.join(" ")).toMatch(/range|span|datasheet/i);
  });
});

describe("a drawing numbered for another unit", () => {
  it("is listed only with the equipment that justifies it", () => {
    // Some sheets are numbered for one unit but show equipment of another; they
    // are legitimate leads, but only if the reason is carried with them.
    const crossUnit = index.flatMap((entry) =>
      instrumentPlacements(entry)
        .filter((placement) => placement.unit !== null && placement.unit !== placement.matchedUnit)
        .map((placement) => ({ entry, placement })),
    );
    expect(crossUnit.length).toBeGreaterThan(0);
    for (const { placement } of crossUnit) {
      expect(placement.matchedEquipment.length).toBeGreaterThan(0);
      for (const tag of placement.matchedEquipment) {
        expect(tag.toUpperCase()).toMatch(new RegExp(`^X${placement.matchedUnit}-`));
      }
    }
  });
});

describe("drawing provenance", () => {
  it("carries the source, the checksum and the extraction method", () => {
    const entry = withSheets((n) => n >= 2);
    const context = instrumentContext(entry);
    for (const placement of context.placements) {
      const sheet = PID_INDEX.sheets.find((candidate) => candidate.file === placement.file)!;
      expect(placement.provenance.file).toBe(sheet.file);
      expect(placement.provenance.sha256).toBe(sheet.sha256);
      expect(placement.provenance.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(placement.provenance.extractionMethod).toBe(sheet.backend);
      expect(placement.provenance.extractedAt).toBe(sheet.extractedAt);
      expect(placement.provenance.bytes).toBe(sheet.bytes);
      expect(placement.provenance.pages).toBe(sheet.pages);
    }
  });

  it("leaves the revision empty instead of inventing one", () => {
    const entry = withSheets(1);
    const provenance = instrumentContext(entry).placements[0].provenance;
    expect(provenance.revision).toBeNull();
    expect(provenance.revisionDate).toBeNull();
    expect(provenance.train).toBeNull();
    expect(provenance.verifiedBy).toBeNull();
    expect(provenance.verifiedAt).toBeNull();
  });

  it("names the gaps in plain words", () => {
    const provenance = instrumentContext(withSheets(1)).placements[0].provenance;
    const gaps = provenanceGaps(provenance, "en").join(" | ");
    expect(gaps).toMatch(/Revision not recorded/);
    expect(gaps).toMatch(/Train not recorded on the drawing/);
    expect(gaps).toMatch(/No human verification recorded/);
    expect(provenanceGaps(provenance, "fr").join(" | ")).toMatch(/Révision non enregistrée/);
  });

  it("is reachable from the drawing side too", () => {
    const file = PID_INDEX.sheets.find((sheet) => sheet.drawing)?.file;
    expect(file).toBeTruthy();
    const fromViewer = sheetProvenance(file!);
    const fromInstrument = instrumentContext(withSheets((n) => n >= 1)).placements.find((p) => p.file === file);
    expect(fromViewer).toBeTruthy();
    if (fromInstrument) {
      expect(fromInstrument.provenance).toEqual(fromViewer);
    }
    expect(shortChecksum(fromViewer!.sha256)).toMatch(/^[0-9a-f]{12}…$/);
  });
});

describe("the rules the panel must never break", () => {
  it("never offers an exact-sheet claim, for any tag", () => {
    for (const entry of index) {
      const context = instrumentContext(entry);
      expect(context.verified, `${entry.tag} is presented as verified`).toBe(false);
      for (const placement of context.placements) {
        expect(placement.verified).toBe(false);
      }
      // The summary states the limit in plain words.
      if (context.placements.length) {
        expect(context.summaryEn).toMatch(/exact bubble is not located/i);
      }
    }
  });

  it("never turns a drawing or a DCS reading into a verified specification", () => {
    for (const entry of index) {
      for (const spec of instrumentContext(entry).specs) {
        if (spec.source === "register") continue;
        expect(spec.verified, `${entry.tag}: ${spec.labelEn} came from ${spec.source}`).toBe(false);
      }
    }
  });

  it("never names a line as this instrument's connection", () => {
    for (const entry of index) {
      const context = instrumentContext(entry);
      // Lines are always tied to a drawing, never to the instrument.
      for (const line of context.lines) {
        expect(line.file.startsWith("/pids/")).toBe(true);
        expect(line.asRead.length).toBeGreaterThan(0);
      }
      expect(context.missing.join(" ")).toMatch(/tapped line/i);
    }
  });

  it("never leaves a link pointing at equipment the register does not hold", () => {
    for (const entry of index) {
      for (const item of instrumentContext(entry).equipmentOnDrawings) {
        if (item.inRegister) expect(getEquipmentByTag(item.tag), item.tag).toBeTruthy();
      }
    }
  });

  it("keeps the three states apart: verified, unit-level, unavailable", () => {
    const entry = withSheets((n) => n >= 2);
    const context = instrumentContext(entry);
    // Unit-level: the drawings are there, the placement is not proof.
    expect(context.basis).toBe("unit");
    expect(context.placements.length).toBeGreaterThan(0);
    expect(context.verified).toBe(false);
    // Unavailable: named, not blank.
    expect(context.missing.length).toBeGreaterThanOrEqual(3);
    // Verified: only register rows, and only when the register knows the tag.
    const verified = context.specs.filter((spec) => spec.verified);
    for (const spec of verified) expect(spec.source).toBe("register");
  });

  it("answers a lookup the same way from either direction", () => {
    const entry = findInstrument("LIC101204")!;
    expect(entry).toBeTruthy();
    const context = instrumentContext(entry);
    expect(context.tag).toBe("LIC101204");
    expect(context.unitCode).toBe("101");
    // The drawing side points back at the same unit.
    expect(context.placements[0].url).toContain(encodeURIComponent(context.placements[0].file));
    expect(instrumentCountForUnit("01")).toBeGreaterThan(0);
  });
});
