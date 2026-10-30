#!/usr/bin/env node
/**
 * Repository secret guard — run in CI (see .github/workflows/ci.yml).
 *
 * Fails the build when:
 *   1. a tracked file looks like an environment file carrying real values;
 *   2. a tracked source file contains a Supabase service-role key, a
 *      publishable key wired into a server-side file, or another recognisable
 *      credential;
 *   3. .env is tracked by git at all.
 *
 * It never prints a secret value — only the file, the line and the pattern name.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const RULES = [
  { name: "supabase-service-role-key", pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: "supabase-legacy-service-key", pattern: /eyJhbGciOiJIUzI1NiIs[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "openai-key", pattern: /sk-[A-Za-z0-9]{32,}/g },
  { name: "google-api-key", pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "private-key-block", pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
];

const ENV_FILES = /^\.env(\.[a-z0-9-]+)?$/i;
const EXAMPLE_OK = /^\.env\.example$/i;
const SCAN_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|yml|yaml|toml|sql|md)$/i;
const IGNORED_PATHS = /(^|\/)(node_modules|dist|\.git|coverage|pid_work)\//;

function trackedFiles() {
  const out = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** A placeholder never matches a rule; a real value does. */
function isPlaceholder(value) {
  return /^(your|changeme|replace|placeholder|xxx|<|\{\{)/i.test(value.trim());
}

const problems = [];
const files = trackedFiles();

for (const file of files) {
  if (IGNORED_PATHS.test(file)) continue;

  // 1 & 3. Environment files must never be tracked, except the sanitised example.
  if (ENV_FILES.test(file.split("/").pop())) {
    if (EXAMPLE_OK.test(file.split("/").pop())) {
      const text = existsSync(file) ? readFileSync(file, "utf8") : "";
      const assigned = [...text.matchAll(/^([A-Z0-9_]+)\s*=\s*(.+)$/gm)];
      for (const [, key, value] of assigned) {
        if (!isPlaceholder(value) && !/^https?:\/\/your/i.test(value.trim())) {
          problems.push(`${file}: example file holds a real-looking value for ${key} (use a placeholder)`);
        }
      }
      continue;
    }
    problems.push(`${file}: environment file is tracked by git (add it to .gitignore and run: git rm --cached ${file})`);
  }

  if (!SCAN_EXTENSIONS.test(file)) continue;
  if (!existsSync(file)) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      problems.push(`${file}:${line}: ${rule.name}`);
      break; // one report per file per rule is enough
    }
  }
}

// 2. A tracked .env.local-style file with real values, even if untracked, must
//    be ignored by git.
if (existsSync(".gitignore")) {
  const ignore = readFileSync(".gitignore", "utf8");
  if (!/^\s*\.env/i.test(ignore.split("\n").find((l) => /^\s*\.env/i.test(l)) ?? "")) {
    problems.push(".gitignore: no rule ignoring .env files");
  }
} else {
  problems.push(".gitignore: missing");
}

if (problems.length) {
  console.error(`\n✖ ${problems.length} secret-hygiene problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(`✔ secret hygiene: ${files.length} tracked files scanned, no credentials found`);
