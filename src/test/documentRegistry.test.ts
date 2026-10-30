// After the document migration, /pids/….pdf stops existing as a static asset.
// Every link in the app that points at one has to keep working — through a
// signed URL when the session may read it, and with an honest explanation when
// it may not. These tests cover both states plus the pre-migration fallback.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDocumentRegistry, documentNeedsSession, loadDocumentRegistry, resolveDocumentUrl } from "@/lib/documentRegistry";

interface Row {
  public_path: string;
  storage_bucket: string;
  storage_path: string;
  classification: string;
  title: string | null;
  drawing_no: string | null;
  doc_type: string | null;
}

function fakeClient(options: { rows?: Row[]; error?: string | null; signedUrl?: string | null } = {}) {
  const rows = options.rows ?? [];
  const signed = options.signedUrl === undefined ? "https://signed.example/doc?token=abc" : options.signedUrl;
  const createSignedUrl = vi.fn(async (_path: string, _ttl: number) => ({
    data: signed ? { signedUrl: signed } : null,
    error: signed ? null : { message: "not authorized" },
  }));
  return {
    from: () => ({
      select: () => ({
        not: async () => ({ data: rows, error: options.error ? { message: options.error } : null }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://public.example/${path}` } }),
      }),
    },
    createSignedUrl,
  };
}

const MIGRATED: Row = {
  public_path: "/pids/E520 R792 R793.pdf",
  storage_bucket: "restricted-documents",
  storage_path: "pids/E520 R792 R793.pdf",
  classification: "RESTRICTED",
  title: "E520",
  drawing_no: "85-X06-10.1",
  doc_type: "P_AND_ID",
};

beforeEach(() => clearDocumentRegistry());

describe("document registry", () => {
  it("falls back to the static path while nothing has been migrated", async () => {
    const client = fakeClient({ rows: [] });
    const result = await resolveDocumentUrl("/pids/E520 R792 R793.pdf", client as never);
    expect(result).toMatchObject({ url: "/pids/E520 R792 R793.pdf", source: "static", migrated: false });
  });

  it("serves a migrated drawing through a signed URL", async () => {
    const client = fakeClient({ rows: [MIGRATED] });
    const result = await resolveDocumentUrl("/pids/E520 R792 R793.pdf", client as never);
    expect(result.source).toBe("storage");
    expect(result.migrated).toBe(true);
    expect(result.url).toContain("token=abc");
    expect(client.createSignedUrl).toHaveBeenCalledWith("pids/E520 R792 R793.pdf", expect.any(Number));
  });

  it("matches the path case-insensitively and with or without the leading slash", async () => {
    const client = fakeClient({ rows: [MIGRATED] });
    const result = await resolveDocumentUrl("pids/E520 R792 R793.pdf", client as never);
    expect(result.migrated).toBe(true);
    expect(result.source).toBe("storage");
  });

  it("says why it cannot be opened instead of returning a dead link", async () => {
    const client = fakeClient({ rows: [MIGRATED], signedUrl: null });
    const result = await resolveDocumentUrl("/pids/E520 R792 R793.pdf", client as never);
    expect(result.url).toBeNull();
    expect(result.source).toBe("unavailable");
    expect(documentNeedsSession(result)).toBe(true);
    expect(result.reason).toMatch(/sign in/i);
  });

  it("treats an unreadable register as 'nothing migrated yet' rather than an error", async () => {
    const client = fakeClient({ error: "permission denied for table engineering_documents" });
    const result = await resolveDocumentUrl("/pids/E520 R792 R793.pdf", client as never);
    expect(result.source).toBe("static");
    expect(result.migrated).toBe(false);
  });

  it("ignores register rows with no storage object", async () => {
    const client = fakeClient({ rows: [{ ...MIGRATED, storage_path: null }] });
    const registry = await loadDocumentRegistry(client as never);
    expect(registry.size).toBe(0);
  });

  it("reads the register once, then serves from cache", async () => {
    const client = fakeClient({ rows: [MIGRATED] });
    const spy = vi.spyOn(client, "from");
    await resolveDocumentUrl("/pids/E520 R792 R793.pdf", client as never);
    await resolveDocumentUrl("/pids/E520 R792 R793.pdf", client as never);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
