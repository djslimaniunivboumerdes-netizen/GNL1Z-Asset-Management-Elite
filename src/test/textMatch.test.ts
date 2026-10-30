import { describe, expect, it } from "vitest";
import {
  buildSnippets,
  diacriticPatternSource,
  findMatches,
  fold,
  foldText,
  highlightParts,
  preferBoundary,
} from "@/lib/textMatch";

describe("text folding", () => {
  it("strips diacritics and case while keeping a map back to the original text", () => {
    const text = "Réfrigération propane";
    const { folded, map } = foldText(text);

    expect(folded).toBe("refrigeration propane");
    expect(folded.length).toBe(map.length);
    // Index 2 is "f" in the original (R-é-f…): folding removed the accent on é,
    // so the map must still point at the original character offsets.
    expect(text[map[1]]).toBe("é");
    expect(text[map[2]]).toBe("f");
  });

  it("folds short strings without an index map", () => {
    expect(fold("Déméthaniseur")).toBe("demethaniseur");
    expect(fold("E-501")).toBe("e-501");
  });
});

describe("accent-insensitive matching", () => {
  it("finds an accented word from an unaccented query and reports the original surface", () => {
    const text = "Contrôle de la mesure: débit mesuré en sortie.";
    const folded = foldText(text);
    const matches = findMatches(text, folded, "mesure");

    // Both the plain and the accented spelling match — one query, both forms.
    expect(matches.map(m => m.surface)).toEqual(["mesure", "mesuré"]);
    // Offsets address the original text, so accents survive snippet slicing.
    for (const match of matches) {
      expect(text.slice(match.start, match.end)).toBe(match.surface);
    }
  });

  it("finds a word regardless of capitalisation and accents", () => {
    const text = "Démarrage global de l'unité";
    const folded = foldText(text);
    expect(findMatches(text, folded, "demarrage")).toHaveLength(1);
    expect(findMatches(text, folded, "DÉMARRAGE")).toHaveLength(1);
  });

  it("keeps equipment tag variants searchable", () => {
    const text = "Inspect E-501 then E501 and finally E 501.";
    const folded = foldText(text);
    expect(findMatches(text, folded, "E-501")).toHaveLength(1);
    expect(findMatches(text, folded, "E501")).toHaveLength(1);
    expect(findMatches(text, folded, "E 501")).toHaveLength(1);
  });
});

describe("token-boundary preference", () => {
  it("prefers whole-token hits over digits buried in longer numbers", () => {
    const text = "Tag 15012 differs from E-501 in train 501.";
    const folded = foldText(text);
    const matches = findMatches(text, folded, "501");

    // Three substring hits, but only two are clean tokens (E-501, "501").
    expect(matches).toHaveLength(3);
    const preferred = preferBoundary(matches);
    expect(preferred).toHaveLength(2);
    expect(preferred.map(m => m.surface)).toEqual(["501", "501"]);
  });

  it("falls back to substring hits when no clean token exists (recall is never lost)", () => {
    const text = "Serial 15012 only.";
    const folded = foldText(text);
    const matches = findMatches(text, folded, "501");
    expect(matches).toHaveLength(1);
    expect(preferBoundary(matches)).toHaveLength(1);
  });
});

describe("snippets", () => {
  it("slices the original text so accents survive into the excerpt", () => {
    const text = "La pression mesurée au refoulement reste stable.";
    const folded = foldText(text);
    const snippets = buildSnippets(text, findMatches(text, folded, "mesuree"), 10, 3);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toContain("mesurée");
  });

  it("caps snippets and marks truncation with ellipses", () => {
    const text = "turbine turbine turbine turbine turbine turbine";
    const folded = foldText(text);
    expect(buildSnippets(text, findMatches(text, folded, "turbine"), 5, 2)).toHaveLength(2);
  });
});

describe("highlight parts", () => {
  it("marks every occurrence — the lastIndex bug used to skip every other one", () => {
    const parts = highlightParts("E-501 tripped. E-501 restart.", ["E-501"]);
    expect(parts.filter(p => p.match)).toHaveLength(2);
  });

  it("marks accented text from an unaccented term", () => {
    const parts = highlightParts("débit mesuré", ["mesure"]);
    expect(parts.some(p => p.match && p.text === "mesuré")).toBe(true);
  });

  it("matches the longest term first", () => {
    const parts = highlightParts("E-501A notice", ["E", "E-501"]);
    expect(parts.find(p => p.match)?.text).toBe("E-501");
  });

  it("returns the text untouched when no terms are supplied", () => {
    expect(highlightParts("plain text", [])).toEqual([{ text: "plain text", match: false }]);
  });

  it("escapes regex metacharacters in terms", () => {
    const source = diacriticPatternSource("E-501 (A)");
    expect(() => new RegExp(source)).not.toThrow();
    expect(highlightParts("value E-501 (A) here", ["E-501 (A)"]).filter(p => p.match)).toHaveLength(1);
  });
});
