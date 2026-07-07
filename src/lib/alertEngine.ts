// src/lib/alertEngine.ts
// Generates alerts from maintenance_logs, equipment_test_dates, and equipment_notes.
// Runs client-side on the Alert Center page and dashboard; deduplicates by
// (tag, alert_type, source_log_id) so re-runs are idempotent.

import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";
import type { Alert, AlertPriority, AlertStats, ScheduleItem, ScheduleStatus } from "@/types/alerts";
import { DEFAULT_INTERVALS } from "@/types/alerts";
import { EQUIPMENT } from "@/data";

// ── keyword list for note scanning ──────────────────────────────────────────
const ALERT_KEYWORDS = ["leak", "corrosion", "crack", "vibration", "failure", "urgent"];

interface LogRow {
  id: string;
  tag: string;
  test_date: string | null;
  test_type: string | null;
  result: string | null;
  notes: string | null;
}

interface NoteRow {
  tag: string;
  notes: string | null;
}

interface TestDateRow {
  tag: string;
  last_tested: string | null;
  next_test_due: string | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function getIntervalDays(testType: string | null): number {
  const cfg = loadIntervalConfig();
  if (!testType) return cfg.hydrostatic;
  const t = testType.toUpperCase();
  if (t.includes("PSV") || t.includes("SAFETY") || t.includes("VALVE")) return cfg.psv;
  if (t.includes("PREV")) return cfg.preventive;
  return cfg.hydrostatic;
}

export function loadIntervalConfig() {
  try {
    const raw = localStorage.getItem("gnl1z_test_intervals");
    if (raw) return { ...DEFAULT_INTERVALS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_INTERVALS };
}

export function saveIntervalConfig(cfg: typeof DEFAULT_INTERVALS) {
  localStorage.setItem("gnl1z_test_intervals", JSON.stringify(cfg));
}

export function calcStatus(daysLeft: number | null): ScheduleStatus {
  if (daysLeft === null) return "OK";
  if (daysLeft < 0)  return "OVERDUE";
  if (daysLeft <= 30) return "DUE_SOON";
  return "OK";
}

// ── Build schedule from maintenance_logs + equipment_test_dates ──────────────

export async function buildSchedule(): Promise<ScheduleItem[]> {
  const today = new Date();

  // 1. Latest log per tag
  const { data: logs } = await supabase
    .from("maintenance_logs" as never)
    .select("id, tag, test_date, test_type, result")
    .order("test_date", { ascending: false }) as { data: LogRow[] | null };

  const latestLog: Record<string, LogRow> = {};
  for (const row of logs ?? []) {
    if (!latestLog[row.tag]) latestLog[row.tag] = row;
  }

  // 2. Manual overrides from equipment_test_dates
  const { data: testDates } = await supabase
    .from("equipment_test_dates")
    .select("tag, last_tested, next_test_due") as { data: TestDateRow[] | null };

  const dateOverrides: Record<string, TestDateRow> = {};
  for (const row of testDates ?? []) {
    dateOverrides[row.tag] = row;
  }

  // 3. Build schedule items for all equipment
  const items: ScheduleItem[] = [];

  for (const eq of EQUIPMENT) {
    const tag = eq.tag;
    const log = latestLog[tag];
    const override = dateOverrides[tag];

    // Determine last test date (override wins)
    const lastTest = override?.last_tested ?? log?.test_date ?? eq.maintenance.last_tested ?? null;

    // Determine next due (override wins, otherwise calculate from last test)
    let nextDue: string | null = override?.next_test_due ?? null;
    if (!nextDue && lastTest) {
      const interval = getIntervalDays(log?.test_type ?? null);
      const d = parseISO(lastTest);
      d.setDate(d.getDate() + interval);
      nextDue = d.toISOString().split("T")[0];
    }
    if (!nextDue && eq.maintenance.next_test_due) {
      nextDue = eq.maintenance.next_test_due;
    }

    let daysLeft: number | null = null;
    if (nextDue) {
      try {
        daysLeft = differenceInDays(parseISO(nextDue), today);
      } catch { /* skip */ }
    }

    items.push({
      tag,
      last_test: lastTest,
      next_due:  nextDue,
      days_left: daysLeft,
      status:    calcStatus(daysLeft),
      test_type: log?.test_type ?? null,
    });
  }

  return items;
}

// ── Generate and upsert alerts ───────────────────────────────────────────────

export async function runAlertEngine(): Promise<void> {
  // Load existing open/acknowledged alerts to avoid duplicates
  const { data: existing } = await supabase
    .from("alerts" as never)
    .select("id, tag, alert_type, source_log_id, status")
    .in("status", ["OPEN", "ACKNOWLEDGED"]) as { data: Alert[] | null };

  const existingSet = new Set(
    (existing ?? []).map((a) =>
      `${a.tag}::${a.alert_type}::${a.source_log_id ?? ""}`
    )
  );

  const toInsert: Omit<Alert, "id" | "created_at">[] = [];

  const today = new Date();

  // ── 1. Failed tests ──────────────────────────────────────────
  const { data: failedLogs } = await supabase
    .from("maintenance_logs" as never)
    .select("id, tag, test_date, test_type, notes")
    .eq("result", "FAIL") as { data: LogRow[] | null };

  for (const log of failedLogs ?? []) {
    const key = `${log.tag}::FAILED_TEST::${log.id}`;
    if (existingSet.has(key)) continue;
    toInsert.push({
      tag:           log.tag,
      alert_type:    "FAILED_TEST",
      priority:      "HIGH",
      message:       `Test FAILED on ${log.test_date ?? "unknown date"}${log.test_type ? ` (${log.test_type})` : ""}. ${log.notes ?? ""}`.trim(),
      status:        "OPEN",
      source_log_id: log.id,
    });
  }

  // ── 2. Upcoming & overdue tests ──────────────────────────────
  const schedule = await buildSchedule();

  for (const item of schedule) {
    if (item.days_left === null) continue;

    if (item.status === "OVERDUE") {
      const key = `${item.tag}::OVERDUE_TEST::`;
      if (!existingSet.has(key)) {
        toInsert.push({
          tag:           item.tag,
          alert_type:    "OVERDUE_TEST",
          priority:      "HIGH",
          message:       `Test overdue by ${Math.abs(item.days_left)} day(s). Next due was ${item.next_due}.`,
          status:        "OPEN",
          source_log_id: null,
        });
      }
    } else if (item.status === "DUE_SOON") {
      const key = `${item.tag}::UPCOMING_TEST::`;
      if (!existingSet.has(key)) {
        toInsert.push({
          tag:           item.tag,
          alert_type:    "UPCOMING_TEST",
          priority:      item.days_left <= 7 ? "HIGH" : "MEDIUM",
          message:       `Test due in ${item.days_left} day(s) on ${item.next_due}.`,
          status:        "OPEN",
          source_log_id: null,
        });
      }
    }
  }

  // ── 3. Keyword scan in equipment notes ───────────────────────
  const { data: notes } = await supabase
    .from("equipment_notes" as never)
    .select("tag, notes") as { data: NoteRow[] | null };

  for (const row of notes ?? []) {
    if (!row.notes) continue;
    const lower = row.notes.toLowerCase();
    const found = ALERT_KEYWORDS.filter((kw) => lower.includes(kw));
    if (found.length === 0) continue;

    const key = `${row.tag}::KEYWORD_NOTE::`;
    if (existingSet.has(key)) continue;

    const priority: AlertPriority =
      found.includes("failure") || found.includes("crack") || found.includes("urgent")
        ? "HIGH"
        : found.includes("leak") || found.includes("corrosion")
        ? "MEDIUM"
        : "LOW";

    toInsert.push({
      tag:           row.tag,
      alert_type:    "KEYWORD_NOTE",
      priority,
      message:       `Equipment note contains: ${found.join(", ")}.`,
      status:        "OPEN",
      source_log_id: null,
    });
  }

  // ── Insert batch ─────────────────────────────────────────────
  if (toInsert.length > 0) {
    await supabase.from("alerts" as never).insert(toInsert as never);
  }
}

// ── Compute stats from loaded alerts ─────────────────────────────────────────

export function computeAlertStats(alerts: Alert[]): AlertStats {
  const open = alerts.filter((a) => a.status === "OPEN");
  return {
    total_open:     open.length,
    overdue:        open.filter((a) => a.alert_type === "OVERDUE_TEST").length,
    failed_tests:   open.filter((a) => a.alert_type === "FAILED_TEST").length,
    upcoming_tests: open.filter((a) => a.alert_type === "UPCOMING_TEST").length,
  };
}

// ── Backward-compatible alias used by Dashboard.tsx ───────────────────────────
export const getAlertStats = computeAlertStats;
