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
import { useI18n } from "@/contexts/I18nContext";

const ALERT_TYPES = [
  { value: "accident", labelEn: "Accident", labelFr: "Accident", color: "bg-red-600" },
  { value: "almost_accident", labelEn: "Near Miss", labelFr: "Presque Accident", color: "bg-orange-500" },
  { value: "leakage", labelEn: "Leakage", labelFr: "Fuite", color: "bg-blue-500" },
  { value: "dangerous", labelEn: "Dangerous Situation", labelFr: "Situation Dangereuse", color: "bg-purple-600" },
  { value: "fire", labelEn: "Fire / Explosion Risk", labelFr: "Risque Incendie / Explosion", color: "bg-rose-700" },
  { value: "equipment_failure", labelEn: "Equipment Failure", labelFr: "Défaillance Équipement", color: "bg-amber-600" },
  { value: "safety_violation", labelEn: "Safety Violation", labelFr: "Violation Sécurité", color: "bg-yellow-600" },
  { value: "other", labelEn: "Other", labelFr: "Autre", color: "bg-gray-500" },
] as const;

const PRIORITIES = [
  { value: "P1", labelEn: "P1 — Critical", labelFr: "P1 — Critique", color: "bg-red-600", textColor: "text-red-600", icon: AlertOctagon },
  { value: "P2", labelEn: "P2 — High", labelFr: "P2 — Haute", color: "bg-orange-500", textColor: "text-orange-500", icon: AlertTriangle },
  { value: "P3", labelEn: "P3 — Medium", labelFr: "P3 — Moyenne", color: "bg-yellow-500", textColor: "text-yellow-600", icon: AlertCircle },
] as const;

const TRAINS = ["T100", "T200", "T300", "T400", "T500", "T600"] as const;

const SONATRACH_HSE = {
  title: "Presque accident / situation dangereuse",
  titleAr: "شبه حادث / حالة خطرة",
  titleEn: "Near miss / Dangerous situation",
  phones: ["5177", "5999", "5542"],
  instructionEn: "If you see a dangerous act, incident, near miss or dangerous situation, fill out a card and place it in the suggestion box.",
  instructionFr: "Si vous voyez un acte dangereux, un incident, un presque accident ou une situation dangereuse, remplissez une carte et placez-la dans la boîte à suggestions.",
  instructionAr: "إذا رأيت عملا خطيرا، حادثا، شبه حادث أو موقفا خطيرا، قم بملء البطاقة وضعها في صندوق الاقتراحات",
  urgentEn: "If urgent action is required, please inform the control post chief immediately or call",
  urgentFr: "En cas d'urgence, informez immédiatement le chef d'entité ou appelez le",
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

export default function FastAlertDashboardWidget() {
  const [alerts, setAlerts] = useState<FastAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const { t, lang } = useI18n();

  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("OPEN");
  const [searchQuery, setSearchQuery] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCustomLocation, setEditCustomLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
      toast({ title: lang === "en" ? "Please fill all required fields" : "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
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
      toast({ title: lang === "en" ? "Failed to submit alert" : "Échec d'envoi", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: lang === "en" ? "Alert submitted successfully" : "Alerte soumise avec succès" });
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
      toast({ title: lang === "en" ? "Update failed" : "Échec de mise à jour", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: lang === "en" ? "Alert updated" : "Alerte mise à jour" });
    setEditingId(null);
    loadAlerts();
  }

  async function deleteAlert(id: string) {
    if (!confirm(lang === "en" ? "Delete this alert?" : "Supprimer cette alerte ?")) return;
    const { error } = await supabase.from("fast_alerts").delete().eq("id", id);
    if (error) {
      toast({ title: lang === "en" ? "Delete failed" : "Échec de suppression", description: error.message, variant: "destructive" });
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast({ title: lang === "en" ? "Alert deleted" : "Alerte supprimée" });
  }

  async function closeAlert(id: string) {
    const { error } = await supabase
      .from("fast_alerts")
      .update({ status: "CLOSED" })
      .eq("id", id);
    if (error) {
      toast({ title: lang === "en" ? "Close failed" : "Échec de clôture", description: error.message, variant: "destructive" });
      return;
    }
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: "CLOSED" } : a));
    toast({ title: lang === "en" ? "Alert closed" : "Alerte clôturée" });
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
    <div className="py-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{lang === "en" ? "Fast Alerts Center" : "Centre d'Alertes Rapides"}</h1>
            <p className="text-sm text-slate-400 font-light">{lang === "en" ? "Safety incident reporting and tracking — GL1Z LNG Complex" : "Signalement et suivi des incidents de sécurité — Complexe GNL GL1Z"}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-5 py-3 shadow-lg shadow-rose-600/20 font-mono text-xs transition-all">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? (lang === "en" ? "Cancel" : "Annuler") : (lang === "en" ? "Report New Alert" : "Signaler une Alerte")}
        </Button>
      </div>

      <Card className="border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent backdrop-blur-md rounded-2xl shadow-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-6 w-6 text-rose-500 animate-pulse" />
                <h3 className="font-bold text-lg text-white tracking-tight">{SONATRACH_HSE.title}</h3>
              </div>
              <p className="text-sm text-slate-300 font-medium mb-1">{SONATRACH_HSE.titleEn}</p>
              <p className="text-xs text-rose-400 font-arabic font-bold" dir="rtl">{SONATRACH_HSE.titleAr}</p>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed font-light">{lang === "en" ? SONATRACH_HSE.instructionEn : SONATRACH_HSE.instructionFr}</p>
            </div>
            <div className="shrink-0 text-center md:text-right bg-slate-950/60 border border-slate-800 rounded-2xl p-6 shadow-inner">
              <div className="text-xs text-rose-400 font-mono font-bold mb-1">{lang === "en" ? "Emergency Hotline" : "Numéro d'Urgence"}</div>
              <div className="text-2xl font-extrabold font-mono text-white tracking-widest">
                {SONATRACH_HSE.phones.join(" / ")}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 max-w-[220px] leading-snug font-light">{lang === "en" ? SONATRACH_HSE.urgentEn : SONATRACH_HSE.urgentFr}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard label={lang === "en" ? "Total" : "Total"} value={stats.total} color="bg-slate-900 border-slate-800 text-white" />
        <StatCard label={lang === "en" ? "P1 Critical" : "P1 Critique"} value={stats.p1} color="bg-rose-500/20 border-rose-500/30 text-rose-400" />
        <StatCard label={lang === "en" ? "P2 High" : "P2 Haute"} value={stats.p2} color="bg-orange-500/20 border-orange-500/30 text-orange-400" />
        <StatCard label={lang === "en" ? "P3 Medium" : "P3 Moyenne"} value={stats.p3} color="bg-amber-500/20 border-amber-500/30 text-amber-400" />
        <StatCard label={lang === "en" ? "Open" : "En Cours"} value={stats.open} color="bg-cyan-500/20 border-cyan-500/30 text-cyan-400" />
        <StatCard label={lang === "en" ? "Closed" : "Clôturé"} value={stats.closed} color="bg-emerald-500/20 border-emerald-500/30 text-emerald-400" />
      </div>

      {showForm && (
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl">
          <CardHeader className="px-6 pt-6 pb-4 border-b border-slate-800">
            <CardTitle className="text-lg flex items-center gap-2 text-white font-display">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              {lang === "en" ? "Report New Safety Alert" : "Déclarer une Nouvelle Alerte de Sécurité"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pt-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-xs font-mono font-bold text-slate-400 mb-2 block">{lang === "en" ? "Alert Type *" : "Type d'Alerte *"}</label>
                <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors">
                  <option value="">{lang === "en" ? "Select type..." : "Sélectionner le type..."}</option>
                  {ALERT_TYPES.map((t) => (<option key={t.value} value={t.value}>{lang === "en" ? t.labelEn : t.labelFr}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-slate-400 mb-2 block">{lang === "en" ? "Priority *" : "Priorité *"}</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors">
                  <option value="">{lang === "en" ? "Select priority..." : "Sélectionner la priorité..."}</option>
                  {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{lang === "en" ? p.labelEn : p.labelFr}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-slate-400 mb-2 block">{lang === "en" ? "Location *" : "Localisation *"}</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors">
                  <option value="">{lang === "en" ? "Select location..." : "Sélectionner la localisation..."}</option>
                  {TRAINS.map((t) => (<option key={t} value={t}>{t}</option>))}
                  <option value="other">{lang === "en" ? "Other (specify)" : "Autre (spécifier)"}</option>
                </select>
              </div>
            </div>
            {location === "other" && (
              <Input value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} placeholder={lang === "en" ? "Enter location..." : "Entrer la localisation..."} className="h-11 bg-slate-950 border-slate-700 text-white rounded-xl" />
            )}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={lang === "en" ? "Describe the safety incident in detail..." : "Décrire l'incident de sécurité en détail..."} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors resize-none" />
            <div className="flex items-center gap-4">
              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 border border-dashed border-slate-700 bg-slate-950 hover:bg-slate-800/80 rounded-xl transition-colors text-sm text-slate-300 font-mono">
                <Camera className="h-4 w-4 text-cyan-500" />
                {photo ? photo.name : (lang === "en" ? "Choose photo (PNG, JPG, HEIC)..." : "Choisir une photo (PNG, JPG, HEIC)...")}
                <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handlePhotoChange} />
              </label>
              {photoPreview && <img src={photoPreview} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-slate-700 shadow-lg" />}
            </div>
            <Button onClick={submitAlert} disabled={submitting} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl py-6 text-sm transition-all shadow-lg shadow-rose-600/20">
              {submitting ? (lang === "en" ? "Submitting..." : "Envoi en cours...") : (lang === "en" ? "Submit Alert" : "Transmettre l'Alerte")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm rounded-2xl shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-slate-400" />
            <Input placeholder={lang === "en" ? "Search alerts..." : "Rechercher une alerte..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-48 h-10 bg-slate-950 border-slate-700 text-white rounded-xl text-xs font-mono" />
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white font-mono">
              <option value="">{lang === "en" ? "All Priorities" : "Toutes Priorités"}</option>
              {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{lang === "en" ? p.labelEn : p.labelFr}</option>))}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white font-mono">
              <option value="">{lang === "en" ? "All Types" : "Tous Types"}</option>
              {ALERT_TYPES.map((t) => (<option key={t.value} value={t.value}>{lang === "en" ? t.labelEn : t.labelFr}</option>))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white font-mono">
              <option value="">{lang === "en" ? "All Statuses" : "Tous Statuts"}</option>
              <option value="OPEN">{lang === "en" ? "Open" : "En Cours"}</option>
              <option value="CLOSED">{lang === "en" ? "Closed" : "Clôturé"}</option>
            </select>
            <Input placeholder={lang === "en" ? "Location..." : "Lieu..."} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-32 h-10 bg-slate-950 border-slate-700 text-white rounded-xl text-xs font-mono" />
            {(filterPriority || filterType || filterLocation || filterStatus || searchQuery) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterPriority(""); setFilterType(""); setFilterLocation(""); setFilterStatus(""); setSearchQuery(""); }} className="h-10 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl px-3">
                <X className="h-3 w-3 mr-1" /> {lang === "en" ? "Clear" : "Effacer"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-mono text-sm">{t("loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono">
              <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-rose-500/40 animate-pulse" />
              {lang === "en" ? "No alerts found matching your filters." : "Aucune alerte trouvée pour ces filtres."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-xs">
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider"><button onClick={() => toggleSort("priority")} className="flex items-center gap-1.5 hover:text-cyan-400">{lang === "en" ? "Priority" : "Priorité"} <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider"><button onClick={() => toggleSort("alert_type")} className="flex items-center gap-1.5 hover:text-cyan-400">{lang === "en" ? "Type" : "Type"} <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider"><button onClick={() => toggleSort("location")} className="flex items-center gap-1.5 hover:text-cyan-400">{lang === "en" ? "Location" : "Localisation"} <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">{lang === "en" ? "Description" : "Description"}</th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">{lang === "en" ? "Photo" : "Photo"}</th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider"><button onClick={() => toggleSort("created_at")} className="flex items-center gap-1.5 hover:text-cyan-400">{lang === "en" ? "Date" : "Date"} <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">{lang === "en" ? "Status" : "Statut"}</th>
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">{lang === "en" ? "Actions" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                  {filtered.map((alert) => {
                    const type = typeInfo(alert.alert_type);
                    const pri = priorityInfo(alert.priority);
                    const PriIcon = pri?.icon ?? AlertCircle;
                    const isEditing = editingId === alert.id;

                    return (
                      <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors">
                        {isEditing ? (
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-3 bg-slate-900 p-4 rounded-2xl border border-slate-700">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <select value={editType} onChange={(e) => setEditType(e.target.value)} className="h-10 rounded-xl bg-slate-950 border border-slate-700 px-3 text-xs text-white">{ALERT_TYPES.map((t) => (<option key={t.value} value={t.value}>{lang === "en" ? t.labelEn : t.labelFr}</option>))}</select>
                                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="h-10 rounded-xl bg-slate-950 border border-slate-700 px-3 text-xs text-white">{PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{lang === "en" ? p.labelEn : p.labelFr}</option>))}</select>
                                <select value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-10 rounded-xl bg-slate-950 border border-slate-700 px-3 text-xs text-white">{TRAINS.map((t) => (<option key={t} value={t}>{t}</option>))}<option value="other">{lang === "en" ? "Other" : "Autre"}</option></select>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveEdit} className="h-10 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl flex-1">{lang === "en" ? "Save" : "Enregistrer"}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-10 text-xs text-slate-400 hover:text-white rounded-xl flex-1">{lang === "en" ? "Cancel" : "Annuler"}</Button>
                                </div>
                              </div>
                              {editLocation === "other" && <Input value={editCustomLocation} onChange={(e) => setEditCustomLocation(e.target.value)} placeholder={lang === "en" ? "Location..." : "Lieu..."} className="h-10 bg-slate-950 border-slate-700 text-white rounded-xl text-xs" />}
                              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white resize-none" />
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-6 py-4"><div className="flex items-center gap-2.5"><PriIcon className={`h-4 w-4 ${pri?.textColor ?? ""}`} /><Badge className={`${pri?.color ?? "bg-gray-500"} text-white border-0 text-xs font-mono px-2.5 py-1 rounded-full`}>{lang === "en" ? pri?.labelEn : pri?.labelFr}</Badge></div></td>
                            <td className="px-6 py-4"><Badge variant="outline" className="text-xs font-mono border-slate-700 bg-slate-900 text-slate-200 px-2.5 py-1 rounded-full">{lang === "en" ? type?.labelEn : type?.labelFr}</Badge></td>
                            <td className="px-6 py-4"><div className="flex items-center gap-1.5 text-xs font-mono text-slate-300"><MapPin className="h-3.5 w-3.5 text-cyan-500" />{alert.location}</div></td>
                            <td className="px-6 py-4 max-w-xs"><p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-light">{alert.description}</p></td>
                            <td className="px-6 py-4">{alert.photo_url ? (
                              <button onClick={() => setZoomPhoto(alert.photo_url)} className="relative group block overflow-hidden rounded-xl border border-slate-700">
                                <img src={alert.photo_url} alt="" className="h-11 w-11 object-cover transform group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn className="h-4 w-4 text-white" /></div>
                              </button>
                            ) : <span className="text-xs text-slate-600 font-mono">—</span>}</td>
                            <td className="px-6 py-4"><div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono"><Calendar className="h-3.5 w-3.5 text-slate-500" />{new Date(alert.created_at).toLocaleDateString()}</div></td>
                            <td className="px-6 py-4"><Badge variant={alert.status === "OPEN" ? "default" : "secondary"} className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${alert.status === "OPEN" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>{alert.status === "OPEN" ? (lang === "en" ? "OPEN" : "EN COURS") : (lang === "en" ? "CLOSED" : "CLÔTURÉ")}</Badge></td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl" onClick={() => startEdit(alert)}><Pencil className="h-3.5 w-3.5" /></Button>
                                {alert.status === "OPEN" && <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded-xl" onClick={() => closeAlert(alert.id)}><CheckCircle className="h-3.5 w-3.5" /></Button>}
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-xl" onClick={() => deleteAlert(alert.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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

      {zoomPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setZoomPhoto(null)}>
          <button className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-900 p-3 rounded-2xl border border-slate-800 transition-all" onClick={() => setZoomPhoto(null)}><X className="h-6 w-6" /></button>
          <img src={zoomPhoto} alt="Full size" className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`border rounded-2xl p-4 backdrop-blur-sm shadow-lg ${color}`}>
      <div className="text-[11px] uppercase tracking-wider font-mono opacity-80 mb-1">{label}</div>
      <div className="text-2xl md:text-3xl font-extrabold font-mono tracking-tight">{value}</div>
    </div>
  );
}
