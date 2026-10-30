import { idb, type PendingLog, type PendingUpload } from "./db";
import { mayAdvancePassedSchedule } from "./scheduleDates";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

let running = false;
export const SYNC_EVENT = "gnl1z:sync-change";
const notify = () => window.dispatchEvent(new Event(SYNC_EVENT));
const messageOf = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Connection interrupted. Your record is still queued.";
};

/** Queue entries are removed only after confirmed persistence, never on auth/RLS errors. */
export async function flushQueue(): Promise<{ logs: number; uploads: number; errors: number }> {
  const result = { logs: 0, uploads: 0, errors: 0 };
  if (running || !navigator.onLine || !isSupabaseConfigured) return result;
  running = true;
  notify();
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return result;

    for (const log of await idb.pendingLogs.toArray()) {
      if (!log.id || log.performed_by !== user.id) continue;
      const clientId = log.client_id ?? crypto.randomUUID();
      try {
        const { client_id: _clientId, id: _localId, next_test_due, last_error: _error, ...payload } = log;
        const { error } = await supabase.from("maintenance_logs").insert({ ...payload, id: clientId });
        // A previous attempt may have committed before the connection dropped.
        if (error && error.code !== "23505") throw new Error(error.message);
        if (log.result === "PASS" && next_test_due) {
          const { data: current, error: readError } = await supabase.from("equipment_test_dates")
            .select("last_tested").eq("tag", log.tag).maybeSingle();
          if (readError) throw new Error(readError.message);
          // A queued historical test must not roll back a more recent passed test.
          if (mayAdvancePassedSchedule(current?.last_tested, log.test_date)) {
            const { error: scheduleError } = await supabase.from("equipment_test_dates").upsert({
              tag: log.tag, last_tested: log.test_date, next_test_due, updated_at: new Date().toISOString(),
            }, { onConflict: "tag" });
            if (scheduleError) throw new Error(scheduleError.message);
          }
        }
        await idb.pendingLogs.delete(log.id);
        result.logs++;
      } catch (error) {
        result.errors++;
        await idb.pendingLogs.update(log.id, { client_id: clientId, last_error: messageOf(error) });
      }
    }

    for (const upload of await idb.pendingUploads.toArray()) {
      if (!upload.id || upload.uploaded_by !== user.id) continue;
      const clientId = upload.client_id ?? crypto.randomUUID();
      const path = upload.upload_path ?? `${upload.tag}/${upload.uploaded_by ?? "unknown"}/${clientId}.webp`;
      try {
        await idb.pendingUploads.update(upload.id, { client_id: clientId, upload_path: path });
        const { error } = await supabase.storage.from("equipment-photos").upload(path, upload.blob, { contentType: upload.mime_type, upsert: false });
        // Stable, per-record paths make a repeated upload safe after a partial failure.
        if (error && !(error.message.toLowerCase().includes("already exists") || (error as { statusCode?: string }).statusCode === "409")) throw error;
        const { error: metadataError } = await supabase.from("equipment_images").insert({
          id: clientId, tag: upload.tag, file_path: path, file_name: upload.file_name,
          mime_type: upload.mime_type, size_bytes: upload.blob.size, uploaded_by: user.id, created_at: upload.created_at,
        });
        if (metadataError && metadataError.code !== "23505") throw metadataError;
        await idb.pendingUploads.delete(upload.id);
        result.uploads++;
      } catch (error) {
        result.errors++;
        await idb.pendingUploads.update(upload.id, { last_error: messageOf(error) });
      }
    }
    return result;
  } finally {
    running = false;
    notify();
  }
}

export function getSyncStatus() { return running; }

export function initSync(): () => void {
  const retry = () => { void flushQueue().catch(() => notify()); };
  window.addEventListener("online", retry);
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") window.setTimeout(retry, 0);
  });
  const interval = window.setInterval(retry, 60_000);
  const initial = window.setTimeout(retry, 2000);
  return () => {
    window.removeEventListener("online", retry);
    window.clearInterval(interval);
    window.clearTimeout(initial);
    data.subscription.unsubscribe();
  };
}

export type { PendingLog, PendingUpload };
