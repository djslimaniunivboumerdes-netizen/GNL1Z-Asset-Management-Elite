import { describe, expect, it } from "vitest";
import { addIntervalDays, calcStatus, daysUntilDate, mayAdvancePassedSchedule, parseDateOnly } from "@/lib/scheduleDates";

describe("calendar-date scheduling", () => {
  it("rejects impossible and non-calendar dates", () => {
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-2-01")).toBeNull();
    expect(parseDateOnly("2026-02-01T12:00:00Z")).toBeNull();
    expect(parseDateOnly("2028-02-29")?.toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("counts calendar days consistently across a daylight-saving transition", () => {
    const today = new Date(2026, 2, 7, 23, 59);
    expect(daysUntilDate("2026-03-08", today)).toBe(1);
    expect(daysUntilDate("2026-03-07", today)).toBe(0);
    expect(daysUntilDate("2026-03-06", today)).toBe(-1);
  });
  it("uses inclusive 30-day boundaries and never calls missing dates current", () => {
    expect(calcStatus(-1)).toBe("OVERDUE");
    expect(calcStatus(0)).toBe("DUE_SOON");
    expect(calcStatus(30)).toBe("DUE_SOON");
    expect(calcStatus(31)).toBe("OK");
    expect(calcStatus(null)).toBe("UNKNOWN");
  });
  it("adds intervals without local-time drift", () => {
    expect(addIntervalDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addIntervalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addIntervalDays("2026-01-01", 0)).toBeNull();
  });
});

describe("passed-test schedule advancement", () => {
  it("allows newer or same-day passed tests but not historical rollback", () => {
    expect(mayAdvancePassedSchedule(null, "2026-10-01")).toBe(true);
    expect(mayAdvancePassedSchedule("2026-09-01", "2026-10-01")).toBe(true);
    expect(mayAdvancePassedSchedule("2026-10-01", "2026-10-01")).toBe(true);
    expect(mayAdvancePassedSchedule("2026-10-20", "2026-10-01")).toBe(false);
    expect(mayAdvancePassedSchedule("2026-10-20", "invalid")).toBe(false);
  });
});
