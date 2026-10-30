// Text matching helpers shared by the manual full-text search
// (functions/api/search-manual.ts) and the client highlighter.
//
// Industrial documents are written in French and English, so a query of
// "mesure" must find "mesuré", and "refrigeration" must find "réfrigération".
// Folding happens on a COPY of the text while keeping an index map back to the
// original string, so snippets are always sliced from the untouched source
// (accents intact) even though matching is accent-insensitive.

const MARK_RE = /[\u0300-\u036f]/g;

export interface FoldedText {
  /** Diacritics stripped, lower-cased. Aligned 1:1 with `map`. */
  folded: string;
  /** folded[i] originates from original character index map[i]. */
  map: number[];
}

/** Strip diacritics + case — for needles and short strings only. */
export function fold(value: string): string {
  return value.normalize("NFD").replace(MARK_RE, "").toLowerCase();
}

/** Fold a whole document while remembering where every folded char came from. */
export function foldText(text: string): FoldedText {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const decomposed = text[i].normalize("NFD").replace(MARK_RE, "").toLowerCase();
    for (const ch of decomposed) {
      folded += ch;
      map.push(i);
    }
  }
  return { folded, map };
}

export interface TextMatch {
  /** Offsets inside the ORIGINAL text (snippet slicing stays faithful). */
  start: number;
  end: number;
  /** The exact substring as written in the document (accents included). */
  surface: string;
  /** True when the hit is a whole word/token, not buried in a longer token. */
  boundary: boolean;
}

const isWordChar = (char: string) => (char >= "a" && char <= "z") || (char >= "0" && char <= "9");

/**
 * Every occurrence of `term` in the original text, accent-insensitive.
 *
 * `boundary` separates clean token hits ("501" in "E-501 501") from digits
 * swallowed inside a longer token ("501" inside "15012"). Callers prefer
 * boundary hits when they exist, and keep substring hits otherwise — recall is
 * never lost, precision improves when both are available.
 */
export function findMatches(original: string, foldedText: FoldedText, term: string, limit = 400): TextMatch[] {
  const needle = fold(term);
  if (!needle) return [];

  const { folded, map } = foldedText;
  const matches: TextMatch[] = [];
  let pos = 0;

  while (matches.length < limit) {
    const idx = folded.indexOf(needle, pos);
    if (idx === -1) break;

    const start = map[idx];
    const end = map[idx + needle.length - 1] + 1;
    const before = idx > 0 ? folded[idx - 1] : "";
    const after = idx + needle.length < folded.length ? folded[idx + needle.length] : "";
    const boundary = !isWordChar(before) && !isWordChar(after);

    matches.push({ start, end, surface: original.slice(start, end), boundary });
    pos = idx + Math.max(1, needle.length);
  }

  return matches;
}

/** Whole-token hits when they exist; otherwise every hit (recall first). */
export function preferBoundary(matches: TextMatch[]): TextMatch[] {
  const boundary = matches.filter(m => m.boundary);
  return boundary.length ? boundary : matches;
}

/** Context windows around matches, sliced from the original text. */
export function buildSnippets(original: string, matches: TextMatch[], context = 200, max = 5): string[] {
  const snips: string[] = [];
  const used = new Set<number>();

  for (const match of matches) {
    if (snips.length >= max) break;
    if (used.has(match.start)) continue;
    used.add(match.start);

    const s = Math.max(0, match.start - context);
    const e = Math.min(original.length, match.end + context);
    snips.push((s > 0 ? "…" : "") + original.slice(s, e) + (e < original.length ? "…" : ""));
  }

  return snips;
}

// ── Client highlighter ───────────────────────────────────────────────────────
// Accented variants per base letter, so "mesure" also marks "mesuré".
const ACCENTED: Record<string, string> = {
  a: "àáâãäåæÀÁÂÃÄÅÆ",
  c: "çÇ",
  e: "èéêëÈÉÊË",
  i: "ìíîïÌÍÎÏ",
  n: "ñÑ",
  o: "òóôõöøÒÓÔÕÖØ",
  u: "ùúûüÙÚÛÜ",
  y: "ýÿÝ",
};

/** Regex source for a term that tolerates accents on every letter. */
export function diacriticPatternSource(term: string): string {
  let out = "";
  for (const char of term) {
    const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const base = char.normalize("NFD").replace(MARK_RE, "").toLowerCase();
    const variants = ACCENTED[base];
    out += variants ? `[${escaped}${variants}]` : escaped;
  }
  return out;
}

export interface HighlightPart { text: string; match: boolean }

/**
 * Split text into alternating plain/matched segments.
 *
 * Deterministic: `split` with ONE capture group always yields matches at odd
 * indices (the previous implementation used `regex.test()` in a loop, which
 * advanced `lastIndex` and silently skipped every other occurrence).
 */
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const clean = [...new Set(terms.map(t => t.trim()).filter(Boolean))];
  if (!clean.length) return [{ text, match: false }];

  const alternation = [...clean]
    .sort((a, b) => b.length - a.length) // longest first: "E-501" beats "E"
    .map(diacriticPatternSource)
    .join("|");

  const re = new RegExp(`(${alternation})`, "gi");
  // Flags are assigned from the ORIGINAL split indices — filtering empty
  // segments first would shift the odd/even parity and mis-mark segments.
  return text
    .split(re)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter(part => part.text !== "");
}
