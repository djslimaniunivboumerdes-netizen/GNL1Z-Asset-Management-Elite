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
import { join } from "node:path";
// Same classifier as the migration script, so the report and the migration can
// never disagree about how many files are RESTRICTED.
import { listPublicDocuments } from "./lib/document-classes.mjs";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");

const files = listPublicDocuments(PUBLIC_DIR).map((doc) => ({
  path: doc.publicPath,
  bytes: doc.bytes,
  kind: doc.kind,
  classification: doc.classification,
}));

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
    console.log("  public.engineering_documents, then archive the public copies");
    console.log("  with scripts/upload-restricted-documents.mjs --archive-dir <dir>.");
    console.log("  Removing them from the working tree does NOT remove them from git history.");
  }
  const unclassified = files.filter((file) => file.classification === "REVIEW");
  if (unclassified.length) {
    console.log(`\n  ${unclassified.length} file(s) need a classification decision:`);
    for (const file of unclassified) console.log(`    ${file.path}`);
  }
  console.log("");
}
