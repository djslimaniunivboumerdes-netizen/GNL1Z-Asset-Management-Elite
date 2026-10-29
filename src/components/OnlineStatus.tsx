import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudAlert, RefreshCw, WifiOff } from "lucide-react";
import { idb } from "@/lib/db";
import { flushQueue, getSyncStatus, SYNC_EVENT } from "@/lib/sync";
import { useI18n } from "@/contexts/I18nContext";

export function OnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(getSyncStatus);
  const { lang } = useI18n();
  const pending = useLiveQuery(async () => {
    const [logs, uploads] = await Promise.all([idb.pendingLogs.toArray(), idb.pendingUploads.toArray()]);
    return { count: logs.length + uploads.length, errors: [...logs, ...uploads].filter((item) => item.last_error).length };
  }, [], { count: 0, errors: 0 });
  useEffect(() => {
    const on = () => { setOnline(true); void flushQueue().catch(() => undefined); };
    const off = () => setOnline(false);
    const sync = () => setSyncing(getSyncStatus());
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(SYNC_EVENT, sync);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener(SYNC_EVENT, sync); };
  }, []);
  if (online && !pending.count) return null;
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const label = !online ? L("Offline", "Hors ligne") : pending.errors ? L("Sync needs attention", "Synchronisation à vérifier") : syncing ? L("Syncing", "Synchronisation") : L("Pending sync", "En attente");
  const Icon = !online ? WifiOff : pending.errors ? CloudAlert : RefreshCw;
  return <button type="button" disabled={!online || syncing || !pending.count} onClick={() => void flushQueue().catch(() => undefined)} title={`${label} · ${pending.count} ${L("records kept on this device", "dossiers conservés sur cet appareil")}`} aria-label={`${label}: ${pending.count}`} className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 text-xs text-amber-700 disabled:opacity-100 dark:text-amber-300"><Icon className={`h-3.5 w-3.5 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} /><span className="tabular-nums">{pending.count}</span><span className="sr-only">{label}</span></button>;
}
