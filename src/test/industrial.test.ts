import { describe, expect, it } from "vitest";
import { serializeCsv } from "@/lib/industrial";

describe("safe CSV export", () => {
  it("preserves Unicode, commas, quotes and multiline descriptions", () => {
    expect(serializeCsv([{ tag: "X01", name: 'Échangeur "A"', notes: "line 1\nline 2, check" }]))
      .toBe('tag,name,notes\r\nX01,"Échangeur ""A""","line 1\nline 2, check"');
  });
  it("neutralizes spreadsheet formulas in values and headers", () => {
    const csv = serializeCsv([{ "=HYPERLINK(\"x\")": "=1+1", tag: " +SUM(A1)", notes: "@import", value: "-10", safe: 42 }]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("' +SUM(A1)");
    expect(csv).toContain("'@import");
    expect(csv).toContain("'-10");
    expect(csv).toContain(",42");
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });
  it("uses a stable union of headers and blanks for missing fields", () => {
    expect(serializeCsv([{ a: 1 }, { b: null }])).toBe("a,b\r\n1,\r\n,");
  });
});

import { recommendCrane, suggestShackle, safetyLoadKg, insulationRecommendation } from "@/lib/industrial";

describe("screening-only engineering guardrails", () => {
  it("does not size lifting equipment from invalid or missing mass", () => {
    for (const mass of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(recommendCrane(mass)).toBeNull();
      expect(suggestShackle(mass)).toBeNull();
      expect(safetyLoadKg(mass)).toBeNull();
    }
  });
  it("does not cap an overload at the largest shackle or claim a 100+ tonne crane is validated", () => {
    expect(suggestShackle(1_000_000)).toBeNull();
    expect(recommendCrane(1_000_000)).toBeNull();
  });
  it("labels fleet output as a screening candidate requiring an approved lift plan", () => {
    const crane = recommendCrane(1000);
    expect(crane?.capacity_t).toBe(12);
    expect(crane?.rationale).toContain("approved lift plan");
  });
  it("does not infer insulation requirements from equipment type when temperature is missing", () => {
    const result = insulationRecommendation("E");
    expect(result.dataMissing).toBe(true);
    expect(result.required).toBe(false);
    expect(result.material).toContain("Not assessed");
  });
  it("treats known temperature output as a screening candidate, not an approved specification", () => {
    const result = insulationRecommendation("E", 120);
    expect(result.dataMissing).toBe(false);
    expect(result.rationale).toContain("approved specification");
  });
});
