import Dexie, { type Table } from "dexie";

export interface PendingLog {
  id?: number;
  client_id?: string;
  tag: string;
  performed_by: string | null;
  technician_name: string | null;
  test_date: string;
  test_type: "PREVENTIVE" | "CORRECTIVE";
  test_pressure_shell: number | null;
  test_pressure_tube: number | null;
  result: "PASS" | "FAIL" | "PENDING";
  notes: string | null;
  created_at: string;
  next_test_due?: string | null;
  last_error?: string | null;
}
export interface PendingUpload {
  id?: number;
  client_id?: string;
  upload_path?: string;
  tag: string;
  file_name: string;
  mime_type: string;
  blob: Blob;
  uploaded_by: string | null;
  created_at: string;
  last_error?: string | null;
}

class GnlDb extends Dexie {
  pendingLogs!: Table<PendingLog, number>;
  pendingUploads!: Table<PendingUpload, number>;
  constructor() {
    super("gnl1z");
    this.version(1).stores({ pendingLogs: "++id, tag, created_at", pendingUploads: "++id, tag, created_at" });
    // Preserve existing queued work while adding stable IDs for safe retries.
    this.version(2).stores({ pendingLogs: "++id, client_id, tag, created_at", pendingUploads: "++id, client_id, tag, created_at" })
      .upgrade(async (transaction) => {
        await transaction.table<PendingLog>("pendingLogs").toCollection().modify((log) => { log.client_id ??= crypto.randomUUID(); });
        await transaction.table<PendingUpload>("pendingUploads").toCollection().modify((upload) => {
          upload.client_id ??= crypto.randomUUID();
          upload.upload_path ??= `${upload.tag}/${upload.uploaded_by ?? "unknown"}/${upload.client_id}.webp`;
        });
      });
  }
}
export const idb = new GnlDb();
