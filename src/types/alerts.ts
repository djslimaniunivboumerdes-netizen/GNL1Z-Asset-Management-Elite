import type { Alert as DatabaseAlert } from "@/integrations/supabase/types";

// The database uses uppercase lifecycle values. Keep one contract throughout
// scheduling, reporting and persistence instead of silently comparing aliases.
export type Alert = DatabaseAlert;
export type AlertPriority = Alert["priority"];
export type AlertStatus = Alert["status"];
export type ScheduleStatus = "OVERDUE" | "DUE_SOON" | "OK" | "UNKNOWN";

export interface AlertFilter {
  priority?: AlertPriority;
  status?: AlertStatus;
  tag?: string;
  type?: string;
}

export interface AlertStats {
  total_open: number;
  overdue: number;
  failed_tests: number;
  upcoming_tests: number;
}

export interface ScheduleItem {
  tag: string;
  last_test: string | null;
  next_due: string | null;
  days_left: number | null;
  test_type: string | null;
  status: ScheduleStatus;
  source: "override" | "maintenance-log" | "register" | "unscheduled";
}

// These are fallback planning intervals for historical logs, not approved
// inspection procedures. New passed tests require an explicitly confirmed due
// date in LogTest. Always follow the facility's approved maintenance plan.
export const DEFAULT_INTERVALS = {
  hydrostatic: 365,
  pneumatic: 365,
  ultrasonic: 730,
  visual: 180,
  psv: 180,
  preventive: 90,
  default: 365,
};
