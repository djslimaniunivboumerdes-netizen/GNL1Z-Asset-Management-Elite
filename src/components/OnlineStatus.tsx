import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Wifi, WifiOff } from "lucide-react";
import { idb } from "@/lib/db";

export function OnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const pendingLogs = useLiveQuery(() => idb.pendingLogs.count(), [], 0);
  const pendingUploads = useLiveQuery(() => idb.pendingUploads.count(), [], 0);
  const queued = (pendingLogs ?? 0) + (pendingUploads ?? 0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && queued === 0) return null;

  return (
    <div
      className={`hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono ${
        online
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
      title={online ? "Online — syncing queue" : "Offline — changes are queued"}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? `SYNCING ${queued}` : queued > 0 ? `OFFLINE · ${queued}` : "OFFLINE"}
    </div>
  );
}
