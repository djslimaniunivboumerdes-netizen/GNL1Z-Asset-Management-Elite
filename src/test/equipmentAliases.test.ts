import { describe, expect, it } from "vitest";
import { resolveEquipmentTag, tagKeys } from "@/lib/equipmentAliases";
import { allAliasRecords, resolvePrompt } from "@/lib/assistantKnowledge";

describe("equipment alias resolution", () => {
  it("generates conservative keys without stripping leading zeros from the canonical tag", () => {
    expect(tagKeys("X01-E-501")).toContain("X01E501");
    expect(tagKeys("X01-E-501")).toContain("E501");
    expect(tagKeys("X06-G-07.80")).toContain("G780");
    expect(tagKeys("X06-G-07.80")).toContain("G0780");
  });

  it("resolves the requested format variants to the same register tag", () => {
    const records = allAliasRecords();
    for (const input of ["e 501", "E-501", "E501", "X01 E 501", "X01-E 501", "X01-E-501", "101-E501"]) {
      const result = resolveEquipmentTag(input, records);
      expect(result.status, input).toBe("resolved");
      if (result.status === "resolved") expect(result.matches[0].record.tag).toBe("X01-E-501");
    }
  });

  it("resolves dotted legacy drum tags and keeps E520 as a drawing-only asset", () => {
    const records = allAliasRecords();
    const g780 = resolveEquipmentTag("piping sizes connected to G 781", records);
    expect(g780.status).toBe("unknown");
    const g780real = resolveEquipmentTag("G-780", records);
    expect(g780real.status).toBe("resolved");
    if (g780real.status === "resolved") expect(g780real.matches[0].record.tag).toBe("X06-G-07.80");
    const e520 = resolvePrompt("How many pipelines associated with E-520?");
    expect(e520.status).toBe("resolved");
    if (e520.status === "resolved") {
      expect(e520.matches[0].record.tag).toBe("E520");
      expect(e520.matches[0].record.kind).toBe("drawing");
    }
  });

  it("does not silently choose between ambiguous short tags", () => {
    const records = [
      { tag: "X01-E-501", aliases: ["E501"] },
      { tag: "X02-E-501", aliases: ["E501"] },
    ];
    const result = resolveEquipmentTag("Review E501", records);
    expect(result.status).toBe("ambiguous");
  });

  it("uses page context only for generic questions, not for an unknown explicit tag", () => {
    const records = allAliasRecords();
    expect(resolvePrompt("What is the schedule?", "X01-E-501").status).toBe("resolved");
    expect(resolvePrompt("How many pipelines for G781?", "X01-E-501").status).toBe("unknown");
  });
});
