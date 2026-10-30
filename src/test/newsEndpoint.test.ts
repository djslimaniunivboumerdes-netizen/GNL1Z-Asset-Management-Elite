// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestOptions } from "../../functions/api/news";

const url = "https://app.example.test/api/news";

function request(origin = "https://app.example.test", ip?: string, headers: Record<string, string> = {}) {
  const all: Record<string, string> = { ...headers };
  if (origin) all.Origin = origin;
  if (ip) all["x-forwarded-for"] = ip;
  return new Request(url, { method: "GET", headers: all });
}

/** Disable the module cache (TTL 0) so each test sees fresh upstream fetches. */
const noCache = { NEWS_CACHE_TTL_MS: "0" };

function rss(items: Array<{ title: string; link: string; pubDate: string; desc?: string; source?: string }>): string {
  const body = items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <pubDate>${item.pubDate}</pubDate>
      <source url="https://example.com">${item.source ?? "Example Wire"}</source>
      <description><![CDATA[${item.desc ?? "Summary text"}]]></description>
    </item>`).join("");
  return `<?xml version="1.0"?><rss><channel><title>feed</title>${body}</channel></rss>`;
}

function feedMock(payloads: Array<string | { status: number }>) {
  let call = 0;
  return vi.fn(async () => {
    const next = payloads[Math.min(call, payloads.length - 1)];
    call += 1;
    if (typeof next === "string") return new Response(next, { status: 200, headers: { "Content-Type": "application/rss+xml" } });
    return new Response("error", { status: next.status });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("news endpoint hardening", () => {
  it("rejects cross-origin requests and answers preflight with the echoed origin", async () => {
    const denied = await onRequestGet({ request: request("https://evil.example.test"), env: noCache });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const preflight = await onRequestOptions({ request: new Request(url, { method: "OPTIONS", headers: { Origin: "https://app.example.test" } }) });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");
  });

  it("rate limits per IP with Retry-After", async () => {
    vi.stubGlobal("fetch", feedMock([rss([])]));
    const env = { ...noCache, NEWS_RATE_LIMIT_PER_MIN: "2" };
    const ip = "198.51.100.7";
    expect((await onRequestGet({ request: request("https://app.example.test", ip), env })).status).toBe(200);
    expect((await onRequestGet({ request: request("https://app.example.test", ip), env })).status).toBe(200);
    const limited = await onRequestGet({ request: request("https://app.example.test", ip), env });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });
});

describe("news endpoint aggregation", () => {
  it("parses feeds: strips HTML, decodes entities, infers categories, allow-lists links", async () => {
    const xml = rss([
      { title: "Sonatrach ships LNG cargo from Arzew", link: "https://example.com/a", pubDate: "Thu, 30 Oct 2026 08:00:00 GMT", desc: "<p>Algerian <b>exports</b> rise &amp; demand firm&nbsp;today</p>" },
      { title: "TTF price slips as storage fills", link: "https://example.com/b", pubDate: "Wed, 29 Oct 2026 08:00:00 GMT", desc: "European benchmark eases" },
      { title: "Algerian LNG cargo tender closes - Example Wire", link: "https://example.com/c", pubDate: "Wed, 29 Oct 2026 08:00:00 GMT" },
      { title: "Bad link protocol", link: "javascript:alert(1)", pubDate: "Wed, 29 Oct 2026 08:00:00 GMT" },
    ]);
    vi.stubGlobal("fetch", feedMock([xml]));

    const response = await onRequestGet({ request: request(), env: noCache });
    const data = await response.json() as {
      items: Array<{ title: string; summary: string; link: string; category: string; dateISO: string; source: string; live: boolean }>;
      degraded: boolean;
      sources: Array<{ name: string; ok: boolean }>;
    };

    expect(response.status).toBe(200);
    // Same item title across the four feeds de-duplicates to one entry.
    expect(data.items.length).toBeGreaterThan(0);
    const first = data.items.find(i => i.title.startsWith("Sonatrach"))!;
    expect(first.category).toBe("Algeria");
    expect(first.summary).toBe("Algerian exports rise & demand firm today");
    expect(first.dateISO).toBe("2026-10-30");
    expect(first.live).toBe(true);

    const market = data.items.find(i => i.title.startsWith("TTF"))!;
    expect(market.category).toBe("Market");

    // Aggregator suffix duplicated by the <source> tag is trimmed.
    expect(data.items.some(i => i.title.endsWith(" - Example Wire"))).toBe(false);
    expect(data.items.some(i => i.title === "Algerian LNG cargo tender closes")).toBe(true);

    // javascript: links never survive parsing.
    expect(data.items.some(i => i.link.startsWith("javascript:"))).toBe(false);
    expect(data.degraded).toBe(false);
    expect(data.sources.every(s => s.ok)).toBe(true);
  });

  it("ranks newest first and caps the item count", async () => {
    const xml = rss([
      { title: "Older LNG terminal maintenance window", link: "https://example.com/1", pubDate: "Mon, 05 Jan 2026 08:00:00 GMT" },
      { title: "Newest LNG terminal maintenance window", link: "https://example.com/2", pubDate: "Thu, 30 Oct 2026 08:00:00 GMT" },
      { title: "Middle LNG terminal maintenance window", link: "https://example.com/3", pubDate: "Mon, 15 Jun 2026 08:00:00 GMT" },
    ]);
    vi.stubGlobal("fetch", feedMock([xml]));

    const data = await (await onRequestGet({ request: request(), env: { ...noCache, NEWS_MAX_ITEMS: "2" } })).json() as {
      items: Array<{ title: string }>;
    };
    expect(data.items).toHaveLength(2);
    expect(data.items[0].title).toMatch(/^Newest/);
  });

  it("degrades gracefully when every upstream feed fails", async () => {
    vi.stubGlobal("fetch", feedMock([{ status: 503 }]));
    const response = await onRequestGet({ request: request(), env: noCache });
    const data = await response.json() as { items: unknown[]; degraded: boolean; reason?: string; sources: Array<{ ok: boolean }> };

    expect(response.status).toBe(200); // never a hard failure for the page
    expect(data.items).toEqual([]);
    expect(data.degraded).toBe(true);
    expect(data.reason).toBe("upstream-unavailable");
    expect(data.sources.every(s => !s.ok)).toBe(true);
  });

  it("reuses the cached aggregate instead of re-fetching every feed", async () => {
    const fetchMock = feedMock([rss([{ title: "Cached LNG headline", link: "https://example.com/c", pubDate: "Thu, 30 Oct 2026 08:00:00 GMT" }])]);
    vi.stubGlobal("fetch", fetchMock);

    const first = await (await onRequestGet({ request: request(), env: {} })).json() as { items: unknown[]; cached: boolean; sources: Array<{ ok: boolean }> };
    expect(first.cached).toBe(false);
    expect(first.items.length).toBeGreaterThan(0);
    const callsAfterFirst = fetchMock.mock.calls.length;

    const second = await (await onRequestGet({ request: request(), env: {} })).json() as { cached: boolean };
    expect(second.cached).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // served from cache

    // A TTL of 0 bypasses the cache entirely.
    const third = await (await onRequestGet({ request: request(), env: noCache })).json() as { cached: boolean };
    expect(third.cached).toBe(false);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
