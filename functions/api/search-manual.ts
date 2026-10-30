// functions/api/search-manual.ts
//
// Cloudflare Pages Function — auto-deploys on every git push.
// Route: POST /api/search-manual
//
// Uses only Web-standard APIs (DecompressionStream, DataView, fetch).
// No npm packages, no CLI deploy needed.
//
// Hardening: same-origin only (origin echo, never wildcard), per-IP rate limit,
// and drive IDs restricted to the checked-in MANUALS catalogue so the endpoint
// cannot be used to pull arbitrary Google Drive documents.

import { MANUALS } from "../../src/data/manuals";

interface ManualMeta { id: string; title: string; driveId: string }
interface SearchHit  { id: string; title: string; driveId: string; count: number; snippets: string[]; terms: string[] }
interface SearchMeta { total: number; matched: number; failed: number; cached: number; elapsedMs: number }

const ALLOWED_DRIVE_IDS = new Set(MANUALS.map((m) => m.drive_id));

function sameOrigin(request: Request): string | null | undefined {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  return origin === new URL(request.url).origin ? origin : undefined;
}
function json(status: number, body: unknown, origin: string | null): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin) { headers["Access-Control-Allow-Origin"] = origin; headers["Vary"] = "Origin"; }
  return Response.json(body, { status, headers });
}

// Best-effort per-IP limiter (per isolate), mirroring /api/ai-agent.
const RATE_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(request: Request, env?: Record<string, string | undefined>): { limited: boolean; retryAfter: number } {
  const configured = Number(env?.MANUAL_RATE_LIMIT_PER_MIN);
  const limit = Number.isSafeInteger(configured) && configured > 0 && configured <= 1000 ? configured : 15;
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

// ── Entry points ──────────────────────────────────────────────────────────────
export function onRequestOptions(ctx: { request: Request }): Response {
  const origin = sameOrigin(ctx.request);
  if (origin === undefined) return json(403, { error: "Origin not allowed" }, null);
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  } });
}

export async function onRequestPost(ctx: { request: Request; env?: Record<string, string | undefined> }): Promise<Response> {
  const origin = sameOrigin(ctx.request);
  if (origin === undefined) return json(403, { error: "Origin not allowed" }, null);
  const rate = rateLimit(ctx.request, ctx.env);
  if (rate.limited) {
    return new Response(JSON.stringify({ error: "Too many search requests. Please wait before retrying." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rate.retryAfter),
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      },
    });
  }
  let query = "", manuals: ManualMeta[] = [];
  try {
    const raw = await ctx.request.text();
    if (new TextEncoder().encode(raw).length > 64 * 1024) return json(413, { error: "Request too large" }, origin);
    const body = JSON.parse(raw) as { query?: unknown; manuals?: unknown };
    query = typeof body.query === "string" ? body.query.trim().slice(0, 200) : "";
    manuals = Array.isArray(body.manuals) ? body.manuals.slice(0, 30).filter((m): m is ManualMeta => {
      if (!m || typeof m !== "object") return false;
      const item = m as Record<string, unknown>;
      return typeof item.id === "string" && typeof item.title === "string" && typeof item.driveId === "string"
        && ALLOWED_DRIVE_IDS.has(item.driveId);
    }) : [];
  } catch {
    return json(400, { error: "Bad request" }, origin);
  }

  if (query.length < 2 || !manuals.length) {
    return json(200, { results: [] }, origin);
  }

  const started = Date.now();
  const settled = await Promise.allSettled(
    manuals.map(m =>
      race(searchManual(m, query), 14_000, null)
    )
  );

  let hits: SearchHit[] = [];
  let failed = 0, scanned = 0, cached = 0;

  for (const r of settled) {
    const value = r.status === "fulfilled" ? r.value : null;
    if (!value || !value.ok) { failed += 1; continue; }
    scanned += 1;
    if (value.cached) cached += 1;
    if (value.hit) hits.push(value.hit);
  }
  hits = hits.sort((a, b) => b.count - a.count);

  const meta: SearchMeta = {
    total: manuals.length,
    matched: hits.length,
    failed,
    cached,
    elapsedMs: Date.now() - started,
  };
  return json(200, { results: hits, meta }, origin);
}

// ── Warm cache: extracted text per document (per isolate) ────────────────────
//
// A cold search downloads + unzips every requested document; repeat searches
// (refined terms, scoped re-runs) reuse the extracted text for 10 minutes.
// Failures are remembered briefly too, so a permission-locked document does
// not hammer Drive on every keystroke-level retry.
const TEXT_TTL_MS  = 10 * 60_000;
const FAIL_TTL_MS  = 60_000;
const textCache = new Map<string, { text: string; at: number }>();
const failCache = new Map<string, { at: number }>();

type TextOutcome =
  | { ok: true;  text: string; cached: boolean }
  | { ok: false; cached: false };

async function getManualText(driveId: string): Promise<TextOutcome> {
  const hit = textCache.get(driveId);
  if (hit && Date.now() - hit.at < TEXT_TTL_MS) return { ok: true, text: hit.text, cached: true };

  const fail = failCache.get(driveId);
  if (fail && Date.now() - fail.at < FAIL_TTL_MS) return { ok: false, cached: false };

  try {
    const text = await fetchDocxAsText(driveId);
    textCache.set(driveId, { text, at: Date.now() });
    failCache.delete(driveId);
    if (textCache.size > 60) { // bound memory in the isolate
      const oldest = textCache.keys().next().value;
      if (oldest !== undefined) textCache.delete(oldest);
    }
    return { ok: true, text, cached: false };
  } catch {
    failCache.set(driveId, { at: Date.now() });
    return { ok: false, cached: false };
  }
}

// ── Search one manual ─────────────────────────────────────────────────────────
async function searchManual(m: ManualMeta, query: string): Promise<{ ok: true; hit: SearchHit | null; cached: boolean } | { ok: false; cached: false }> {
  const got = await getManualText(m.driveId);
  if (!got.ok) return { ok: false, cached: false };
  const { snippets, terms, count } = searchInText(got.text, query);
  return {
    ok: true,
    cached: got.cached,
    hit: count > 0 ? { ...m, count, snippets, terms } : null,
  };
}

// ── Fetch + extract ───────────────────────────────────────────────────────────
async function fetchDocxAsText(driveId: string): Promise<string> {
  const buf = await downloadFromDrive(driveId);
  return extractDocxText(buf);
}

async function downloadFromDrive(driveId: string): Promise<ArrayBuffer> {
  const url  = `https://drive.google.com/uc?export=download&id=${driveId}`;
  const hdrs = { "User-Agent": "Mozilla/5.0 (compatible; GNL1Z-Search/1.0)" };

  let res = await fetch(url, { redirect: "follow", headers: hdrs });
  if (!res.ok) throw new Error(`Drive ${res.status}`);

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    res = await fetch(`${url}&confirm=t`, { redirect: "follow", headers: hdrs });
    if (!res.ok) throw new Error(`Drive confirm ${res.status}`);
  }

  return res.arrayBuffer();
}

// ── Parse .docx ───────────────────────────────────────────────────────────────
//
// THE KEY FIX:
// Word splits a single word/tag across multiple <w:t> runs for formatting
// (bold, colour change, hyperlink anchor, etc.).
//
// Old code:   parts.join(" ")
//   → "E-501" split as ["E-","501"] becomes "E- 501"
//   → indexOf("501") on "E- 501" returns -1 ← BUG
//
// New code: concatenate runs WITHIN a paragraph without any separator.
// Spaces are only added BETWEEN paragraphs.
//   → "E-501" split any way still becomes "E-501" ✓
//   → "501" / "E501" / "E-501" all find it ✓
//
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const xml = await unzipEntry(buffer, "word/document.xml");
  if (!xml) return "";

  const paragraphs: string[] = [];

  // Iterate over every paragraph block <w:p>…</w:p>
  const paraRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let para: RegExpExecArray | null;

  while ((para = paraRe.exec(xml)) !== null) {
    // Concatenate every <w:t> run inside this paragraph — NO added spaces
    const runRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let   run:   RegExpExecArray | null;
    let   paraText = "";

    while ((run = runRe.exec(para[0])) !== null) {
      paraText += run[1];          // direct concat → "E-501" stays "E-501"
    }

    const trimmed = paraText.trim();
    if (trimmed) paragraphs.push(trimmed);
  }

  return paragraphs.join(" ").replace(/\s{2,}/g, " ").trim();
}

// ── Minimal ZIP reader (Web APIs only) ───────────────────────────────────────
async function unzipEntry(buffer: ArrayBuffer, target: string): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const view  = new DataView(buffer);
  let   pos   = 0;

  while (pos + 30 < bytes.length) {
    if (view.getUint32(pos, true) !== 0x04034b50) { pos++; continue; }

    const method    = view.getUint16(pos + 8,  true);
    const cSize     = view.getUint32(pos + 18, true);
    const nameLen   = view.getUint16(pos + 26, true);
    const extraLen  = view.getUint16(pos + 28, true);
    const name      = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const dataStart = pos + 30 + nameLen + extraLen;
    const dataEnd   = dataStart + cSize;

    if (name === target) {
      const chunk = bytes.subarray(dataStart, dataEnd);
      if (method === 0) return new TextDecoder().decode(chunk);
      if (method === 8) return inflate(chunk);
      return null;
    }
    pos = dataEnd;
  }
  return null;
}

// ── DEFLATE ───────────────────────────────────────────────────────────────────
async function inflate(data: Uint8Array): Promise<string> {
  const ds     = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  await writer.write(new Uint8Array(data));
  await writer.close();

  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total  = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let   off    = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  return new TextDecoder().decode(merged);
}

// ── Query variants ────────────────────────────────────────────────────────────
//
// Generates every reasonable form of an equipment tag so "501", "E501",
// "E-501" and "E 501" all find the same equipment.
//
//  "501"   → ["501"]                       (plain number always works as substring)
//  "E501"  → ["E501",  "E-501", "E 501"]
//  "E-501" → ["E-501", "E501", "E 501"]
//  "E 501" → ["E 501", "E501", "E-501"]
//
function queryVariants(raw: string): string[] {
  const q    = raw.trim();
  // Strip all separators → bare alphanumeric string
  const bare = q.replace(/[-\s_]+/g, "");
  // Insert dash at every letter↔digit and digit↔letter boundary
  const dashed = bare
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .replace(/(\d)([A-Za-z])/g, "$1-$2");
  // Insert space at those same boundaries
  const spaced = bare
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");

  // Deduplicate while keeping insertion order
  const seen = new Set<string>();
  return [q, bare, dashed, spaced].filter(v => {
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

// ── Find snippets for a list of terms ────────────────────────────────────────
function findSnippets(text: string, terms: string[], ctx = 200, max = 5): string[] {
  const snips:   string[] = [];
  const usedPos  = new Set<number>(); // avoid duplicate snippets
  const lc      = text.toLowerCase();
  const unique  = [...new Set(terms.map(t => t.toLowerCase()).filter(Boolean))];

  for (const term of unique) {
    let pos = 0;
    while (snips.length < max) {
      const idx = lc.indexOf(term, pos);
      if (idx === -1) break;

      if (!usedPos.has(idx)) {
        usedPos.add(idx);
        const s = Math.max(0, idx - ctx);
        const e = Math.min(text.length, idx + term.length + ctx);
        snips.push((s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : ""));
      }

      pos = idx + Math.max(1, term.length);
    }

    if (snips.length >= max) break;
  }

  return snips;
}

// Occurrence count over the union of all term positions (used for ranking).
function countOccurrences(textLower: string, terms: string[]): number {
  const positions = new Set<number>();
  for (const raw of [...new Set(terms.map(t => t.toLowerCase()).filter(Boolean))]) {
    let pos = 0;
    for (;;) {
      const idx = textLower.indexOf(raw, pos);
      if (idx === -1) break;
      positions.add(idx);
      pos = idx + Math.max(1, raw.length);
    }
  }
  return positions.size;
}

// ── Full-text search: phrase first, then AND-of-words ─────────────────────────
//
// 1. Phrase pass  — the whole query (plus tag variants like E-501/E501/E 501)
//    must appear literally. This is what equipment-tag lookups rely on.
// 2. AND pass     — for multi-word queries that are not a contiguous phrase:
//    EVERY word (≥2 chars) must appear somewhere in the document; snippets are
//    collected around the individual words. So "refrigeration propane" finds
//    the manual even when the two words sit in different sentences.
//
// Returns snippet contexts, the terms to highlight client-side, and an
// occurrence count for cross-document ranking.
function searchInText(text: string, query: string): { snippets: string[]; terms: string[]; count: number } {
  const variants = queryVariants(query);

  const phraseSnips = findSnippets(text, variants, 200, 5);
  if (phraseSnips.length) {
    return { snippets: phraseSnips, terms: variants, count: countOccurrences(text.toLowerCase(), variants) };
  }

  const words = query.split(/\s+/).filter(w => w.length >= 2);
  if (words.length >= 2) {
    const wordTerms: string[] = [];
    const everyWordPresent = words.every(word => {
      const wordVariants = queryVariants(word);
      wordTerms.push(...wordVariants);
      const lc = text.toLowerCase();
      return wordVariants.some(v => lc.includes(v.toLowerCase()));
    });

    if (everyWordPresent) {
      const terms = [...new Set([...wordTerms, ...variants])];
      return {
        snippets: findSnippets(text, terms, 200, 5),
        terms,
        count: countOccurrences(text.toLowerCase(), wordTerms),
      };
    }
  }

  return { snippets: [], terms: variants, count: 0 };
}

// ── Timeout race ──────────────────────────────────────────────────────────────
function race<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  // A late Drive failure must never surface as an unhandled rejection.
  promise.catch(() => undefined);
  return Promise.race([
    promise,
    new Promise<T>(res => setTimeout(() => res(fallback), ms)),
  ]);
}
