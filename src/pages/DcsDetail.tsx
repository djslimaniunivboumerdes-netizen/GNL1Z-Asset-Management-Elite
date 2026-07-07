import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Cpu, ExternalLink, Sparkles, RefreshCw, Tag, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/contexts/I18nContext";
import { getDcsPanel, dcsImageUrl, dcsImageViewUrl } from "@/data/dcs_panels";
import { getEquipmentByTag, EQUIPMENT } from "@/data";
import type { Equipment } from "@/data";
import { getTagsForPanel, getTagIndex } from "@/data/dcs_tags";
import { getEquipmentTagsFromDcsTags } from "@/data/dcs_equipment_map";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { StorageImg } from "@/components/StorageImg";
import NotFound from "./NotFound";

export default function DcsDetail() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { t, lang } = useI18n();

  // 1. Check if id is a DCS Panel ID. If not, check if it's an instrument tag!
  let panel = getDcsPanel(id);
  let resolvedHighlightTag = searchParams.get("tag")?.toUpperCase() ?? null;

  if (!panel) {
    const tagIndex = getTagIndex();
    const cleanId = id.toUpperCase().trim();
    const panelIds = tagIndex[cleanId];
    if (panelIds && panelIds.length > 0) {
      panel = getDcsPanel(panelIds[0]);
      resolvedHighlightTag = cleanId; // Auto-highlight the clicked instrument tag
    }
  }

  const highlightTag = resolvedHighlightTag;
  const [tags, setTags] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!panel) return;
    let active = true;
    const cached = getTagsForPanel(panel.id);
    if (cached.length) setTags(cached);
    (async () => {
      const { data } = await supabase
        .from("dcs_detected_instruments")
        .select("tags")
        .eq("panel_id", panel.id)
        .maybeSingle();
      if (active && Array.isArray(data?.tags) && (data!.tags as string[]).length) {
        setTags(data!.tags as string[]);
      } else if (active && !cached.length) {
        setTags([]);
      }
    })();
    return () => { active = false; };
  }, [panel]);

  if (!panel) return <NotFound />;

  const detect = async (force = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-dcs-instruments", {
        body: { panel_id: panel.id, storage_path: panel.storage_path, force },
      });
      if (error) {
        toast({ title: lang === "en" ? "Detection failed" : "Échec de détection", description: error.message, variant: "destructive" });
        return;
      }
      if ((data as { error?: string })?.error === "IMAGE_FETCH_FAILED") {
        toast({ 
          title: lang === "en" ? "Cannot access DCS image" : "Impossible d'accéder à l'image DCS", 
          description: (data as { message?: string }).message ?? "Image not found in Storage",
          variant: "destructive" 
        });
        return;
      }
      if ((data as { error?: string })?.error) {
        toast({ title: lang === "en" ? "Detection failed" : "Échec de détection", description: (data as { error: string }).error, variant: "destructive" });
        return;
      }
      const t = (data as { tags?: string[] }).tags ?? [];
      setTags(t);
      toast({ title: lang === "en" ? `Found ${t.length} instrument tag(s)` : `${t.length} tag(s) détecté(s)` });
    } catch (err) {
      toast({ 
        title: lang === "en" ? "Detection failed" : "Échec de détection", 
        description: err instanceof Error ? err.message : "Network error", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const related = useMemo((): Equipment[] => {
    const map = new Map<string, Equipment>();

    if (tags && tags.length > 0) {
      const equipmentTags = getEquipmentTagsFromDcsTags(tags);
      for (const eqTag of equipmentTags) {
        const eq = getEquipmentByTag(eqTag);
        if (eq) map.set(eq.tag, eq);
      }
    }

    for (const tag of panel.related_tags ?? []) {
      const eq = getEquipmentByTag(tag);
      if (eq) map.set(eq.tag, eq);
    }

    if (panel.unit) {
      for (const eq of EQUIPMENT) {
        if (eq.unit === panel.unit) map.set(eq.tag, eq);
      }
    }

    return Array.from(map.values());
  }, [panel, tags]);

  const aiTags = tags ?? [];
  const mappedEquipmentTags = useMemo(() => {
    if (!tags) return [];
    return getEquipmentTagsFromDcsTags(tags);
  }, [tags]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl px-3 py-2">
        <Link to="/dcs"><ArrowLeft className="h-4 w-4 mr-2" /> {t("back")}</Link>
      </Button>

      {/* Hero Header */}
      <div className="relative overflow-hidden border border-slate-800 rounded-3xl bg-slate-900/60 p-6 md:p-10 shadow-2xl backdrop-blur-md text-white">
        <div className="absolute top-0 right-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono uppercase tracking-widest mb-3 font-bold">
            <Cpu className="h-4 w-4 text-cyan-500" /> {t("panelDetail")}
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-white">
            {lang === "en" ? panel.title_en : panel.title_fr}
          </h1>
          <div className="flex flex-wrap gap-2.5 mt-4">
            <Badge className="bg-slate-800 border border-slate-700 text-slate-200 font-mono px-3 py-1 rounded-full text-xs">{panel.section}</Badge>
            {panel.unit && <Badge className="bg-slate-800 border border-slate-700 text-slate-200 font-mono px-3 py-1 rounded-full text-xs">{panel.unit}</Badge>}
            {highlightTag && (
              <Badge className="bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono px-3 py-1 rounded-full text-xs animate-pulse">
                {lang === "en" ? "Target Instrument:" : "Instrument Cible :"} {highlightTag}
              </Badge>
            )}
          </div>
          {(panel.description_en || panel.description_fr) && (
            <p className="mt-4 text-slate-300 max-w-3xl text-base leading-relaxed font-light">
              {lang === "en" ? panel.description_en : panel.description_fr}
            </p>
          )}
        </div>
      </div>

      {/* DCS Screen */}
      <div className="border border-slate-800 rounded-3xl overflow-hidden bg-slate-900/40 shadow-2xl backdrop-blur-sm">
        <div className="bg-slate-950/60 px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <span className="text-xs uppercase tracking-widest text-slate-400 font-mono font-bold">DCS Screen</span>
          <Button asChild variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-200 hover:text-white rounded-xl gap-2 font-mono text-xs cursor-pointer shadow-md">
            <a href={dcsImageViewUrl(panel.storage_path)} target="_blank" rel="noopener noreferrer">
              {t("openInDrive")} <ExternalLink className="h-4 w-4 text-cyan-400" />
            </a>
          </Button>
        </div>
        <div className="relative bg-slate-950 w-full p-4 md:p-6" style={{ aspectRatio: "16/9" }}>
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Cpu className="h-8 w-8 animate-pulse text-cyan-500" />
                <span className="text-xs font-mono uppercase tracking-widest">{lang === "en" ? "Loading DCS Screen…" : "Chargement de l'écran DCS…"}</span>
              </div>
            </div>
          )}
          {imgError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <ImageOff className="h-12 w-12 text-rose-500/50" />
                <span className="text-sm font-bold text-white">{lang === "en" ? "DCS Image Unavailable" : "Image DCS Indisponible"}</span>
                <span className="text-xs font-mono text-slate-500 max-w-xs text-center">
                  {lang === "en" ? "Image not found in Supabase Storage." : "Image introuvable dans le stockage Supabase."}
                </span>
              </div>
            </div>
          )}
          <StorageImg
            storagePath={panel.storage_path}
            alt={lang === "en" ? panel.title_en : panel.title_fr}
            className={`w-full h-full object-contain rounded-xl border border-slate-800/80 shadow-2xl ${imgError ? 'hidden' : ''}`}
            fallbackClassName="flex flex-col items-center justify-center gap-3 text-white/30 w-full h-full"
          />
        </div>
      </div>

      {/* Detected Instrument Tags */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Tag className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {lang === "en" ? "Detected Instrument Tags" : "Tags d'instruments détectés"}
            </h2>
            {tags && <Badge variant="outline" className="font-mono text-xs bg-slate-800 text-slate-300 border-slate-700 px-3 py-1 rounded-full ml-2">{tags.length}</Badge>}
          </div>
          <div className="flex gap-3">
            {(!tags || tags.length === 0) && (
              <Button onClick={() => detect(false)} disabled={loading} size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold gap-2 rounded-xl px-5 py-5 shadow-lg shadow-cyan-600/20 font-mono text-xs transition-all">
                <Sparkles className="h-4 w-4 text-cyan-300" /> {loading ? "…" : (lang === "en" ? "Detect with AI" : "Détecter avec AI")}
              </Button>
            )}
            {tags && tags.length > 0 && (
              <Button onClick={() => detect(true)} disabled={loading} size="sm" variant="outline" className="bg-slate-800 border-slate-700 text-slate-200 hover:text-white rounded-xl py-5 px-5 font-mono text-xs gap-2 cursor-pointer shadow-md">
                <RefreshCw className={`h-4 w-4 text-cyan-400 ${loading ? "animate-spin" : ""}`} /> {lang === "en" ? "Re-scan" : "Re-scanner"}
              </Button>
            )}
          </div>
        </div>
        {tags === null ? (
          <p className="text-sm text-slate-500 font-mono animate-pulse">…</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-slate-400 font-light bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80 text-center">
            {lang === "en"
              ? "No tags detected yet. Click 'Detect with AI' to scan this DCS screen with vision AI."
              : "Aucun tag détecté. Cliquez 'Détecter avec AI' pour scanner cet écran DCS."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 bg-slate-950/40 p-6 rounded-2xl border border-slate-800 shadow-inner max-h-[220px] overflow-y-auto">
            {aiTags.map((tg) => {
              const isHi = highlightTag && tg.toUpperCase() === highlightTag;
              const hasMapping = mappedEquipmentTags.includes(tg);
              return (
                <span
                  key={tg}
                  className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold transition-all ${
                    isHi
                      ? "border-amber-500 bg-amber-500 text-slate-950 ring-4 ring-amber-500/40 animate-pulse shadow-xl scale-110 z-10"
                      : hasMapping
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 shadow-sm"
                  }`}
                  title={hasMapping ? (lang === "en" ? "Mapped to equipment" : "Relié à un équipement") : (lang === "en" ? "No equipment mapping" : "Non relié")}
                >
                  {tg}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Related Equipment */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-8 backdrop-blur-sm shadow-xl space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight mb-2">
          {lang === "en" ? "Related Equipment" : "Équipement Relié"}
        </h2>
        {related.length === 0 ? (
          <p className="text-sm text-slate-400 font-light bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80 text-center">
            {lang === "en" ? "No equipment linked yet to this panel." : "Aucun équipement lié à ce panneau."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((eq) => (
              <Link
                key={eq.tag}
                to={`/equipment/${encodeURIComponent(eq.tag)}`}
                className="group flex items-center justify-between border border-slate-800 rounded-2xl p-5 bg-slate-900/50 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-all shadow-md backdrop-blur-sm"
              >
                <div className="min-w-0 pr-4">
                  <div className="font-mono text-xs text-cyan-400 font-bold mb-1">{eq.tag}</div>
                  <div className="text-sm font-bold text-white truncate">{eq.name}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
      <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl px-3 py-2">
        <Link to="/dcs"><ArrowLeft className="h-4 w-4 mr-2" /> {t("back")}</Link>
      </Button>
    </div>
  );
}
