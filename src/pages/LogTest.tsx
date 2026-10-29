import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getEquipmentByTag, isShellAndTube } from "@/data";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { idb, type PendingLog } from "@/lib/db";
import { flushQueue } from "@/lib/sync";
import { parseDateOnly } from "@/lib/scheduleDates";
import { toast } from "@/hooks/use-toast";
import NotFound from "./NotFound";

export default function LogTest() {
  const { tag = "" } = useParams();
  const eq = getEquipmentByTag(tag);
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [testDate, setTestDate] = useState(localToday);
  const [testType, setTestType] = useState<"PREVENTIVE" | "CORRECTIVE">("PREVENTIVE");
  const [nextDue, setNextDue] = useState("");
  const [shellP, setShellP] = useState("");
  const [tubeP, setTubeP] = useState("");
  const [result, setResult] = useState<PendingLog["result"]>("PASS");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <div role="status" className="p-10 text-sm text-muted-foreground">{L("Checking your session…", "Vérification de la session…")}</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!eq) return <NotFound />;
  const isExch = isShellAndTube(eq);
  const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

  const queue = async (payload: PendingLog) => {
    await idb.pendingLogs.add(payload);
    toast({ title: L("Saved on this device", "Enregistré sur cet appareil"), description: L("Not yet synced. Keep this device until the pending-sync indicator clears.", "Pas encore synchronisé. Conservez cet appareil jusqu'à la fin de la synchronisation.") });
    navigate(`/equipment/${encodeURIComponent(eq.tag)}`);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !user) return;
    setError("");
    if (!parseDateOnly(testDate) || testDate > localToday) { setError(L("Enter a valid test date, not in the future.", "Saisissez une date valide, pas dans le futur.")); return; }
    if (result === "PASS" && (!parseDateOnly(nextDue) || nextDue <= testDate)) { setError(L("Confirm the next due date from the approved maintenance plan. It must follow the passed test date.", "Confirmez la prochaine échéance du plan approuvé. Elle doit suivre la date de l'essai réussi.")); return; }
    const pressures = [shellP, ...(isExch ? [tubeP] : [])].filter((value) => value !== "").map(Number);
    if (pressures.some((value) => !Number.isFinite(value) || value < 0)) { setError(L("Pressure must be a finite, non-negative number.", "La pression doit être un nombre fini positif ou nul.")); return; }
    setBusy(true);
    const clientId = crypto.randomUUID();
    const payload: PendingLog = {
      client_id: clientId, tag: eq.tag, performed_by: user.id,
      technician_name: user.user_metadata?.full_name ?? user.email ?? null,
      test_date: testDate, test_type: testType,
      test_pressure_shell: shellP === "" ? null : Number(shellP),
      test_pressure_tube: isExch && tubeP !== "" ? Number(tubeP) : null,
      result, notes: notes.trim() || null, created_at: new Date().toISOString(),
      next_test_due: result === "PASS" ? nextDue : null,
    };
    try {
      if (!navigator.onLine) { await queue(payload); return; }
      const { client_id: _client, next_test_due, last_error: _lastError, ...row } = payload;
      const { error: insertError } = await supabase.from("maintenance_logs").insert({ ...row, id: clientId });
      if (insertError) throw insertError;
      // Failed and pending tests must never clear an existing overdue obligation.
      if (result === "PASS") {
        const { error: scheduleError } = await supabase.from("equipment_test_dates").upsert({
          tag: eq.tag, last_tested: testDate, next_test_due: nextDue, updated_at: new Date().toISOString(),
        }, { onConflict: "tag" });
        if (scheduleError) {
          await queryClient.invalidateQueries({ queryKey: ["maintenance-schedule"] });
          toast({ title: L("Test saved — confirm the due date", "Essai enregistré — confirmez l'échéance"), description: L("The schedule was not updated. Confirm the approved due date on the equipment page; do not submit this test again.", "L'échéance n'a pas été mise à jour. Confirmez la date approuvée sur la page équipement ; ne soumettez pas cet essai à nouveau."), variant: "destructive" });
          navigate(`/equipment/${encodeURIComponent(eq.tag)}`);
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["maintenance-schedule"] });
      toast({ title: L("Test record saved", "Essai enregistré"), description: result === "PASS" ? `${L("Next due", "Échéance")} ${nextDue}` : L("The existing due date was not changed.", "L'échéance existante n'a pas été modifiée.") });
      void flushQueue().catch(() => undefined);
      navigate(`/equipment/${encodeURIComponent(eq.tag)}`);
    } catch (cause) {
      // Network failures may be retried. Permission/validation failures stay on
      // the form so the operator can correct them instead of seeing a false success.
      if (cause instanceof TypeError) {
        try { await queue({ ...payload, last_error: cause.message }); } catch { setError(L("Device storage is unavailable. The record has not been saved; keep this form open.", "Stockage indisponible. Le dossier n'est pas enregistré ; gardez ce formulaire ouvert.")); }
      } else setError(cause instanceof Error ? cause.message : L("Save failed. The form has been kept open.", "Échec de l'enregistrement. Le formulaire reste ouvert."));
    } finally { setBusy(false); }
  };

  const select = (id: string, value: string, change: (value: string) => void, options: string[]) => <select id={id} value={value} onChange={(event) => change(event.target.value)} className={selectClass}>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  return <div className="mx-auto max-w-2xl px-4 py-6 md:py-8">
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link to={`/equipment/${encodeURIComponent(eq.tag)}`}><ArrowLeft className="mr-1 h-4 w-4" />{L("Back to equipment", "Retour à l'équipement")}</Link></Button>
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" /><h1 className="text-xl font-bold">{L("Log maintenance test", "Enregistrer un essai")}</h1></div><p className="mt-2 font-mono text-xs text-muted-foreground">{eq.tag} — {eq.name}</p></div>
      {!navigator.onLine && <p className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><WifiOff className="h-4 w-4" />{L("Offline: this record will be queued on this device.", "Hors ligne : ce dossier sera mis en attente sur cet appareil.")}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="test-date">{L("Test date", "Date de l'essai")} *</Label><Input id="test-date" required type="date" max={localToday} value={testDate} onChange={(event) => setTestDate(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="test-type">{L("Test type", "Type d'essai")}</Label>{select("test-type", testType, (value) => setTestType(value as typeof testType), ["PREVENTIVE", "CORRECTIVE"])}</div>
        <div className="space-y-2"><Label htmlFor="shell-pressure">{isExch ? L("Shell pressure (bar)", "Pression calandre (bar)") : L("Test pressure (bar)", "Pression d'essai (bar)")}</Label><Input id="shell-pressure" type="number" min="0" step="any" value={shellP} onChange={(event) => setShellP(event.target.value)} /></div>
        {isExch && <div className="space-y-2"><Label htmlFor="tube-pressure">{L("Tube pressure (bar)", "Pression faisceau (bar)")}</Label><Input id="tube-pressure" type="number" min="0" step="any" value={tubeP} onChange={(event) => setTubeP(event.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor="test-result">{L("Result", "Résultat")}</Label>{select("test-result", result, (value) => setResult(value as PendingLog["result"]), ["PASS", "FAIL", "PENDING"])}</div>
        {result === "PASS" && <div className="space-y-2"><Label htmlFor="next-due">{L("Confirmed next due", "Prochaine échéance confirmée")} *</Label><Input id="next-due" required type="date" min={testDate} value={nextDue} onChange={(event) => setNextDue(event.target.value)} aria-describedby="due-help" /></div>}
      </div>
      <p id="due-help" className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">{result === "PASS" ? L("Enter the next due date from the approved maintenance plan. No interval is assumed by this form.", "Saisissez l'échéance du plan de maintenance approuvé. Ce formulaire ne suppose aucun intervalle.") : L("Failed or pending results do not change the last passed test or next due date.", "Un résultat échoué ou en attente ne modifie ni le dernier essai réussi ni l'échéance.")}</p>
      <div className="space-y-2"><Label htmlFor="test-notes">{L("Notes", "Observations")}</Label><Textarea id="test-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={5000} placeholder={L("Observations, test conditions and follow-up actions…", "Observations, conditions d'essai et actions de suivi…")} /></div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full bg-cyan-700 text-white hover:bg-cyan-600"><Save className="h-4 w-4" />{busy ? L("Saving…", "Enregistrement…") : L("Save record", "Enregistrer")}</Button>
    </form>
  </div>;
}
