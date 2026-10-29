import type { ScheduleStatus } from "@/types/alerts";

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a calendar date without introducing the browser's timezone. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !DATE_ONLY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

/** Whole calendar days, rather than date-fns' truncated 24-hour intervals. */
export function daysUntilDate(value: string | null | undefined, today = new Date()): number | null {
  const due = parseDateOnly(value);
  if (!due) return null;
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - current) / DAY_MS);
}

export function addIntervalDays(value: string, interval: number): string | null {
  const date = parseDateOnly(value);
  if (!date || !Number.isSafeInteger(interval) || interval < 1) return null;
  return new Date(date.getTime() + interval * DAY_MS).toISOString().slice(0, 10);
}

export function calcStatus(daysLeft: number | null): ScheduleStatus {
  if (daysLeft === null || !Number.isFinite(daysLeft)) return "UNKNOWN";
  if (daysLeft < 0) return "OVERDUE";
  if (daysLeft <= 30) return "DUE_SOON";
  return "OK";
}

/** A historical PASS may be recorded, but must not roll back a newer passed test. */
export function mayAdvancePassedSchedule(currentLast: string | null | undefined, testDate: string): boolean {
  const next = parseDateOnly(testDate);
  if (!next) return false;
  const current = parseDateOnly(currentLast);
  return !current || current.getTime() <= next.getTime();
}
