import { describe, expect, it } from "vitest";
import { EQUIPMENT } from "@/data";
import { createEquipmentSearch, matchingParts } from "@/lib/equipmentSearch";

describe("equipment register search", () => {
  const search = createEquipmentSearch(EQUIPMENT);
  it("finds tags regardless of case and surrounding whitespace", () => {
    expect(search("  x01-e-501  ").map((item) => item.tag)).toContain("X01-E-501");
  });
  it("tolerates a small typo in an equipment name", () => {
    expect(search("condenseur").length).toBeGreaterThan(0);
    expect(search("condnseur").map((item) => item.tag)).toContain("X01-E-501");
  });
  it("searches spare-part references and exposes the matching component", () => {
    const asset = EQUIPMENT.find((item) => item.spare_parts.items?.some((part) => part.reference && part.reference.length > 5));
    const part = asset?.spare_parts.items?.find((item) => item.reference && item.reference.length > 5);
    expect(asset).toBeDefined();
    expect(part).toBeDefined();
    expect(search(part!.reference!).map((item) => item.tag)).toContain(asset!.tag);
    expect(matchingParts(asset!, part!.reference!)).toContainEqual(part);
  });
  it("returns no invented matches and does not mutate the register", () => {
    const first = EQUIPMENT[0].tag;
    expect(search("zzzz-no-such-asset-999999")).toEqual([]);
    expect(search("")).toHaveLength(EQUIPMENT.length);
    expect(EQUIPMENT[0].tag).toBe(first);
  });
});
