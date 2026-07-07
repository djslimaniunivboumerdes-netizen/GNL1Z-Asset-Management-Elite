import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEquipmentByTag, isShellAndTube } from "@/data";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { idb } from "@/lib/db";
import { flushQueue } from "@/lib/sync";
import { toast } from "@/hooks/use-toast";
import NotFound from "./NotFound";

export default function LogTest() {
  const { tag = "" } = useParams();
  const eq = getEquipmentByTag(decodeURIComponent(tag));
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [testType, setTestType] = useState<"PREVENTIVE" | "CORRECTIVE">("PREVENTIVE");
  const [shellP, setShellP] = useState("");
  const [tubeP, setTubeP] = useState("");
  const [result, setResult] = useState<"PASS" | "FAIL" | "PENDING">("PASS");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!eq) return <NotFound />;
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const isExch = isShellAndTube(eq);

  const submit = async () => {
    setBusy(true);
    const payload = {
      tag: eq.tag,
      performed_by: user.id,
      technician_name: user.user_metadata?.full_name ?? user.email ?? null,
      test_date: testDate,
      test_type: testType,
      test_pressure_shell: shellP ? Number(shellP) : null,
      test_pressure_tube: isExch && tubeP ? Number(tubeP) : null,
      result,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    // Auto next-due
    const next = new Date(testDate);
    next.setFullYear(next.getFullYear() + (testType === "PREVENTIVE" ? 5 : 1));
    const nextStr = format(next, "yyyy-MM-dd");

    if (!navigator.onLine) {
      await idb.pendingLogs.add(payload);
      toast({ title: "Queued offline", description: "Will sync when connection returns." });
      setBusy(false);
      nav(`/equipment/${encodeURIComponent(eq.tag)}`);
      return;
    }

    const { error } = await supabase.from("maintenance_logs" as never).insert(payload as never);
    if (error) {
      // fall back to queue
      await idb.pendingLogs.add(payload);
      toast({ title: "Saved offline", description: error.message });
    } else {
      // update next due
      await supabase.from("equipment_test_dates").upsert({
        tag: eq.tag,
        last_tested: testDate,
        next_test_due: nextStr,
        updated_at: new Date().toISOString(),
      });
      toast({ title: "Test logged", description: `${result} · next due ${nextStr}` });
      void flushQueue();
    }
    setBusy(false);
    nav(`/equipment/${encodeURIComponent(eq.tag)}`);
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to={`/equipment/${encodeURIComponent(eq.tag)}`}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </Button>
      <div className="border border-border rounded-lg bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-display font-bold">Log maintenance test</h1>
        </div>
        <div className="font-mono text-xs text-muted-foreground mb-5">{eq.tag} — {eq.name}</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Test date</Label>
            <Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Test type</Label>
            <Select value={testType} onValueChange={(v) => setTestType(v as "PREVENTIVE" | "CORRECTIVE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PREVENTIVE">PREVENTIVE</SelectItem>
                <SelectItem value="CORRECTIVE">CORRECTIVE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isExch ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Test pressure — Shell (bar)</Label>
                <Input type="number" step="0.1" value={shellP} onChange={(e) => setShellP(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Test pressure — Tube (bar)</Label>
                <Input type="number" step="0.1" value={tubeP} onChange={(e) => setTubeP(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Test pressure (bar)</Label>
              <Input type="number" step="0.1" value={shellP} onChange={(e) => setShellP(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Result</Label>
            <Select value={result} onValueChange={(v) => setResult(v as "PASS" | "FAIL" | "PENDING")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">PASS</SelectItem>
                <SelectItem value="FAIL">FAIL</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </div>

        <Button onClick={submit} disabled={busy} className="mt-5 w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
          <Save className="h-4 w-4" /> Save record
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Next test due will be auto-calculated: PREVENTIVE +5y · CORRECTIVE +1y.
        </p>
      </div>
    </div>
  );
}
