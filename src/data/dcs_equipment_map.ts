// DCS-to-Equipment mapping
// AI detects instrument tags from DCS screenshots (e.g., "101-F502")
// This maps them to actual equipment tags in the database (e.g., "X01-F-502")
//
// Format: [AI-detected tag]: [equipment database tag]
// If a DCS tag doesn't map to any equipment, set to null

export const DCS_TO_EQUIPMENT_MAP: Record<string, string | null> = {
  // General Train
  "101-F502": "X01-F-502",
  "101-F501": "X01-F-501",
  "102-G07.87": "X02-G-07.87",
  "101-G-507": "X01-G-507",
  "102-G07.85": "X02-G-07.85",
  "102-R03.10": "X02-R-03.10",
  "102-R03.12": "X02-R-03.12",

  // Liquefaction
  "X06-E-05.30": "X06-E-05.30",

  // MCR Refrigeration
  "X04-G-07.85": "X04-G-07.85",
  "X04-G-07.90": "X04-G-07.90",
  "X04-G-07.91": "X04-G-07.91",
  "X04-E-05.21": "X04-E-05.21",
  "X04-E-05.22": "X04-E-05.22",
  "X04-E-05.23": "X04-E-05.23",
  "X04-E-05.24": "X04-E-05.24",
  "X04-E-05.25A": "X04-E-05.25A",
  "X04-E-05.25B": "X04-E-05.25B",
  "X04-E-05.26A": "X04-E-05.26A",
  "X04-E-05.26B": "X04-E-05.26B",
  "X04-E-05.40": "X04-E-05.40",

  // Propane
  "X05-G-07.88": "X05-G-07.88",
  "X05-G-07.89": "X05-G-07.89",
  "X04-F-07.11": "X04-F-07.11",
  "X03-G-07.86": "X03-G-07.86",
  "X03-F-05.16": "X03-F-05.16",
  "X03-E-05.13": "X03-E-05.13",
  "X03-E-05.14A": "X03-E-05.14A",
  "X03-E-05.14B": "X03-E-05.14B",

  // Decarbonation
  "X01-F-501": "X01-F-501",
  "X01-F-502": "X01-F-502",
  "X01-E-501": "X01-E-501",
  "X01-E-502": "X01-E-502",
  "X01-G-502": "X01-G-502",
  "X01-G-507": "X01-G-507",
  "X01-E-504": "X01-E-504",
  "X01-E-505": "X01-E-505",
  "X01-E-506": "X01-E-506",
  "X01-P-501": "X01-P-501",
  "X01-P-502": "X01-P-502",

  // Dehydration
  "X02-R-03.12": "X02-R-03.12",
  "X02-G-03.14": "X02-G-03.14",
  "X02-E-03.15": "X02-E-03.15",
  "X02-E-03.16": "X02-E-03.16",
  "X02-P-03.14A": "X02-P-03.14A",
  "X02-P-03.14B": "X02-P-03.14B",
  "X02-E-15.50": "X02-E-15.50",
  "X02-E-15.51": "X02-E-15.51",
  "X02-P-03.12A": "X02-P-03.12A",
  "X02-P-03.12B": "X02-P-03.12B",

  // Scrubber
  "X01-E-503A": "X01-E-503A",
  "X01-E-503B": "X01-E-503B",

  // Demethanisation
  "X07-F-07.21": "X07-F-07.21",
  "X07-E-07.22": "X07-E-07.22",
  "X07-E-07.23": "X07-E-07.23",
  "X07-E-07.30": "X07-E-07.30",
  "X07-G-07.24": "X07-G-07.24",

  // Deethanisation
  "X08-F-07.31": "X08-F-07.31",

  // Depropanisation
  "X09-F-07.41": "X09-F-07.41",

  // Debutanisation
  "X10-F-07.51": "X10-F-07.51",
};

/**
 * Map a DCS-detected tag to an equipment tag.
 * Returns null if no mapping exists.
 */
export function mapDcsTagToEquipment(dcsTag: string): string | null {
  const normalized = dcsTag.toUpperCase().trim();
  return DCS_TO_EQUIPMENT_MAP[normalized] ?? null;
}

/**
 * Get all equipment tags related to a list of DCS-detected tags.
 */
export function getEquipmentTagsFromDcsTags(dcsTags: string[]): string[] {
  const equipmentTags: string[] = [];
  for (const tag of dcsTags) {
    const mapped = mapDcsTagToEquipment(tag);
    if (mapped) equipmentTags.push(mapped);
  }
  return [...new Set(equipmentTags)];
}
