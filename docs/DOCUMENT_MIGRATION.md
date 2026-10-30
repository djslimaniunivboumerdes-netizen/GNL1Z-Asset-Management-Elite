# Document migration — how to run it on your machine

46 files (44 P&IDs + 2 PFDs, 17.5 MB) are still served as static assets from
`public/`. This is the runbook for moving them into the private
`restricted-documents` bucket and registering them in
`public.engineering_documents`.

**Nothing has been uploaded yet.** The sandbox this was written in has no
outbound access to `*.supabase.co`, so the upload has to be run from a machine
that can reach your project — yours.

---

## 0. What the script will and will not do

| Step | Flag | Effect |
|---|---|---|
| Dry run | *(none)* | Lists the 46 files and writes a manifest. Touches nothing. |
| Upload | `--upload` | Pushes each object, then **downloads it back and compares sha256**. |
| Verify | `--verify` | Re-downloads every object and compares hashes again. Safe to repeat. |
| Register | `--register` | Writes the `engineering_documents` rows (idempotent). |
| Archive | `--archive-dir <path>` | **Moves** the public copies out of `public/` to a directory you choose. Refuses unless every file verified in the same run. |
| Restore | `--restore` | Moves the archived copies back into `public/`. |

It never deletes a file. It never touches git history. It never writes to
production unless you point it at production.

---

## 1. Choose the target project

**Do this on staging first.** Staging is `nwcpfsqsdjezkwkhxrqx`
(`gnl1z-staging`), and it already has the bucket and the register applied.

```bash
export SUPABASE_URL=https://nwcpfsqsdjezkwkhxrqx.supabase.co
```

For production later, change only that line — and read §6 first.

---

## 2. Supply the service-role key **without exposing it**

The service-role key bypasses every RLS policy. It must never be committed,
never be pasted into a file, and never be given a `VITE_` prefix (those are
bundled into the browser).

```bash
# A leading space keeps the command out of bash history when
# HISTCONTROL=ignorespace is set (the default on most distributions).
 read -s -p 'Service-role key: ' SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
```

If you prefer a file, put it **outside** the repository and export it from
there:

```bash
set -a; source ~/.config/gnl1z/staging.env; set +a    # chmod 600 that file
```

### Verify the credentials cannot leak — four checks, all cheap

1. **The repository refuses to track them.**

   ```bash
   git check-ignore -v .env .env.local            # → .gitignore:33:.env.*
   git status --porcelain                         # no .env* listed
   ```

2. **CI refuses to pass if one is committed.** This is the same gate GitHub
   runs on every pull request:

   ```bash
   node scripts/check-secrets.mjs
   # ✔ secret hygiene: N tracked files scanned, no credentials found
   ```

   It fails on any tracked `.env*`, on service-role/OpenAI/Google/AWS key
   patterns anywhere in tracked source, on real-looking values in
   `.env.example`, and on a missing `.gitignore` rule.

3. **The key never reaches the bundle.** `VITE_*` values are inlined into
   JavaScript, so:

   ```bash
   export SUPABASE_SERVICE_ROLE_KEY=…   # no VITE_ prefix — correct
   npm run build
   grep -rIl 'service_role\|sb_secret_' dist/ | wc -l    # must print 0
   ```

   (If you ever set `VITE_SUPABASE_SERVICE_ROLE_KEY`, this check fails and the
   key ends up public. Don't.)

4. **The session does not keep it.** Close the shell when you are done, or:

   ```bash
   unset SUPABASE_SERVICE_ROLE_KEY; history -d $((HISTCMD-1)) 2>/dev/null
   ```

The manifest the script writes (`document-migration-manifest.json`) contains
file paths and sha256 checksums **only** — no keys, no tokens. It is
git-ignored.

---

## 3. Rehearse on one file

```bash
node scripts/upload-restricted-documents.mjs --limit 1 --upload --verify
```

Expected output: `Uploaded and verified: 1/1`. If it fails, the message says
why (bad key, bucket missing, wrong project).

---

## 4. Run the real migration

```bash
node scripts/upload-restricted-documents.mjs --upload --verify --register
```

- ~17.5 MB over 4 parallel connections; allow a couple of minutes.
- Every file is uploaded **and** downloaded back for a sha256 comparison. A
  file that does not verify is reported as `FAILED`, and the exit code is `1`.
- `--register` upserts on `storage_path`, so re-running is safe.

Then confirm independently:

```bash
node scripts/upload-restricted-documents.mjs --verify --out manifest-verify.json
#   verified   46/46
```

---

## 5. Only now move the originals

```bash
node scripts/upload-restricted-documents.mjs \
  --verify --archive-dir ../gnl1z-restricted-originals
```

- The directory **must be outside `public/`** — the script refuses otherwise.
- It refuses unless all 46 verified in this same run.
- The files are **moved**, not deleted. To put them back:

  ```bash
  node scripts/upload-restricted-documents.mjs --restore
  ```

**Keep the archive until the application has been exercised** (§7). Deleting
them from the working tree also does not remove them from git history — say the
word if you want that handled, and it will be treated as a destructive change
needing its own authorisation.

---

## 6. Before you point this at production

1. Apply the three migrations to production first (`supabase db push`, or the
   equivalent SQL in `docs/DEPLOYMENT.md`) — the bucket and the register row
   must exist.
2. Confirm with `node scripts/upload-restricted-documents.mjs --preflight`:
   it reports whether `restricted-documents` exists and whether it is private.
   It exits non-zero if the bucket is public.
3. Run `--limit 1` first, then the full run.
4. Remember: **the 46 files become invisible to anonymous visitors the moment
   they leave `public/`**, and visible again only to signed-in staff through
   signed URLs. Make sure the accounts you need exist first.

---

## 7. Prove the application can still open them

After the migration, a drawing is served through
`src/lib/documentRegistry.ts`: the old `/pids/….pdf` path is looked up in
`engineering_documents` and exchanged for a short-lived signed URL. If a
session may not read it, the viewer says so instead of showing a blank frame.

Sign in to the deployed app (or the local dev server) as a normal user and
check, for a handful of drawings and ideally all 46:

- the P&ID page opens the drawing (not a blank iframe);
- the "Secure PDF" link downloads it;
- signing out and opening the same deep link shows
  *"This drawing is in secure storage — sign in to open it"*, not a 404.

Automated coverage of the same behaviour: `src/test/documentRegistry.test.ts`
(7 tests) and `src/test/links.test.ts` (5 tests).

---

## 8. If something goes wrong

| Symptom | Action |
|---|---|
| `✖ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY` | Both are needed; see §2. |
| `bucket "restricted-documents" does not exist` | Apply migration `20261030000002_storage_buckets_and_policies.sql`. |
| `bucket … EXISTS but PUBLIC` | `update storage.buckets set public = false where id = 'restricted-documents';` |
| `register HTTP 409` repeatedly | The script falls back to delete+insert; if it still fails, the unique index from migration `20261030000003` is missing. |
| `sha256 mismatch` | The stored bytes differ from the original. Re-run `--upload`; the object is overwritten (upsert). |
| Files disappeared from the app | `--restore` puts them back in `public/`. |
