import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrails for the SQL migrations.
 *
 * These tests will not catch every possible mistake — they are a safety net for
 * the failures that actually happened in this project: a table left without RLS,
 * a `USING (true)` policy on a table that holds plant data, and a migration
 * without a rollback plan.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

interface Migration {
  name: string;
  sql: string;
}

function migrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));
}

/** Strip comments so commented-out rollback SQL is not mistaken for live SQL. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

const all = migrations();
const allSql = all.map((m) => m.sql).join("\n");
const liveSql = stripComments(allSql);

describe("migration inventory", () => {
  it("exists and is ordered by timestamp", () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    const names = all.map((m) => m.name);
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it("is not empty", () => {
    for (const migration of all) expect(migration.sql.trim().length).toBeGreaterThan(50);
  });
});

/**
 * The effective policy set: a `create policy` that a later migration drops is
 * not in force, so the historical files must be read in order, not in isolation.
 */
interface Policy {
  table: string;
  command: string;
  name: string;
  body: string;
}

function effectivePolicies(): Policy[] {
  const createRe = /create\s+policy\s+(?:"([^"]+)"\s+)?on\s+public\.(\w+)\s+for\s+(\w+)([^;]*);/gi;
  const dropRe = /drop\s+policy\s+(?:if\s+exists\s+)?(?:"([^"]+)"\s+)?on\s+public\.(\w+)\s*;/gi;

  // Statements are replayed in document order: the hardening migrations drop a
  // policy and immediately re-create it, so "all drops first" would wrongly
  // conclude that nothing is in force.
  const steps: Array<{ index: number; kind: "create" | "drop"; name: string; table: string; command: string; body: string }> = [];

  for (const match of liveSql.matchAll(createRe)) {
    steps.push({
      index: match.index ?? 0,
      kind: "create",
      name: match[1] ?? "",
      table: match[2] ?? "",
      command: (match[3] ?? "").toLowerCase(),
      body: match[4] ?? "",
    });
  }
  for (const match of liveSql.matchAll(dropRe)) {
    steps.push({
      index: match.index ?? 0,
      kind: "drop",
      name: match[1] ?? "",
      table: match[2] ?? "",
      command: "",
      body: "",
    });
  }
  steps.sort((a, b) => a.index - b.index);

  const inForce = new Map<string, Policy>();
  for (const step of steps) {
    const key = `${step.table}.${step.name}`;
    if (step.kind === "drop") {
      if (step.name) inForce.delete(key);
      else for (const existing of [...inForce.keys()]) if (existing.startsWith(`${step.table}.`)) inForce.delete(existing);
    } else if (step.table) {
      inForce.set(key, { table: step.table, command: step.command, name: step.name, body: step.body });
    }
  }
  return [...inForce.values()];
}

const policies = effectivePolicies();

/** `FOR ALL` counts as every command. */
function policiesFor(table: string, command: string): Policy[] {
  return policies.filter((policy) => policy.table === table && (policy.command === command || policy.command === "all"));
}

describe("row-level security", () => {
  it("enables RLS on every table created in the public schema", () => {
    const created = [...liveSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(0);
    for (const table of new Set(created)) {
      const enabled = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i").test(liveSql);
      expect(enabled, `public.${table} is created without ENABLE ROW LEVEL SECURITY`).toBe(true);
    }
  });

  it("no longer leaves a blanket public-read policy on plant data", () => {
    // These tables hold maintenance, alert, note, detection or AI-cache data.
    const sensitive = [
      "maintenance_logs",
      "equipment_notes",
      "equipment_test_dates",
      "equipment_images",
      "alerts",
      "fast_alerts",
      "dcs_detected_instruments",
      "ai_responses_cache",
    ];
    expect(policies.length).toBeGreaterThan(10);
    for (const table of sensitive) {
      const blanket = policiesFor(table, "select").filter((policy) => /using\s*\(\s*true\s*\)/i.test(policy.body));
      expect(blanket.map((p) => `${table}:${p.name}`), `${table} still has a "FOR SELECT USING (true)" policy`).toEqual([]);
    }
  });

  it("no longer grants blanket write access to any authenticated user", () => {
    const blanket = policies
      .filter((policy) => ["insert", "update", "delete", "all"].includes(policy.command))
      .filter((policy) => /with\s+check\s*\(\s*true\s*\)/i.test(policy.body) || /using\s*\(\s*true\s*\)/i.test(policy.body))
      // An administrator-only policy may legitimately write any column: the
      // gate is the USING clause, not the WITH CHECK clause.
      .filter((policy) => !/public\.is_admin\(\)/i.test(policy.body));
    expect(blanket.map((p) => `${p.table} ${p.command} ${p.name}`)).toEqual([]);
  });

  it("gives every hardened table at least one policy in force", () => {
    for (const table of ["maintenance_logs", "equipment_notes", "alerts", "fast_alerts", "equipment_images"]) {
      expect(policies.filter((policy) => policy.table === table).length, `${table} has no policy in force`).toBeGreaterThan(0);
    }
  });

  it("protects the AI cache from the client entirely", () => {
    expect(/revoke\s+all\s+on\s+public\.ai_responses_cache\s+from\s+anon,\s*authenticated/i.test(liveSql)).toBe(true);
  });

  it("removes TRUNCATE from every client role — TRUNCATE ignores RLS", () => {
    // Found on staging: Supabase grants anon/authenticated TRUNCATE on every new
    // public table, and TRUNCATE does not evaluate row-level security.
    expect(/revoke\s+truncate\s+on\s+public\.%I\s+from\s+anon,\s*authenticated/i.test(liveSql)).toBe(true);
  });

  it("leaves anon with nothing but the PUBLIC document register", () => {
    expect(/revoke\s+all\s+on\s+public\.%I\s+from\s+anon/i.test(liveSql)).toBe(true);
    expect(/grant\s+select\s+on\s+public\.engineering_documents\s+to\s+anon/i.test(liveSql)).toBe(true);
    expect(/revoke\s+insert,\s*update,\s*delete\s+on\s+public\.engineering_documents\s+from\s+anon/i.test(liveSql)).toBe(
      true,
    );
  });

  it("keeps the audit log append-only at the privilege level too", () => {
    expect(/revoke\s+update,\s*delete\s+on\s+public\.audit_log\s+from\s+authenticated/i.test(liveSql)).toBe(true);
    expect(/revoke\s+delete\s+on\s+public\.maintenance_logs\s+from\s+authenticated/i.test(liveSql)).toBe(true);
  });
});

describe("role model", () => {
  it("defines the eight plant roles", () => {
    expect(/create\s+type\s+public\.app_role\s+as\s+enum/i.test(liveSql) ||
      /app_role/i.test(liveSql)).toBe(true);
    for (const role of [
      "administrator",
      "reliability_engineer",
      "mechanical_engineer",
      "process_engineer",
      "instrumentation_engineer",
      "maintenance_technician",
      "operations_viewer",
      "auditor",
    ]) {
      expect(liveSql).toContain(role);
    }
  });

  it("stops an authenticated user from changing their own role", () => {
    // Column-level privilege is the primary control.
    expect(/grant\s+update\s*\(\s*full_name\s*\)\s+on\s+public\.profiles/i.test(liveSql)).toBe(true);
    // A trigger is the backstop.
    expect(/guard_profile_role/i.test(liveSql)).toBe(true);
  });

  it("prevents a technician from approving their own record", () => {
    expect(/cannot\s+review\s+or\s+approve\s+a\s+record\s+you\s+performed/i.test(liveSql)).toBe(true);
  });

  it("never marks imported records as approved", () => {
    expect(/status\s*=\s*'IMPORTED'/i.test(liveSql)).toBe(true);
  });
});

describe("operational safety", () => {
  it("creates an append-only audit log", () => {
    expect(/create\s+table\s+if\s+not\s+exists\s+public\.audit_log/i.test(liveSql)).toBe(true);
    // Insert and select policies exist; update and delete must not.
    const auditPolicies = [...liveSql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.audit_log\s+for\s+(\w+)/gi)];
    const commands = auditPolicies.map((m) => m[2].toLowerCase());
    expect(commands).toContain("insert");
    expect(commands).not.toContain("update");
    expect(commands).not.toContain("delete");
  });

  it("provides the rate limiter the DCS edge function calls", () => {
    expect(/create\s+or\s+replace\s+function\s+public\.consume_rate_limit/i.test(liveSql)).toBe(true);
  });

  it("pins search_path on SECURITY DEFINER functions", () => {
    const definers = [...liveSql.matchAll(/create\s+or\s+replace\s+function[^$]*?security\s+definer([^$]*?)\$\$/gi)];
    expect(definers.length).toBeGreaterThan(3);
    for (const definer of definers) {
      expect(definer[1]).toMatch(/search_path/i);
    }
  });

  it("documents a rollback for the hardening migrations", () => {
    const hardening = all.filter((m) => m.name.startsWith("20261030"));
    expect(hardening.length).toBeGreaterThanOrEqual(2);
    for (const migration of hardening) expect(migration.sql).toMatch(/ROLLBACK/);
  });
});

describe("two-tier access model", () => {
  const policy = (table: string, name: string) => policies.find((p) => p.table === table && p.name === name);

  it("defines the plant-user predicate and excludes the auditor from it", () => {
    expect(/create\s+or\s+replace\s+function\s+public\.is_plant_user\(\)/i.test(liveSql)).toBe(true);
    expect(/role_key\s+<>\s+'auditor'/i.test(liveSql)).toBe(true);
  });

  it("restricts official equipment data to the administrator", () => {
    // The test-date register is the plant's official record of when equipment
    // was last tested: no plant user may amend it.
    const write = policy("equipment_test_dates", "test_dates_write_admin");
    expect(write, "equipment_test_dates has no administrator-only policy").toBeTruthy();
    expect(write?.body).toMatch(/public\.is_admin\(\)/);
    expect(write?.body).not.toMatch(/public\.can_write\(\)/);
  });

  it("restricts the document register and its bucket to the administrator", () => {
    for (const name of ["eng_docs_write_admin", "eng_docs_verify_admin"]) {
      const write = policy("engineering_documents", name);
      expect(write, `${name} is missing`).toBeTruthy();
      expect(write?.body).toMatch(/public\.is_admin\(\)/);
    }
    // The private bucket accepts uploads from administrators only.
    expect(/bucket_id\s*=\s*'restricted-documents'[\s\S]*?public\.is_admin\(\)/i.test(liveSql)).toBe(true);
  });

  it("lets every plant user raise an alert and record maintenance", () => {
    for (const [table, name] of [
      ["alerts", "alerts_insert_plant"],
      ["fast_alerts", "fast_alerts_insert_plant"],
      ["maintenance_logs", "logs_insert_own"],
    ] as const) {
      const insert = policy(table, name);
      expect(insert, `${table}: ${name} is missing`).toBeTruthy();
      expect(insert?.body, `${table}: ${name} must use is_plant_user()`).toMatch(/public\.is_plant_user\(\)/);
      // And it must be their own row.
      expect(insert?.body).toMatch(/auth\.uid\(\)/);
    }
  });

  it("makes maintenance approval an administrator decision", () => {
    expect(/Only an administrator can review, approve or close a maintenance record/i.test(liveSql)).toBe(true);
    // Nobody approves their own work, administrator included.
    expect(/You cannot review or approve a record you performed/i.test(liveSql)).toBe(true);
  });

  it("lets a plant user amend only their own records", () => {
    for (const [table, name] of [
      ["alerts", "alerts_update_author_or_admin"],
      ["fast_alerts", "fast_alerts_update_author_or_admin"],
      ["maintenance_logs", "logs_update_own_or_admin"],
    ] as const) {
      const update = policy(table, name);
      expect(update?.body, `${table}: ${name}`).toMatch(/auth\.uid\(\)/);
    }
  });

  it("keeps one row per stored object so the migration can be re-run", () => {
    expect(/create\s+unique\s+index\s+if\s+not\s+exists\s+eng_docs_storage_path_key\s+on\s+public\.engineering_documents\s*\(\s*storage_path\s*\)/i.test(liveSql)).toBe(
      true,
    );
  });
});
