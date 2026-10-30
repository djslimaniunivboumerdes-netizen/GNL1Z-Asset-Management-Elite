#!/usr/bin/env node
/**
 * Restricted-document migration — CLI.
 *
 * Moves every document classified RESTRICTED (46 P&ID and PFD files today,
 * 17.5 MB) out of public/ and into the private `restricted-documents` bucket,
 * registers each one in public.engineering_documents, and — only once every
 * file has been checksum-verified — can move the originals out of public/ to an
 * archive directory you choose.
 *
 * Order of operations, and why:
 *   1. --upload     push each object, then download it back and compare sha256.
 *   2. --verify     re-download every object and compare again (safe to re-run).
 *   3. --register   write the engineering_documents row (idempotent).
 *   4. --archive    MOVE the public copies out of the served folder. Refuses to
 *                   run unless every file verified in this same run. Nothing is
 *                   ever unlinked; --restore puts every file back.
 *
 * Nothing is uploaded, registered or moved unless the matching flag is present.
 *
 * Usage
 *   node scripts/upload-restricted-documents.mjs                      # dry run
 *   node scripts/upload-restricted-documents.mjs --limit 1 --upload   # rehearse
 *   node scripts/upload-restricted-documents.mjs --upload --register
 *   node scripts/upload-restricted-documents.mjs --verify             # re-check
 *   node scripts/upload-restricted-documents.mjs --verify --archive-dir ../gnl1z-originals
 *   node scripts/upload-restricted-documents.mjs --restore            # put them back
 *
 * Environment (see docs/DOCUMENT_MIGRATION.md for the full runbook)
 *   SUPABASE_URL                  https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     server-side only, never a VITE_ variable
 *
 * Requires outbound access to <project>.supabase.co. The service-role key
 * bypasses RLS: treat it as a production credential, keep it out of the shell
 * history, and do not commit it.
 */
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  buildPlan,
  preflight,
  registerOne,
  runPool,
  summarise,
  uploadAndVerify,
  verifyOne,
} from "./lib/document-migration.mjs";

const ROOT = process.cwd();
const DEFAULT_MANIFEST = join(ROOT, "document-migration-manifest.json");

const argv = process.argv.slice(2);
const has = (name) => argv.includes(name);
const value = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index > -1 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const wantUpload = has("--upload");
const wantVerify = has("--verify");
const wantRegister = has("--register");
const wantRestore = has("--restore");
const wantPreflight = has("--preflight");
const archiveDir = value("--archive-dir");
const manifestFile = resolve(value("--out", DEFAULT_MANIFEST));
const limit = Number(value("--limit", "0")) || Infinity;
const concurrency = Math.max(1, Math.min(8, Number(value("--concurrency", "4")) || 4));

const projectUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** The manifest is the evidence file: what moved, where, and its hash. */
function writeManifest(items) {
  const payload = {
    generatedAt: new Date().toISOString(),
    projectUrl: projectUrl.replace(/\/\/([^@]+)@/, "//***@"),
    bucket: "restricted-documents",
    summary: summarise(items),
    documents: items.map((item) => ({
      publicPath: item.publicPath,
      storagePath: item.storagePath,
      docType: item.docType,
      bytes: item.bytes,
      sha256: item.sha256,
      verified: item.verified,
      remoteSha256: item.remoteSha256,
      registered: item.registered,
      archived: item.archived,
      archivedPath: item.archivedPath ?? null,
      drawingNo: item.drawingNo ?? null,
      error: item.error ?? null,
    })),
  };
  writeFileSync(manifestFile, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function loadManifest() {
  if (!existsSync(manifestFile)) {
    console.error(`\n✖ No manifest at ${manifestFile}. Run with --out <file> when you migrate.\n`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(manifestFile, "utf8"));
}

function requireCredentials() {
  if (projectUrl && serviceKey) return true;
  console.error("\n✖ Missing credentials. Both are required:\n");
  console.error("    export SUPABASE_URL=https://<project>.supabase.co");
  console.error("    export SUPABASE_SERVICE_ROLE_KEY=<service-role key>   # server-side only\n");
  console.error("  Read the key from Dashboard → Project Settings → API. It bypasses RLS:\n" + "  never prefix it with VITE_, never paste it into the repo, never commit it.\n");
  return false;
}

const plan = buildPlan({ root: ROOT, publicDir: join(ROOT, "public"), limit });

if (plan.length === 0) {
  console.log("\nNo RESTRICTED documents found under public/. Nothing to do.\n");
  process.exit(0);
}

console.log(`\nRestricted-document migration — ${plan.length} files, ${mib(plan.reduce((s, i) => s + i.bytes, 0))}`);
console.log(`Target: private bucket "restricted-documents" (pids/, pfd/)`);

// ---------------------------------------------------------------- restore ----
if (wantRestore) {
  const manifest = loadManifest();
  let moved = 0;
  let skipped = 0;
  for (const doc of manifest.documents) {
    if (!doc.archivedPath || !existsSync(doc.archivedPath)) {
      skipped += 1;
      continue;
    }
    const destination = join(ROOT, "public", doc.publicPath.replace(/^\//, ""));
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(doc.archivedPath, destination);
    moved += 1;
  }
  console.log(`\nRestored ${moved} file(s) to public/. ${skipped} already in place or missing.\n`);
  process.exit(0);
}

// ------------------------------------------------------------------ dry run --
if (!wantUpload && !wantVerify && !wantRegister && !wantPreflight) {
  for (const item of plan.slice(0, 12)) {
    console.log(`  ${item.storagePath.padEnd(52)} ${String(Math.round(item.bytes / 1024)).padStart(6)} KB  ${item.drawingNo ?? "—"}`);
  }
  if (plan.length > 12) console.log(`  … and ${plan.length - 12} more`);
  console.log("\nDry run — nothing was uploaded, registered or moved.");
  console.log("  --upload      push to Storage and verify each object by hash");
  console.log("  --verify      re-download and compare hashes (no upload)");
  console.log("  --register    write the engineering_documents rows");
  console.log("  --archive-dir <outside public/>   move the public copies out, after verification");
  console.log("  --restore     put the archived copies back into public/\n");
  writeManifest(plan);
  console.log(`Manifest (dry run) written to ${relative(ROOT, manifestFile) || manifestFile}\n`);
  process.exit(0);
}

if (!requireCredentials()) process.exit(2);

if (wantPreflight) {
  const check = await preflight({ projectUrl, serviceKey });
  console.log("\nPreflight:");
  console.log(`  bucket restricted-documents : ${check.bucket.exists ? (check.bucket.isPublic ? "EXISTS but PUBLIC — fix before migrating" : "exists, private") : check.bucket.error}`);
  console.log(`  engineering_documents table : ${check.register.reachable ? "reachable" : check.register.error}`);
  if (!check.bucket.exists || check.bucket.isPublic !== false || !check.register.reachable) process.exit(1);
  console.log("\nReady to migrate.\n");
  process.exit(0);
}

// ------------------------------------------------------------------- upload --
if (wantUpload) {
  console.log(`\nUploading with concurrency ${concurrency}…`);
  await runPool(plan, async (item) => {
    await uploadAndVerify(item, { projectUrl, serviceKey });
    console.log(`  ✓ ${item.storagePath}`);
  }, concurrency);
}

// ------------------------------------------------------------------- verify --
if (wantVerify || wantUpload) {
  console.log("\nVerifying every object by checksum…");
  await runPool(plan, async (item) => {
    const result = await verifyOne(item, { projectUrl, serviceKey });
    if (!result.verified) throw new Error(result.error ?? "verification failed");
  }, concurrency);
}

// ----------------------------------------------------------------- register --
if (wantRegister) {
  console.log("\nRegistering in public.engineering_documents…");
  await runPool(plan, async (item) => {
    const result = await registerOne(item, { projectUrl, serviceKey });
    if (!result.registered) throw new Error(result.error ?? "registration failed");
  }, concurrency);
}

const summary = summarise(plan);
console.log(`\n  uploaded   ${summary.uploaded}/${summary.total}`);
console.log(`  verified   ${summary.verified}/${summary.total}`);
console.log(`  registered ${summary.registered}/${summary.total}`);
for (const failure of summary.failures) console.log(`  FAILED     ${failure.storagePath}: ${failure.error}`);

// ------------------------------------------------------------------ archive --
if (archiveDir) {
  const target = isAbsolute(archiveDir) ? archiveDir : resolve(ROOT, archiveDir);
  const publicDir = join(ROOT, "public");
  const insidePublic = target === publicDir || target.startsWith(publicDir + "/");

  if (insidePublic) {
    console.error(`\n✖ Refusing to archive into ${target}: it is inside public/ and would still be served.\n`);
    process.exit(2);
  }
  if (summary.verified !== summary.total || summary.failures.length > 0) {
    console.error(`\n✖ Refusing to archive: only ${summary.verified}/${summary.total} files verified in this run.`);
    console.error("  Every file must be verified before the public copies move. Re-run with --verify.\n");
    process.exit(1);
  }

  mkdirSync(target, { recursive: true });
  for (const item of plan) {
    const destination = join(target, item.publicPath.replace(/^\//, ""));
    mkdirSync(dirname(destination), { recursive: true });
    if (existsSync(destination) && statSync(destination).size > 0) {
      // Already archived once: keep the first copy, do not overwrite it.
      item.archived = true;
      item.archivedPath = destination;
      continue;
    }
    renameSync(item.absolutePath, destination);
    item.archived = true;
    item.archivedPath = destination;
  }
  console.log(`\nArchived ${plan.length} original(s) to ${target}`);
  console.log("  They are moved, not deleted. To put them back: node scripts/upload-restricted-documents.mjs --restore");
  console.log("  Removing them from the working tree does NOT remove them from git history.\n");
}

const manifest = writeManifest(plan);
console.log(`Manifest written to ${relative(ROOT, manifestFile) || manifestFile}`);
console.log(`  verified ${manifest.summary.verified}/${manifest.summary.total}, registered ${manifest.summary.registered}/${manifest.summary.total}, archived ${manifest.summary.archived}\n`);

process.exit(manifest.summary.failures.length > 0 ? 1 : 0);
