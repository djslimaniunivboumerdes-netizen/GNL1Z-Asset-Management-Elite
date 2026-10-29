import { describe, expect, it } from "vitest";
import { EQUIPMENT } from "@/data";
import { buildEngineeringJudgment } from "@/lib/engineeringJudgment";

describe("record-based engineering review", () => {
  it("does not turn missing pressure data into a hydrotest setpoint or safety clearance", () => {
    const source = EQUIPMENT.find((item) => item.technical.test_pressure?.design_bar || item.technical.test_pressure?.shell_design_bar) ?? EQUIPMENT[0];
    const eq = structuredClone(source);
    eq.technical.test_pressure = undefined;
    const judgment = buildEngineeringJudgment(eq);
    const text = [...judgment.recommendedTests, ...judgment.safetyRecommendations].map((item) => item.en).join(" ");
    expect(text).toContain("missing");
    expect(text).not.toContain("no immediate safety action required");
    expect(text).not.toMatch(/at null bar|to null bar/i);
  });
  it("presents recorded pressures as reference values rather than calculated setpoints", () => {
    const source = EQUIPMENT.find((item) => item.technical.test_pressure?.design_bar || item.technical.test_pressure?.shell_design_bar) ?? EQUIPMENT[0];
    const judgment = buildEngineeringJudgment(source);
    const text = judgment.recommendedTests.map((item) => item.en).join(" ");
    expect(text).toContain("approved");
    expect(text).not.toContain("no immediate safety action required");
  });
});
