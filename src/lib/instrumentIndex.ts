// src/lib/instrumentIndex.ts
//
// Answers the question operators actually ask when they look at a DCS screen:
// "LIC101204 — what is it, which screen is it on, and which equipment is it on?"
//
// The AI vision scan (src/data/dcs_detected_tags.json) gives us, per panel, the
// raw instrument tags read off the screenshot. This module joins that with
//  · the ISA decode          (src/lib/instrumentTags)
//  · the GNL1Z unit catalogue (which process unit / train the tag belongs to)
//  · the process-flow tags   (which equipment lives in that unit)
// and exposes one ranked, searchable index over all of it.

import { DCS_DETECTED_TAGS } from "@/data/dcs_tags";
import { DCS_PANELS } from "@/data/dcs_panels";
import { TAGS } from "@/data/smartFlow";
import { parseInstrumentTag, resolveUnit, type InstrumentTag, type UnitInfo } from "@/lib/instrumentTags";

export interface InstrumentPanelRef {
  id: string;
  titleEn: string;
  titleFr: string;
}

export interface InstrumentEquipmentRef {
  /** Diagram id, e.g. "F502" — also the ?tag= value on /flow. */
  id: string;
  diag: string;
  nameEn: string;
  nameFr: string;
  /** Equipment register tag, e.g. "X01-F-502", when the asset exists there. */
  dbTag: string | null;
  section: string;
}

export interface InstrumentEntry {
  /** Normalised tag, e.g. "LIC101204". */
  tag: string;
  parsed: InstrumentTag;
  unit: UnitInfo | null;
  panels: InstrumentPanelRef[];
  equipment: InstrumentEquipmentRef[];
  /** Free text used by the search (tag + meaning + panels + equipment). */
  haystack: string;
}

let cached: InstrumentEntry[] | null = null;

/** Equipment indexed by the 3-digit unit prefix of its diagram tag ("101-F502"). */
const EQUIPMENT_BY_UNIT = (() => {
  const map = new Map<string, InstrumentEquipmentRef[]>();
  for (const tag of TAGS) {
    const prefix = /^(\d{3})/.exec(tag.diag)?.[1];
    if (!prefix) continue;
    const list = map.get(prefix) ?? [];
    list.push({
      id: tag.id,
      diag: tag.diag,
      nameEn: tag.nameEn,
      nameFr: tag.nameFr,
      dbTag: tag.dbTag,
      section: tag.section,
    });
    map.set(prefix, list);
  }
  return map;
})();

const PANEL_BY_ID = new Map(DCS_PANELS.map(panel => [panel.id, panel]));

export function buildInstrumentIndex(): InstrumentEntry[] {
  if (cached) return cached;

  const seen = new Map<string, InstrumentEntry>();

  for (const [panelId, tags] of Object.entries(DCS_DETECTED_TAGS)) {
    const panel = PANEL_BY_ID.get(panelId);
    const panelRef: InstrumentPanelRef | null = panel
      ? { id: panel.id, titleEn: panel.title_en, titleFr: panel.title_fr }
      : null;

    for (const rawTag of tags) {
      const parsed = parseInstrumentTag(rawTag);
      if (!parsed.mnemonic) continue; // not an instrument tag (e.g. "101-F502")
      const key = parsed.key;

      const existing = seen.get(key);
      if (existing) {
        if (panelRef && !existing.panels.some(p => p.id === panelRef.id)) existing.panels.push(panelRef);
        continue;
      }

      const { unit } = resolveUnit(parsed.unitCode);
      const equipment = parsed.unitCode ? EQUIPMENT_BY_UNIT.get(parsed.unitCode) ?? [] : [];

      const entry: InstrumentEntry = {
        tag: key,
        parsed,
        unit,
        panels: panelRef ? [panelRef] : [],
        equipment: [...equipment],
        haystack: "",
      };
      entry.haystack = [
        key,
        parsed.mnemonic,
        parsed.descriptionEn,
        parsed.descriptionFr,
        parsed.unitCode ?? "",
        unit?.en ?? "",
        unit?.fr ?? "",
        ...entry.panels.flatMap(p => [p.titleEn, p.titleFr]),
        ...equipment.flatMap(e => [e.diag, e.nameEn, e.nameFr, e.dbTag ?? ""]),
      ].join(" ").toLowerCase();

      seen.set(key, entry);
    }
  }

  cached = [...seen.values()].sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  return cached;
}

export interface InstrumentQuery {
  /** Free text: full tag, partial tag, mnemonic, meaning, equipment or panel. */
  q?: string;
  /** Filter by measured variable letter (L, P, T, F…). */
  variable?: string | null;
  /** Filter by device class (valve, controller, transmitter…). */
  deviceClass?: string | null;
  /** Filter by 3-digit unit code (101, 102…). */
  unitCode?: string | null;
  limit?: number;
}

const score = (entry: InstrumentEntry, needle: string): number => {
  if (!needle) return 1;
  const tag = entry.tag.toLowerCase();
  if (tag === needle) return 100;
  if (tag.startsWith(needle)) return 80;
  if (entry.parsed.mnemonic.toLowerCase() === needle) return 70;
  if (entry.parsed.mnemonic.toLowerCase().startsWith(needle)) return 60;
  if (entry.parsed.loop && entry.parsed.loop.includes(needle)) return 50;
  if (entry.parsed.unitCode === needle) return 45;
  if (tag.includes(needle)) return 40;
  if (entry.parsed.descriptionEn.toLowerCase().includes(needle)) return 30;
  if (entry.parsed.descriptionFr.toLowerCase().includes(needle)) return 30;
  if (entry.haystack.includes(needle)) return 10;
  return 0;
};

/** Ranked search over the whole instrument population. */
export function searchInstruments(query: InstrumentQuery = {}): InstrumentEntry[] {
  const needle = (query.q ?? "").trim().toLowerCase();
  const limit = query.limit ?? 60;

  return buildInstrumentIndex()
    .filter(entry => {
      if (query.variable && entry.parsed.variable !== query.variable) return false;
      if (query.deviceClass && entry.parsed.deviceClass !== query.deviceClass) return false;
      if (query.unitCode && entry.parsed.unitCode !== query.unitCode) return false;
      return true;
    })
    .map(entry => ({ entry, rank: score(entry, needle) }))
    .filter(row => row.rank > 0)
    .sort((a, b) =>
      b.rank - a.rank ||
      a.entry.parsed.mnemonic.localeCompare(b.entry.parsed.mnemonic) ||
      a.entry.tag.localeCompare(b.entry.tag, undefined, { numeric: true }))
    .slice(0, limit)
    .map(row => row.entry);
}

export interface InstrumentFacets {
  total: number;
  byVariable: Array<{ key: string; en: string; fr: string; count: number }>;
  byDeviceClass: Array<{ key: string; count: number }>;
  byUnit: Array<{ code: string; en: string; fr: string; count: number }>;
  withoutEquipment: number;
}

export function instrumentFacets(): InstrumentFacets {
  const index = buildInstrumentIndex();
  const variables = new Map<string, { en: string; fr: string; count: number }>();
  const classes = new Map<string, number>();
  const units = new Map<string, { en: string; fr: string; count: number }>();
  let withoutEquipment = 0;

  for (const entry of index) {
    const variable = entry.parsed.variable;
    if (variable && entry.parsed.variableEn) {
      const current = variables.get(variable);
      variables.set(variable, {
        en: entry.parsed.variableEn,
        fr: entry.parsed.variableFr ?? entry.parsed.variableEn,
        count: (current?.count ?? 0) + 1,
      });
    }
    classes.set(entry.parsed.deviceClass, (classes.get(entry.parsed.deviceClass) ?? 0) + 1);
    if (entry.parsed.unitCode) {
      const current = units.get(entry.parsed.unitCode);
      units.set(entry.parsed.unitCode, {
        en: entry.unit?.en ?? `Unit ${entry.parsed.unitCode}`,
        fr: entry.unit?.fr ?? `Unité ${entry.parsed.unitCode}`,
        count: (current?.count ?? 0) + 1,
      });
    }
    if (entry.equipment.length === 0) withoutEquipment += 1;
  }

  return {
    total: index.length,
    byVariable: [...variables.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.count - a.count),
    byDeviceClass: [...classes.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    byUnit: [...units.entries()]
      .map(([code, value]) => ({ code, ...value }))
      .sort((a, b) => b.count - a.count),
    withoutEquipment,
  };
}

/** Single lookup used by the DCS detail page and future assistant answers. */
export function findInstrument(tag: string): InstrumentEntry | undefined {
  const key = tag.trim().toUpperCase().replace(/[\s\-_.]+/g, "");
  return buildInstrumentIndex().find(entry => entry.tag === key);
}
