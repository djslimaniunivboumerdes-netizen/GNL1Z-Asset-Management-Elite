// Expert AI GNL1 must answer an instrument question from the same evidence the
// Instrument Finder shows — and must not claim more than it does.
//
// The rules under test are the ones the brief makes mandatory:
//   · never say an instrument is on an exact drawing;
//   · never infer a line, a range or an equipment relationship;
//   · label every value with the source it came from;
//   · state the gaps instead of omitting them;
//   · never place a signed URL, a token or a secret in the answer.

import { describe, expect, it } from "vitest";
import {
  buildKnowledgeAnswer, resolveInstrument, instrumentTagsIn,
} from "@/lib/assistantKnowledge";
import { buildInstrumentIndex } from "@/lib/instrumentIndex";
import { instrumentContext } from "@/lib/instrumentLocation";

const index = buildInstrumentIndex();

/** A tag that has drawings, equipment on them, and register-backed equipment. */
function richTag(): string {
  const found = index.find((entry) => {
    const context = instrumentContext(entry);
    return (
      context.placements.length > 0 &&
      context.equipmentOnDrawings.some((item) => item.inRegister) &&
      context.specs.some((spec) => spec.source === "register")
    );
  });
  if (!found) throw new Error("no instrument with drawings and register equipment");
  return found.tag;
}

/** A tag no drawing can be tied to. */
function orphanTag(): string {
  const found = index.find((entry) => instrumentContext(entry).placements.length === 0);
  if (!found) throw new Error("no unresolved instrument");
  return found.tag;
}

const answer = (prompt: string, lang = "en") => buildKnowledgeAnswer({ prompt, lang });

describe("resolving an instrument question", () => {
  it("finds a tag written the way operators write it", () => {
    expect(instrumentTagsIn("where is LIC101204?")).toContain("LIC101204");
    expect(instrumentTagsIn("check XV-101-223 please")).toContain("XV101223");
    expect(resolveInstrument("where is LIC101204?")).toBeTruthy();
    expect(resolveInstrument("LIC101204")?.tag).toBe("LIC101204");
    expect(resolveInstrument("nothing here")).toBeNull();
  });

  it("answers with the instrument intent, not 'equipment not found'", () => {
    const result = answer(`where is ${richTag()}?`);
    expect(result.intent).toBe("instrument");
    expect(result.text).toContain(richTag());
    expect(result.text).not.toContain("Equipment not found");
  });

  it("falls through to the equipment path when no instrument matches", () => {
    const result = answer("Review X01-E-501");
    expect(result.intent).not.toBe("instrument");
  });
});

describe("what the answer says", () => {
  const tag = richTag();
  const result = answer(`where is ${tag}?`);
  const text = result.text;

  it("gives the identity, the unit and the train", () => {
    const entry = index.find((candidate) => candidate.tag === tag)!;
    expect(text).toContain(entry.tag);
    expect(text).toMatch(/### Unit and train/);
    if (entry.parsed.train) expect(text).toContain(`train ${entry.parsed.train}`);
  });

  it("offers drawings as a lead, with links into the P&ID viewer", () => {
    const context = instrumentContext(index.find((candidate) => candidate.tag === tag)!);
    expect(text).toMatch(/### Drawings to inspect/);
    expect(text).toMatch(/\/pids\?file=/);
    for (const placement of context.placements.slice(0, 3)) {
      if (placement.drawing) expect(text).toContain(placement.drawing);
    }
  });

  it("never claims the instrument is on a sheet", () => {
    expect(text).not.toMatch(/appears on sheet|is on sheet|found on the drawing|located on sheet/i);
    expect(text).toMatch(/Unit-level association — not a verified location/i);
    expect(text).toMatch(/I cannot tell you which sheet/i);
  });

  it("labels equipment by source and never promotes a drawing tag to the register", () => {
    const context = instrumentContext(index.find((candidate) => candidate.tag === tag)!);
    const drawingOnly = context.equipmentOnDrawings.filter((item) => !item.inRegister);
    if (drawingOnly.length) {
      expect(text).toContain("read on the drawing, not in the register");
    }
    expect(text).toMatch(/in the equipment register/);
  });

  it("shows the piping as what the drawing carries, not as a connection", () => {
    expect(text).toMatch(/not a connection of this instrument/i);
  });

  it("labels each specification with its source", () => {
    expect(text).toMatch(/ISA tag decode/);
    expect(text).toMatch(/Equipment register|Equipment register/);
  });

  it("states the gaps instead of leaving them out", () => {
    expect(text).toMatch(/### What I cannot tell you/);
    expect(text).toMatch(/exact position/i);
    expect(text).toMatch(/range/i);
  });

  it("links back to the Instrument Finder", () => {
    expect(text).toContain(`/instruments?q=${tag}`);
    expect(result.sources.some((source) => source.kind === "instrument")).toBe(true);
  });

  it("says it is advisory, not an engineering instruction", () => {
    expect(text).toMatch(/not an operating instruction/i);
  });
});

describe("what the answer must never leak", () => {
  const tag = richTag();
  const payload = JSON.stringify(buildKnowledgeAnswer({ prompt: `where is ${tag}?`, lang: "en" }));

  it("carries no signed URL, token or credential", () => {
    expect(payload).not.toMatch(/token=|signature=|X-Amz|service_role|sb_secret|apikey/i);
    for (const source of buildKnowledgeAnswer({ prompt: `where is ${tag}?`, lang: "en" }).sources) {
      expect(source.href ?? "").not.toMatch(/^https?:/i);
      expect(source.href ?? "").toMatch(/^\//);
    }
  });

  it("points at drawings through the app, never at the document itself", () => {
    // The route is the P&ID viewer; the bytes stay behind the existing
    // document permissions, and the file path is only ever a parameter.
    for (const source of buildKnowledgeAnswer({ prompt: `where is ${tag}?`, lang: "en" }).sources) {
      const href = source.href ?? "";
      expect(href.startsWith("/")).toBe(true);
      expect(href).not.toMatch(/^\/pids\/.*\.pdf$/);
      if (href.includes("/pids?file=")) expect(href).toMatch(/file=%2F/);
    }
  });
});

describe("the awkward cases", () => {
  it("says plainly when no drawing can be tied to a tag", () => {
    const result = answer(`where is ${orphanTag()}?`);
    expect(result.intent).toBe("instrument");
    expect(result.text).toMatch(/no drawing could be tied/i);
    expect(result.text).not.toMatch(/### Drawings to inspect/);
  });

  it("answers in French with the same rules", () => {
    const result = answer(`où se trouve ${richTag()} ?`, "fr");
    expect(result.intent).toBe("instrument");
    expect(result.text).toMatch(/Association au niveau de l'unité/);
    expect(result.text).toMatch(/Ce que je ne peux pas vous dire/);
    expect(result.text).toMatch(/Décodage du tag ISA|Registre des équipements/);
  });

  it("keeps the answer bounded", () => {
    const result = answer(`tell me everything about ${richTag()}`);
    expect(result.text.length).toBeLessThan(12_000);
    expect(result.sources.length).toBeLessThanOrEqual(10);
  });
});
