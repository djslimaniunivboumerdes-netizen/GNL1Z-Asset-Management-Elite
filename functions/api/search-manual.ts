// functions/api/search-manual.ts
//
// Cloudflare Pages Function — auto-deploys on every git push.
// Route: POST /api/search-manual
//
// Uses only Web-standard APIs (DecompressionStream, DataView, fetch).
// No npm packages, no CLI deploy needed.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

interface ManualMeta { id: string; title: string; driveId: string }
interface SearchHit  { id: string; title: string; driveId: string; count: number; snippets: string[] }

// ── Entry points ──────────────────────────────────────────────────────────────
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(ctx: { request: Request }): Promise<Response> {
  let query = "", manuals: ManualMeta[] = [];
  try {
    const body = await ctx.request.json() as { query: string; manuals: ManualMeta[] };
    query   = (body.query   ?? "").trim();
    manuals = body.manuals  ?? [];
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400, headers: CORS });
  }

  if (!query || !manuals.length) {
    return Response.json({ results: [] }, { headers: CORS });
  }

  const settled = await Promise.allSettled(
    manuals.map(m =>
      race(searchManual(m, query), 14_000, { ...m, count: 0, snippets: [] })
    )
  );

  const results = settled
    .map(r => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is SearchHit => r !== null && r.count > 0)
    .sort((a, b) => b.count - a.count);

  return Response.json({ results }, { headers: CORS });
}

// ── Search one manual ─────────────────────────────────────────────────────────
async function searchManual(m: ManualMeta, query: string): Promise<SearchHit> {
  const text     = await fetchDocxAsText(m.driveId);
  const snippets = findSnippets(text, query, 200, 5);
  return { ...m, count: snippets.length, snippets };
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

  await writer.write(data);
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

// ── Find snippets — tries every query variant ─────────────────────────────────
function findSnippets(text: string, query: string, ctx = 200, max = 5): string[] {
  const snips:   string[] = [];
  const usedPos  = new Set<number>(); // avoid duplicate snippets

  for (const variant of queryVariants(query)) {
    const lc  = text.toLowerCase();
    const lcV = variant.toLowerCase();
    let   pos = 0;

    while (snips.length < max) {
      const idx = lc.indexOf(lcV, pos);
      if (idx === -1) break;

      if (!usedPos.has(idx)) {
        usedPos.add(idx);
        const s = Math.max(0, idx - ctx);
        const e = Math.min(text.length, idx + variant.length + ctx);
        snips.push((s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : ""));
      }

      pos = idx + Math.max(1, variant.length);
    }

    if (snips.length >= max) break;
  }

  return snips;
}

// ── Timeout race ──────────────────────────────────────────────────────────────
function race<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(res => setTimeout(() => res(fallback), ms)),
  ]);
}
