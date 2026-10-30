import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CLASSES,
  accessNotice,
  canAccessDocument,
  classifyDocument,
  type DocumentDescriptor,
} from "@/lib/documentAccess";

const pid: DocumentDescriptor = {
  id: "pid-1",
  title: "E520 R792 R793",
  kind: "pid",
  classification: classifyDocument("pid"),
  publicPath: "/pids/E520 R792 R793.pdf",
};

const photo: DocumentDescriptor = {
  id: "photo-1",
  title: "Pump suction",
  kind: "equipment_photo",
  classification: classifyDocument("equipment_photo"),
};

const engineer = { authenticated: true, role: "mechanical_engineer" as const };
const anonymous = { authenticated: false, role: "anonymous" as const };

describe("document classification", () => {
  it("treats plant drawings as restricted company information", () => {
    expect(classifyDocument("pid")).toBe("RESTRICTED");
    expect(classifyDocument("pfd")).toBe("RESTRICTED");
    expect(classifyDocument("manual")).toBe("RESTRICTED");
    expect(classifyDocument("procedure")).toBe("RESTRICTED");
  });

  it("keeps photographs and DCS screenshots internal rather than public", () => {
    expect(classifyDocument("equipment_photo")).toBe("INTERNAL");
    expect(classifyDocument("dcs_panel")).toBe("INTERNAL");
  });

  it("records a reason for every classification so the decision can be reviewed", () => {
    for (const rule of Object.values(DOCUMENT_CLASSES)) {
      expect(rule.rationale.length).toBeGreaterThan(30);
    }
  });
});

describe("access decisions", () => {
  it("never offers a restricted document to an anonymous visitor", () => {
    expect(canAccessDocument(pid, anonymous)).toBe(false);
    expect(canAccessDocument(photo, anonymous)).toBe(false);
  });

  it("offers signed-in staff everything except what their role excludes", () => {
    expect(canAccessDocument(pid, engineer)).toBe(true);
    expect(canAccessDocument(photo, engineer)).toBe(true);
    expect(canAccessDocument(pid, { authenticated: true, role: "operations_viewer" })).toBe(true);
  });

  it("explains a refusal instead of showing an empty panel", () => {
    expect(accessNotice(pid, anonymous, "en")).toMatch(/signed-in staff/i);
    expect(accessNotice(pid, anonymous, "fr")).toMatch(/connect/i);
    expect(accessNotice(pid, engineer, "en")).toBeNull();
  });

  it("defaults an unknown kind to restricted, never to public", () => {
    const unknown = { ...pid, kind: "unknown" } as unknown as DocumentDescriptor;
    expect(classifyDocument(unknown.kind)).toBe("RESTRICTED");
  });
});
