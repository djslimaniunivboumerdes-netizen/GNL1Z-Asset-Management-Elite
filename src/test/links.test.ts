// A broken link in a plant application is a safety problem, not a cosmetic one:
// the link that does not open is usually the drawing or the procedure someone
// needed. There is no browser in this stack, so this test does the next best
// thing — it reads every internal link in the source and checks it against the
// router and against the files that actually ship.
//
// It also protects the document migration: when the P&IDs move out of public/,
// every link that still points at /pids/….pdf has to resolve through the
// register (src/lib/documentRegistry.ts) or this test fails.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const PUBLIC_DIR = join(ROOT, "public");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sources = walk(SRC).map((file) => ({ file, text: readFileSync(file, "utf8") }));

/** Routes declared in App.tsx, e.g. /equipment/:tag -> /^\/equipment\/[^/]+$/. */
function routePatterns(): RegExp[] {
  const app = readFileSync(join(SRC, "App.tsx"), "utf8");
  const paths = [...app.matchAll(/path=(?:"([^"]+)"|\{["'`]([^"'`]+)["'`]\})/g)].map((m) => m[1] ?? m[2]);
  return paths.map((path) => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\/:[\w]+/g, "/[^/]+").replace(/:[^/]+/g, "[^/]+");
    return new RegExp(`^${escaped}$`);
  });
}

const ROUTES = routePatterns();
/** /pids?file=… and similar query strings are not part of the path. */
const stripQuery = (value: string) => value.split("?")[0].split("#")[0];

const isExternal = (value: string) => /^(https?:)?\/\//i.test(value) || /^(mailto:|tel:|data:|blob:)/i.test(value);
/** Cloudflare Pages Functions: /api/news is served by functions/api/news.ts. */
const isApi = (value: string) => value.startsWith("/api/");
function apiHandlerExists(value: string): boolean {
  const relative = value.replace(/^\/api\//, "").replace(/\/$/, "");
  for (const candidate of [join(ROOT, "functions", "api", `${relative}.ts`), join(ROOT, "functions", "api", relative, "index.ts")]) {
    if (existsSync(candidate)) return true;
  }
  return false;
}
const isAsset = (value: string) => /\.[a-z0-9]{2,5}$/i.test(value);

/** Every internal path the app can navigate to or load. */
function internalLinks(): Array<{ value: string; file: string }> {
  const found: Array<{ value: string; file: string }> = [];
  const patterns = [
    /\bto\s*=\s*(?:"([^"]+)"|\{\s*["'`]([^"'`]+)["'`]\s*\}|\{`([^`]+)`\})/g,
    /\bhref\s*=\s*(?:"([^"]+)"|\{\s*["'`]([^"'`]+)["'`]\s*\}|\{`([^`]+)`\})/g,
    /\bnavigate\(\s*["'`]([^"'`]+)["'`]/g,
    /\bassetUrl\(\s*["'`]([^"'`]+)["'`]/g,
  ];
  for (const { file, text } of sources) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
        if (!value || !value.startsWith("/")) continue;
        if (value.includes("${") || value.includes("<")) continue; // built at runtime
        found.push({ value, file });
      }
    }
  }
  return found;
}

const links = internalLinks();

describe("internal links", () => {
  it("finds the links it is supposed to be checking", () => {
    // A refactor that renames `to=` would silently empty this net.
    expect(links.length).toBeGreaterThan(20);
    expect(ROUTES.length).toBeGreaterThan(10);
  });

  it("points every internal link at a real route or a file that ships", () => {
    const broken: string[] = [];
    for (const { value, file } of links) {
      const path = stripQuery(value);
      if (!path.startsWith("/")) continue;
      if (isExternal(path)) continue;

      if (isApi(path)) {
        if (apiHandlerExists(path)) continue;
        broken.push(`${path}  (no Pages Function in functions/api/)  ${file.replace(ROOT, "")}`);
        continue;
      }

      const matchesRoute = ROUTES.some((route) => route.test(path));
      if (matchesRoute) continue;

      if (isAsset(path)) {
        // Static asset: the file must exist in public/ today.
        const candidate = join(PUBLIC_DIR, path.replace(/^\//, ""));
        if (existsSync(candidate) && statSync(candidate).size > 0) continue;
        broken.push(`${path}  (missing from public/)  ${file.replace(ROOT, "")}`);
        continue;
      }

      broken.push(`${path}  (no route, no asset)  ${file.replace(ROOT, "")}`);
    }
    expect(broken.sort()).toEqual([]);
  });

  it("keeps the routes the assistant cites in its answers", () => {
    // Equipment answers link to /equipment/:tag and drawings to /pids?file=…
    const paths = ROUTES.map((route) => route.source);
    expect(paths.some((source) => source.includes("equipment"))).toBe(true);
    expect(paths.some((source) => source.includes("pids"))).toBe(true);
  });
});

describe("documents referenced by the app", () => {
  it("resolves every drawing the P&ID viewer can open", () => {
    const mapping = JSON.parse(readFileSync(join(SRC, "data", "pid_sheet_files.json"), "utf8")) as Record<string, string>;
    const paths = [...new Set(Object.values(mapping))];
    // 28 entries, 26 distinct drawings: two sheets are listed in two sections.
    expect(paths.length).toBe(26);
    const missing = paths.filter((path) => {
      if (!path || !path.startsWith("/")) return false;
      return !existsSync(join(PUBLIC_DIR, path.replace(/^\//, "")));
    });
    // Before the migration these ship under public/. After it they live in the
    // private bucket and are resolved by src/lib/documentRegistry.ts — the
    // register is then the source of truth, and this expectation moves with it.
    expect(missing).toEqual([]);
  });

  it("knows how much of the drawing set is served locally", () => {
    const mapping = JSON.parse(readFileSync(join(SRC, "data", "pid_sheet_files.json"), "utf8")) as Record<string, string>;
    const index = JSON.parse(readFileSync(join(SRC, "data", "pid_index.json"), "utf8")) as { sheets: Array<{ file: string }> };
    const local = new Set(Object.values(mapping));
    const covered = index.sheets.filter((sheet) => local.has(sheet.file)).length;
    // The remaining 18 sheets have no local PDF: the viewer opens them from
    // Drive. That is a gap, not a defect — it is recorded here so a change in
    // either direction is deliberate.
    expect(index.sheets.length).toBe(44);
    expect(covered).toBe(26);
  });
});
