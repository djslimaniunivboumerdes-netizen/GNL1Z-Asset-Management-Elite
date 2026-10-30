// src/lib/instrumentLocation.ts
//
// "Where is this instrument, what is it connected to, and what do we know about
// it?" — answered from the drawings that were read ONCE and stored
// (src/data/pid_index.json). Nothing here runs OCR, and nothing here guesses.
//
// WHAT THE DRAWINGS CAN ACTUALLY TELL US, and what they cannot:
//
//   Yes  · which unit the instrument belongs to (its tag says 101 → unit 01),
//          therefore which drawings cover that unit;
//        · which equipment those drawings show (the tags read on the sheet);
//        · which piping those drawings carry (nominal sizes and line numbers,
//          exactly as read);
//        · whether the drawing has a local vector copy that opens offline.
//
//   No   · the exact position of the instrument bubble. Bubbles are graphics:
//          OCR reads the characters around them, not their place on the sheet.
//          Measured: of 466 tags carrying a 5+ digit number, 434 appear nowhere
//          in the drawing text, and the 32 that "match" are coincidental
//          substrings inside line numbers and service text. So no claim is made
//          that a tag was read on a drawing.
//        · which line the instrument is tapped into. Loop numbers are 1–3
//          digits, and a 3-digit search matches two thirds of the sheets — pure
//          noise. The lines are listed for the engineer to compare, not
//          asserted as this instrument's connection.
//        · calibrated range, span, model, datasheet. Not in this system.
//
// Every fact therefore carries a `source` and a `verified` flag, and the things
// we cannot tell are listed explicitly rather than left blank.

import { PID_INDEX, pidSheetsForTag, pidSheetsForUnit, type PidSheetIndex } from "./pidIndex";
import { UNIT_CATALOGUE, instrumentUnit } from "./instrumentTags";
import { getEquipmentByTag } from "../data/index";
import { buildInstrumentIndex, type InstrumentEntry } from "./instrumentIndex";
import localSheetFiles from "../data/pid_sheet_files.json";

/** Why we believe an instrument is on a given drawing. */
export type PlacementBasis = "equipment" | "unit" | "none";

export interface InstrumentLine {
  /** Exactly as read on the drawing — kept so the engineer can check it. */
  asRead: string;
  size: string | null;
  number: string | null;
  /** Which drawing it was read from. */
  file: string;
}

export interface InstrumentPlacement {
  file: string;
  drawing: string | null;
  title: string;
  titleEn: string | null;
  titleFr: string | null;
  /** Plant unit of the drawing, e.g. "06". */
  unit: string | null;
  /** Deep link into the P&ID viewer. */
  url: string;
  /** Set when a vector PDF ships with the app (26 of the 44 sheets today). */
  localPdf: string | null;
  /** Equipment tags read on this drawing. */
  equipmentOnSheet: string[];
  /** Nominal pipe sizes read on this drawing. */
  sizes: string[];
  lines: InstrumentLine[];
  /** Sheets are OCR readings: none has been signed off by an engineer yet. */
  verified: boolean;
}

export interface InstrumentSpec {
  labelEn: string;
  labelFr: string;
  value: string;
  /** Where the value comes from — shown next to it in the UI. */
  source: "isa" | "dcs" | "register" | "drawing";
  verified: boolean;
}

export interface InstrumentContext {
  tag: string;
  unitCode: string | null;
  unitEn: string | null;
  unitFr: string | null;
  placements: InstrumentPlacement[];
  /** Distinct piping across every placement, capped — for the "connected to" panel. */
  lines: InstrumentLine[];
  /** Distinct nominal sizes across every placement. */
  sizes: string[];
  /** Equipment shown on those drawings, with whether the register knows it. */
  equipmentOnDrawings: Array<{ tag: string; inRegister: boolean }>;
  specs: InstrumentSpec[];
  /** What the system cannot tell you — listed, not hidden. */
  missing: string[];
  basis: PlacementBasis;
  verified: boolean;
  summaryEn: string;
  summaryFr: string;
}

/** Only 26 of the 44 sheets ship as vector PDFs; the rest open from Drive. */
const LOCAL_PDFS = new Set(Object.values(localSheetFiles as Record<string, string>));

function toPlacement(sheet: PidSheetIndex): InstrumentPlacement {
  return {
    file: sheet.file,
    drawing: sheet.drawing ?? null,
    title: sheet.titleEn ?? sheet.title ?? sheet.file.replace(/^\/pids\//, "").replace(/\.pdf$/i, ""),
    titleEn: sheet.titleEn ?? null,
    titleFr: sheet.titleFr ?? null,
    unit: (/X0?(\d{1,2})/i.exec(sheet.drawing ?? "")?.[1] ?? null)?.padStart(2, "0") ?? null,
    url: `/pids?file=${encodeURIComponent(sheet.file)}`,
    localPdf: LOCAL_PDFS.has(sheet.file) ? sheet.file : null,
    equipmentOnSheet: [...(sheet.equipment ?? [])],
    sizes: [...(sheet.sizes ?? [])],
    lines: (sheet.lineCalls ?? []).slice(0, 12).map((call) => ({
      asRead: call.asRead,
      size: call.size ?? null,
      number: call.number ?? null,
      file: sheet.file,
    })),
    verified: Boolean(sheet.verified),
  };
}

/** The unit a tag's numbering places it in: 101 → "01", 105 → "05". */
export function unitOfInstrument(entry: InstrumentEntry): string | null {
  const code = entry.parsed.unitCode;
  return code && code.length === 3 ? code.slice(1) : null;
}

/**
 * Drawings where an instrument may be found, best candidate first.
 *
 * Two ways in, because a drawing can be identified either way:
 *  · its drawing number carries the unit (85-X06-10.1 → unit 06);
 *  · it shows equipment known to be in the instrument's unit — this is what
 *    catches the 13 sheets whose title block has no readable number.
 */
export function instrumentPlacements(entry: InstrumentEntry): InstrumentPlacement[] {
  const unit = unitOfInstrument(entry);
  const related = new Set(
    entry.equipment
      .map((item) => (item.dbTag ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const scored = new Map<string, { sheet: PidSheetIndex; score: number }>();
  const put = (sheet: PidSheetIndex, score: number) => {
    const existing = scored.get(sheet.file);
    scored.set(sheet.file, { sheet, score: (existing?.score ?? 0) + score });
  };

  for (const sheet of pidSheetsForUnit(unit)) put(sheet, 1);

  for (const dbTag of related) {
    const tagUnit = /^X(\d{2})-/i.exec(dbTag)?.[1] ?? null;
    for (const sheet of pidSheetsForTag(dbTag)) {
      // Keep only sheets that belong to the same unit: an instrument in unit 01
      // must not be pointed at a unit 06 drawing.
      if (unit && tagUnit && tagUnit !== unit) continue;
      put(sheet, 2);
    }
  }

  return [...scored.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aHasDrawing = Boolean(a.sheet.drawing);
      if (aHasDrawing !== Boolean(b.sheet.drawing)) return aHasDrawing ? -1 : 1;
      return (a.sheet.drawing ?? a.sheet.title).localeCompare(b.sheet.drawing ?? b.sheet.title, undefined, { numeric: true });
    })
    .map(({ sheet }) => toPlacement(sheet));
}

const contextCache = new Map<string, InstrumentContext>();

/** Everything the drawings can honestly say about one instrument. */
export function instrumentContext(entry: InstrumentEntry, lang: "en" | "fr" = "en"): InstrumentContext {
  const cacheKey = `${entry.tag}:${lang}`;
  const hit = contextCache.get(cacheKey);
  if (hit) return hit;

  const unit = unitOfInstrument(entry);
  const info = unit ? UNIT_CATALOGUE[unit] : null;
  const placements = instrumentPlacements(entry);

  const lines: InstrumentLine[] = [];
  const seenLines = new Set<string>();
  const sizes = new Set<string>();
  const equipmentOnDrawings = new Map<string, boolean>();

  for (const placement of placements) {
    for (const line of placement.lines) {
      const key = `${line.size ?? ""}|${line.number ?? ""}`;
      if (seenLines.has(key)) continue;
      seenLines.add(key);
      lines.push(line);
    }
    for (const size of placement.sizes) sizes.add(size);
    for (const tag of placement.equipmentOnSheet) {
      const clean = tag.trim();
      if (!clean) continue;
      equipmentOnDrawings.set(clean, equipmentOnDrawings.get(clean) || Boolean(getEquipmentByTag(clean)));
    }
  }

  /* ── Specifications: every row says where it came from ─────────────────── */
  const specs: InstrumentSpec[] = [];
  const add = (
    labelEn: string,
    labelFr: string,
    value: string | null | undefined,
    source: InstrumentSpec["source"],
    verified = false,
  ) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return;
    specs.push({ labelEn, labelFr, value: trimmed, source, verified });
  };

  const { parsed } = entry;
  add("Measured variable", "Grandeur mesurée", parsed.variableEn ?? null, "isa");
  add("Device", "Appareil", parsed.deviceClass, "isa");
  add("Function letters", "Lettres de fonction", parsed.functions.length ? parsed.functions.join(" · ") : null, "isa");
  add("Engineering unit", "Unité de mesure", instrumentUnit(parsed) ?? null, "isa");
  add("Loop", "Boucle", parsed.loop ?? null, "isa");
  add("Unit code", "Code unité", parsed.unitCode ?? null, "isa");
  add("Unit", "Unité", info ? (lang === "fr" ? info.fr : info.en) : null, "register", true);
  add("Unit systems", "Systèmes de l'unité", info?.systems ?? null, "register", true);
  if (parsed.suffix) add("Suffix", "Suffixe", parsed.suffix, "isa");

  add(
    "DCS screens",
    "Écrans DCS",
    entry.panels.length ? entry.panels.map((panel) => (lang === "fr" ? panel.titleFr : panel.titleEn)).join(", ") : null,
    "dcs",
  );

  if (placements.length) {
    add(
      "Drawings of this unit",
      "Plans de cette unité",
      placements.map((placement) => placement.drawing ?? placement.title).slice(0, 6).join(", "),
      "drawing",
    );
  }
  if (sizes.size) {
    add("Nominal pipe sizes on these drawings", "Diamètres nominaux sur ces plans", [...sizes].slice(0, 12).join(" · "), "drawing");
  }

  // Equipment register facts, for equipment the instrument's unit holds.
  const registerTag = entry.equipment.find((item) => item.dbTag && getEquipmentByTag(item.dbTag))?.dbTag ?? null;
  const record = registerTag ? getEquipmentByTag(registerTag) : undefined;
  if (record) {
    add("Related equipment", "Équipement lié", record.tag, "register", true);
    add("Section", "Section", record.section ?? null, "register", true);
    const pressure = record.technical?.pressure_bar;
    if (pressure) add("Equipment pressure", "Pression de l'équipement", `${pressure} bar`, "register", true);
    const test = record.technical?.test_pressure;
    if (test && (test.shell_design_bar || test.tube_design_bar)) {
      add(
        "Design pressure (shell / tube)",
        "Pression de calcul (calandre / faisceau)",
        `${test.shell_design_bar ?? "—"} / ${test.tube_design_bar ?? "—"} bar`,
        "register",
        true,
      );
    }
    if (test && (test.shell_test_bar || test.tube_test_bar)) {
      add(
        "Test pressure (shell / tube)",
        "Pression d'épreuve (calandre / faisceau)",
        `${test.shell_test_bar ?? "—"} / ${test.tube_test_bar ?? "—"} bar`,
        "register",
        true,
      );
    }
    if (record.maintenance?.next_test_due) {
      add("Next test due", "Prochain essai", record.maintenance.next_test_due, "register", true);
    }
  }

  /* ── What the system cannot say — stated, not omitted ──────────────────── */
  const en = lang === "en";
  const missing: string[] = [];
  if (placements.length === 0) {
    missing.push(
      en
        ? "No drawing could be tied to this tag: its unit code is missing, or no drawing covers that unit."
        : "Aucun plan n'a pu être relié à ce tag : le code unité est absent, ou aucun plan ne couvre cette unité.",
    );
  } else {
    missing.push(
      en
        ? "Exact position on the drawing: instrument bubbles are graphics, so the extraction cannot place them. Open the drawing and look for the loop number."
        : "Position exacte sur le plan : les bulles d'instruments sont des graphiques, l'extraction ne peut pas les situer. Ouvrez le plan et cherchez le numéro de boucle.",
    );
  }
  missing.push(
    en
      ? "Tapped line: the loop number is 1–3 digits, which matches too much of a drawing to assert a connection. The lines above are what the drawing carries."
      : "Ligne de piquage : le numéro de boucle comporte 1 à 3 chiffres, ce qui correspond à trop d'endroits sur un plan pour affirmer un raccordement. Les lignes ci-dessus sont celles que porte le plan.",
  );
  missing.push(
    en
      ? "Calibrated range, span, model and datasheet are not in this system — check the instrument loop folder."
      : "Étendue calibrée, span, modèle et fiche technique ne sont pas dans ce système — consultez le classeur de boucle.",
  );

  const drawings = placements.map((placement) => placement.drawing).filter((value): value is string => Boolean(value));
  const basis: PlacementBasis = placements.length === 0 ? "none" : "unit";
  const summaryEn =
    placements.length === 0
      ? `${entry.tag}: no drawing could be tied to this tag. Its unit code is ${parsed.unitCode ?? "unreadable"}.`
      : `${entry.tag} sits in unit ${unit ?? parsed.unitCode ?? "?"}${info ? ` (${info.en})` : ""}. ` +
        `${placements.length} drawing${placements.length === 1 ? "" : "s"} cover${placements.length === 1 ? "s" : ""} that unit` +
        `${drawings.length ? ` (${drawings.slice(0, 4).join(", ")})` : ""}. ` +
        `No drawing carries this tag as text, so the exact bubble is not located — open the drawing and check.`;
  const summaryFr =
    placements.length === 0
      ? `${entry.tag} : aucun plan n'a pu être relié à ce tag. Son code unité est ${parsed.unitCode ?? "illisible"}.`
      : `${entry.tag} appartient à l'unité ${unit ?? parsed.unitCode ?? "?"}${info ? ` (${info.fr})` : ""}. ` +
        `${placements.length} plan${placements.length === 1 ? "" : "s"} couvre${placements.length === 1 ? "" : "nt"} cette unité` +
        `${drawings.length ? ` (${drawings.slice(0, 4).join(", ")})` : ""}. ` +
        `Aucun plan ne porte ce tag en texte : la bulle exacte n'est donc pas située — ouvrez le plan et vérifiez.`;

  const context: InstrumentContext = {
    tag: entry.tag,
    unitCode: parsed.unitCode ?? null,
    unitEn: info ? `${unit} · ${info.en}` : null,
    unitFr: info ? `${unit} · ${info.fr}` : null,
    placements,
    lines: lines.slice(0, 12),
    sizes: [...sizes],
    equipmentOnDrawings: [...equipmentOnDrawings.entries()]
      .map(([tag, inRegister]) => ({ tag, inRegister }))
      .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true })),
    specs,
    missing,
    basis,
    verified: placements.length > 0 && placements.every((placement) => placement.verified),
    summaryEn,
    summaryFr,
  };

  contextCache.set(cacheKey, context);
  return context;
}

/** How many instruments belong to a drawing's unit — for the P&ID viewer. */
export function instrumentCountForUnit(unit: string | null): number {
  if (!unit) return 0;
  return buildInstrumentIndex().filter((entry) => unitOfInstrument(entry) === unit).length;
}

/** The unit a drawing belongs to, e.g. /pids/G507.pdf → "01". */
export function unitOfSheet(file: string): string | null {
  const sheet = PID_INDEX.sheets.find((candidate) => candidate.file === file);
  const match = sheet ? /X0?(\d{1,2})/i.exec(sheet.drawing ?? "") : null;
  return match ? match[1].padStart(2, "0") : null;
}

/** Instruments of one unit, for the "who lives on this drawing" link. */
export function instrumentsOfUnit(unit: string | null): InstrumentEntry[] {
  if (!unit) return [];
  return buildInstrumentIndex().filter((entry) => unitOfInstrument(entry) === unit);
}
