import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { EQUIPMENT } from "@/data";
import { DEFAULT_INTERVALS, type Alert, type AlertPriority, type AlertStats, type ScheduleItem } from "@/types/alerts";
import { addIntervalDays, daysUntilDate, parseDateOnly, calcStatus } from "./scheduleDates";

export { calcStatus };
const ALERT_KEYWORDS = ["leak", "corrosion", "crack", "vibration", "failure", "urgent"];

export function loadIntervalConfig() {
  const defaults = { ...DEFAULT_INTERVALS };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("gnl1z_test_intervals") ?? "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 36500) defaults[key] = value;
    }
  } catch { /* An unavailable or malformed preference must not break scheduling. */ }
  return defaults;
}

export function saveIntervalConfig(cfg: typeof DEFAULT_INTERVALS) {
  localStorage.setItem("gnl1z_test_intervals", JSON.stringify(cfg));
}

export function getIntervalDays(testType: string | null | undefined): number {
  const cfg = loadIntervalConfig();
  const type = (testType ?? "").toUpperCase();
  if (type.includes("PSV") || type.includes("SAFETY") || type.includes("VALVE")) return cfg.psv;
  if (type.includes("PREV")) return cfg.preventive;
  if (type.includes("PNEUM")) return cfg.pneumatic;
  if (type.includes("ULTRA")) return cfg.ultrasonic;
  if (type.includes("VISUAL")) return cfg.visual;
  return cfg.default;
}

function readableError(message: string): Error {
  return new Error(`Maintenance data could not be loaded. ${message}`);
}

/** Read-only schedule. A failed request is never presented as an empty schedule. */
export async function buildSchedule(today = new Date()): Promise<ScheduleItem[]> {
  if (!isSupabaseConfigured) {
    return EQUIPMENT.map((eq) => {
      const next = parseDateOnly(eq.maintenance.next_test_due)?.toISOString().slice(0, 10) ?? null;
      const days = daysUntilDate(next, today);
      return {
        tag: eq.tag, last_test: parseDateOnly(eq.maintenance.last_tested)?.toISOString().slice(0, 10) ?? null,
        next_due: next, days_left: days, status: calcStatus(days),
        test_type: null, source: next ? "register" : "unscheduled",
      };
    });
  }

  const [logsResult, datesResult] = await Promise.all([
    supabase.from("maintenance_logs").select("id, tag, test_date, test_type, result, created_at")
      .eq("result", "PASS").order("test_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("equipment_test_dates").select("tag, last_tested, next_test_due"),
  ]);
  if (logsResult.error) throw readableError(logsResult.error.message);
  if (datesResult.error) throw readableError(datesResult.error.message);

  const latestLog = new Map<string, NonNullable<typeof logsResult.data>[number]>();
  for (const row of logsResult.data ?? []) {
    if (row.tag && parseDateOnly(row.test_date) && !latestLog.has(row.tag)) latestLog.set(row.tag, row);
  }
  const overrides = new Map((datesResult.data ?? []).map((row) => [row.tag, row]));

  return EQUIPMENT.map((eq) => {
    const log = latestLog.get(eq.tag);
    const override = overrides.get(eq.tag);
    const last = override ? override.last_tested : log?.test_date ?? eq.maintenance.last_tested;
    const lastTest = parseDateOnly(last)?.toISOString().slice(0, 10) ?? null;
    // An existing override is authoritative, including a deliberately cleared due date.
    const rawDue = override ? override.next_test_due
      : lastTest ? addIntervalDays(lastTest, getIntervalDays(log?.test_type)) ?? eq.maintenance.next_test_due
      : eq.maintenance.next_test_due;
    const nextDue = parseDateOnly(rawDue)?.toISOString().slice(0, 10) ?? null;
    const days = daysUntilDate(nextDue, today);
    return {
      tag: eq.tag, last_test: lastTest, next_due: nextDue, days_left: days,
      test_type: log?.test_type ?? null, status: calcStatus(days),
      source: override ? "override" : log ? "maintenance-log" : nextDue ? "register" : "unscheduled",
    };
  });
}

/** Explicit, authenticated maintenance-alert generation; never run on a public page view. */
export async function runAlertEngine(): Promise<{ created: number }> {
  if (!isSupabaseConfigured) throw new Error("Connect Supabase before generating alerts.");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in before generating maintenance alerts.");

  // Include resolved alerts so refreshing a page cannot reopen resolved incidents.
  const [existingResult, failedResult, notesResult, schedule] = await Promise.all([
    supabase.from("alerts").select("id, tag, alert_type, source_log_id, status"),
    supabase.from("maintenance_logs").select("id, tag, test_date, test_type, notes").eq("result", "FAIL"),
    supabase.from("equipment_notes").select("tag, notes"),
    buildSchedule(),
  ]);
  for (const result of [existingResult, failedResult, notesResult]) {
    if (result.error) throw readableError(result.error.message);
  }
  const keyOf = (a: { tag: string; alert_type: string; source_log_id?: string | null }) => `${a.tag}::${a.alert_type}::${a.source_log_id ?? ""}`;
  const existing = new Set((existingResult.data ?? []).map(keyOf));
  const toInsert: Omit<Alert, "id" | "created_at" | "updated_at">[] = [];
  const add = (alert: typeof toInsert[number]) => {
    const key = keyOf(alert);
    if (existing.has(key)) return;
    existing.add(key);
    toInsert.push(alert);
  };

  for (const log of failedResult.data ?? []) {
    if (!log.tag) continue;
    add({ tag: log.tag, alert_type: "FAILED_TEST", priority: "HIGH",
      message: `Test FAILED on ${log.test_date ?? "unknown date"}${log.test_type ? ` (${log.test_type})` : ""}. ${log.notes ?? ""}`.trim(),
      status: "OPEN", source_log_id: log.id });
  }
  for (const item of schedule) {
    if (item.days_left === null) continue;
    if (item.status === "OVERDUE") {
      add({ tag: item.tag, alert_type: "OVERDUE_TEST", priority: "HIGH",
        message: `Test overdue by ${Math.abs(item.days_left)} day(s). Next due was ${item.next_due}.`, status: "OPEN", source_log_id: null });
    } else if (item.status === "DUE_SOON") {
      add({ tag: item.tag, alert_type: "UPCOMING_TEST", priority: item.days_left <= 7 ? "HIGH" : "MEDIUM",
        message: `Test due in ${item.days_left} day(s) on ${item.next_due}.`, status: "OPEN", source_log_id: null });
    }
  }
  for (const note of notesResult.data ?? []) {
    const found = ALERT_KEYWORDS.filter((word) => note.notes?.toLowerCase().includes(word));
    if (!found.length) continue;
    const priority: AlertPriority = found.some((word) => ["failure", "crack", "urgent"].includes(word)) ? "HIGH"
      : found.some((word) => ["leak", "corrosion"].includes(word)) ? "MEDIUM" : "LOW";
    add({ tag: note.tag, alert_type: "KEYWORD_NOTE", priority, message: `Equipment note contains: ${found.join(", ")}.`, status: "OPEN", source_log_id: null });
  }
  if (toInsert.length) {
    const { error } = await supabase.from("alerts").insert(toInsert);
    if (error) throw readableError(error.message);
  }
  return { created: toInsert.length };
}

export function computeAlertStats(alerts: Alert[]): AlertStats {
  const open = alerts.filter((alert) => alert.status === "OPEN");
  return {
    total_open: open.length,
    overdue: open.filter((alert) => alert.alert_type === "OVERDUE_TEST").length,
    failed_tests: open.filter((alert) => alert.alert_type === "FAILED_TEST").length,
    upcoming_tests: open.filter((alert) => alert.alert_type === "UPCOMING_TEST").length,
  };
}
export const getAlertStats = computeAlertStats;
