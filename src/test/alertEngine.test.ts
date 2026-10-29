import { beforeEach, describe, expect, it, vi } from "vitest";
import { EQUIPMENT } from "@/data";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}));
import { buildSchedule, runAlertEngine } from "@/lib/alertEngine";

const tag = EQUIPMENT[0].tag;
const today = new Date(2026, 9, 29);

describe("maintenance schedule integration contract", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it("uses only PASS logs and the latest test date", async () => {
    const tables: Record<string, unknown[]> = {
      maintenance_logs: [{ id: "new", tag, test_date: "2026-10-01", test_type: "PREVENTIVE", result: "PASS", created_at: "2026-10-01T12:00:00Z" }],
      equipment_test_dates: [],
    };
    mocks.from.mockImplementation((name: string) => {
      const builder = { select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: tables[name] ?? [], error: null }).then(resolve) };
      return builder;
    });
    const [item] = await buildSchedule(today);
    expect(item.last_test).toBe("2026-10-01");
    expect(item.source).toBe("maintenance-log");
    expect(item.next_due).not.toBeNull();
    expect(mocks.from).toHaveBeenCalledWith("maintenance_logs");
  });
  it("treats a cleared confirmed due date as authoritative, not up to date", async () => {
    mocks.from.mockImplementation((name: string) => {
      const data = name === "equipment_test_dates" ? [{ tag, last_tested: "2026-10-01", next_test_due: null }] : [];
      const builder = { select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
      return builder;
    });
    const [item] = await buildSchedule(today);
    expect(item.next_due).toBeNull();
    expect(item.status).toBe("UNKNOWN");
    expect(item.source).toBe("override");
  });
  it("propagates a failed query instead of returning an empty healthy schedule", async () => {
    mocks.from.mockImplementation(() => {
      const builder = { select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "Backend paused" } }).then(resolve) };
      return builder;
    });
    await expect(buildSchedule(today)).rejects.toThrow("Backend paused");
  });
  it("does not generate alerts for an unauthenticated visitor", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(runAlertEngine()).rejects.toThrow("Sign in");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
