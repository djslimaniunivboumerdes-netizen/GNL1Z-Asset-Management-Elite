// Industrial engineering helpers: bolt→wrench, shackle sizing, insulation rules, CSV export.

// Standard bolt → hex wrench across-flats lookup (imperial inches preferred).
// Metric bolt sizes are mapped to the closest equivalent inch wrench.
const BOLT_TO_WRENCH: Record<string, string> = {
  "M8": "1/2\"",
  "M10": "11/16\"",
  "M12": "3/4\"",
  "M14": "7/8\"",
  "M16": "15/16\"",
  "M18": "1-1/16\"",
  "M20": "1-3/16\"",
  "M22": "1-1/4\"",
  "M24": "1-7/16\"",
  "M27": "1-5/8\"",
  "M30": "1-13/16\"",
  "M33": "2\"",
  "M36": "2-3/16\"",
  "M42": "2-9/16\"",
  "M48": "2-15/16\"",
  "1/4\"": "7/16\"",
  "5/16\"": "1/2\"",
  "3/8\"": "9/16\"",
  "7/16\"": "5/8\"",
  "1/2\"": "3/4\"",
  "9/16\"": "13/16\"",
  "5/8\"": "1-1/16\"",
  "3/4\"": "1-1/4\"",
  "7/8\"": "1-7/16\"",
  "1\"": "1-5/8\"",
  "1-1/8\"": "1-13/16\"",
  "1-1/4\"": "2\"",
  "1-3/8\"": "2-3/16\"",
  "1-1/2\"": "2-3/8\"",
};

// Default bolt sizes per equipment type (imperial inches per Sonatrach GNL1Z standard).
const DEFAULT_BOLT_BY_TYPE: Record<string, string> = {
  E: '3/4"',     // shell-and-tube exchangers — typical flange bolt
  F: '7/8"',     // columns / vessels
  G: '3/4"',     // separators / drums
  P: '5/8"',     // pumps
  K: '1-1/8"',   // compressors
  R: '3/4"',     // reactors
};

// Common companion bolt sizes typically encountered around a primary flange size
// (manway, drain, vent, instrument tappings, gasket retainers).
const COMPANION_BOLTS: Record<string, string[]> = {
  '1/2"':    ['3/8"', '1/2"', '5/8"'],
  '5/8"':    ['1/2"', '5/8"', '3/4"'],
  '3/4"':    ['1/2"', '5/8"', '3/4"', '7/8"'],
  '7/8"':    ['5/8"', '3/4"', '7/8"', '1"'],
  '1"':      ['3/4"', '7/8"', '1"', '1-1/8"'],
  '1-1/8"':  ['3/4"', '7/8"', '1"', '1-1/8"', '1-1/4"'],
  '1-1/4"':  ['7/8"', '1"', '1-1/8"', '1-1/4"', '1-3/8"'],
  '1-3/8"':  ['1"', '1-1/8"', '1-1/4"', '1-3/8"', '1-1/2"'],
  '1-1/2"':  ['1"', '1-1/4"', '1-3/8"', '1-1/2"'],
};

export function defaultBoltForType(typeCode: string): string {
  return DEFAULT_BOLT_BY_TYPE[typeCode] ?? '5/8"';
}

export function predictWrench(boltSize: string): string | null {
  if (!boltSize) return null;
  const key = boltSize.trim();
  if (BOLT_TO_WRENCH[key]) return BOLT_TO_WRENCH[key];
  const metric = key.match(/^M\s*(\d+)$/i);
  if (metric) return BOLT_TO_WRENCH[`M${metric[1]}`] ?? null;
  return null;
}

export function companionBolts(boltSize: string): string[] {
  return COMPANION_BOLTS[boltSize.trim()] ?? [boltSize];
}

export function predictToolKit(boltSize: string): string[] {
  const tools: string[] = [];
  const bolts = companionBolts(boltSize);
  const wrenches = Array.from(new Set(bolts.map((b) => predictWrench(b)).filter(Boolean) as string[]));

  // One combination wrench per companion bolt size
  wrenches.forEach((w) => {
    tools.push(`Combination wrench / Clé mixte ${w}`);
  });
  // Impact sockets (1/2" drive for ≤ 1", 3/4" drive for larger)
  wrenches.forEach((w) => {
    const drive = /^(1-|2)/.test(w) ? '3/4"' : '1/2"';
    tools.push(`Impact socket ${drive} drive / Douille à choc ${w}`);
  });
  // Torque wrench — pick the largest size encountered
  if (wrenches.length) {
    tools.push(`Torque wrench / Clé dynamométrique ${wrenches[wrenches.length - 1]}`);
  }
  // Stud / nut handling
  tools.push(`Stud bolt extractor / Extracteur de goujons`);
  tools.push(`Flange spreader / Écarteur de brides`);
  // Gasket service
  tools.push(`Spiral-wound gasket set (CS/SS, graphite filler) / Jeu de joints spiralés`);
  tools.push(`Gasket / joint scraper / Racloir de joint`);
  tools.push(`Wire brush (SS) / Brosse métallique inox`);
  tools.push(`Anti-seize compound (Cu / Ni grade) / Pâte anti-grippage`);
  tools.push(`Calibrated torque chart / Tableau de couples calibrés`);
  return tools;
}

// Crane recommendation per Sonatrach GNL1Z fleet (12 / 24 / 35 / 54 / 74 / 100+ T)
export interface CraneRec {
  capacity_t: number;
  label: string;
  rationale: string;
}
const CRANE_FLEET: number[] = [12, 24, 35, 54, 74, 100];

export function recommendCrane(massKg: number): CraneRec | null {
  if (!massKg || massKg <= 0) return null;
  const liftT = (massKg * 1.5) / 1000; // 1.5× safety factor on hook load
  // Working at ~70% of crane chart to allow boom radius / rigging weight
  const required = liftT / 0.7;
  const pick = CRANE_FLEET.find((c) => c >= required);
  if (!pick) {
    return {
      capacity_t: 100,
      label: '100+ Tonne mobile crane / Grue mobile 100+ T',
      rationale: `Hook load ${liftT.toFixed(1)} t (1.5× SF) exceeds 74 T at 70% chart utilisation — use 100+ T crawler/all-terrain.`,
    };
  }
  return {
    capacity_t: pick,
    label: `${pick} Tonne mobile crane / Grue mobile ${pick} T`,
    rationale: `Hook load ${liftT.toFixed(1)} t (mass × 1.5 SF) within ${pick} T crane chart at 70% utilisation (~${(pick * 0.7).toFixed(1)} t available).`,
  };
}

// Suggested shackle (Crosby G-209 working load limits, tons)
const SHACKLE_TABLE: Array<{ size: string; wll_t: number }> = [
  { size: "1/2\" (12mm)", wll_t: 2 },
  { size: "5/8\" (16mm)", wll_t: 3.25 },
  { size: "3/4\" (19mm)", wll_t: 4.75 },
  { size: "7/8\" (22mm)", wll_t: 6.5 },
  { size: "1\" (25mm)", wll_t: 8.5 },
  { size: "1-1/8\" (28mm)", wll_t: 9.5 },
  { size: "1-1/4\" (32mm)", wll_t: 12 },
  { size: "1-3/8\" (35mm)", wll_t: 13.5 },
  { size: "1-1/2\" (38mm)", wll_t: 17 },
  { size: "1-3/4\" (45mm)", wll_t: 25 },
  { size: "2\" (50mm)", wll_t: 35 },
  { size: "2-1/2\" (65mm)", wll_t: 55 },
  { size: "3\" (75mm)", wll_t: 85 },
  { size: "3-1/2\" (90mm)", wll_t: 120 },
];

export function suggestShackle(massKg: number): { size: string; wll_t: number } | null {
  if (!massKg || massKg <= 0) return null;
  const safety = (massKg * 1.5) / 1000; // tons
  return SHACKLE_TABLE.find((s) => s.wll_t >= safety) ?? SHACKLE_TABLE[SHACKLE_TABLE.length - 1];
}

export function safetyLoadKg(massKg: number) {
  return Math.round(massKg * 1.5);
}

// Insulation logic by equipment type + (optional) temperature
export function insulationRecommendation(typeCode: string, tempC?: number): {
  required: boolean;
  thickness_mm: number;
  material: string;
  rationale: string;
} {
  const t = tempC ?? estimateTempByType(typeCode);
  if (t >= 60 && t < 150) return { required: true, thickness_mm: 50, material: "Mineral wool + aluminium jacket", rationale: `Hot service ${t}°C — personnel protection.` };
  if (t >= 150 && t < 350) return { required: true, thickness_mm: 80, material: "Rock wool + stainless steel jacket", rationale: `High-temp service ${t}°C — heat conservation.` };
  if (t >= 350) return { required: true, thickness_mm: 120, material: "Calcium silicate + SS jacket", rationale: `Very high temp ${t}°C — refractory insulation.` };
  if (t < 0 && t > -50) return { required: true, thickness_mm: 60, material: "Cellular glass (Foamglas)", rationale: `Cold service ${t}°C — anti-condensation.` };
  if (t <= -50) return { required: true, thickness_mm: 150, material: "Polyurethane + vapour barrier", rationale: `Cryogenic ${t}°C — LNG-grade insulation.` };
  return { required: false, thickness_mm: 0, material: "—", rationale: "Ambient service, no insulation required." };
}

function estimateTempByType(code: string): number {
  // Rough defaults so insulation tab still gives guidance when no temp recorded.
  switch (code) {
    case "E": return 120; // exchanger
    case "F": return 90;  // column
    case "G": return 40;  // separator
    case "P": return 60;  // pump
    case "K": return 80;  // compressor
    default: return 25;
  }
}

// CSV export
export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
