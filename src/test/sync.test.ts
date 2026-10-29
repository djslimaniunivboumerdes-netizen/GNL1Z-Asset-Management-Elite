import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { idb, type PendingLog } from "@/lib/db";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), insertLog: vi.fn(), insertImage: vi.fn(), upload: vi.fn(), readSchedule: vi.fn(), upsertSchedule: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: mocks.getSession },
    from: (table: string) => table === "maintenance_logs" ? { insert: mocks.insertLog } : table === "equipment_images" ? { insert: mocks.insertImage } : {
      select: () => ({ eq: () => ({ maybeSingle: mocks.readSchedule }) }),
      upsert: mocks.upsertSchedule,
    },
    storage: { from: () => ({ upload: mocks.upload }) },
  },
}));
import { flushQueue } from "@/lib/sync";

const log: PendingLog = {
  client_id: "11111111-1111-4111-8111-111111111111", tag: "X01-E-501", performed_by: "user-1", technician_name: "Test operator",
  test_date: "2026-10-01", test_type: "PREVENTIVE", test_pressure_shell: 10, test_pressure_tube: null,
  result: "PASS", notes: "Isolated test", created_at: "2026-10-01T10:00:00Z", next_test_due: "2027-10-01",
};

describe("failure-retaining offline sync", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await idb.pendingLogs.clear(); await idb.pendingUploads.clear();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    mocks.insertLog.mockResolvedValue({ error: null }); mocks.insertImage.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: null }); mocks.readSchedule.mockResolvedValue({ data: null, error: null });
    mocks.upsertSchedule.mockResolvedValue({ error: null });
  });
  afterEach(async () => { await idb.pendingLogs.clear(); await idb.pendingUploads.clear(); });

  it("retains records when there is no authenticated session", async () => {
    await idb.pendingLogs.add(log);
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await flushQueue();
    expect(await idb.pendingLogs.count()).toBe(1);
    expect(mocks.insertLog).not.toHaveBeenCalled();
  });
  it("never uploads another user's queued record", async () => {
    await idb.pendingLogs.add({ ...log, performed_by: "user-2" });
    await flushQueue();
    expect(await idb.pendingLogs.count()).toBe(1);
    expect(mocks.insertLog).not.toHaveBeenCalled();
  });
  it("retains permission failures with an actionable error", async () => {
    const localId = await idb.pendingLogs.add(log);
    mocks.insertLog.mockResolvedValue({ error: { code: "42501", message: "Permission denied" } });
    expect((await flushQueue()).errors).toBe(1);
    expect((await idb.pendingLogs.get(localId))?.last_error).toBe("Permission denied");
  });
  it("uses the same remote ID and removes a confirmed record", async () => {
    await idb.pendingLogs.add(log);
    await flushQueue();
    expect(mocks.insertLog).toHaveBeenCalledWith(expect.objectContaining({ id: log.client_id, tag: log.tag }));
    expect(mocks.insertLog.mock.calls[0][0]).not.toHaveProperty("next_test_due");
    expect(await idb.pendingLogs.count()).toBe(0);
  });
  it("accepts a previously committed duplicate after a dropped response", async () => {
    await idb.pendingLogs.add(log);
    mocks.insertLog.mockResolvedValue({ error: { code: "23505", message: "Duplicate key" } });
    await flushQueue();
    expect(await idb.pendingLogs.count()).toBe(0);
  });
  it("does not change the schedule for FAIL or PENDING records", async () => {
    for (const result of ["FAIL", "PENDING"] as const) {
      await idb.pendingLogs.clear();
      await idb.pendingLogs.add({ ...log, result });
      await flushQueue();
      expect(mocks.upsertSchedule).not.toHaveBeenCalled();
      expect(await idb.pendingLogs.count()).toBe(0);
    }
  });
  it("does not roll back a newer passed test when syncing historical work", async () => {
    await idb.pendingLogs.add(log);
    mocks.readSchedule.mockResolvedValue({ data: { last_tested: "2026-10-20" }, error: null });
    await flushQueue();
    expect(mocks.upsertSchedule).not.toHaveBeenCalled();
    expect(await idb.pendingLogs.count()).toBe(0);
  });
  it("retains a photo and its stable path when metadata persistence fails", async () => {
    const localId = await idb.pendingUploads.add({ client_id: "33333333-3333-4333-8333-333333333333", upload_path: "X01-E-501/33333333-3333-4333-8333-333333333333.webp", tag: log.tag, file_name: "test.webp", mime_type: "image/webp", blob: new Blob(["isolated"], { type: "image/webp" }), uploaded_by: "user-1", created_at: log.created_at });
    mocks.insertImage.mockResolvedValue({ error: { code: "42501", message: "Permission denied" } });
    await flushQueue();
    expect((await idb.pendingUploads.get(localId))?.last_error).toBe("Permission denied");
    mocks.insertImage.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: { message: "The resource already exists", statusCode: "409" } });
    await flushQueue();
    expect(mocks.upload.mock.calls[1][0]).toBe(mocks.upload.mock.calls[0][0]);
    expect(mocks.insertImage.mock.calls[1][0].id).toBe(mocks.insertImage.mock.calls[0][0].id);
    expect(await idb.pendingUploads.count()).toBe(0);
  });
});
