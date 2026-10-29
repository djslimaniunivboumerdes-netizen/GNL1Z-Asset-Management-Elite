import { describe, expect, it } from "vitest";
import { buildKnowledgeAnswer, detectIntent } from "@/lib/assistantKnowledge";

describe("source-backed assistant answers", () => {
  it("detects piping count and size intents in English and French", () => {
    expect(detectIntent("How many pipelines associated with E-520?")).toBe("line_count");
    expect(detectIntent("What piping sizes are connected to G 780?")).toBe("line_sizes");
    expect(detectIntent("Combien de lignes de tuyauterie pour E-520 ?")).toBe("line_count");
  });

  it("refuses to invent a pipeline count for E520 without a line list", () => {
    const answer = buildKnowledgeAnswer({ prompt: "How many pipelines associated with E-520?", lang: "en" });
    expect(answer.intent).toBe("line_count");
    expect(answer.verifiedLineList).toBe(false);
    expect(answer.text).toContain("Piping answer not yet verified");
    expect(answer.text).toContain("E520");
    expect(answer.sources.some((source) => source.kind === "pid")).toBe(true);
    expect(answer.text).not.toMatch(/\b\d+\s+distinct pipeline/i);
  });

  it("counts and lists sizes from a supplied line list with row citations", () => {
    const answer = buildKnowledgeAnswer({
      prompt: "What pipe sizes are connected to E-501?",
      lang: "en",
      lineList: {
        fileName: "line-list.csv",
        rows: [
          { row: 2, lineNumber: "L-1", from: "E501", to: "G502", size: "DN 50", service: "MEA", spec: "", insulation: "" },
          { row: 3, lineNumber: "L-1", from: "X01-E-501", to: "G502", size: "DN 50", service: "MEA", spec: "", insulation: "" },
          { row: 4, lineNumber: "L-2", from: "P501", to: "E-501", size: '2"', service: "amine", spec: "", insulation: "" },
        ],
      },
    });
    expect(answer.verifiedLineList).toBe(true);
    expect(answer.text).toContain("DN 50");
    expect(answer.text).toContain('2"');
    expect(answer.text).toContain("CSV row 2");
    expect(answer.sources.some((source) => source.kind === "csv")).toBe(true);
  });

  it("reports unknown tags instead of substituting a neighbor", () => {
    const answer = buildKnowledgeAnswer({ prompt: "piping sizes connected to G 781", lang: "en" });
    expect(answer.resolution.status).toBe("unknown");
    expect(answer.text).toContain("Equipment not found");
    expect(answer.text).not.toContain("X06-G-07.80");
  });

  it("answers in French and keeps the safety boundary", () => {
    const answer = buildKnowledgeAnswer({ prompt: "Consulter E-501", lang: "fr" });
    expect(answer.text).toContain("Référence du registre");
    expect(answer.text).toContain("X01-E-501");
    expect(answer.text).toContain("autorisation d'exploitation");
  });
});
