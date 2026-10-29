// Industrial engineering helpers: bolt→wrench, screening-only lifting/insulation guidance, CSV export.
// These helpers do not replace an approved lift plan, rigging study, insulation specification,
// manufacturer chart, or site procedure. Missing inputs must never produce a sized recommendation.

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
  if (!Number.isFinite(massKg) || massKg <= 0) return null;
  const liftT = (massKg * 1.5) / 1000; // screening allowance, not an approved rigging load
  const required = liftT / 0.7;
  const pick = CRANE_FLEET.find((c) => c >= required);
  // Never suggest "100+ T" as if it were a validated capacity. Outside the
  // configured fleet, a competent person must prepare an engineered lift plan.
  if (!pick) return null;
  return {
    capacity_t: pick,
    label: `${pick} Tonne fleet candidate / Candidat flotte ${pick} T`,
    rationale: `Screening only: ${liftT.toFixed(1)} t allowance (mass × 1.5) at 70% utilisation points to the ${pick} T fleet class. Verify the actual crane chart at radius/configuration, rigging weight, centre of gravity, ground bearing and the approved lift plan before selection.`,
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
  if (!Number.isFinite(massKg) || massKg <= 0) return null;
  const safety = (massKg * 1.5) / 1000; // screening allowance, not sling tension
  // Do not cap an overload at the largest table row. Multi-leg geometry,
  // angles, bending, temperature and manufacturer WLL require a rigging study.
  return SHACKLE_TABLE.find((s) => s.wll_t >= safety) ?? null;
}

export function safetyLoadKg(massKg: number): number | null {
  if (!Number.isFinite(massKg) || massKg <= 0) return null;
  return Math.round(massKg * 1.5);
}

// Insulation screening by verified service temperature. Equipment type alone
// is not a safe basis for deciding whether insulation is required.
export interface InsulationRecommendation {
  required: boolean;
  thickness_mm: number;
  material: string;
  rationale: string;
  dataMissing: boolean;
}

export function insulationRecommendation(_typeCode: string, tempC?: number | null): InsulationRecommendation {
  if (tempC == null || !Number.isFinite(tempC)) {
    return {
      required: false,
      thickness_mm: 0,
      material: "Not assessed / Non évalué",
      rationale: "No verified service temperature is recorded. Do not infer insulation requirements from equipment type; confirm the approved insulation specification and operating envelope.",
      dataMissing: true,
    };
  }
  const t = tempC;
  if (t >= 60 && t < 150) return { required: true, thickness_mm: 50, material: "Mineral wool + aluminium jacket", rationale: `Hot service ${t}°C — screening candidate for personnel protection; verify the approved specification.`, dataMissing: false };
  if (t >= 150 && t < 350) return { required: true, thickness_mm: 80, material: "Rock wool + stainless steel jacket", rationale: `High-temperature service ${t}°C — screening candidate for heat conservation; verify the approved specification.`, dataMissing: false };
  if (t >= 350) return { required: true, thickness_mm: 120, material: "Calcium silicate + SS jacket", rationale: `Very high temperature ${t}°C — screening candidate only; verify refractory/insulation design and approved specification.`, dataMissing: false };
  if (t < 0 && t > -50) return { required: true, thickness_mm: 60, material: "Cellular glass (Foamglas)", rationale: `Cold service ${t}°C — screening candidate for anti-condensation; verify vapour-barrier design.`, dataMissing: false };
  if (t <= -50) return { required: true, thickness_mm: 150, material: "Polyurethane + vapour barrier", rationale: `Cryogenic service ${t}°C — screening candidate only; verify LNG-grade insulation, vapour barrier and contract specification.`, dataMissing: false };
  return { required: false, thickness_mm: 0, material: "—", rationale: `Recorded service ${t}°C is in the ambient screening band. Confirm personnel-protection, condensation and process requirements before concluding insulation is unnecessary.`, dataMissing: false };
}

// CSV export. Protect spreadsheet consumers from formula injection as well as
// preserving commas, quotes, newlines and Unicode in technical descriptions.
export function serializeCsv(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    let text = value == null ? "" : typeof value === "string" ? value : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\r\n");
}

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const blob = new Blob(["\uFEFF" + serializeCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
