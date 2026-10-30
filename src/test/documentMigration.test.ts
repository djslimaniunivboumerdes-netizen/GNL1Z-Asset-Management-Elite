// The document migration cannot be rehearsed in CI (it needs a Supabase project
// and a service-role key), so every decision it makes is tested here against a
// throwaway directory and a fake fetch. What these tests guarantee is the part
// that would otherwise be silent: that a file is only "migrated" when its
// checksum proves it, that the register row carries that checksum, and that a
// failure is never swallowed.

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRestrictedDocuments } from "../../scripts/lib/document-classes.mjs";
import {
  buildPlan,
  objectUrl,
  registerOne,
  registerRow,
  runPool,
  sha256,
  summarise,
  uploadAndVerify,
  verifyOne,
} from "../../scripts/lib/document-migration.mjs";

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "gnl1z-docs-"));
  const publicDir = join(root, "public");
  for (const dir of ["pids", "pfd", "images"]) mkdirSync(join(publicDir, dir), { recursive: true });
  writeFileSync(join(publicDir, "pids", "E520 R792 R793.pdf"), Buffer.from("pdf-bytes"));
  writeFileSync(join(publicDir, "pids", "Anti-pompage propane.pdf"), Buffer.from("another-pdf"));
  writeFileSync(join(publicDir, "pfd", "gnl1z-pfd-labeled.png"), Buffer.from("png-bytes"));
  writeFileSync(join(publicDir, "images", "pump.jpg"), Buffer.from("jpg-bytes")); // INTERNAL — stays public

  mkdirSync(join(root, "src", "data"), { recursive: true });
  writeFileSync(
    join(root, "src", "data", "pid_index.json"),
    JSON.stringify({
      sheets: [{ file: "/pids/E520 R792 R793.pdf", drawing: "85-X06-10.1", title: "E520", equipment: ["X06-E-520"] }],
    }),
  );
  return { root, publicDir };
}

/** Fake fetch driven by a route table: method + url → response factory. */
function fakeFetch(routes: Array<{ match: (url: string, init?: RequestInit) => boolean; respond: () => Response }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const route = routes.find((candidate) => candidate.match(String(url), init));
    if (!route) return new Response("not found", { status: 404 });
    return route.respond();
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const text = (body: string, status = 200) => () => new Response(body, { status });
const empty = (status: number) => () => new Response(null, { status });

describe("restricted-document migration", () => {
  let repo: ReturnType<typeof makeRepo>;
  let plan: ReturnType<typeof buildPlan>;

  beforeEach(() => {
    repo = makeRepo();
    plan = buildPlan({ root: repo.root, publicDir: repo.publicDir });
  });

  it("plans only the files that must leave the public folder", () => {
    // 2 P&IDs + 1 PFD. The INTERNAL image is served as a static asset on purpose.
    expect(plan.map((item) => item.storagePath)).toEqual([
      "pfd/gnl1z-pfd-labeled.png",
      "pids/Anti-pompage propane.pdf",
      "pids/E520 R792 R793.pdf",
    ]);
    expect(listRestrictedDocuments(repo.publicDir).map((doc) => doc.publicPath)).toEqual([
      "/pfd/gnl1z-pfd-labeled.png",
      "/pids/Anti-pompage propane.pdf",
      "/pids/E520 R792 R793.pdf",
    ]);
  });

  it("hashes the bytes on disk — the value every later check compares against", () => {
    const sheet = plan.find((item) => item.fileName === "E520 R792 R793.pdf");
    expect(sheet?.sha256).toBe(sha256(Buffer.from("pdf-bytes")));
    expect(sheet?.sha256).toHaveLength(64);
    expect(sheet?.bytes).toBe(9);
  });

  it("carries the drawing number and tag from the P&ID index", () => {
    const sheet = plan.find((item) => item.fileName === "E520 R792 R793.pdf");
    expect(sheet?.drawingNo).toBe("85-X06-10.1");
    expect(sheet?.tag).toBe("X06-E-520");
    expect(sheet?.docType).toBe("P_AND_ID");
    const pfd = plan.find((item) => item.docType === "PFD");
    expect(pfd?.drawingNo).toBeNull();
  });

  it("encodes storage keys segment by segment", () => {
    expect(objectUrl("https://x.supabase.co/", "restricted-documents", "pids/E520 R792 R793.pdf")).toBe(
      "https://x.supabase.co/storage/v1/object/restricted-documents/pids/E520%20R792%20R793.pdf",
    );
  });

  it("writes a register row that proves which bytes were stored", () => {
    const row = registerRow(plan[0]);
    expect(row.classification).toBe("RESTRICTED");
    expect(row.storage_bucket).toBe("restricted-documents");
    expect(row.public_path).toBe(plan[0].publicPath);
    expect(row.notes).toContain(plan[0].sha256); // the full hash, not a prefix
    expect(row.verified).toBe(false); // bytes proven, content not signed off
  });

  it("uploads, then proves the upload by downloading it back", async () => {
    const item = plan.find((candidate) => candidate.fileName === "E520 R792 R793.pdf")!;
    const body = readFileSync(item.absolutePath); // the server must give back exactly these bytes
    const { impl, calls } = fakeFetch([
      { match: (url, init) => init?.method === "POST" && url.includes("/object/"), respond: text("", 200) },
      { match: (url, init) => !init?.method && url.includes("/object/"), respond: () => new Response(body, { status: 200 }) },
    ]);

    const result = await uploadAndVerify(item, { projectUrl: "https://x.supabase.co", serviceKey: "k", fetchImpl: impl });

    expect(result.verified).toBe(true);
    expect(result.remoteSha256).toBe(sha256(body));
    expect(calls[0].init?.method).toBe("POST");
    expect(calls).toHaveLength(2); // one upload, one verification — never "trust the 200"
  });

  it("fails the file when the stored bytes differ from the original", async () => {
    const item = plan[0];
    const { impl } = fakeFetch([
      { match: (url, init) => init?.method === "POST" && url.includes("/object/"), respond: text("", 200) },
      { match: (url, init) => !init?.method && url.includes("/object/"), respond: () => new Response(Buffer.from("corrupted"), { status: 200 }) },
    ]);

    await expect(uploadAndVerify(item, { projectUrl: "https://x.supabase.co", serviceKey: "k", fetchImpl: impl })).rejects.toThrow(
      /sha256 mismatch/,
    );
    expect(item.verified).toBe(false);
  });

  it("retries a transient failure and gives up on a permanent one", async () => {
    const item = plan[0];
    let attempts = 0;
    const impl = vi.fn(async () => {
      attempts += 1;
      return attempts < 3 ? new Response("boom", { status: 503 }) : new Response(Buffer.from("png-bytes"), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await verifyOne(item, { projectUrl: "https://x.supabase.co", serviceKey: "k", fetchImpl: impl, attempts: 3 });
    expect(result.verified).toBe(true);
    expect(attempts).toBe(3);

    const permanent = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const denied = await verifyOne(plan[0], { projectUrl: "https://x.supabase.co", serviceKey: "k", fetchImpl: permanent, attempts: 3 });
    expect(denied.verified).toBe(false);
    expect(denied.error).toMatch(/403/);
  });

  it("registers idempotently, and falls back when the unique index is missing", async () => {
    const item = plan[0];
    const { impl } = fakeFetch([
      { match: (url, init) => init?.method === "POST" && url.includes("on_conflict"), respond: text("[]", 201) },
    ]);
    const ok = await registerOne(item, { projectUrl: "https://x.supabase.co", serviceKey: "k", fetchImpl: impl });
    expect(ok).toMatchObject({ registered: true, mode: "upsert" });
    expect(item.registered).toBe(true);

    const { impl: fallback } = fakeFetch([
      { match: (url, init) => init?.method === "POST" && url.includes("on_conflict"), respond: text("no unique or exclusion constraint", 409) },
      { match: (url, init) => init?.method === "DELETE", respond: empty(204) },
      { match: (url, init) => init?.method === "POST" && !url.includes("on_conflict"), respond: text("[]", 201) },
    ]);
    const item2 = buildPlan({ root: repo.root, publicDir: repo.publicDir })[0];
    const recovered = await registerOne(item2, { projectUrl: "https://x.supabase.co", serviceKey: "k", fetchImpl: fallback });
    expect(recovered).toMatchObject({ registered: true, mode: "delete+insert" });
  });

  it("keeps going when one file fails, and says which one", async () => {
    const failing = buildPlan({ root: repo.root, publicDir: repo.publicDir });
    const results = await runPool(failing, async (item) => {
      if (item.fileName.startsWith("Anti-pompage")) throw new Error("disk read error");
      item.verified = true;
    }, 2);

    const summary = summarise(results);
    expect(summary.total).toBe(3);
    expect(summary.verified).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.failures[0].error).toBe("disk read error");
  });

  it("refuses to call itself done unless every file verified", () => {
    const summary = summarise(buildPlan({ root: repo.root, publicDir: repo.publicDir }));
    // The archive step is gated on verified === total; a fresh plan is not.
    expect(summary.verified).toBe(0);
    expect(summary.total).toBe(3);
    expect(summary.verified === summary.total).toBe(false);
  });
});
