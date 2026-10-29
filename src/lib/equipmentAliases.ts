// Pure, dependency-free equipment alias resolution shared by the browser and
// the Pages Function. It never guesses a numeric equivalence: leading zeros and
// dotted identifiers are preserved unless an explicit source alias says otherwise.

export interface AliasRecord {
  tag: string;
  aliases?: string[];
  name?: string;
  unit?: string;
  kind?: "register" | "drawing";
}

export interface AliasMatch<T extends AliasRecord = AliasRecord> {
  record: T;
  alias: string;
  key: string;
  span: [number, number];
  specificity: number;
}

export type AliasResolution<T extends AliasRecord = AliasRecord> =
  | { status: "resolved"; matches: AliasMatch<T>[]; input: string }
  | { status: "ambiguous"; candidates: AliasMatch<T>[]; input: string }
  | { status: "unknown"; candidates: AliasMatch<T>[]; input: string };

const strip = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
export function compactTag(value: string): string {
  return strip(value).replace(/[^A-Z0-9]/g, "");
}

/** Conservative keys for one known tag. Does not strip leading zeros. */
export function tagKeys(tag: string): string[] {
  const raw = strip(tag).trim();
  const keys = new Set<string>([compactTag(raw)]);
  // Unit-less suffix: X01-E-501 -> E501, X06-G-07.80 -> G0780.
  const suffix = raw.match(/([A-Z]{1,3})[-\s._]*(\d{2,4}(?:\.\d{1,3})?)([A-Z]?)$/);
  if (suffix) {
    const base = `${suffix[1]}${suffix[2].replace(/\./g, "")}${suffix[3]}`;
    keys.add(compactTag(base));
    // Legacy drawing tags often omit a leading zero: G0780 -> G780.
    const legacy = `${suffix[1]}${suffix[2].replace(/\./g, "").replace(/^0+/, "")}${suffix[3]}`;
    keys.add(compactTag(legacy));
  }
  keys.delete("");
  return [...keys];
}

export function buildAliasIndex<T extends AliasRecord>(records: T[]): Map<string, AliasMatch<T>[]> {
  const index = new Map<string, AliasMatch<T>[]>();
  for (const record of records) {
    const aliases = [record.tag, ...(record.aliases ?? [])];
    for (const alias of aliases) {
      for (const key of tagKeys(alias)) {
        const list = index.get(key) ?? [];
        if (!list.some((item) => item.record.tag === record.tag && item.alias === alias)) {
          list.push({ record, alias, key, span: [0, 0], specificity: key.length });
        }
        index.set(key, list);
      }
    }
  }
  return index;
}

const TOKEN = /[A-Z0-9]+(?:[._\-/][A-Z0-9]+)*/g;

/** Find explicit tag mentions in a free-text question. Longest match wins. */
export function findTagMentions<T extends AliasRecord>(prompt: string, index: Map<string, AliasMatch<T>[]>): AliasMatch<T>[] {
  const text = strip(prompt);
  const tokens = [...text.matchAll(TOKEN)].map((match) => ({ value: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }));
  const found: AliasMatch<T>[] = [];
  const used = new Set<string>();
  for (let size = Math.min(4, tokens.length); size >= 1; size--) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const window = tokens.slice(i, i + size);
      const key = compactTag(window.map((token) => token.value).join(""));
      const candidates = index.get(key);
      if (!candidates?.length) continue;
      const span: [number, number] = [window[0].start, window[window.length - 1].end];
      if (found.some((item) => item.span[0] === span[0] && item.span[1] === span[1])) continue;
      for (const candidate of candidates) {
        const id = `${candidate.record.tag}@${span[0]}:${span[1]}`;
        if (used.has(id)) continue;
        used.add(id);
        found.push({ ...candidate, key, span, specificity: key.length });
      }
    }
  }
  // Prefer the most specific mention at overlapping positions.
  return found.sort((a, b) => b.specificity - a.specificity).filter((item, index, all) =>
    !all.slice(0, index).some((other) => other.span[0] <= item.span[0] && other.span[1] >= item.span[1] && other.record.tag === item.record.tag),
  );
}

export function resolveEquipmentTag<T extends AliasRecord>(input: string, records: T[], currentTag?: string | null): AliasResolution<T> {
  const index = buildAliasIndex(records);
  const mentions = findTagMentions(input, index);
  if (mentions.length) {
    const byTag = new Map<string, AliasMatch<T>>();
    for (const mention of mentions) if (!byTag.has(mention.record.tag) || mention.specificity > byTag.get(mention.record.tag)!.specificity) byTag.set(mention.record.tag, mention);
    const matches = [...byTag.values()];
    // A single compact key can map to several distinct records (e.g. E501 in two
    // trains). Multiple aliases for the same record are not ambiguous.
    const ambiguousMention = mentions.find((mention) => {
      const candidates = index.get(mention.key) ?? [];
      return new Set(candidates.map((candidate) => candidate.record.tag)).size > 1;
    });
    if (ambiguousMention) {
      const candidates = index.get(ambiguousMention.key) ?? [];
      const unique = [...new Map(candidates.map((candidate) => [candidate.record.tag, candidate])).values()];
      return { status: "ambiguous", candidates: unique, input };
    }
    return { status: "resolved", matches, input };
  }
  if (currentTag) {
    const current = records.find((record) => compactTag(record.tag) === compactTag(currentTag));
    if (current && /\b(it|its|this|that|equipment|asset|cet|cette|il|elle|l'équipement)\b/i.test(input)) {
      return { status: "resolved", matches: [{ record: current, alias: current.tag, key: compactTag(current.tag), span: [0, 0], specificity: 0 }], input };
    }
  }
  return { status: "unknown", candidates: [], input };
}

export function describeAliasMatch(match: AliasMatch): string {
  return match.alias === match.record.tag ? match.record.tag : `${match.alias} → ${match.record.tag}`;
}
