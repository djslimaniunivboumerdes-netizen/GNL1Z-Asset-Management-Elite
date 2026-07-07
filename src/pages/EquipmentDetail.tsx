import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Fuse from "fuse.js";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Copy, Check, Download, Wrench, Anchor, Snowflake, Package, Info, Search, FileText, Save, CalendarIcon, ExternalLink, QrCode, X, ShieldCheck, Plus, Trash2, Beaker, Gauge, Sparkles, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getEquipmentByTag, isShellAndTube, type SparePart, type Equipment } from "@/data";
import { buildEngineeringJudgment, type RiskTier } from "@/lib/engineeringJudgment";
import {
  predictWrench, predictToolKit, suggestShackle, safetyLoadKg,
  insulationRecommendation, exportToCsv, defaultBoltForType, recommendCrane,
} from "@/lib/industrial";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SvgQr } from "@/components/SvgQr";
import { ImageGallery } from "@/components/ImageGallery";
import { MaintenanceTimeline } from "@/components/MaintenanceTimeline";
import { EquipmentTestStatus } from "@/components/EquipmentTestStatus";
import NotFound from "./NotFound";


const TRAINS = ["T100", "T200", "T300", "T400", "T500", "T600"];

export default function EquipmentDetail() {
  const { tag = "" } = useParams();
  const { t, lang } = useI18n();
  const eq = getEquipmentByTag(decodeURIComponent(tag));

  const [qrOpen, setQrOpen] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [train, setTrain] = useState("T100");
  const [savingNote, setSavingNote] = useState(false);

  if (!eq) return <NotFound />;

  const boltSize = defaultBoltForType(eq.type.code);
  const wrench = predictWrench(boltSize);
  const tools = predictToolKit(boltSize);
  const shackle = suggestShackle(eq.technical.weight_kg);
  const safety = safetyLoadKg(eq.technical.weight_kg);
  const insulation = insulationRecommendation(eq.type.code, eq.technical.temperature_c);
  const crane = recommendCrane(eq.technical.weight_kg);
  const judgment = useMemo(() => buildEngineeringJudgment(eq), [eq]);

  const pageUrl = `${window.location.origin}/equipment/${encodeURIComponent(eq.tag)}`;

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("equipment_notes")
        .select("*")
        .eq("tag", eq.tag)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Notes load error:", error.message);
      }

      if (active) setNotes(data ?? []);
    })();

    return () => {
      active = false;
    };
  }, [eq.tag]);

  const addNote = async () => {
    if (!newNote.trim()) return;

    setSavingNote(true);

    const { error } = await supabase.from("equipment_notes").insert({
      tag: eq.tag,
      train,
      note: newNote.trim(),
    });

    setSavingNote(false);

    if (error) {
      toast({
        title: lang === "en" ? "Error" : "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setNewNote("");

    const { data } = await supabase
      .from("equipment_notes")
      .select("*")
      .eq("tag", eq.tag)
      .order("created_at", { ascending: false });

    setNotes(data ?? []);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase
      .from("equipment_notes")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: lang === "en" ? "Delete failed" : "Échec de suppression",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl px-3 py-2">
        <Link to="/equipment"><ArrowLeft className="h-4 w-4 mr-2" /> {t("back")}</Link>
      </Button>

      {/* Hero Header */}
      <div className="relative overflow-hidden border border-slate-800 rounded-3xl bg-slate-900/60 p-6 md:p-10 shadow-2xl backdrop-blur-md text-white">
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-cyan-400 mb-2 font-bold">{eq.type.name}</div>
              <div className="flex items-center gap-4">
                <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-white">{eq.tag}</h1>
                <button
                  onClick={() => setQrOpen(!qrOpen)}
                  title={lang === "en" ? "QR Code" : "Code QR"}
                  className="shrink-0 h-11 w-11 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-all shadow-md cursor-pointer"
                >
                  {qrOpen ? <X className="h-5 w-5 text-white" /> : <QrCode className="h-5 w-5 text-cyan-400" />}
                </button>
              </div>
              <p className="text-slate-300 mt-3 max-w-2xl text-base leading-relaxed font-light">{eq.name}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Badge className="bg-slate-800 border border-slate-700 text-slate-200 font-mono px-3 py-1 rounded-full text-xs">{eq.unit}</Badge>
              <Badge className="bg-slate-800 border border-slate-700 text-slate-200 font-mono px-3 py-1 rounded-full text-xs">{eq.section}</Badge>
              <Badge className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono px-3 py-1 rounded-full text-xs">{eq.testing_status}</Badge>
            </div>
          </div>

          {qrOpen && (
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start gap-6 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl p-3 shadow-2xl shrink-0">
                <SvgQr value={pageUrl} size={180} />
              </div>
              <div className="text-slate-300 space-y-3 text-sm">
                <div className="font-bold text-white text-lg tracking-tight">{eq.tag} — {lang === "en" ? "QR Code" : "Code QR"}</div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm font-light">
                  {lang === "en" ? "Scan with any phone camera to open this page. Print at ≥ 4×4 cm for reliable scanning." : "Scannez avec l'appareil photo d'un téléphone pour ouvrir cette page. Imprimez à ≥ 4×4 cm pour un scan fiable."}
                </p>
                <div className="font-mono text-xs text-slate-500 break-all max-w-sm bg-slate-950 p-3 rounded-xl border border-slate-800">{pageUrl}</div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => navigator.clipboard.writeText(pageUrl)}
                    className="inline-flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 transition-all shadow-md font-mono font-bold cursor-pointer"
                  >
                    <Copy className="h-4 w-4 text-cyan-400" /> {lang === "en" ? "Copy URL" : "Copier l'URL"}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 transition-all shadow-md font-mono font-bold cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-emerald-400" /> {lang === "en" ? "Print" : "Imprimer"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="tech" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-1.5 shadow-lg backdrop-blur-sm">
          <TabsTrigger value="tech" className="gap-2 text-xs font-mono py-2.5 px-4 rounded-xl data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400 transition-all"><Info className="h-4 w-4" /> {t("techInfo")}</TabsTrigger>
          <TabsTrigger value="pdr" className="gap-2 text-xs font-mono py-2.5 px-4 rounded-xl data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400 transition-all"><Package className="h-4 w-4" /> {t("pdr")}</TabsTrigger>
          <TabsTrigger value="tools" className="gap-2 text-xs font-mono py-2.5 px-4 rounded-xl data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400 transition-all"><Wrench className="h-4 w-4" /> {t("toolPredictor")}</TabsTrigger>
          <TabsTrigger value="lifting" className="gap-2 text-xs font-mono py-2.5 px-4 rounded-xl data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400 transition-all"><Anchor className="h-4 w-4" /> {t("lifting")}</TabsTrigger>
          <TabsTrigger value="insulation" className="gap-2 text-xs font-mono py-2.5 px-4 rounded-xl data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400 transition-all"><Snowflake className="h-4 w-4" /> {t("insulation")}</TabsTrigger>
          <TabsTrigger value="judgment" className="gap-2 text-xs font-mono py-2.5 px-4 rounded-xl data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-400 transition-all"><Sparkles className="h-4 w-4" /> {lang === "en" ? "AI Judgment" : "Jugement IA"}</TabsTrigger>
        </TabsList>

        <TabsContent value="tech" className="mt-6 space-y-6">
          <TechInfoTab eq={eq} />
        </TabsContent>

        <TabsContent value="pdr" className="mt-6"><PdrTab parts={eq.spare_parts.items ?? []} tag={eq.tag} /></TabsContent>

        <TabsContent value="tools" className="mt-6">
          <ToolsTab boltSize={boltSize} wrench={wrench} tools={tools} liftingMethod={eq.maintenance.lifting_method} extraTools={eq.maintenance.tools} />
        </TabsContent>

        <TabsContent value="lifting" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <BigStat label={t("weight")} value={`${eq.technical.weight_kg} kg`} />
            <BigStat label={t("safetyLoad")} value={`${safety} kg`} accent />
            <BigStat label={t("liftingMethod")} value={eq.maintenance.lifting_method.replace(/_/g, " ")} />
          </div>
          <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Anchor className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{t("shackle")}</h3>
            </div>
            {shackle ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-inner">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-mono mb-2">{lang === "en" ? "Size" : "Taille"}</div>
                  <div className="text-3xl font-extrabold text-amber-400 font-mono">{shackle.size}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-inner">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-mono mb-2">WLL (Charge Utile)</div>
                  <div className="text-3xl font-extrabold text-white font-mono">{shackle.wll_t} t</div>
                </div>
                <div className="col-span-2 text-xs text-slate-400 border-t border-slate-800 pt-4 font-mono">
                  {lang === "en" ? `Calculated from ${eq.technical.weight_kg} kg × 1.5 safety factor = ${(safety / 1000).toFixed(2)} t. Crosby G-209 reference.` : `Calculé à partir de ${eq.technical.weight_kg} kg × 1.5 de facteur de sécurité = ${(safety / 1000).toFixed(2)} t. Référence Crosby G-209.`}
                </div>
              </div>
            ) : (
              <EmptyState message={lang === "en" ? "No mass recorded — shackle cannot be sized." : "Masse non enregistrée — la manille ne peut être calculée."} />
            )}
          </div>

          <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Wrench className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{lang === "en" ? "Crane recommendation" : "Grue recommandée"}</h3>
            </div>
            {crane ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-inner">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-mono mb-2">{lang === "en" ? "Capacity" : "Capacité"}</div>
                  <div className="text-3xl font-extrabold text-cyan-400 font-mono">{crane.capacity_t}{crane.capacity_t >= 100 ? "+" : ""} T</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-inner">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-mono mb-2">{lang === "en" ? "Type" : "Type"}</div>
                  <div className="text-lg font-bold text-white tracking-tight mt-1">{crane.label}</div>
                </div>
                <div className="col-span-2 text-xs text-slate-300 border-t border-slate-800 pt-4 font-light leading-relaxed">
                  {crane.rationale}
                </div>
                <div className="col-span-2 text-xs text-slate-500 font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {lang === "en" ? "GNL1Z fleet: 12 T · 24 T · 35 T · 54 T · 74 T · 100+ T" : "Flotte GNL1Z : 12 T · 24 T · 35 T · 54 T · 74 T · 100+ T"}
                </div>
              </div>
            ) : (
              <EmptyState message={lang === "en" ? "No mass recorded — crane cannot be sized." : "Masse non enregistrée — la grue ne peut être calculée."} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="insulation" className="mt-6">
          <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Snowflake className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{t("insulationReq")}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <BigStat label={lang === "en" ? "Status" : "Statut"} value={insulation.required ? (lang === "en" ? "Required" : "Requis") : (lang === "en" ? "Not required" : "Non requis")} accent={insulation.required} />
              <BigStat label={lang === "en" ? "Thickness" : "Épaisseur"} value={insulation.thickness_mm ? `${insulation.thickness_mm} mm` : "—"} />
              <BigStat label={lang === "en" ? "Material" : "Matériau"} value={insulation.material} />
            </div>
            <div className="mt-6 text-sm text-slate-300 border-t border-slate-800 pt-6 font-light leading-relaxed">
              <span className="font-bold text-white">{lang === "en" ? "Rationale: " : "Explication : "}</span>{insulation.rationale}
            </div>
            <div className="mt-4 text-xs text-slate-500 font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
              {lang === "en" ? "Equipment type:" : "Type d'équipement :"} {eq.type.code} ({eq.type.name})
            </div>
          </div>
        </TabsContent>

        <TabsContent value="judgment" className="mt-6">
          <EngineeringJudgmentTab judgment={judgment} lang={lang} tag={eq.tag} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-end">
        <Button asChild className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl py-6 px-6 shadow-lg shadow-cyan-500/20 gap-2.5 text-sm transition-all">
          <Link to={`/equipment/${encodeURIComponent(eq.tag)}/log`}>
            <ShieldCheck className="h-5 w-5 text-cyan-300" /> {lang === "en" ? "Log maintenance test" : "Enregistrer un essai de maintenance"}
          </Link>
        </Button>
      </div>

      {/* Field Notes (Multi-Note + Train) */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight">{lang === "en" ? "Field Notes" : "Notes de Terrain"}</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={train}
            onChange={(e) => setTrain(e.target.value)}
            className="h-12 rounded-xl bg-slate-950 border border-slate-800 px-4 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none transition-colors shrink-0"
          >
            {TRAINS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={lang === "en" ? "Add a note…" : "Ajouter une note…"}
            className="flex-1 h-12 bg-slate-950 border-slate-800 text-white rounded-xl text-sm font-light placeholder:text-slate-500 focus:border-cyan-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addNote();
              }
            }}
          />

          <Button onClick={addNote} disabled={savingNote || !newNote.trim()} className="shrink-0 h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl px-6 shadow-lg shadow-cyan-600/20 transition-all">
            <Save className="h-4 w-4 mr-2" />
            {savingNote ? "…" : (lang === "en" ? "Save" : "Enregistrer")}
          </Button>
        </div>

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500 font-mono bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80 text-center">{lang === "en" ? "No notes yet." : "Aucune note pour le moment."}</p>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="border border-slate-800 rounded-2xl p-5 bg-slate-950/40 flex justify-between items-start gap-4 shadow-inner hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="secondary" className="font-mono text-xs bg-slate-800 text-cyan-400 border border-slate-700 px-2.5 py-1 rounded-full">
                      {n.train || "T100"}
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString(lang === "en" ? "en-US" : "fr-FR", { dateStyle: "short", timeStyle: "short" })
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 break-words leading-relaxed font-light">{n.note}</p>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteNote(n.id)}
                  className="shrink-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl p-2.5 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <ImageGallery tag={eq.tag} />
        <MaintenanceTimeline tag={eq.tag} />
      </div>
    </div>
  );
}

function TechInfoTab({ eq }: { eq: Equipment }) {
  const { t, lang } = useI18n();
  const tp = eq.technical.test_pressure;
  const isExch = isShellAndTube(eq);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Field label={t("serial")} value={eq.technical.serial_no || "—"} mono />
        <Field label={t("testType")} value={eq.testing_status} />
        <Field label={t("pressure")} value={eq.technical.pressure_bar || "—"} mono accent />
        <Field label={t("volume")} value={eq.technical.volume_m3 || "—"} mono />
        <Field label={t("weight")} value={eq.technical.weight_kg} mono accent />
        {eq.technical.temperature_c != null && <Field label={lang === "en" ? "Temp (°C)" : "Temp (°C)"} value={eq.technical.temperature_c} mono />}
      </div>

      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Info className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">{t("testPressure")}</h3>
          {isExch && <Badge variant="outline" className="font-mono text-xs bg-slate-800 text-slate-300 border-slate-700 px-3 py-1 rounded-full ml-2">{lang === "en" ? "Shell & Tube" : "Calandre & Faisceau"}</Badge>}
        </div>
        {isExch ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PressureCell label={`${t("designPressure")} — ${t("shellSide")}`} value={tp?.shell_design_bar} />
            <PressureCell label={`${t("designPressure")} — ${t("tubeSide")}`} value={tp?.tube_design_bar} />
            <PressureCell label={`${t("testPressure")} — ${t("shellSide")}`} value={tp?.shell_test_bar} accent />
            <PressureCell label={`${t("testPressure")} — ${t("tubeSide")} / ${t("faciauxSide")}`} value={tp?.tube_test_bar} accent />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <PressureCell label={t("designPressure")} value={tp?.design_bar} />
            <PressureCell label={t("testPressure")} value={tp?.test_bar} accent />
          </div>
        )}
        <div className="text-xs text-slate-400 mt-6 border-t border-slate-800 pt-6 font-mono leading-relaxed bg-slate-950/60 p-5 rounded-2xl shadow-inner">
          {lang === "en"
            ? "Test pressures derived per ASME VIII (1.43× MAWP design × 1.3 hydrotest)."
            : "Pressions d'épreuve calculées selon ASME VIII (1.43× pression de calcul × 1.3 hydrotest)."}
        </div>
      </div>

      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">{lang === "en" ? "Isolation Plan" : "Plan d'Isolement"}</h3>
          </div>
          {eq.pid_drive_id ? (
            <Button asChild className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl py-5 px-6 shadow-lg shadow-purple-600/20 gap-2.5 text-sm transition-all">
              <a href={`https://drive.google.com/file/d/${eq.pid_drive_id}/preview`} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" /> {lang === "en" ? "Open Isolation Plan" : "Ouvrir le Plan d'Isolement"}
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </Button>
          ) : (
            <Badge variant="outline" className="text-slate-500 bg-slate-950 border-slate-800 px-4 py-2 rounded-full font-mono text-xs">{lang === "en" ? "No isolation plan" : "Aucun plan d'isolement"}</Badge>
          )}
        </div>
      </div>

      <EquipmentTestStatus tag={eq.tag} />
      <TestDatesEditor tag={eq.tag} initialLast={eq.maintenance.last_tested} initialNext={eq.maintenance.next_test_due} />
    </div>
  );
}

function PressureCell({ label, value, accent }: { label: string; value: number | null | undefined; accent?: boolean }) {
  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-950/60 p-5 shadow-inner">
      <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-2 font-mono leading-snug">{label}</div>
      <div className={`font-mono font-extrabold ${accent ? "text-cyan-400 text-3xl" : "text-white text-2xl"}`}>
        {value != null ? `${value} bar` : "—"}
      </div>
    </div>
  );
}

interface TestRecord {
  id?: string;
  tag: string;
  train: string;
  last_tested: string | null;
  next_test_due: string | null;
  updated_at?: string;
}

function TestDatesEditor({ tag, initialLast, initialNext }: { tag: string; initialLast: string; initialNext: string }) {
  const { t, lang } = useI18n();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editTrain, setEditTrain] = useState("T100");
  const [editLast, setEditLast] = useState<Date | undefined>(undefined);
  const [editNext, setEditNext] = useState<Date | undefined>(undefined);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("equipment_test_dates")
        .select("id, tag, train, last_tested, next_test_due, updated_at")
        .eq("tag", tag)
        .order("created_at", { ascending: false });
      if (active && data) {
        setRecords(data as TestRecord[]);
      }
      if (active) setLoaded(true);
    })();
    return () => { active = false; };
  }, [tag]);

  const startEdit = (record: TestRecord) => {
    setEditingId(record.id ?? null);
    setEditTrain(record.train || "T100");
    setEditLast(record.last_tested ? safeParse(record.last_tested) : undefined);
    setEditNext(record.next_test_due ? safeParse(record.next_test_due) : undefined);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTrain("T100");
    setEditLast(undefined);
    setEditNext(undefined);
  };

  const saveRecord = async () => {
    if (!editTrain) return;
    setSaving(true);

    const payload = {
      tag,
      train: editTrain,
      last_tested: editLast ? format(editLast, "yyyy-MM-dd") : null,
      next_test_due: editNext ? format(editNext, "yyyy-MM-dd") : null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from("equipment_test_dates")
        .update(payload)
        .eq("id", editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("equipment_test_dates")
        .insert(payload);
      error = insertError;
    }

    setSaving(false);

    if (error) {
      toast({ title: lang === "en" ? "Save failed" : "Échec d'enregistrement", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editingId ? (lang === "en" ? "Updated" : "Mis à jour") : (lang === "en" ? "Saved" : "Enregistré") });
    cancelEdit();
    const { data } = await supabase
      .from("equipment_test_dates")
      .select("id, tag, train, last_tested, next_test_due, updated_at")
      .eq("tag", tag)
      .order("created_at", { ascending: false });
    setRecords(data as TestRecord[] ?? []);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm(lang === "en" ? "Delete this test record?" : "Supprimer cet enregistrement de test ?")) return;
    const { error } = await supabase
      .from("equipment_test_dates")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: lang === "en" ? "Delete failed" : "Échec de suppression", description: error.message, variant: "destructive" });
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast({ title: lang === "en" ? "Deleted" : "Supprimé" });
  };

  const daysUntil = (nextDue?: string | null) => {
    if (!nextDue) return null;
    try {
      return differenceInDays(parseISO(nextDue), new Date());
    } catch { return null; }
  };

  return (
    <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">{t("lastTested")} / {t("nextDue")}</h3>
          {!loaded && <span className="text-xs text-slate-500 ml-2 animate-pulse font-mono">…</span>}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} className="gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl px-4 py-2 font-mono text-xs">
            {expanded ? (lang === "en" ? "Hide" : "Masquer") : (lang === "en" ? "Show" : "Afficher")} ({records.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => { cancelEdit(); setExpanded(true); }} className="gap-1.5 bg-slate-800 border-slate-700 text-slate-200 hover:text-white rounded-xl px-4 py-2 font-mono text-xs">
            <Plus className="h-4 w-4 text-cyan-400" /> {lang === "en" ? "Add" : "Ajouter"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-6">
          {/* Add/Edit Form */}
          <div className="border border-slate-800 rounded-2xl p-6 bg-slate-950/60 shadow-inner space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_auto] gap-4 items-end">
              <div>
                <div className="text-xs font-mono font-bold text-slate-400 mb-2">TRAIN</div>
                <select
                  value={editTrain}
                  onChange={(e) => setEditTrain(e.target.value)}
                  className="h-12 w-full rounded-xl bg-slate-900 border border-slate-700 px-4 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none transition-colors"
                >
                  {TRAINS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <DatePickerField label={t("lastTested")} date={editLast} onChange={setEditLast} />
              <DatePickerField label={t("nextDue")} date={editNext} onChange={setEditNext} />
              <div className="flex gap-2">
                <Button onClick={saveRecord} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold gap-2 h-12 rounded-xl px-6 shadow-lg shadow-cyan-600/20 transition-all font-mono text-xs">
                  <Save className="h-4 w-4" /> {saving ? "…" : (editingId ? (lang === "en" ? "Update" : "Mettre à jour") : (lang === "en" ? "Save" : "Enregistrer"))}
                </Button>
                {(editingId || records.length > 0) && (
                  <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-12 w-12 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {records.length === 0 ? (
            <EmptyState message={lang === "en" ? "No test records yet." : "Aucun enregistrement de test."} />
          ) : (
            <div className="divide-y divide-slate-800 bg-slate-950/20 border border-slate-800 rounded-2xl p-2 shadow-inner">
              {records.map((record) => {
                const dLeft = daysUntil(record.next_test_due);
                const isOverdue = dLeft !== null && dLeft < 0;
                const isDueSoon = dLeft !== null && dLeft >= 0 && dLeft <= 30;

                return (
                  <div key={record.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-900/40 rounded-xl transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <Badge variant="secondary" className="font-mono text-xs bg-slate-800 text-cyan-400 border border-slate-700 px-3 py-1 rounded-full">{record.train}</Badge>
                        {record.last_tested && (
                          <span className="text-xs text-slate-300 font-mono">{lang === "en" ? "Last:" : "Dernier :"} {record.last_tested}</span>
                        )}
                        {record.next_test_due && (
                          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${isOverdue ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : isDueSoon ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
                            {lang === "en" ? "Next:" : "Prochain :"} {record.next_test_due}
                            {dLeft !== null && ` (${dLeft} ${lang === "en" ? "days" : "jours"})`}
                          </span>
                        )}
                      </div>
                      {record.updated_at && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          {lang === "en" ? "Updated:" : "Mis à jour :"} {new Date(record.updated_at).toLocaleString(lang === "en" ? "en-US" : "fr-FR")}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl" onClick={() => startEdit(record)}>
                        <FileText className="h-4 w-4 text-cyan-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl" onClick={() => record.id && deleteRecord(record.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DatePickerField({ label, date, onChange }: { label: string; date: Date | undefined; onChange: (d: Date | undefined) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="text-xs font-mono font-bold text-slate-400 mb-2">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-mono h-12 bg-slate-900 border-slate-700 text-white rounded-xl text-xs", !date && "text-slate-500")}>
            <CalendarIcon className="mr-3 h-4 w-4 text-cyan-500" />
            {date ? format(date, "yyyy-MM-dd") : t("pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl" align="start">
          <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className={cn("p-4 pointer-events-auto bg-slate-900 rounded-2xl")} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function safeParse(s: string): Date | undefined {
  try { return parseISO(s); } catch { return undefined; }
}

function Field({ label, value, mono, accent }: { label: string; value: string | number; mono?: boolean; accent?: boolean }) {
  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/50 p-5 shadow-lg backdrop-blur-sm hover:border-slate-700 transition-all">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-mono font-medium">{label}</div>
      <div className={`text-xl font-bold tracking-tight ${mono ? "font-mono" : "font-display"} ${accent ? "text-cyan-400 text-2xl font-extrabold" : "text-white"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border rounded-3xl p-6 backdrop-blur-sm shadow-xl transition-all ${accent ? "border-cyan-500/40 bg-cyan-500/10 shadow-cyan-500/10" : "border-slate-800 bg-slate-900/40"}`}>
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-2 font-mono font-bold">{label}</div>
      <div className={`text-3xl font-extrabold font-mono tracking-tight ${accent ? "text-cyan-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-mono bg-slate-950/40 shadow-inner text-sm">
      {message}
    </div>
  );
}

function riskTierStyle(tier: RiskTier) {
  switch (tier) {
    case "CRITICAL": return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/40" };
    case "HIGH":      return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" };
    case "MEDIUM":    return { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/40" };
    default:          return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40" };
  }
}

function EngineeringJudgmentTab({ judgment, lang, tag }: { judgment: ReturnType<typeof buildEngineeringJudgment>; lang: string; tag: string }) {
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const rs = riskTierStyle(judgment.riskTier);

  const askAi = () => {
    const prompt = lang === "fr"
      ? `Explique en détail le jugement d'ingénierie et les recommandations de sécurité pour ${tag}.`
      : `Explain in detail the engineering judgment and safety recommendations for ${tag}.`;
    window.dispatchEvent(new CustomEvent("gnl1z:ask-ai", { detail: { prompt } }));
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 font-mono leading-relaxed">
        <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          {L(
            "This is a rule-based engineering judgment derived from the real design pressure, mass, volume, unit-service, and spare-parts material records in the master database — not a statistical ML prediction. It cites the source field for every conclusion so a QA/QC engineer can verify it.",
            "Ceci est un jugement d'ingénierie basé sur des règles, dérivé des données réelles de pression de calcul, masse, volume, service par unité et matériaux des pièces de rechange de la base maîtresse — et non une prédiction statistique par IA. Chaque conclusion cite son champ source pour vérification par un ingénieur QA/QC."
          )}
        </p>
      </div>

      {/* Risk tier + Ask AI */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className={`flex-1 border rounded-3xl p-6 backdrop-blur-sm shadow-xl ${rs.bg} ${rs.border}`}>
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-2 font-mono font-bold flex items-center gap-2">
            <AlertOctagon className="h-4 w-4" /> {L("Risk Tier", "Niveau de Risque")}
          </div>
          <div className={`text-4xl font-extrabold font-mono tracking-tight ${rs.text}`}>{judgment.riskTier}</div>
        </div>
        <button
          onClick={askAi}
          className="flex-1 flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 hover:from-cyan-600/30 hover:to-blue-600/30 transition-all cursor-pointer font-mono text-sm font-bold p-6"
        >
          <Sparkles className="h-5 w-5 text-cyan-400" /> {L("Ask AI Expert to explain this judgment", "Demander à l'Expert IA d'expliquer ce jugement")}
        </button>
      </div>

      {/* Process Service */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400"><Beaker className="h-5 w-5" /></div>
          <h3 className="text-xl font-bold text-white tracking-tight">{L("Process Service Profile", "Profil du Service Procédé")}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label={L("Fluid In Contact", "Fluide en Contact")} value={L(judgment.service.fluidEn, judgment.service.fluidFr)} />
          <Field label={L("Temperature Range", "Plage de Température")} value={L(judgment.service.tempRangeEn, judgment.service.tempRangeFr)} mono />
          <Field label={L("Corrosivity Profile", "Profil de Corrosivité")} value={L(judgment.service.corrosivityEn, judgment.service.corrosivityFr)} />
        </div>
      </div>

      {/* Pressure Analysis */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"><Gauge className="h-5 w-5" /></div>
          <h3 className="text-xl font-bold text-white tracking-tight">{L("Pressure & Code Margin Analysis", "Analyse de Pression & Marge de Code")}</h3>
        </div>
        {judgment.pressure.dataMissing ? (
          <EmptyState message={L("Design/test pressure not recorded for this asset in the master database.", "Pression de calcul/épreuve non enregistrée pour cet équipement.")} />
        ) : judgment.pressure.isShellTube ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <BigStat label={L("Shell Design", "Calcul Calandre")} value={`${judgment.pressure.shellDesignBar} bar`} />
            <BigStat label={L("Shell Test", "Épreuve Calandre")} value={`${judgment.pressure.shellTestBar} bar`} accent />
            <BigStat label={L("Tube Design", "Calcul Faisceau")} value={`${judgment.pressure.tubeDesignBar ?? "—"} bar`} />
            <BigStat label={L("Tube Test", "Épreuve Faisceau")} value={`${judgment.pressure.tubeTestBar ?? "—"} bar`} accent />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigStat label={L("Design Pressure", "Pression de Calcul")} value={`${judgment.pressure.designBar} bar`} />
            <BigStat label={L("Test Pressure", "Pression d'Épreuve")} value={`${judgment.pressure.testBar} bar`} accent />
            <BigStat label={L("Test/Design Ratio", "Ratio Épreuve/Calcul")} value={judgment.pressure.ratio ? `${judgment.pressure.ratio.toFixed(2)}×` : "—"} accent={!!judgment.pressure.belowCodeMinMargin} />
          </div>
        )}
      </div>

      {/* Recommended Tests */}
      <JudgmentListCard
        icon={<ShieldCheck className="h-5 w-5" />}
        color="emerald"
        title={L("Recommended Test / Inspection Program", "Programme d'Essais / Inspection Recommandé")}
        items={judgment.recommendedTests}
        lang={lang}
      />

      {/* Risk Factors */}
      <JudgmentListCard
        icon={<AlertOctagon className="h-5 w-5" />}
        color="rose"
        title={L("Risk Factors Identified", "Facteurs de Risque Identifiés")}
        items={judgment.riskFactors}
        lang={lang}
      />

      {/* Safety Recommendations */}
      <JudgmentListCard
        icon={<ShieldCheck className="h-5 w-5" />}
        color="amber"
        title={L("Safety Recommendations", "Recommandations de Sécurité")}
        items={judgment.safetyRecommendations}
        lang={lang}
      />

      {/* Process Recommendations */}
      <JudgmentListCard
        icon={<Beaker className="h-5 w-5" />}
        color="sky"
        title={L("Process Recommendations", "Recommandations de Procédé")}
        items={judgment.processRecommendations}
        lang={lang}
      />

      {/* Materials from real spare-parts records */}
      {judgment.materials.length > 0 && (
        <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-slate-500/10 border border-slate-500/30 text-slate-300"><Package className="h-5 w-5" /></div>
            <h3 className="text-xl font-bold text-white tracking-tight">{L("Materials of Construction (from PDR)", "Matériaux de Construction (depuis PDR)")}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {judgment.materials.map((m) => (
              <span key={m} className="font-mono text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl">{m}</span>
            ))}
          </div>
          {judgment.representativeBoltSize && (
            <p className="text-xs text-slate-500 font-mono mt-4">
              {L("Representative bolting/gasket size:", "Taille de boulonnage/joint représentative :")} <span className="text-white font-bold">{judgment.representativeBoltSize}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function JudgmentListCard({ icon, color, title, items, lang }: { icon: React.ReactNode; color: string; title: string; items: { en: string; fr: string }[]; lang: string }) {
  const colorMap: Record<string, { text: string; bg: string; border: string }> = {
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
    rose:    { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
    amber:   { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
    sky:     { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" },
  };
  const c = colorMap[color] ?? colorMap.emerald;
  return (
    <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${c.bg} border ${c.border} ${c.text}`}>{icon}</div>
        <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-light leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${c.bg} border ${c.border}`} />
            <span>{lang === "fr" ? item.fr : item.en}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PdrTab({ parts, tag }: { parts: SparePart[]; tag: string }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const fuse = useMemo(() => new Fuse(parts, { threshold: 0.35, keys: ["code", "description", "category", "reference", "material"] }), [parts]);
  const list = q.trim() ? fuse.search(q).map((r) => r.item) : parts;

  if (!parts.length) return <EmptyState message={lang === "en" ? "No spare parts recorded for this equipment." : "Aucune pièce de rechange enregistrée pour cet équipement."} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-10 h-11 bg-slate-950 border-slate-800 text-white rounded-xl font-mono text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none" />
        </div>
        <Button
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-200 hover:text-white rounded-xl py-5 shadow-md font-mono text-xs gap-2 cursor-pointer"
          onClick={() => exportToCsv(`${tag}_parts.csv`, list.map((p) => ({
            code: p.code, description: p.description, category: p.category ?? "", qty: p.qty_installed,
            location: p.stock_location ?? "", material: p.material ?? "", size: p.size_nominal ?? "",
          })))}
        >
          <Download className="h-4 w-4 text-cyan-400" /> {t("exportCsv")}
        </Button>
      </div>

      <div className="border border-slate-800 rounded-3xl overflow-hidden bg-slate-900/40 shadow-2xl backdrop-blur-sm">
        <div className="hidden md:grid grid-cols-[140px_1fr_160px_80px_120px] bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 px-6 py-4 font-bold font-mono border-b border-slate-800">
          <div>{t("code")}</div><div>{t("description")}</div><div>{t("category")}</div><div className="text-right">{t("qty")}</div><div>{t("location")}</div>
        </div>
        <div className="divide-y divide-slate-800 bg-slate-950/20">
          {list.map((p, i) => (
            <div key={`${p.code}-${i}`} className="grid grid-cols-1 md:grid-cols-[140px_1fr_160px_80px_120px] gap-2 md:gap-0 px-6 py-4 text-sm hover:bg-slate-800/40 transition-colors">
              <div className="font-mono text-xs text-cyan-400 font-bold">{p.code}</div>
              <div className="text-sm text-slate-200 font-light leading-relaxed">{p.description}</div>
              <div className="text-xs text-slate-400 font-mono">{p.category || "—"}</div>
              <div className="md:text-right font-mono font-bold text-white">{p.qty_installed}</div>
              <div className="text-xs font-mono text-slate-400">{p.stock_location || "—"}</div>
            </div>
          ))}
          {list.length === 0 && <div className="px-6 py-12 text-center text-slate-400 font-mono text-sm">{t("noResults")}</div>}
        </div>
      </div>
    </div>
  );
}

function ToolsTab({ boltSize, wrench, tools, liftingMethod, extraTools }: { boltSize: string; wrench: string | null; tools: string[]; liftingMethod: string; extraTools: string[] }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const allTools = [...tools, ...extraTools];

  const copy = async () => {
    await navigator.clipboard.writeText(allTools.map((tool, i) => `${i + 1}. ${tool}`).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BigStat label={`${t("bolt")} (${lang === "en" ? "default" : "défaut"})`} value={boltSize} />
        <BigStat label={lang === "en" ? "Wrench / Spanner" : "Clé / Douille"} value={wrench ?? "—"} accent={!!wrench} />
        <BigStat label={t("liftingMethod")} value={liftingMethod.replace(/_/g, " ")} />
      </div>

      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Wrench className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">{t("recommendedTools")}</h3>
          </div>
          <Button onClick={copy} variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-200 hover:text-white rounded-xl py-5 px-5 font-mono text-xs gap-2 cursor-pointer shadow-md">
            {copied ? <Check className="h-4 w-4 text-emerald-400 animate-bounce" /> : <Copy className="h-4 w-4 text-cyan-400" />}
            {copied ? t("copied") : t("copyToolList")}
          </Button>
        </div>
        <ol className="divide-y divide-slate-800 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shadow-inner">
          {allTools.map((tool, i) => (
            <li key={i} className="flex items-center gap-4 text-sm py-3.5 px-4 text-slate-200 hover:bg-slate-900/80 rounded-xl transition-colors">
              <span className="font-mono text-xs font-bold bg-slate-800 border border-slate-700 text-cyan-400 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-light leading-relaxed">{tool}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
