import { describe, expect, it } from "vitest";
import {
  parseInstrumentTag, describeInstrument, instrumentUnit, resolveUnit, UNIT_CATALOGUE,
} from "@/lib/instrumentTags";
import {
  buildInstrumentIndex, searchInstruments, instrumentFacets, findInstrument,
} from "@/lib/instrumentIndex";

describe("instrument tag parsing", () => {
  it("decodes a compact tag into variable, functions, unit and loop", () => {
    const tag = parseInstrumentTag("LIC101204");
    expect(tag.mnemonic).toBe("LIC");
    expect(tag.variable).toBe("L");
    expect(tag.functions).toEqual(["I", "C"]);
    expect(tag.unitCode).toBe("101");
    expect(tag.loop).toBe("204");
    expect(tag.deviceClass).toBe("controller");
    expect(tag.descriptionEn).toBe("Level indicating controller");
    expect(tag.descriptionFr).toBe("Niveau indicateur contrôleur");
  });

  it("decodes the hyphenated form used on some screens", () => {
    const tag = parseInstrumentTag("XV-101-223");
    expect(tag.mnemonic).toBe("XV");
    expect(tag.unitCode).toBe("101");
    expect(tag.loop).toBe("223");
    expect(tag.deviceClass).toBe("valve");
    expect(tag.descriptionEn).toContain("valve");
  });

  it("handles suffixes, short loops and differential variables", () => {
    expect(parseInstrumentTag("PDI10204A").loop).toBe("04");
    expect(parseInstrumentTag("PDI10204A").suffix).toBe("A");
    expect(parseInstrumentTag("PDI10204A").variable).toBe("PD");
    expect(parseInstrumentTag("PDI10204A").descriptionEn).toContain("Differential pressure");
    expect(parseInstrumentTag("TIC10442").loop).toBe("42");
    expect(parseInstrumentTag("TIC10442").unitCode).toBe("104");
    expect(parseInstrumentTag("AI100185A").loop).toBe("185");
    expect(parseInstrumentTag("AI100185A").unitCode).toBe("100");
  });

  it("flags plant-specific letter groups instead of pretending they are certain", () => {
    const tag = parseInstrumentTag("CRIC-105-06");
    expect(tag.unverified).toBe(true);
    expect(tag.unitCode).toBe("105");
    expect(tag.loop).toBe("06");
  });

  it("names the device after its last function letter, without duplicating it", () => {
    expect(parseInstrumentTag("FIC10505").descriptionEn).toBe("Flow indicating controller");
    expect(parseInstrumentTag("FIQ10131").descriptionEn).toBe("Flow indicating totalizer");
    expect(parseInstrumentTag("AAH102184").descriptionEn).toBe("Analysis high alarm");
    expect(parseInstrumentTag("PDAH102229").descriptionEn).toBe("Differential pressure high alarm");
    expect(parseInstrumentTag("XV-101-223").descriptionEn).toBe("On-off / unclassified valve");
    expect(parseInstrumentTag("TI101101").descriptionEn).toBe("Temperature indicator");
  });

  it("reads the device from the stem when high/low modifiers close the tag", () => {
    expect(parseInstrumentTag("TSL10512").descriptionEn).toBe("Temperature low switch");
    expect(parseInstrumentTag("PDALL10634").descriptionEn).toBe("Differential pressure low low alarm");
    expect(parseInstrumentTag("PDAH102229").descriptionEn).toBe("Differential pressure high alarm");
    expect(parseInstrumentTag("PCV10602").descriptionEn).toBe("Pressure control valve");
  });

  it("knows the fuel-gas unit used by the 9xx screens", () => {
    expect(resolveUnit("940").unit?.en).toBe("Fuel gas");
    expect(resolveUnit("940").unit?.fr).toBe("Gaz combustible");
  });

  it("normalises case, spacing and separators to one key", () => {
    expect(parseInstrumentTag(" lic 101204 ").key).toBe("LIC101204");
    expect(parseInstrumentTag("LIC-101-204").key).toBe("LIC101204");
  });

  it("reports the usual engineering unit for the measurement", () => {
    expect(instrumentUnit(parseInstrumentTag("LIC101204"))).toBe("%");
    expect(instrumentUnit(parseInstrumentTag("TIC10612"))).toBe("°C");
    expect(instrumentUnit(parseInstrumentTag("PIC103114A"))).toBe("bar");
  });

  it("resolves the train and the process unit from the unit code", () => {
    expect(resolveUnit("101")).toEqual({
      unitCode: "101",
      train: "1",
      unit: expect.objectContaining({ code: "01", en: "Decarbonation (MEA)" }),
    });
    // 206 → train 2, liquefaction — the other trains use the same unit map.
    expect(resolveUnit("206").train).toBe("2");
    expect(resolveUnit("206").unit?.code).toBe("06");
    expect(resolveUnit(null).unit).toBeNull();
    // 9xx tags are plant-level systems (fuel gas), not one of the six trains.
    expect(resolveUnit("940").train).toBeNull();
  });

  it("builds a sentence naming the loop and the unit", () => {
    const sentence = describeInstrument(parseInstrumentTag("FIC10505"), "en");
    expect(sentence).toContain("Flow indicating controller");
    expect(sentence).toContain("loop 05");
    expect(sentence).toContain("unit 105");
  });
});

describe("instrument index", () => {
  it("indexes the scanned tags, skipping equipment-style tags", () => {
    const index = buildInstrumentIndex();
    expect(index.length).toBeGreaterThan(200);
    // "101-F502" is an equipment tag, not an instrument — it must not be indexed.
    expect(index.some(e => e.tag === "101-F502")).toBe(false);
    expect(index.some(e => e.tag === "LIC101204")).toBe(true);
  });

  it("attaches the panels a tag was seen on", () => {
    const entry = findInstrument("LIC101204")!;
    expect(entry.panels.length).toBeGreaterThan(0);
    expect(entry.panels.map(p => p.id)).toContain("decarbonation-01");
  });

  it("links an instrument to the equipment of its unit", () => {
    const entry = findInstrument("LIC101204")!;
    expect(entry.unit?.code).toBe("01");
    // 101-F501 / F502 / E501 … all belong to unit 101 (decarbonation).
    expect(entry.equipment.map(e => e.diag)).toEqual(expect.arrayContaining(["101-F502", "101-F501", "101-E501"]));
    expect(entry.equipment.find(e => e.diag === "101-F502")?.dbTag).toBe("X01-F-502");
  });

  it("finds a tag by exact tag, partial tag, mnemonic and meaning", () => {
    expect(searchInstruments({ q: "LIC101204" })[0].tag).toBe("LIC101204");
    expect(searchInstruments({ q: "LIC1012" })[0].tag.startsWith("LIC1012")).toBe(true);
    expect(searchInstruments({ q: "XV" }).every(e => e.parsed.mnemonic.startsWith("XV"))).toBe(true);
    expect(searchInstruments({ q: "level" }).every(e => e.parsed.variable === "L")).toBe(true);
    expect(searchInstruments({ q: "niveau" }).every(e => e.parsed.variable === "L")).toBe(true);
  });

  it("finds instruments by the equipment they belong to", () => {
    const results = searchInstruments({ q: "F502" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(e => e.equipment.some(eq => eq.diag === "101-F502"))).toBe(true);
  });

  it("filters by measurement, device class and unit", () => {
    expect(searchInstruments({ variable: "T" }).every(e => e.parsed.variable === "T")).toBe(true);
    expect(searchInstruments({ deviceClass: "valve" }).every(e => e.parsed.deviceClass === "valve")).toBe(true);
    expect(searchInstruments({ unitCode: "105" }).every(e => e.parsed.unitCode === "105")).toBe(true);
    expect(searchInstruments({ unitCode: "105" }).length).toBeGreaterThan(0);
  });

  it("exposes facets for the filter chips", () => {
    const facets = instrumentFacets();
    expect(facets.total).toBeGreaterThan(200);
    expect(facets.byVariable[0].count).toBeGreaterThan(0);
    expect(facets.byDeviceClass.some(c => c.key === "valve")).toBe(true);
    expect(facets.byUnit.some(u => u.code === "101")).toBe(true);
  });

  it("is case- and separator-insensitive when looking a tag up", () => {
    expect(findInstrument("lic-101-204")?.tag).toBe("LIC101204");
  });

  it("covers every unit in the catalogue with a French label", () => {
    for (const unit of Object.values(UNIT_CATALOGUE)) {
      expect(unit.fr.length).toBeGreaterThan(0);
      expect(unit.systems.length).toBeGreaterThan(0);
    }
  });
});
