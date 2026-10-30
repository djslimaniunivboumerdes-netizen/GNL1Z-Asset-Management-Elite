/**
 * Core of the restricted-document migration — no console output, no process
 * state, so every step can be unit-tested (src/test/documentMigration.test.ts)
 * without network access. The CLI in scripts/upload-restricted-documents.mjs is
 * a thin shell over these functions.
 *
 * Safety properties, in order:
 *  1. The default is a dry run. Nothing is written anywhere without a flag.
 *  2. An upload is only "done" when the object is downloaded again and its
 *     sha256 equals the local file's. A 200 response alone proves nothing.
 *  3. The register row records the full sha256, so a later audit can prove the
 *     bytes in Storage are the bytes that were on disk.
 *  4. Originals are never deleted. `--archive-dir` MOVES them (default: outside
 *     the repository) and the manifest records both paths so `--restore` can put
 *     every file back. Archiving refuses to run unless every file verified in
 *     the same run.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listRestrictedDocuments } from "./document-classes.mjs";

export const BUCKET = "restricted-documents";
export const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Storage keys are path segments: encode each one, never the whole path. */
export function objectUrl(projectUrl, bucket, storagePath) {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${String(projectUrl).replace(/\/$/, "")}/storage/v1/object/${bucket}/${encoded}`;
}

export function bucketUrl(projectUrl, bucket) {
  return `${String(projectUrl).replace(/\/$/, "")}/storage/v1/bucket/${bucket}`;
}

export function signUrl(projectUrl, bucket, storagePath, expiresIn = 3600) {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${String(projectUrl).replace(/\/$/, "")}/storage/v1/object/sign/${bucket}/${encoded}?expiresIn=${expiresIn}`;
}

/**
 * The work list: every RESTRICTED file under public/, with the hash of the bytes
 * on disk. `limit` exists so a first run can be a single-file rehearsal.
 */
export function buildPlan({ root = process.cwd(), publicDir = join(process.cwd(), "public"), limit = Infinity } = {}) {
  const indexPath = join(root, "src", "data", "pid_index.json");
  let index = null;
  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, "utf8"));
    } catch {
      index = null; // a malformed index must not block the migration
    }
  }

  const sheetsByBase = new Map();
  for (const sheet of index?.sheets ?? []) {
    const base = String(sheet.file ?? "").replace(/^\/?pids\//, "").replace(/\.pdf$/i, "");
    if (base) sheetsByBase.set(base.toLowerCase(), sheet);
  }

  return listRestrictedDocuments(publicDir).slice(0, limit).map((doc) => {
    const name = doc.publicPath.split("/").pop();
    const base = name.replace(/\.[^.]+$/, "");
    const sheet = sheetsByBase.get(base.toLowerCase());
    const bytes = readFileSync(doc.absolutePath);
    return {
      publicPath: doc.publicPath,
      absolutePath: doc.absolutePath,
      fileName: name,
      kind: doc.kind,
      docType: doc.docType ?? "OTHER",
      classification: doc.classification,
      bucket: doc.bucket ?? BUCKET,
      target: doc.target ?? doc.kind,
      storagePath: `${doc.target ?? doc.kind}/${name}`,
      title: base,
      tag: sheet?.equipment?.[0] ?? null,
      drawingNo: sheet?.drawing ?? null,
      bytes: bytes.length,
      sha256: sha256(bytes),
      // Status is per-run state, never persisted in the manifest as truth.
      uploaded: false,
      verified: false,
      registered: false,
      archived: false,
      remoteSha256: null,
      error: null,
    };
  });
}

/** The row written to public.engineering_documents for a migrated file. */
export function registerRow(item, migratedOn = new Date().toISOString().slice(0, 10)) {
  return {
    doc_type: item.docType,
    title: item.title,
    tag: item.tag ?? null,
    drawing_no: item.drawingNo ?? null,
    revision: null,
    revision_date: null,
    classification: item.classification,
    storage_bucket: item.bucket,
    storage_path: item.storagePath,
    public_path: item.publicPath, // kept so the app can fall back until the copies are archived
    source_page: null,
    extraction_method: null,
    extraction_confidence: null,
    verified: false, // no human has signed the *content* off — only the bytes are proven
    notes: `migrated ${migratedOn}; sha256 ${item.sha256}; ${item.bytes} bytes; original ${item.publicPath}`,
  };
}

/**
 * Throws unless the target project is ready: bucket present, bucket private,
 * register table reachable. Cheap, read-only, and it fails before 17.5 MB is
 * pushed anywhere.
 */
export async function preflight({ projectUrl, serviceKey, bucket = BUCKET, fetchImpl = fetch }) {
  const result = { bucket: { exists: false, isPublic: null, error: null }, register: { reachable: false, error: null } };
  const auth = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const response = await fetchImpl(bucketUrl(projectUrl, bucket), { headers: auth });
  if (response.status === 404) {
    result.bucket.error = `bucket "${bucket}" does not exist — apply supabase/migrations/20261030000002_storage_buckets_and_policies.sql first`;
  } else if (!response.ok) {
    result.bucket.error = `bucket check ${response.status}: ${(await response.text()).slice(0, 200)}`;
  } else {
    const body = await response.json();
    result.bucket.exists = true;
    result.bucket.isPublic = Boolean(body?.public);
  }

  const table = await fetchImpl(`${String(projectUrl).replace(/\/$/, "")}/rest/v1/engineering_documents?select=id&limit=1`, {
    headers: { ...auth, Accept: "application/json" },
  });
  result.register.reachable = table.ok;
  if (!table.ok) {
    result.register.error = `engineering_documents ${table.status}: ${(await table.text()).slice(0, 200)}`;
  }

  return result;
}

async function request(fetchImpl, url, init, { attempts = 3, backoffMs = 400 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, init);
      if (response.ok || !RETRIABLE_STATUS.has(response.status)) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
  }
  throw lastError ?? new Error("request failed");
}

/** Upload one object, then download it again and compare hashes. */
export async function uploadAndVerify(item, { projectUrl, serviceKey, fetchImpl = fetch, attempts = 3 } = {}) {
  if (!projectUrl || !serviceKey) throw new Error("projectUrl and serviceKey are required");
  const url = objectUrl(projectUrl, item.bucket, item.storagePath);
  const auth = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const body = readFileSync(item.absolutePath);
  const contentType = /\.pdf$/i.test(item.fileName)
    ? "application/pdf"
    : /\.png$/i.test(item.fileName)
      ? "image/png"
      : /\.jpe?g$/i.test(item.fileName)
        ? "image/jpeg"
        : "application/octet-stream";

  const put = await request(
    fetchImpl,
    url,
    { method: "POST", headers: { ...auth, "Content-Type": contentType, "x-upsert": "true", "cache-control": "3600" }, body },
    { attempts },
  );
  if (!put.ok) throw new Error(`upload HTTP ${put.status}: ${(await put.text()).slice(0, 200)}`);
  item.uploaded = true;

  const verification = await verifyOne(item, { projectUrl, serviceKey, fetchImpl, attempts });
  if (!verification.verified) throw new Error(verification.error ?? "sha256 mismatch");
  item.remoteSha256 = verification.remoteSha256;
  return item;
}

/** Download the stored object and compare it with the bytes on disk. */
export async function verifyOne(item, { projectUrl, serviceKey, fetchImpl = fetch, attempts = 3 } = {}) {
  if (!projectUrl || !serviceKey) throw new Error("projectUrl and serviceKey are required");
  const url = objectUrl(projectUrl, item.bucket, item.storagePath);
  const response = await request(fetchImpl, url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }, { attempts });
  if (response.status === 404) return { verified: false, remoteSha256: null, error: "not found in Storage" };
  if (!response.ok) return { verified: false, remoteSha256: null, error: `verify HTTP ${response.status}` };
  const remoteSha256 = sha256(Buffer.from(await response.arrayBuffer()));
  if (remoteSha256 !== item.sha256) {
    return { verified: false, remoteSha256, error: `sha256 mismatch ${remoteSha256.slice(0, 12)} != ${item.sha256.slice(0, 12)}` };
  }
  item.verified = true;
  item.remoteSha256 = remoteSha256;
  return { verified: true, remoteSha256, error: null };
}

/**
 * Upsert the register row. Uses the unique index on storage_path when the
 * database has it (migration 20261030000003), and falls back to
 * delete-then-insert so the run stays idempotent on a database that does not.
 */
export async function registerOne(item, { projectUrl, serviceKey, fetchImpl = fetch, attempts = 3 } = {}) {
  if (!projectUrl || !serviceKey) throw new Error("projectUrl and serviceKey are required");
  const base = String(projectUrl).replace(/\/$/, "");
  const auth = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const row = registerRow(item);

  const upsert = await request(
    fetchImpl,
    `${base}/rest/v1/engineering_documents?on_conflict=storage_path`,
    { method: "POST", headers: { ...auth, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify([row]) },
    { attempts },
  );
  if (upsert.ok) {
    item.registered = true;
    return { registered: true, mode: "upsert", error: null };
  }

  const detail = (await upsert.text()).slice(0, 300);
  // 409 with no usable ON CONFLICT target: the unique index is missing.
  if (upsert.status === 409) {
    const del = await request(
      fetchImpl,
      `${base}/rest/v1/engineering_documents?storage_path=eq.${encodeURIComponent(item.storagePath)}`,
      { method: "DELETE", headers: auth },
      { attempts },
    );
    if (!del.ok) return { registered: false, mode: "delete", error: `delete HTTP ${del.status}` };
    const insert = await request(
      fetchImpl,
      `${base}/rest/v1/engineering_documents`,
      { method: "POST", headers: { ...auth, Prefer: "return=representation" }, body: JSON.stringify([row]) },
      { attempts },
    );
    if (!insert.ok) return { registered: false, mode: "delete+insert", error: `insert HTTP ${insert.status}: ${(await insert.text()).slice(0, 200)}` };
    item.registered = true;
    return { registered: true, mode: "delete+insert", error: null };
  }

  return { registered: false, mode: "upsert", error: `register HTTP ${upsert.status}: ${detail}` };
}

/** Run `worker` over `items` with bounded concurrency, collecting failures. */
export async function runPool(items, worker, concurrency = 4) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await worker(item);
      } catch (error) {
        item.error = error instanceof Error ? error.message : String(error);
      }
    }
  });
  await Promise.all(runners);
  return items;
}

/** Summarise a plan for humans and for exit codes. */
export function summarise(items) {
  const failed = items.filter((item) => item.error);
  return {
    total: items.length,
    uploaded: items.filter((item) => item.uploaded).length,
    verified: items.filter((item) => item.verified).length,
    registered: items.filter((item) => item.registered).length,
    archived: items.filter((item) => item.archived).length,
    failed: failed.length,
    failures: failed.map((item) => ({ storagePath: item.storagePath, error: item.error })),
    bytes: items.reduce((sum, item) => sum + item.bytes, 0),
  };
}
