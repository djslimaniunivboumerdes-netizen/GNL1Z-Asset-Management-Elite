// The script that plans the migration (scripts/lib/document-classes.mjs) and the
// application that enforces the tiers (src/lib/documentAccess.ts) keep two
// tables of "which document is which class". They are supposed to agree, because
// a file the script leaves public while the app calls it RESTRICTED is a file
// that never gets moved.
//
// Today they disagree on exactly one kind — line_list — and only the document
// owner can settle which side is right, so this test pins every other kind and
// records the exception instead of quietly picking one.

import { describe, expect, it } from "vitest";
import { DOCUMENT_CLASSES } from "@/lib/documentAccess";
import * as documentClasses from "../../scripts/lib/document-classes.mjs";

/** The migration script is plain JavaScript, so its shapes are declared here. */
const { CLASS_RULES, listPublicDocuments } = documentClasses as unknown as {
  CLASS_RULES: Array<{ kind: string; classification: string; match: RegExp }>;
  listPublicDocuments: (dir: string) => Array<{ publicPath: string; kind: string; classification: string; bytes: number }>;
};

const scriptByKind = new Map(CLASS_RULES.map((rule) => [rule.kind, rule.classification]));
const appByKind = new Map(
  Object.entries(DOCUMENT_CLASSES).map(([kind, rule]) => [kind, rule.classification]),
);

/** Known, reported exception — see docs/PRODUCTION_READINESS.md. */
const AGREED_EXCEPTIONS = new Map([["line_list", { script: "INTERNAL", app: "RESTRICTED" }]]);

describe("document classification parity", () => {
  it("classifies every shared kind the same way, bar the reported exception", () => {
    const shared = [...scriptByKind.keys()].filter((kind) => appByKind.has(kind));
    expect(shared.length).toBeGreaterThan(3);
    for (const kind of shared) {
      const expected = AGREED_EXCEPTIONS.get(kind);
      if (expected) {
        expect(scriptByKind.get(kind)).toBe(expected.script);
        expect(appByKind.get(kind)).toBe(expected.app);
        continue;
      }
      expect(appByKind.get(kind), `kind "${kind}" disagrees between script and app`).toBe(scriptByKind.get(kind));
    }
  });

  it("keeps the exception to the line list alone", () => {
    // Anything beyond this is new drift and must be resolved, not recorded.
    const drift = [...scriptByKind.keys()]
      .filter((kind) => appByKind.has(kind) && appByKind.get(kind) !== scriptByKind.get(kind))
      .map((kind) => ({ kind, script: scriptByKind.get(kind), app: appByKind.get(kind) }));
    expect(drift).toEqual([{ kind: "line_list", script: "INTERNAL", app: "RESTRICTED" }]);

    // One file is affected today: the derived equipment register CSV. It is
    // small, and both tiers need the same session, so the exposure is limited —
    // but it is the file the migration would leave public.
    const affected = listPublicDocuments("public").filter((doc) => doc.kind === "line_list");
    expect(affected.map((doc) => doc.publicPath)).toEqual(["/data/gnl1z_equipment_register.csv"]);
  });

  it("counts the documents the migration would move", () => {
    const docs = listPublicDocuments("public");
    const restricted = docs.filter((doc) => doc.classification === "RESTRICTED");
    const byKind: Record<string, number> = {};
    for (const doc of restricted) byKind[doc.kind] = (byKind[doc.kind] ?? 0) + 1;
    // 44 P&IDs + 2 PFDs — the figure every runbook and report quotes.
    expect(byKind.pid).toBe(44);
    expect(byKind.pfd).toBe(2);
    expect(restricted).toHaveLength(46);
  });
});
