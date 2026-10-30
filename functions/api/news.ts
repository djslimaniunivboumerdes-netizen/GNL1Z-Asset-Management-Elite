// functions/api/news.ts
//
// Cloudflare Pages Function — auto-deploys on every git push.
// Route: GET /api/news
//
// The curated dispatches in src/pages/News.tsx go stale by definition, and the
// site's CSP (connect-src 'self' …) forbids the browser from calling an
// external news API directly. So the aggregation happens here, server-side:
// public RSS is fetched, parsed, normalised, de-duplicated and cached, and the
// page renders whatever is actually current.
//
// Uses only Web-standard APIs (fetch, URL). No npm packages, no API key.
// Hardening: same-origin only (origin echo, never wildcard), per-IP rate
// limit, per-feed timeout, link scheme allow-list, HTML/entity stripping, and
// graceful degradation — a total upstream failure returns 200 with
// `degraded: true` so the page keeps showing its curated content.

type Category = "Operations" | "Market" | "Algeria" | "Global";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  /** ISO date (YYYY-MM-DD, UTC) — stable for sorting and locale formatting. */
  dateISO: string;
  category: Category;
  live: true;
}

interface FeedSpec { name: string; url: string; category: Category }
interface FeedStatus { name: string; ok: boolean; items: number }

interface NewsPayload {
  items: NewsItem[];
  generatedAt: string;
  degraded: boolean;
  reason?: "upstream-unavailable" | "partial";
  sources: FeedStatus[];
  cached: boolean;
}

// Google News RSS is keyless, HTTPS and stable; each query is a topic lens.
const FEEDS: FeedSpec[] = [
  {
    name: "Sonatrach / Algeria",
    url: "https://news.google.com/rss/search?q=Sonatrach+OR+(Algeria+AND+(LNG+OR+%22natural+gas%22))&hl=en-US&gl=US&ceid=US:en",
    category: "Algeria",
  },
  {
    name: "LNG market",
    url: "https://news.google.com/rss/search?q=(LNG+OR+%22liquefied+natural+gas%22)+AND+(price+OR+market+OR+demand+OR+supply)&hl=en-US&gl=US&ceid=US:en",
    category: "Market",
  },
  {
    name: "Gas benchmarks",
    url: "https://news.google.com/rss/search?q=(%22Henry+Hub%22+OR+TTF+OR+JKM)+AND+gas&hl=en-US&gl=US&ceid=US:en",
    category: "Market",
  },
  {
    name: "LNG operations",
    url: "https://news.google.com/rss/search?q=LNG+AND+(terminal+OR+train+OR+liquefaction+OR+regasification+OR+maintenance)&hl=en-US&gl=US&ceid=US:en",
    category: "Operations",
  },
];

const FEED_TIMEOUT_MS = 6_000;
const MAX_SUMMARY = 400;
const MAX_TITLE = 300;

// ── Caching (per isolate) ───────────────────────────────────────────────────
// Headlines change on a timescale of minutes; a 15 min TTL keeps the page fast
// and stops us hammering the upstream feeds. Env-overridable so tests can
// disable it (NEWS_CACHE_TTL_MS=0).
const DEFAULT_TTL_MS = 15 * 60_000;
let cache: { items: NewsItem[]; sources: FeedStatus[]; at: number } | null = null;

function cacheTtl(env?: Record<string, string | undefined>): number {
  const configured = Number(env?.NEWS_CACHE_TTL_MS);
  if (Number.isSafeInteger(configured) && configured >= 0 && configured <= 3_600_000) return configured;
  return DEFAULT_TTL_MS;
}

function maxItems(env?: Record<string, string | undefined>): number {
  const configured = Number(env?.NEWS_MAX_ITEMS);
  return Number.isSafeInteger(configured) && configured > 0 && configured <= 60 ? configured : 30;
}

// ── Hardening helpers (mirror /api/search-manual) ───────────────────────────
function sameOrigin(request: Request): string | null | undefined {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  return origin === new URL(request.url).origin ? origin : undefined;
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
  if (origin) { headers["Access-Control-Allow-Origin"] = origin; headers["Vary"] = "Origin"; }
  return Response.json(body, { status, headers });
}

const RATE_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(request: Request, env?: Record<string, string | undefined>): { limited: boolean; retryAfter: number } {
  const configured = Number(env?.NEWS_RATE_LIMIT_PER_MIN);
  const limit = Number.isSafeInteger(configured) && configured > 0 && configured <= 1000 ? configured : 30;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateLimits.size > 5000) for (const [key, value] of rateLimits) if (value.resetAt <= now) rateLimits.delete(key);
    return { limited: false, retryAfter: 0 };
  }
  current.count += 1;
  return { limited: current.count > limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

// ── Entry points ─────────────────────────────────────────────────────────────
export function onRequestOptions(ctx: { request: Request }): Response {
  const origin = sameOrigin(ctx.request);
  if (origin === undefined) return json(403, { error: "Origin not allowed" }, null);
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  } });
}

export async function onRequestGet(ctx: { request: Request; env?: Record<string, string | undefined> }): Promise<Response> {
  const origin = sameOrigin(ctx.request);
  if (origin === undefined) return json(403, { error: "Origin not allowed" }, null);

  const rate = rateLimit(ctx.request, ctx.env);
  if (rate.limited) {
    return new Response(JSON.stringify({ error: "Too many news requests. Please wait before retrying." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rate.retryAfter),
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      },
    });
  }

  const ttl = cacheTtl(ctx.env);
  if (cache && ttl > 0 && Date.now() - cache.at < ttl) {
    return json(200, payload(cache.items, cache.sources, new Date(cache.at).toISOString(), true), origin);
  }

  const sources: FeedStatus[] = [];
  const collected: NewsItem[] = [];

  const settled = await Promise.allSettled(FEEDS.map(async (feed) => {
    const response = await raceFetch(feed, FEED_TIMEOUT_MS);
    if (!response.ok) throw new Error(`${feed.name}: HTTP ${response.status}`);
    const xml = await response.text();
    return parseRss(xml, feed);
  }));

  for (const [index, result] of settled.entries()) {
    const feed = FEEDS[index];
    if (result.status === "fulfilled") {
      sources.push({ name: feed.name, ok: true, items: result.value.length });
      collected.push(...result.value);
    } else {
      sources.push({ name: feed.name, ok: false, items: 0 });
    }
  }

  const items = dedupeAndRank(collected, maxItems(ctx.env));
  const okFeeds = sources.filter(s => s.ok).length;

  if (okFeeds === 0) {
    // Degrade, never fail: the page keeps its curated dispatches.
    return json(200, {
      items: [],
      generatedAt: new Date().toISOString(),
      degraded: true,
      reason: "upstream-unavailable",
      sources,
      cached: false,
    } satisfies NewsPayload, origin);
  }

  if (ttl > 0) cache = { items, sources, at: Date.now() };
  else cache = null;

  return json(200, payload(items, sources, new Date().toISOString(), false, okFeeds < FEEDS.length ? "partial" : undefined), origin);
}

function payload(items: NewsItem[], sources: FeedStatus[], generatedAt: string, cached: boolean, reason?: "partial"): NewsPayload {
  return reason
    ? { items, generatedAt, degraded: true, reason, sources, cached }
    : { items, generatedAt, degraded: false, sources, cached };
}

async function raceFetch(feed: FeedSpec, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GNL1Z-News/1.0)", Accept: "application/rss+xml, application/xml, text/xml" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── RSS parsing (no dependencies) ───────────────────────────────────────────
function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  if (!match) return "";
  const inner = match[1].trim();
  return inner.startsWith("<![CDATA[") ? inner.slice(9, inner.length - 3) : inner;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, entity => ENTITIES[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

/** Only http(s) links leave this function — never javascript: or data:. */
function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(raw: string): string {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return new Date().toISOString().slice(0, 10);
  const date = new Date(ms).toISOString().slice(0, 10);
  // Guard against feeds serving far-future or epoch placeholders.
  const now = Date.now();
  return ms > now + 86_400_000 ? new Date(now).toISOString().slice(0, 10) : date;
}

const ALGERIA_WORDS = /\b(algeria|algerian|sonatrach|arzew|skikda|hassi|alnaft|medgaz|transmed|timimoun|ahnet|oran|algiers)\b/i;
const MARKET_WORDS = /\b(price|prices|market|benchmark|hub|ttf|jkm|brent|cargo|spot|demand|supply|contract|trade|tariff|futures|bcm|mmbtu|dollar|euro)\b/i;
const OPS_WORDS = /\b(terminal|train|plant|liquefaction|regasification|maintenance|shutdown|outage|inspection|compressor|turbine|commissioning|flng|vessel|loading|storage tank)\b/i;

function classify(text: string, fallback: Category): Category {
  if (ALGERIA_WORDS.test(text)) return "Algeria";
  if (OPS_WORDS.test(text)) return "Operations";
  if (MARKET_WORDS.test(text)) return "Market";
  return fallback;
}

export function parseRss(xml: string, feed: FeedSpec): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = decodeEntities(stripHtml(tag(block, "title"))).slice(0, MAX_TITLE);
    const link = safeHttpUrl(decodeEntities(tag(block, "link")).trim());
    const summary = decodeEntities(stripHtml(tag(block, "description"))).slice(0, MAX_SUMMARY);
    const source = decodeEntities(stripHtml(tag(block, "source"))).slice(0, 80) || feed.name;
    // Aggregators append the outlet to the headline ("Cargo loads firm - Reuters");
    // the source is shown separately, so drop the duplicated suffix.
    const cleanTitle = source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title;
    const dateISO = isoDate(tag(block, "pubDate"));

    if (!title || !link) continue;

    items.push({
      id: link,
      title: cleanTitle,
      summary,
      source,
      link,
      dateISO,
      category: classify(`${title} ${summary}`, feed.category),
      live: true,
    });
  }

  return items;
}

// ── Merge ───────────────────────────────────────────────────────────────────
const normaliseTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function dedupeAndRank(items: NewsItem[], max: number): NewsItem[] {
  const seenTitle = new Set<string>();
  const seenLink = new Set<string>();
  const unique: NewsItem[] = [];

  for (const item of items) {
    const title = normaliseTitle(item.title);
    if (!title || seenTitle.has(title) || seenLink.has(item.link)) continue;
    seenTitle.add(title);
    seenLink.add(item.link);
    unique.push(item);
  }

  return unique
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || a.title.localeCompare(b.title))
    .slice(0, max);
}
