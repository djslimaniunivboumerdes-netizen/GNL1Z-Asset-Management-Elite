#!/usr/bin/env node
/**
 * Document exposure audit — READ ONLY.
 *
 * Reports every document served as a static asset, its classification, and how
 * much of it is public today. Nothing is moved, renamed or deleted: moving
 * plant documents is an authorised change, so this script only produces the
 * evidence an authoriser needs.
 *
 *   node scripts/audit-documents.mjs            # report
 *   node scripts/audit-documents.mjs --json     # machine-readable
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");

/** Mirrors src/lib/documentAccess.ts DOCUMENT_CLASSES. */
const CLASS_BY_FOLDER = [
  { match: /^pids?\//i, kind: "pid", classification: "RESTRICTED" },
  { match: /^pfd\//i, kind: "pfd", classification: "RESTRICTED" },
  { match: /^manuals?\//i, kind: "manual", classification: "RESTRICTED" },
  { match: /^data\//i, kind: "line_list", classification: "INTERNAL" },
  { match: /^images\//i, kind: "equipment_photo", classification: "INTERNAL" },
];

const DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g|webp|csv|xlsx?|docx?)$/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(PUBLIC_DIR)
  .map((file) => ({ file, rel: relative(PUBLIC_DIR, file).split("\\").join("/") }))
  .filter(({ rel }) => DOCUMENT_EXTENSIONS.test(rel))
  .map(({ file, rel }) => {
    const rule = CLASS_BY_FOLDER.find((candidate) => candidate.match.test(rel));
    return {
      path: `/${rel}`,
      bytes: statSync(file).size,
      kind: rule?.kind ?? "unclassified",
      classification: rule?.classification ?? "REVIEW",
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const byClass = {};
for (const file of files) {
  byClass[file.classification] ??= { count: 0, bytes: 0 };
  byClass[file.classification].count += 1;
  byClass[file.classification].bytes += file.bytes;
}

const report = {
  generatedAt: new Date().toISOString(),
  total: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  byClassification: byClass,
  files,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
  console.log(`\nStatic document exposure — ${new Date(report.generatedAt).toISOString()}`);
  console.log(`${report.total} files, ${kb(report.totalBytes)} served from public/\n`);
  for (const [classification, stats] of Object.entries(byClass)) {
    console.log(`  ${classification.padEnd(12)} ${String(stats.count).padStart(4)} files  ${kb(stats.bytes).padStart(10)}`);
  }
  const restricted = files.filter((file) => file.classification === "RESTRICTED");
  if (restricted.length) {
    console.log(`\n  ${restricted.length} file(s) are classified RESTRICTED but are public today:`);
    for (const file of restricted.slice(0, 12)) console.log(`    ${file.path} (${kb(file.bytes)})`);
    if (restricted.length > 12) console.log(`    … and ${restricted.length - 12} more`);
    console.log("\n  Migration (requires authorisation): upload these to the private");
    console.log("  'restricted-documents' bucket, register them in");
    console.log("  public.engineering_documents, then delete the public copies.");
    console.log("  Deleting from the working tree does NOT remove them from git history.");
  }
  const unclassified = files.filter((file) => file.classification === "REVIEW");
  if (unclassified.length) {
    console.log(`\n  ${unclassified.length} file(s) need a classification decision:`);
    for (const file of unclassified) console.log(`    ${file.path}`);
  }
  console.log("");
}
