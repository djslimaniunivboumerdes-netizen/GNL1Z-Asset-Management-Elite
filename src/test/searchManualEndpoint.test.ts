// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestOptions, onRequestPost } from "../../functions/api/search-manual";
import { MANUALS } from "../data/manuals";

const url = "https://app.example.test/api/search-manual";
function request(body: unknown, origin = "https://app.example.test", ip?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: origin };
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}
const S01 = MANUALS[0];

// Store-only ZIP local file header — the endpoint's reader does not verify CRCs.
function docxZip(content: string): ArrayBuffer {
  const enc = new TextEncoder();
  const name = enc.encode("word/document.xml");
  const data = enc.encode(content);
  const bytes = new Uint8Array(30 + name.length + data.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, 0, true); // stored
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  bytes.set(name, 30);
  bytes.set(data, 30 + name.length);
  return bytes.buffer;
}

afterEach(() => vi.unstubAllGlobals());

describe("manual search endpoint hardening", () => {
  it("rejects cross-origin requests and never answers with a wildcard origin", async () => {
    const denied = await onRequestPost({ request: request({ query: "E-501", manuals: [] }, "https://evil.example.test"), env: {} });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const options = await onRequestOptions({ request: new Request(url, { method: "OPTIONS", headers: { Origin: "https://app.example.test" } }) });
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");

    const crossOptions = await onRequestOptions({ request: new Request(url, { method: "OPTIONS", headers: { Origin: "https://evil.example.test" } }) });
    expect(crossOptions.status).toBe(403);
  });

  it("ignores drive IDs that are not in the checked-in manual catalogue", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await onRequestPost({
      request: request({ query: "compressor", manuals: [{ id: "X", title: "Not allowed", driveId: "InjectedDrive1d" }] }),
      env: {},
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("searches an allowed manual and returns snippets with provenance", async () => {
    const xml = "<w:p><w:t>Weekly E-501 condenser inspection recorded.</w:t></w:p>";
    const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => new Response(docxZip(xml), { status: 200, headers: { "Content-Type": "application/octet-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await onRequestPost({
      request: request({ query: "E-501", manuals: [{ id: S01.id, title: S01.title_en, driveId: S01.drive_id }] }),
      env: {},
    });
    const data = await response.json() as { results: Array<{ id: string; count: number; snippets: string[] }> };
    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toBe(S01.id);
    expect(data.results[0].snippets[0]).toContain("E-501");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(S01.drive_id);
  });

  it("skips single-character queries without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await onRequestPost({
      request: request({ query: "E", manuals: [{ id: S01.id, title: S01.title_en, driveId: S01.drive_id }] }),
      env: {},
    });
    expect(await response.json()).toEqual({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate limits per IP with Retry-After", async () => {
    const fetchMock = vi.fn(async () => new Response(docxZip("<w:p><w:t>nothing</w:t></w:p>"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = { query: "valve", manuals: [{ id: S01.id, title: S01.title_en, driveId: S01.drive_id }] };
    const env = { MANUAL_RATE_LIMIT_PER_MIN: "2" };
    const ip = "203.0.113.42";
    expect((await onRequestPost({ request: request(body, "https://app.example.test", ip), env })).status).toBe(200);
    expect((await onRequestPost({ request: request(body, "https://app.example.test", ip), env })).status).toBe(200);
    const limited = await onRequestPost({ request: request(body, "https://app.example.test", ip), env });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });

  it("rejects oversized bodies", async () => {
    const response = await onRequestPost({
      request: new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://app.example.test" }, body: `{"query":"${"x".repeat(70 * 1024)}"}` }),
      env: {},
    });
    expect(response.status).toBe(413);
  });
});

describe("manual search full-text behaviour", () => {
  it("matches multi-word queries where every word appears (AND), returning highlight terms", async () => {
    const m = MANUALS[2];
    const xml = "<w:p><w:t>The propane refrigeration cycle cools the trains before liquefaction.</w:t></w:p>";
    const fetchMock = vi.fn(async () => new Response(docxZip(xml), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequestPost({
      request: request({ query: "refrigeration propane", manuals: [{ id: m.id, title: m.title_en, driveId: m.drive_id }] }),
      env: {},
    });
    const data = await response.json() as {
      results: Array<{ id: string; count: number; snippets: string[]; terms: string[] }>;
      meta: { total: number; matched: number; failed: number; cached: number; elapsedMs: number };
    };

    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toBe(m.id);
    expect(data.results[0].terms).toEqual(expect.arrayContaining(["propane", "refrigeration"]));
    expect(data.results[0].snippets[0].toLowerCase()).toContain("propane");
    expect(data.meta).toMatchObject({ total: 1, matched: 1, failed: 0, cached: 0 });
    expect(data.meta.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("reuses extracted text on repeat searches (warm cache) without re-downloading", async () => {
    const m = MANUALS[3];
    const xml = "<w:p><w:t>Feed separation drums operate at high pressure.</w:t></w:p>";
    const fetchMock = vi.fn(async () => new Response(docxZip(xml), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await onRequestPost({
      request: request({ query: "separation", manuals: [{ id: m.id, title: m.title_en, driveId: m.drive_id }] }),
      env: {},
    });
    const firstData = await first.json() as { results: unknown[]; meta: { cached: number } };
    expect(firstData.results).toHaveLength(1);
    expect(firstData.meta.cached).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await onRequestPost({
      request: request({ query: "pressure", manuals: [{ id: m.id, title: m.title_en, driveId: m.drive_id }] }),
      env: {},
    });
    const secondData = await second.json() as { results: unknown[]; meta: { cached: number } };
    expect(secondData.results).toHaveLength(1);
    expect(secondData.meta.cached).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from the warm cache
  });

  it("matches French accented text from an unaccented query and returns surface forms", async () => {
    // MANUALS[5] — a document no other test caches, so this runs on fresh text.
    const m = MANUALS[5];
    const xml = "<w:p><w:t>La réfrigération au propane assure la liquéfaction du gaz.</w:t></w:p>";
    const fetchMock = vi.fn(async () => new Response(docxZip(xml), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequestPost({
      request: request({ query: "refrigeration", manuals: [{ id: m.id, title: m.title_fr, driveId: m.drive_id }] }),
      env: {},
    });
    const data = await response.json() as {
      results: Array<{ id: string; snippets: string[]; terms: string[] }>;
    };

    expect(data.results).toHaveLength(1);
    // Snippet is sliced from the original, so the accent is preserved…
    expect(data.results[0].snippets[0]).toContain("réfrigération");
    // …and the surface form is handed to the UI so highlighting is exact.
    expect(data.results[0].terms).toContain("réfrigération");
  });

  it("prefers whole-token tag hits over digits buried in longer numbers", async () => {
    const m = MANUALS[0];
    // "15012" contains "501" but is not tag 501; only E-501 is a real hit.
    const xml = "<w:p><w:t>Serial 15012 recorded near E-501 during the round.</w:t></w:p>";
    const fetchMock = vi.fn(async () => new Response(docxZip(xml), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequestPost({
      request: request({ query: "501", manuals: [{ id: m.id, title: m.title_en, driveId: m.drive_id }] }),
      env: {},
    });
    const data = await response.json() as { results: Array<{ count: number; snippets: string[] }> };

    expect(data.results).toHaveLength(1);
    expect(data.results[0].count).toBe(1); // not 2 — the 15012 noise is dropped
    expect(data.results[0].snippets[0]).toContain("E-501");
  });

  it("remembers failed downloads briefly instead of re-hitting Drive", async () => {
    const m = MANUALS[4];
    const fetchMock = vi.fn(async () => new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = { query: "valve", manuals: [{ id: m.id, title: m.title_en, driveId: m.drive_id }] };

    const first = await onRequestPost({ request: request(body), env: {} });
    const firstData = await first.json() as { results: unknown[]; meta: { failed: number } };
    expect(firstData.results).toHaveLength(0);
    expect(firstData.meta.failed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await onRequestPost({ request: request(body), env: {} });
    const secondData = await second.json() as { meta: { failed: number } };
    expect(secondData.meta.failed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // negative cache absorbed the retry
  });
});
