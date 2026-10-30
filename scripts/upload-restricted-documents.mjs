#!/usr/bin/env node
/**
 * Restricted-document migration.
 *
 * Moves the documents classified RESTRICTED (P&IDs and PFDs today) out of the
 * public static folder and into the private `restricted-documents` bucket, then
 * writes the register rows for public.engineering_documents.
 *
 * Safety properties, in order:
 *  1. Nothing happens without --upload. The default is a dry run.
 *  2. Every upload is verified: the object is downloaded again and its sha256
 *     compared with the local file. An unverified upload is reported as failed.
 *  3. The register row records the sha256, so a later audit can prove the bytes
 *     in Storage are the bytes that were on disk.
 *  4. Local files are never deleted here. Deletion is a separate, explicit step
 *     (--delete-public) that refuses to run unless every upload in this batch
 *     verified in the same run.
 *
 * Usage
 *   node scripts/upload-restricted-documents.mjs                        # dry run
 *   node scripts/upload-restricted-documents.mjs --out register.json    # write rows
 *   SUPABASE_SERVICE_ROLE_KEY=… node scripts/upload-restricted-documents.mjs --upload
 *
 * Requires network egress to <project>.supabase.co and a service-role key
 * (server-side only — never a VITE_ variable).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const BUCKET = "restricted-documents";
const EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i;

/** Mirrors src/lib/documentAccess.ts — keep the two in step. */
const CLASSES = [
  { dir: "pids", kind: "pid", classification: "RESTRICTED", target: "pids" },
  { dir: "pfd", kind: "pfd", classification: "RESTRICTED", target: "pfd" },
];

const args = new Set(process.argv.slice(2));
const flag = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const wantUpload = args.has("--upload");
const wantDelete = args.has("--delete-public");
const outFile = flag("--out");
const projectUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function sha256(buffer) {
  return createHash("sha256").update(buffer).update("").digest("hex");
}

/** drawing number and sheet title, when the P&ID index knows them. */
function pidMeta(fileName) {
  const indexPath = join(ROOT, "src", "data", "pid_index.json");
  if (!existsSync(indexPath)) return {};
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  const base = fileName.replace(/\.pdf$/i, "");
  const sheet = (index.sheets ?? []).find((s) => (s.file ?? "").replace(/^\/?pids\//, "").replace(/\.pdf$/i, "") === base);
  return sheet ? { drawing_no: sheet.drawing ?? null, title_hint: sheet.title ?? null } : {};
}

const plan = [];
for (const entry of CLASSES) {
  const dir = join(PUBLIC_DIR, entry.dir);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    if (!EXTENSIONS.test(name)) continue;
    const full = join(dir, name);
    const bytes = readFileSync(full);
    const meta = entry.kind === "pid" ? pidMeta(name) : {};
    plan.push({
      localPath: `/${entry.dir}/${name}`,
      absolutePath: full,
      kind: entry.kind,
      classification: entry.classification,
      storageBucket: BUCKET,
      storagePath: `${entry.target}/${name}`,
      title: name.replace(/\.[^.]+$/, ""),
      drawingNo: meta.drawing_no ?? null,
      bytes: bytes.length,
      sha256: sha256(bytes),
      verified: false,
      uploaded: false,
      error: null,
    });
  }
}

if (!wantUpload) {
  const total = plan.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`\nDry run — ${plan.length} RESTRICTED documents, ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Target bucket: ${BUCKET} (private)\n`);
  for (const item of plan.slice(0, 15)) {
    console.log(`  ${item.storagePath}  ${(item.bytes / 1024).toFixed(0).padStart(6)} KB  ${item.drawingNo ?? "—"}`);
  }
  if (plan.length > 15) console.log(`  … and ${plan.length - 15} more`);
  console.log(
    wantUpload ? "" : "\nNothing was uploaded. Re-run with --upload (and SUPABASE_SERVICE_ROLE_KEY) to migrate.\n",
  );
}

async function upload(item) {
  const url = `${projectUrl}/storage/v1/object/${BUCKET}/${item.storagePath.split("/").map(encodeURIComponent).join("/")}`;
  const body = readFileSync(item.absolutePath);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": item.localPath.endsWith(".pdf") ? "application/pdf" : "image/*",
      "x-upsert": "true",
      "cache-control": "3600",
    },
    body,
  });
  if (!response.ok) throw new Error(`upload ${response.status}: ${(await response.text()).slice(0, 200)}`);

  // Verify: read the object back and compare hashes. An upload is only "done"
  // when the bytes in Storage match the bytes on disk.
  const back = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!back.ok) throw new Error(`verify ${back.status}`);
  const remoteHash = sha256(Buffer.from(await back.arrayBuffer()));
  if (remoteHash !== item.sha256) throw new Error(`sha256 mismatch ${remoteHash.slice(0, 12)} != ${item.sha256.slice(0, 12)}`);
  item.uploaded = true;
}

if (wantUpload) {
  if (!projectUrl || !serviceKey) {
    console.error("\n✖ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).\n");
    process.exit(1);
  }
  await Promise.all(
    plan.map(async (item) => {
      try {
        await upload(item);
      } catch (error) {
        item.error = error instanceof Error ? error.message : String(error);
      }
    }),
  );

  const ok = plan.filter((item) => item.uploaded).length;
  const failed = plan.filter((item) => item.error);
  console.log(`\nUploaded and verified: ${ok}/${plan.length}`);
  for (const item of failed) console.log(`  FAILED ${item.storagePath}: ${item.error}`);

  if (wantDelete) {
    if (failed.length) {
      console.error("\n✖ Refusing to delete public copies: not every upload verified in this run.\n");
      process.exit(1);
    }
    const { unlinkSync } = await import("node:fs");
    for (const item of plan) unlinkSync(item.absolutePath);
    console.log(`Deleted ${plan.length} public copies from public/. (git history still contains them.)`);
  }
}

if (outFile && (wantUpload || !wantUpload)) {
  const rows = plan.map((item) => ({
    doc_type: item.kind === "pid" ? "P_AND_ID" : "PFD",
    title: item.title,
    drawing_no: item.drawingNo,
    classification: item.classification,
    storage_bucket: item.storageBucket,
    storage_path: item.storagePath,
    public_path: item.localPath,
    extraction_method: null,
    verified: false,
    notes: `migrated ${new Date().toISOString().slice(0, 10)}; sha256 ${item.sha256.slice(0, 16)}…; ${item.bytes} bytes`,
  }));
  writeFileSync(outFile, JSON.stringify(rows, null, 2));
  console.log(`\nWrote ${rows.length} register rows to ${outFile}`);
}

if (!wantUpload && !outFile) {
  console.log("Add --out register.json to write the engineering_documents rows.\n");
}
