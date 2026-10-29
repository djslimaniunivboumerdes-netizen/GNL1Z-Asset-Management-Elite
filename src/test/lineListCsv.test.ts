import { describe, expect, it } from "vitest";
import { normalizePipeSize, parseLineListCsv, queryLineList } from "@/lib/lineListCsv";
import { resolvePrompt } from "@/lib/assistantKnowledge";

const csv = `line;from;to;size;service
L-001;E-501;G-502;DN 50;MEA
L-001;E501;G502;DN 50;MEA
L-002;X01-E-501;P501;2";amine
L-003;F501;E501;NPS 3;lean amine
`;

describe("line-list CSV", () => {
  it("parses semicolon CSV and deduplicates by line number", () => {
    const dataset = parseLineListCsv(csv, "lines.csv");
    expect(dataset.delimiter).toBe(";");
    expect(dataset.rowCount).toBe(4);
    const result = queryLineList(dataset, "X01-E-501", (candidate) => {
      const resolution = resolvePrompt(candidate);
      return resolution.status === "resolved" && resolution.matches.some((match) => match.record.tag === "X01-E-501");
    });
    expect(result.distinctLineCount).toBe(3);
    expect(result.sizes).toEqual(['2"', "DN 50", "NPS 3"]);
    expect(result.matchedRows).toHaveLength(4);
  });

  it("normalizes common size labels without converting units", () => {
    expect(normalizePipeSize("dn100")).toBe("DN 100");
    expect(normalizePipeSize('4" SCH 40')).toBe('4"');
    expect(normalizePipeSize("NPS 2.5")).toBe("NPS 2.5");
    expect(normalizePipeSize("")).toBe("");
  });

  it("warns when connection or size columns are missing", () => {
    const dataset = parseLineListCsv("line,size\nL1,DN50\n", "missing.csv");
    expect(dataset.warnings.some((warning) => /from\/to/.test(warning))).toBe(true);
    const noSize = parseLineListCsv("line,from,to\nL1,E501,G502\n", "nosize.csv");
    expect(noSize.warnings.some((warning) => /size/.test(warning))).toBe(true);
  });
});
