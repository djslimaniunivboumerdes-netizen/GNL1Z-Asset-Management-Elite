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
