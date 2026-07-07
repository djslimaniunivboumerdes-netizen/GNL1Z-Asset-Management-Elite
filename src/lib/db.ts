import Dexie, { type Table } from "dexie";

export interface PendingLog {
  id?: number;
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
}

export interface PendingUpload {
  id?: number;
  tag: string;
  file_name: string;
  mime_type: string;
  blob: Blob;
  uploaded_by: string | null;
  created_at: string;
}

class GnlDb extends Dexie {
  pendingLogs!: Table<PendingLog, number>;
  pendingUploads!: Table<PendingUpload, number>;

  constructor() {
    super("gnl1z");
    this.version(1).stores({
      pendingLogs: "++id, tag, created_at",
      pendingUploads: "++id, tag, created_at",
    });
  }
}

export const idb = new GnlDb();
