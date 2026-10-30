// src/lib/instrumentTags.ts
//
// Turns a raw DCS instrument tag ("LIC101204", "XV-101-223", "PDI10204A") into
// something an operator can act on: what it measures, what it does, which unit
// it lives in and which equipment it belongs to.
//
// Pure domain logic — no React, no data imports, no network — so it is fast to
// unit-test and safe to reuse from pages, the assistant and Cloudflare code.
//
// Numbering convention used at GNL1Z (validated against the scanned panels):
//   <train><unit><loop>   e.g. 101204 → train 1, unit 01 (decarbonation), loop 204
//   105-06               → train 1, unit 05 (MCR refrigeration), loop 06

export type DeviceClass =
  | "valve" | "controller" | "indicator" | "transmitter" | "switch"
  | "alarm" | "hand" | "analyser" | "speed" | "position" | "totalizer"
  | "relay" | "element" | "unknown";

export interface InstrumentTag {
  /** Exactly as read from the DCS screen. */
  raw: string;
  /** Normalised lookup key: uppercase, separators removed. */
  key: string;
  /** Letter group, e.g. "LIC". */
  mnemonic: string;
  /** First letter (measured variable) when it is a standard ISA code. */
  variable: string | null;
  variableEn: string | null;
  variableFr: string | null;
  /** Remaining letters, decoded individually. */
  functions: string[];
  /** Unit code (train + unit), e.g. "101". */
  unitCode: string | null;
  /** Train number parsed from the unit code ("1"…"6"). */
  train: string | null;
  /** Loop number inside the unit, e.g. "204". */
  loop: string | null;
  /** Trailing letter (A/B…) distinguishing parallel devices. */
  suffix: string | null;
  deviceClass: DeviceClass;
  descriptionEn: string;
  descriptionFr: string;
  /** True when some letter could not be decoded — the reading is incomplete. */
  partial: boolean;
  /** True for plant-specific letter groups the decode cannot verify. */
  unverified: boolean;
}

/* ─── ISA-5.1 measured variables (first letter) ──────────────────────────── */
interface VariableDef { en: string; fr: string; unit: string }

const VARIABLES: Record<string, VariableDef> = {
  A: { en: "Analysis",        fr: "Analyse",        unit: "ppm / %" },
  B: { en: "Burner / flame",  fr: "Brûleur / flamme", unit: "—" },
  C: { en: "Conductivity",    fr: "Conductivité",   unit: "µS/cm" },
  D: { en: "Density",         fr: "Densité",        unit: "kg/m³" },
  E: { en: "Voltage",         fr: "Tension",        unit: "V" },
  F: { en: "Flow",            fr: "Débit",          unit: "m³/h" },
  H: { en: "Hand (manual)",   fr: "Manuel",         unit: "—" },
  I: { en: "Current",         fr: "Courant",        unit: "A" },
  J: { en: "Power",           fr: "Puissance",      unit: "kW" },
  K: { en: "Time",            fr: "Temps",          unit: "s" },
  L: { en: "Level",           fr: "Niveau",         unit: "%" },
  M: { en: "Moisture",        fr: "Humidité",       unit: "%" },
  P: { en: "Pressure",        fr: "Pression",       unit: "bar" },
  Q: { en: "Quantity",        fr: "Quantité",       unit: "—" },
  R: { en: "Radiation",       fr: "Radioactivité",  unit: "—" },
  S: { en: "Speed / frequency", fr: "Vitesse / fréquence", unit: "rpm" },
  T: { en: "Temperature",     fr: "Température",    unit: "°C" },
  U: { en: "Multivariable",   fr: "Multivariable",  unit: "—" },
  V: { en: "Vibration",       fr: "Vibration",      unit: "mm/s" },
  W: { en: "Weight / force",  fr: "Poids / force",  unit: "kg" },
  X: { en: "On-off / unclassified", fr: "Marche-arrêt / divers", unit: "—" },
  Y: { en: "Event / state",   fr: "Événement / état", unit: "—" },
  Z: { en: "Position",        fr: "Position",       unit: "%" },
};

/** Two-letter variables read as a single measurement (differential, etc.). */
const COMPOUND_VARIABLES: Record<string, VariableDef> = {
  PD: { en: "Differential pressure", fr: "Pression différentielle", unit: "mbar" },
  TD: { en: "Differential temperature", fr: "Température différentielle", unit: "K" },
};

/**
 * Letters that name the physical device when they close the tag:
 * LIC → controller, XV → valve, TI → indicator, FIQ → totalizer.
 */
const NOUN_LETTERS: Record<string, { en: string; fr: string }> = {
  C: { en: "controller", fr: "contrôleur" },
  V: { en: "valve", fr: "vanne" },
  I: { en: "indicator", fr: "indicateur" },
  T: { en: "transmitter", fr: "transmetteur" },
  S: { en: "switch", fr: "contact" },
  Q: { en: "totalizer", fr: "totalisateur" },
  A: { en: "alarm", fr: "alarme" },
  Z: { en: "actuator", fr: "actionneur" },
  Y: { en: "relay", fr: "relais" },
  E: { en: "element", fr: "élément" },
  M: { en: "motor", fr: "moteur" },
  R: { en: "recorder", fr: "enregistreur" },
  K: { en: "control station", fr: "station de contrôle" },
  G: { en: "gauge", fr: "voyant" },
};

/**
 * Plant-specific letter groups that follow no ISA combination we can verify.
 * They are decoded from the individual letters but flagged so nobody trusts
 * the reading without checking the loop drawing.
 */
const UNVERIFIED_MNEMONICS = new Set(["CRIC"]);

/* ─── ISA-5.1 function letters (second and later) ────────────────────────── */
const FUNCTIONS: Record<string, { en: string; fr: string }> = {
  A: { en: "alarm",        fr: "alarme" },
  C: { en: "control",      fr: "régulation" },
  E: { en: "element",      fr: "élément" },
  G: { en: "gauge / glass", fr: "voyant" },
  H: { en: "high",         fr: "haut" },
  I: { en: "indicating",   fr: "indicateur" },
  K: { en: "control station", fr: "station de contrôle" },
  L: { en: "low",          fr: "bas" },
  M: { en: "motor",        fr: "moteur" },
  Q: { en: "totalizing",   fr: "totalisateur" },
  R: { en: "recording",    fr: "enregistreur" },
  S: { en: "switch",       fr: "contact" },
  T: { en: "transmitting", fr: "transmetteur" },
  V: { en: "valve",        fr: "vanne" },
  Y: { en: "relay / compute", fr: "relais / calculateur" },
  Z: { en: "actuator",     fr: "actionneur" },
};

/* ─── GNL1Z unit catalogue ───────────────────────────────────────────────── */
export interface UnitInfo {
  code: string;          // "01"
  en: string;
  fr: string;
  section: string;       // matches the process-flow section vocabulary
  systems: string;       // example systems inside the unit
}

/** Keyed by the two digits that follow the train number. */
export const UNIT_CATALOGUE: Record<string, UnitInfo> = {
  "00": { code: "00", en: "Common / utilities",   fr: "Communs / utilités",   section: "Utilities",     systems: "Instrument air, nitrogen, fuel gas" },
  "01": { code: "01", en: "Decarbonation (MEA)",  fr: "Décarbonatation (MEA)", section: "Treatment",    systems: "F-501/F-502 absorber-regenerator, E-501…E-504" },
  "02": { code: "02", en: "Dehydration",          fr: "Déshydratation",       section: "Dehydration",   systems: "G-07.87 scrubber, R-03.10/03.12 mole sieve" },
  "03": { code: "03", en: "Propane refrigeration", fr: "Réfrigération propane", section: "Propane",     systems: "C3 compressors, propane condensers" },
  "04": { code: "04", en: "Feed separation / scrubber", fr: "Séparation d'alimentation", section: "Propane", systems: "Inlet scrubber, separators" },
  "05": { code: "05", en: "MCR refrigeration",    fr: "Réfrigération MCR",    section: "Liquefaction",  systems: "Mixed-refrigerant compressors, MCHE" },
  "06": { code: "06", en: "Liquefaction",         fr: "Liquéfaction",         section: "Liquefaction",  systems: "MCHE, LNG rundown" },
  "07": { code: "07", en: "Demethaniser",         fr: "Déméthaniseur",        section: "Fractionation", systems: "C-07 column, overhead system" },
  "08": { code: "08", en: "Deethaniser",          fr: "Dééthaniseur",         section: "Fractionation", systems: "C-08 column" },
  "09": { code: "09", en: "Depropaniser",         fr: "Dépropaniseur",        section: "Fractionation", systems: "C-09 column" },
  "10": { code: "10", en: "Debutaniser",          fr: "Débutaniseur",         section: "Fractionation", systems: "C-10 column" },
  "11": { code: "11", en: "Utilities & flare",    fr: "Utilités & torche",    section: "Utilities",     systems: "Flare, seawater, derime" },
  // 940 → train 9, unit 40: the fuel-gas skid read on the "Fuel gas" screen.
  "40": { code: "40", en: "Fuel gas",             fr: "Gaz combustible",      section: "Utilities",     systems: "Fuel gas header, knock-out drum" },
};

export interface UnitResolution {
  unitCode: string | null;
  train: string | null;
  unit: UnitInfo | null;
}

/** Split a 3-digit unit code into train + unit, e.g. 101 → train 1, unit 01. */
export function resolveUnit(unitCode: string | null): UnitResolution {
  if (!unitCode || unitCode.length !== 3) {
    return { unitCode: unitCode ?? null, train: null, unit: null };
  }
  const train = /^[1-6]$/.test(unitCode[0]) ? unitCode[0] : null;
  const unit = UNIT_CATALOGUE[unitCode.slice(1)] ?? null;
  return { unitCode, train, unit };
}

/* ─── Parsing ────────────────────────────────────────────────────────────── */
const MODIFIER_TAIL = /(HH|LL|HL|LH|H|L)+$/;

function classifyDevice(mnemonic: string): DeviceClass {
  if (mnemonic.length === 0) return "unknown";
  if (mnemonic.includes("V") && mnemonic.indexOf("V") > 0) return "valve";
  if (mnemonic.endsWith("V")) return "valve";
  if (mnemonic.startsWith("H")) return "hand";
  // Alarm/switch tails carry modifiers (AH, ALL, HH, LL…) — read the stem.
  const stem = mnemonic.replace(MODIFIER_TAIL, "");
  if (stem.endsWith("A")) return "alarm";
  if (stem.endsWith("C")) return "controller";
  if (stem.endsWith("Q")) return "totalizer";
  if (stem.endsWith("S")) return "switch";
  if (stem.endsWith("T")) return "transmitter";
  if (stem.endsWith("Z")) return "position";
  if (stem.endsWith("I")) return "indicator";
  if (stem.endsWith("Y")) return "relay";
  if (stem.endsWith("E")) return "element";
  return "unknown";
}

/**
 * Parse a DCS instrument tag into its engineering meaning.
 * Accepts the hyphenated form used on some screens ("XV-101-223") and the
 * compact form the AI vision scan returns ("LIC101204").
 */
export function parseInstrumentTag(raw: string): InstrumentTag {
  const trimmed = (raw ?? "").trim().toUpperCase();
  const key = trimmed.replace(/[\s\-_.]+/g, "");

  const letters = /^([A-Z]+)/.exec(key)?.[1] ?? "";
  // Split the numeric tail on hyphens first — "XV-101-223" → unit 101, loop 223.
  const tailMatch = /(\d[\d-]*)/.exec(trimmed.slice(letters.length)) ?? /(\d+)/.exec(key.slice(letters.length));
  const tail = tailMatch?.[1] ?? "";
  const digits = tail.replace(/-/g, "");
  const suffix = /([A-Z])$/.exec(key)?.[1] ?? null;

  let unitCode: string | null = null;
  let loop: string | null = null;

  if (tail.includes("-")) {
    // Explicit "101-223" grouping: first block is the unit, the rest the loop.
    const [first, ...rest] = tail.split("-").filter(Boolean);
    unitCode = first?.padStart(3, "0").slice(0, 3) ?? null;
    loop = rest.join("-") || null;
  } else if (digits.length >= 3) {
    unitCode = digits.slice(0, 3);
    loop = digits.length > 3 ? digits.slice(3) : null;
  } else if (digits.length > 0) {
    loop = digits;
  }

  const { train } = resolveUnit(unitCode);

  // Decode the letters: compound variables first, then variable + functions.
  let variable: string | null = null;
  let variableDef: VariableDef | null = null;
  let functionStart = 1;

  // "PD" alone is differential pressure as well, as long as every remaining
  // letter is a known function — otherwise it stays Pressure + unknown D.
  const rest = letters.slice(2).split("");
  const compound = COMPOUND_VARIABLES[letters.slice(0, 2)];
  if (compound && rest.every(letter => FUNCTIONS[letter])) {
    variable = letters.slice(0, 2);
    variableDef = compound;
    functionStart = 2;
  } else if (VARIABLES[letters[0]]) {
    variable = letters[0];
    variableDef = VARIABLES[letters[0]];
    functionStart = 1;
  } else {
    functionStart = 0; // no standard variable — decode the rest as functions
  }

  const functionLetters = letters.slice(functionStart).split("");
  const decodedFunctions = functionLetters.filter(l => FUNCTIONS[l]);
  const partial = variable === null || decodedFunctions.length !== functionLetters.length;

  const classEn: Record<DeviceClass, string> = {
    valve: "valve", controller: "controller", indicator: "indicator",
    transmitter: "transmitter", switch: "switch", alarm: "alarm", hand: "hand",
    analyser: "analyser", speed: "device", position: "position", totalizer: "totalizer",
    relay: "relay", element: "element", unknown: "instrument",
  };
  const classFr: Record<DeviceClass, string> = {
    valve: "vanne", controller: "contrôleur", indicator: "indicateur",
    transmitter: "transmetteur", switch: "contact", alarm: "alarme", hand: "manuel",
    analyser: "analyseur", speed: "appareil", position: "position", totalizer: "totalisateur",
    relay: "relais", element: "élément", unknown: "instrument",
  };

  const deviceClass = classifyDevice(letters);

  // Build the name: the last device-forming letter becomes the noun, the earlier
  // ones qualify it. Without this, LIC renders as "control controller" and AAH
  // as "alarm high alarm".
  let nounEn = classEn[deviceClass];
  let nounFr = classFr[deviceClass];
  let nounIndex = -1;

  // Trailing H/L modifiers never name the device: TSL is a *low switch*,
  // PDALL a *low-low alarm*. Look for the noun on the stem.
  let modifierTail = 0;
  while (modifierTail < decodedFunctions.length) {
    const letter = decodedFunctions[decodedFunctions.length - 1 - modifierTail];
    if (letter !== "H" && letter !== "L") break;
    modifierTail += 1;
  }
  const stemEnd = decodedFunctions.length - modifierTail;
  if (stemEnd > 0 && NOUN_LETTERS[decodedFunctions[stemEnd - 1]]) {
    nounIndex = stemEnd - 1;
    nounEn = NOUN_LETTERS[decodedFunctions[nounIndex]].en;
    nounFr = NOUN_LETTERS[decodedFunctions[nounIndex]].fr;
  }

  const qualifiers = decodedFunctions.filter((_, index) => index !== nounIndex);

  // Drop a qualifier already implied by the noun ("alarm high" + "alarm").
  const purposeEn = qualifiers.map(l => FUNCTIONS[l].en).filter(word => word !== nounEn).join(" ");
  const purposeFr = qualifiers.map(l => FUNCTIONS[l].fr).filter(word => word !== nounFr).join(" ");

  const head = variableDef ? variableDef.en : letters;
  const headFr = variableDef ? variableDef.fr : letters;
  const descriptionEn = `${head} ${purposeEn} ${nounEn}`.replace(/\s+/g, " ").trim();
  const descriptionFr = `${headFr} ${purposeFr} ${nounFr}`.replace(/\s+/g, " ").trim();

  return {
    raw: trimmed,
    key,
    mnemonic: letters,
    variable,
    variableEn: variableDef?.en ?? null,
    variableFr: variableDef?.fr ?? null,
    functions: functionLetters,
    unitCode,
    train,
    loop,
    suffix,
    deviceClass,
    descriptionEn,
    descriptionFr,
    partial,
    unverified: UNVERIFIED_MNEMONICS.has(letters),
  };
}

/** Short human sentence: "Level indicating controller, loop 204 of unit 101." */
export function describeInstrument(tag: InstrumentTag, lang: "en" | "fr"): string {
  const { unit } = resolveUnit(tag.unitCode);
  const loopPart = tag.loop ? (lang === "fr" ? ` boucle ${tag.loop}` : ` loop ${tag.loop}`) : "";
  const unitPart = tag.unitCode
    ? (lang === "fr" ? ` — unité ${tag.unitCode}${unit ? ` (${unit.fr})` : ""}` : ` — unit ${tag.unitCode}${unit ? ` (${unit.en})` : ""}`)
    : "";
  const base = lang === "fr" ? tag.descriptionFr : tag.descriptionEn;
  return `${base}${loopPart}${unitPart}`;
}

/** Engineering unit typically shown for this measurement (bar, °C, %…). */
export function instrumentUnit(tag: InstrumentTag): string | null {
  if (COMPOUND_VARIABLES[tag.mnemonic.slice(0, 2)] && tag.variable?.length === 2) {
    return COMPOUND_VARIABLES[tag.mnemonic.slice(0, 2)].unit;
  }
  return tag.variable ? VARIABLES[tag.variable]?.unit ?? null : null;
}
