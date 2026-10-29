import Fuse from "fuse.js";
import type { Equipment, SparePart } from "@/data";

const fuseOptions: ConstructorParameters<typeof Fuse<Equipment>>[1] = {
  threshold: 0.25,
  ignoreLocation: true,
  keys: ["tag", "name", "name_en", "name_fr", "unit", "section", "type.name", "technical.serial_no", "notes", "spare_parts.items.code", "spare_parts.items.description", "spare_parts.items.reference"],
};

/** Pre-index the register once; avoid serializing every asset on every keystroke. */
export function createEquipmentSearch(equipment: Equipment[]) {
  const fuse = new Fuse(equipment, fuseOptions);
  const deepText = new Map(equipment.map((item) => [item.tag, JSON.stringify(item).toLocaleLowerCase()]));
  return (query: string): Equipment[] => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return equipment;
    const exact = equipment.filter((item) => deepText.get(item.tag)?.includes(normalized));
    const found = new Map(exact.map((item) => [item.tag, item]));
    for (const result of fuse.search(normalized)) found.set(result.item.tag, result.item);
    return [...found.values()];
  };
}

export function matchingParts(item: Equipment, query: string): SparePart[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return (item.spare_parts.items ?? []).filter((part) => JSON.stringify(part).toLocaleLowerCase().includes(normalized));
}
