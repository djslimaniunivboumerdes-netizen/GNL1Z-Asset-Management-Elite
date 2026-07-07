import gnl1zDb from "@/data/gnl1z_database.json";

export interface SparePart {
  code: string | number;
  description: string;
  reference?: string;
  qty_installed: number;
  stock_location?: string;
  item_label?: string;
  testing_status?: string;
  category?: string;
  material?: string;
  size_nominal?: string;
}

export interface EquipmentType {
  code: string;
  name: string;
}

// Two shapes: shell-and-tube exchangers expose shell+tube; everything else exposes single design/test.
export interface TestPressure {
  // exchanger-specific (E type)
  shell_design_bar?: number | null;
  tube_design_bar?: number | null;
  shell_test_bar?: number | null;
  tube_test_bar?: number | null;
  // generic
  design_bar?: number | null;
  test_bar?: number | null;
}

export interface Equipment {
  tag: string;
  name: string;
  name_en?: string;
  name_fr?: string;
  type: EquipmentType;
  unit: string;
  section: string;
  testing_status: string;
  technical: {
    weight_kg: number;
    volume_m3: number;
    pressure_bar: number;
    serial_no: string;
    temperature_c?: number;
    test_pressure?: TestPressure;
  };
  maintenance: {
    lifting_method: string;
    tools: string[];
    last_tested: string;
    next_test_due: string;
  };
  spare_parts: {
    count: number;
    total_qty_installed: number;
    items?: SparePart[];
  };
  pid_drive_id?: string | null;
  notes?: string;
}

interface DbShape {
  project: string;
  location: string;
  process: string;
  trains: number;
  equipment_count: number;
  spare_parts_count: number;
  last_updated: string;
  equipment: Equipment[];
}

const DB = gnl1zDb as DbShape;

export const EQUIPMENT: Equipment[] = DB.equipment;

export const META = {
  project: DB.project,
  location: DB.location,
  process: DB.process,
  trains: DB.trains,
  equipment_count: DB.equipment_count,
  spare_parts_count: DB.spare_parts_count,
  last_updated: DB.last_updated,
};

export const UNITS = Array.from(new Set(EQUIPMENT.map((e) => e.unit))).sort();
export const STATUSES = Array.from(new Set(EQUIPMENT.map((e) => e.testing_status))).sort();
export const SECTIONS = Array.from(new Set(EQUIPMENT.map((e) => e.section))).sort();

// Normalize tag for robust matching (case + spaces + separator variants).
function normalizeTag(t: string): string {
  return t.toUpperCase().replace(/\s+/g, "").replace(/[._]/g, "-");
}
const TAG_INDEX: Record<string, Equipment> = (() => {
  const m: Record<string, Equipment> = {};
  for (const e of EQUIPMENT) {
    m[e.tag] = e;
    m[normalizeTag(e.tag)] = e;
  }
  return m;
})();
export function getEquipmentByTag(tag: string): Equipment | undefined {
  if (!tag) return undefined;
  return TAG_INDEX[tag] ?? TAG_INDEX[normalizeTag(tag)];
}

export function isShellAndTube(eq: Equipment): boolean {
  return eq.type.code === "E";
}
export function getAllEquipmentTags(): string[] {
  return EQUIPMENT.map((e) => e.tag);
}
