import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldAlert, Filter, ArrowUpDown, MapPin, Camera, Calendar,
  AlertTriangle, AlertOctagon, AlertCircle, X, Plus, ChevronDown,
  ZoomIn, Pencil, Trash2, CheckCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ALERT_TYPES = [
  { value: "accident", label: "Accident", color: "bg-red-600" },
  { value: "almost_accident", label: "Almost Accident / Near Miss", color: "bg-orange-500" },
  { value: "leakage", label: "Leakage", color: "bg-blue-500" },
  { value: "dangerous", label: "Dangerous Situation", color: "bg-purple-600" },
  { value: "fire", label: "Fire / Explosion Risk", color: "bg-rose-700" },
  { value: "equipment_failure", label: "Equipment Failure", color: "bg-amber-600" },
  { value: "safety_violation", label: "Safety Violation", color: "bg-yellow-600" },
  { value: "other", label: "Other", color: "bg-gray-500" },
] as const;

const PRIORITIES = [
  { value: "P1", label: "P1 — Critical", color: "bg-red-600", textColor: "text-red-600", icon: AlertOctagon },
  { value: "P2", label: "P2 — High", color: "bg-orange-500", textColor: "text-orange-500", icon: AlertTriangle },
  { value: "P3", label: "P3 — Medium", color: "bg-yellow-500", textColor: "text-yellow-600", icon: AlertCircle },
] as const;

const TRAINS = ["T100", "T200", "T300", "T400", "T500", "T600"] as const;

// Sonatrach GL1Z HSE contact info from the uploaded photo
const SONATRACH_HSE = {
  title: "Presque accident / situation dangereuse",
  titleAr: "شبه حادث / حالة خطرة",
  titleEn: "Near miss / Dangerous situation",
  phones: ["5177", "5999", "5542"],
  instruction: "If you see a dangerous act, incident, near miss or dangerous situation, fill out a card and place it in the suggestion box.",
  instructionFr: "Si vous voyez un acte dangereux, un incident, un presque accident ou une situation dangereuse, remplissez une carte et placez-la dans la boîte à suggestions.",
  instructionAr: "إذا رأيت عملا خطيرا، حادثا، شبه حادث أو موقفا خطيرا، قم بملء البطاقة وضعها في صندوق الاقتراحات",
  urgent: "If urgent action is required, please inform the control post chief immediately or call",
};

interface FastAlert {
  id: string;
  alert_type: string;
  priority: string;
  location: string;
  description: string;
  photo_url: string | null;
  created_at: string;
  status: string;
}

type SortKey = "created_at" | "priority" | "alert_type" | "location";
type SortDir = "asc" | "desc";

export default function AlertCenter() {
  const [alerts, setAlerts] = useState<FastAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("OPEN");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCustomLocation, setEditCustomLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Form state
  const [alertType, setAlertType] = useState("");
  const [priority, setPriority] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fast_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAlerts(data as FastAlert[]);
    }
    setLoading(false);
  }

  async function convertHeicToJpeg(file: File): Promise<File> {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "heic" || ext === "heif") {
      const newName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
      return new File([file], newName, { type: "image/jpeg" });
    }
    return file;
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function submitAlert() {
    const finalLocation = location === "other" ? customLocation.trim() : location;
    if (!alertType || !priority || !finalLocation || !description.trim()) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    let photoUrl: string | null = null;
    if (photo) {
      const converted = await convertHeicToJpeg(photo);
      const fileExt = converted.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("alert-photos")
        .upload(fileName, converted);

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from("alert-photos")
          .getPublicUrl(fileName);
        photoUrl = urlData?.publicUrl ?? null;
      }
    }

    const { error } = await supabase.from("fast_alerts").insert({
      alert_type: alertType,
      priority: priority,
      location: finalLocation,
      description: description.trim(),
      photo_url: photoUrl,
      status: "OPEN",
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Failed to submit alert", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Alert submitted successfully" });
    setShowForm(false);
    resetForm();
    loadAlerts();
  }

  function resetForm() {
    setAlertType("");
    setPriority("");
    setLocation("");
    setCustomLocation("");
    setDescription("");
    setPhoto(null);
    setPhotoPreview(null);
  }

  function startEdit(alert: FastAlert) {
    setEditingId(alert.id);
    setEditType(alert.alert_type);
    setEditPriority(alert.priority);
    setEditLocation(TRAINS.includes(alert.location as any) ? alert.location : "other");
    setEditCustomLocation(TRAINS.includes(alert.location as any) ? "" : alert.location);
    setEditDescription(alert.description);
  }

  async function saveEdit() {
    if (!editingId || !editType || !editPriority) return;
    const finalLocation = editLocation === "other" ? editCustomLocation.trim() : editLocation;

    const { error } = await supabase
      .from("fast_alerts")
      .update({
        alert_type: editType,
        priority: editPriority,
        location: finalLocation,
        description: editDescription.trim(),
      })
      .eq("id", editingId);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Alert updated" });
    setEditingId(null);
    loadAlerts();
  }

  async function deleteAlert(id: string) {
    if (!confirm("Delete this alert?")) return;
    const { error } = await supabase.from("fast_alerts").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Alert deleted" });
  }

  async function closeAlert(id: string) {
    const { error } = await supabase
      .from("fast_alerts")
      .update({ status: "CLOSED" })
      .eq("id", id);
    if (error) {
      toast({ title: "Close failed", description: error.message, variant: "destructive" });
      return;
    }
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: "CLOSED" } : a));
    toast({ title: "Alert closed" });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const typeInfo = (type: string) => ALERT_TYPES.find((t) => t.value === type);
  const priorityInfo = (p: string) => PRIORITIES.find((pr) => pr.value === p);

  // Filter & sort
  let filtered = alerts.filter((a) => {
    if (filterPriority && a.priority !== filterPriority) return false;
    if (filterType && a.alert_type !== filterType) return false;
    if (filterLocation && !a.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.description.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.alert_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "created_at") {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortKey === "priority") {
      const order = { P1: 3, P2: 2, P3: 1 };
      cmp = (order[a.priority as keyof typeof order] ?? 0) - (order[b.priority as keyof typeof order] ?? 0);
    } else {
      cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const stats = {
    total: alerts.length,
    p1: alerts.filter((a) => a.priority === "P1").length,
    p2: alerts.filter((a) => a.priority === "P2").length,
    p3: alerts.filter((a) => a.priority === "P3").length,
    open: alerts.filter((a) => a.status === "OPEN").length,
    closed: alerts.filter((a) => a.status === "CLOSED").length,
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-red-500" />
          <div>
            <h1 className="text-3xl font-display font-bold">Fast Alerts Center</h1>
            <p className="text-sm text-muted-foreground">Safety incident reporting and tracking — GL1Z LNG Complex</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Report New Alert"}
        </Button>
      </div>

      {/* Sonatrach HSE Info Card */}
      <Card className="mb-6 border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="font-bold text-red-800">{SONATRACH_HSE.title}</h3>
              </div>
              <p className="text-sm text-red-700 mb-1">{SONATRACH_HSE.titleEn}</p>
              <p className="text-xs text-red-600 font-arabic" dir="rtl">{SONATRACH_HSE.titleAr}</p>
              <p className="text-xs text-muted-foreground mt-2">{SONATRACH_HSE.instruction}</p>
            </div>
            <div className="shrink-0 text-center md:text-right">
              <div className="text-xs text-red-700 font-medium mb-1">Emergency Hotline</div>
              <div className="text-2xl font-bold font-mono text-red-800">
                {SONATRACH_HSE.phones.join(" / ")}
              </div>
              <p className="text-[10px] text-red-600 mt-1">{SONATRACH_HSE.urgent}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} color="bg-zinc-500" />
        <StatCard label="P1 Critical" value={stats.p1} color="bg-red-600" />
        <StatCard label="P2 High" value={stats.p2} color="bg-orange-500" />
        <StatCard label="P3 Medium" value={stats.p3} color="bg-yellow-500" />
        <StatCard label="Open" value={stats.open} color="bg-blue-500" />
        <StatCard label="Closed" value={stats.closed} color="bg-emerald-500" />
      </div>

      {/* Submit Form */}
      {showForm && (
        <Card className="mb-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Report New Safety Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Alert Type *</label>
                <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select type...</option>
                  {ALERT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority *</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select priority...</option>
                  {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Location *</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select location...</option>
                  {TRAINS.map((t) => (<option key={t} value={t}>{t}</option>))}
                  <option value="other">Other (specify)</option>
                </select>
              </div>
            </div>
            {location === "other" && (
              <Input value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} placeholder="Enter location..." />
            )}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the safety incident in detail..." rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg hover:bg-secondary transition-colors text-sm">
                <Camera className="h-4 w-4" />
                {photo ? photo.name : "Choose photo (PNG, JPG, HEIC)..."}
                <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handlePhotoChange} />
              </label>
              {photoPreview && <img src={photoPreview} alt="Preview" className="h-16 w-16 object-cover rounded border border-border" />}
            </div>
            <Button onClick={submitAlert} disabled={submitting} className="w-full bg-red-600 hover:bg-red-700 text-white">
              {submitting ? "Submitting..." : "Submit Alert"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search alerts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-48 h-8 text-sm" />
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">All Types</option>
              {ALERT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
            <Input placeholder="Location..." value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-32 h-8 text-xs" />
            {(filterPriority || filterType || filterLocation || filterStatus || searchQuery) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterPriority(""); setFilterType(""); setFilterLocation(""); setFilterStatus(""); setSearchQuery(""); }}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading alerts...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ShieldAlert className="h-10 w-10 mx-auto mb-2 opacity-30" />
              No alerts found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider"><button onClick={() => toggleSort("priority")} className="flex items-center gap-1">Priority <ArrowUpDown className="h-3 w-3" /></button></th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider"><button onClick={() => toggleSort("alert_type")} className="flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3" /></button></th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider"><button onClick={() => toggleSort("location")} className="flex items-center gap-1">Location <ArrowUpDown className="h-3 w-3" /></button></th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider">Photo</th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider"><button onClick={() => toggleSort("created_at")} className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></button></th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((alert) => {
                    const type = typeInfo(alert.alert_type);
                    const pri = priorityInfo(alert.priority);
                    const PriIcon = pri?.icon ?? AlertCircle;
                    const isEditing = editingId === alert.id;

                    return (
                      <tr key={alert.id} className="hover:bg-secondary/20 transition-colors">
                        {isEditing ? (
                          <td colSpan={8} className="px-4 py-3">
                            <div className="space-y-2">
                              <div className="grid grid-cols-4 gap-2">
                                <select value={editType} onChange={(e) => setEditType(e.target.value)} className="h-9 rounded border px-2 text-xs">{ALERT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}</select>
                                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="h-9 rounded border px-2 text-xs">{PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}</select>
                                <select value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-9 rounded border px-2 text-xs">{TRAINS.map((t) => (<option key={t} value={t}>{t}</option>))}<option value="other">Other</option></select>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveEdit} className="h-9 text-xs">Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-9 text-xs">Cancel</Button>
                                </div>
                              </div>
                              {editLocation === "other" && <Input value={editCustomLocation} onChange={(e) => setEditCustomLocation(e.target.value)} placeholder="Location..." className="h-9 text-xs" />}
                              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="w-full rounded border px-2 py-1 text-xs resize-none" />
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><PriIcon className={`h-4 w-4 ${pri?.textColor ?? ""}`} /><Badge className={`${pri?.color ?? "bg-gray-500"} text-white border-0 text-xs`}>{pri?.label ?? alert.priority}</Badge></div></td>
                            <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{type?.label ?? alert.alert_type}</Badge></td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" />{alert.location}</div></td>
                            <td className="px-4 py-3 max-w-xs"><p className="text-xs text-foreground line-clamp-2">{alert.description}</p></td>
                            <td className="px-4 py-3">{alert.photo_url ? (
                              <button onClick={() => setZoomPhoto(alert.photo_url)} className="relative group">
                                <img src={alert.photo_url} alt="" className="h-10 w-10 object-cover rounded border border-border" />
                                <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn className="h-3 w-3 text-white" /></div>
                              </button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(alert.created_at).toLocaleDateString()}</div></td>
                            <td className="px-4 py-3"><Badge variant={alert.status === "OPEN" ? "default" : "secondary"} className="text-[10px]">{alert.status}</Badge></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(alert)}><Pencil className="h-3 w-3" /></Button>
                                {alert.status === "OPEN" && <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => closeAlert(alert.id)}><CheckCircle className="h-3 w-3" /></Button>}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAlert(alert.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zoom Modal */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomPhoto(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setZoomPhoto(null)}><X className="h-8 w-8" /></button>
          <img src={zoomPhoto} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} text-white rounded-lg p-3`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
            }
