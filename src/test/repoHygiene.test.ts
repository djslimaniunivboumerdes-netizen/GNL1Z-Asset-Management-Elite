import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Repository hygiene, enforced in CI.
 *
 * The point is not tidiness: an environment file that reaches git is a
 * credential that has to be rotated, and this repository is public.
 */

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
}

describe("environment files", () => {
  it("does not track any environment file except the sanitised example", () => {
    const offenders = tracked()
      .filter((file) => /(^|\/)\.env(\.[A-Za-z0-9-]+)?$/.test(file))
      .filter((file) => !file.endsWith(".env.example"));
    expect(offenders).toEqual([]);
  });

  it("ignores environment files in git", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it("ships an example file made only of placeholders", () => {
    const example = readFileSync(".env.example", "utf8");
    const assignments = [...example.matchAll(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/gm)];
    expect(assignments.length).toBeGreaterThan(0);
    for (const [, key, value] of assignments) {
      const trimmed = value.trim();
      const placeholder =
        /^(YOUR|your|https:\/\/YOUR|https:\/\/your)/.test(trimmed) ||
        /^</.test(trimmed) ||
        /^\{\{/.test(trimmed) ||
        trimmed === "";
      expect(placeholder, `${key} has a real-looking value in .env.example`).toBe(true);
    }
  });

  it("keeps a local .env out of the repository but usable locally", () => {
    // Present locally is fine (developers need it); tracked is not.
    if (existsSync(".env")) {
      expect(tracked()).not.toContain(".env");
    }
  });
});

describe("no credentials in tracked source", () => {
  it("contains no service-role key, provider key or private key block", () => {
    const patterns: Array<[string, RegExp]> = [
      ["supabase service-role key", /sb_secret_[A-Za-z0-9_-]{20,}/],
      ["openai key", /sk-[A-Za-z0-9]{32,}/],
      ["google api key", /AIza[0-9A-Za-z_-]{35}/],
      ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ];
    for (const file of tracked()) {
      if (!/\.(ts|tsx|js|mjs|sql|json|toml|yml)$/.test(file)) continue;
      if (!existsSync(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const [label, pattern] of patterns) {
        expect(pattern.test(text), `${file} contains a ${label}`).toBe(false);
      }
    }
  });
});

describe("edge function configuration", () => {
  it("requires JWT authentication on the DCS instrument detector", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(config).toMatch(/\[functions\.detect-dcs-instruments\][\s\S]*verify_jwt\s*=\s*true/);
  });

  it("does not pin a production project reference", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    const match = /^project_id\s*=\s*"(.*)"\s*$/m.exec(config);
    expect(match, "project_id must be declared").toBeTruthy();
    expect(match?.[1] ?? "x").toBe("");
  });
});
