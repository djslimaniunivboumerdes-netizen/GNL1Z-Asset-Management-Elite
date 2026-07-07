import { idb } from "./db";
import { supabase } from "@/integrations/supabase/client";
import { runAlertEngine } from "./alertEngine";

let running = false;

export async function flushQueue(): Promise<{ logs: number; uploads: number; errors: number }> {
  if (running || !navigator.onLine) return { logs: 0, uploads: 0, errors: 0 };
  running = true;
  let logs = 0, uploads = 0, errors = 0;
  let hasUpdates = false;

  try {
    // Process Logs
    const pendingLogs = await idb.pendingLogs.toArray();
    for (const log of pendingLogs) {
      const { id, ...payload } = log;
      const { error } = await supabase.from("maintenance_logs").insert(payload);
      
      if (error) {
        errors++;
        console.error("[GNL1Z Sync] Failed to sync log:", error);
        // If it's a non-retriable client/auth/RLS error (e.g., 400, 401, 403, 409), remove from queue
        if (error.code && (error.code.startsWith("P") || error.code.startsWith("4"))) {
          console.warn(`[GNL1Z Sync] Non-retriable error (${error.code}). Discarding invalid log from queue.`);
          if (id) await idb.pendingLogs.delete(id);
        }
        continue;
      }
      
      if (id) await idb.pendingLogs.delete(id);
      logs++;
      hasUpdates = true;
    }

    // Process Uploads
    const pendingUploads = await idb.pendingUploads.toArray();
    for (const up of pendingUploads) {
      const path = `${up.tag}/${Date.now()}-${up.file_name}`;
      const { error: upErr } = await supabase.storage.from("equipment-photos").upload(path, up.blob, {
        contentType: up.mime_type,
        upsert: false,
      });

      if (upErr) {
        errors++;
        console.error("[GNL1Z Sync] Failed to upload photo:", upErr);
        if ((upErr as any).statusCode && (upErr as any).statusCode >= 400 && (upErr as any).statusCode < 500) {
          console.warn("[GNL1Z Sync] Non-retriable storage error. Discarding invalid upload from queue.");
          if (up.id) await idb.pendingUploads.delete(up.id);
        }
        continue;
      }

      const { error: insErr } = await supabase.from("equipment_images").insert({
        tag: up.tag,
        file_path: path,
        file_name: up.file_name,
        mime_type: up.mime_type,
        size_bytes: up.blob.size,
        uploaded_by: up.uploaded_by,
      });

      if (insErr) {
        errors++;
        console.error("[GNL1Z Sync] Failed to record photo metadata:", insErr);
        if (insErr.code && (insErr.code.startsWith("P") || insErr.code.startsWith("4"))) {
          if (up.id) await idb.pendingUploads.delete(up.id);
        }
        continue;
      }

      if (up.id) await idb.pendingUploads.delete(up.id);
      uploads++;
      hasUpdates = true;
    }

    // Run Alert Engine client-side if any logs or uploads were successfully synced
    if (hasUpdates) {
      try {
        await runAlertEngine();
        console.log("[GNL1Z Sync] Alert engine completed successfully post-sync.");
      } catch (alertErr) {
        console.error("[GNL1Z Sync] Alert engine encountered an error:", alertErr);
      }
    }

  } finally {
    running = false;
  }
  return { logs, uploads, errors };
}

export function initSync() {
  window.addEventListener("online", () => { void flushQueue(); });
  // Periodic retry every 60s
  setInterval(() => { void flushQueue(); }, 60_000);
  // Initial attempt
  setTimeout(() => { void flushQueue(); }, 2000);
}
