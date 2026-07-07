import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
import { Cpu, Search, ArrowRight, Tag as TagIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/contexts/I18nContext";
import { DCS_PANELS, DCS_SECTIONS, getDcsPanel } from "@/data/dcs_panels";
import { getAllTagsSorted, getTagIndex } from "@/data/dcs_tags";
import { StorageImg } from "@/components/StorageImg";

function DcsThumb({ storagePath, alt }: { storagePath: string; alt: string }) {
  return (
    <div className="relative bg-slate-950 border-b border-slate-800 overflow-hidden" style={{ aspectRatio: "16/9" }}>
      <StorageImg
        storagePath={storagePath}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    </div>
  );
}

export default function DcsDirectory() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [section, setSection] = useState<string>("all");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(DCS_PANELS, {
        threshold: 0.35,
        keys: ["title_en", "title_fr", "section", "unit", "related_tags"],
      }),
    []
  );

  const list = useMemo(() => {
    let l = q.trim() ? fuse.search(q).map((r) => r.item) : DCS_PANELS;
    if (section !== "all") l = l.filter((p) => p.section === section);
    return l;
  }, [q, section, fuse]);

  const allTags = useMemo(() => getAllTagsSorted(), []);
  const tagIndex = useMemo(() => getTagIndex(), []);
  const filteredTags = useMemo(() => {
    const tq = tagQuery.trim().toUpperCase();
    return tq ? allTags.filter((t) => t.includes(tq)) : allTags;
  }, [tagQuery, allTags]);

  const goToTag = (tag: string) => {
    const panels = tagIndex[tag] ?? [];
    if (panels.length === 0) return;
    setTagsOpen(false);
    navigate(`/dcs/${panels[0]}?tag=${encodeURIComponent(tag)}`);
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
        <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-mono mb-2">
          / {t("dcs")}
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-inner">
            <Cpu className="h-7 w-7" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">{t("dcs")}</h1>
        </div>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed font-light">
          {lang === "en"
            ? `${DCS_PANELS.length} DCS screen captures from the Sonatrach GNL1Z control room. Click any panel for details.`
            : `${DCS_PANELS.length} captures DCS de la salle de contrôle GNL1Z Sonatrach. Cliquez sur un panneau pour les détails.`}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/20 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="pl-10 h-12 bg-slate-950 border-slate-800 text-white rounded-xl font-mono text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-12 bg-slate-800 border-slate-700 text-slate-200 hover:text-white rounded-xl py-5 px-5 font-mono text-xs gap-2 cursor-pointer shadow-md">
              <TagIcon className="h-4 w-4 text-cyan-400" />
              {lang === "en" ? "All Tags" : "Tous les tags"}
              <Badge variant="secondary" className="ml-1 font-mono bg-slate-900 text-cyan-400 border border-slate-700">
                {allTags.length}
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl flex flex-col p-6">
            <DialogHeader className="border-b border-slate-800 pb-4 mb-4">
              <DialogTitle className="flex items-center gap-3 text-lg font-display text-white">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <TagIcon className="h-5 w-5" />
                </div>
                {lang === "en"
                  ? "All Detected Instrument Tags"
                  : "Tous les tags d'instruments détectés"}
                <Badge variant="outline" className="font-mono text-xs bg-slate-950 border-slate-800 text-slate-300 ml-2">
                  {filteredTags.length}/{allTags.length}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder={
                  lang === "en"
                    ? "Filter tags (e.g. FT-1503)"
                    : "Filtrer les tags (ex. FT-1503)"
                }
                className="pl-10 h-12 bg-slate-950 border-slate-800 text-white rounded-xl font-mono text-xs placeholder:text-slate-500 focus:border-cyan-500"
              />
            </div>
            <div className="overflow-y-auto flex-1 bg-slate-950/40 border border-slate-800 rounded-2xl p-4 shadow-inner">
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => {
                  const panels = tagIndex[tag] ?? [];
                  const firstPanel = getDcsPanel(panels[0]);
                  return (
                    <button
                      key={tag}
                      onClick={() => goToTag(tag)}
                      title={
                        firstPanel
                          ? lang === "en"
                            ? firstPanel.title_en
                            : firstPanel.title_fr
                          : ""
                      }
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 font-mono text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      {tag}
                      {panels.length > 1 && (
                        <span className="ml-1.5 opacity-60 bg-slate-800 px-1.5 py-0.5 rounded-full text-[10px]">{panels.length}</span>
                      )}
                    </button>
                  );
                })}
                {filteredTags.length === 0 && (
                  <p className="text-sm text-slate-500 py-8 text-center font-mono">
                    {t("noResults")}
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setSection("all")}
            className={`px-4 h-12 rounded-xl border text-xs font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
              section === "all"
                ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/20"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
            }`}
          >
            {lang === "en" ? "All" : "Tout"}
          </button>
          {DCS_SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-4 h-12 rounded-xl border text-xs font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                section === s
                  ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/20"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((p) => (
          <Link
            key={p.id}
            to={`/dcs/${p.id}`}
            className="group relative overflow-hidden border border-slate-800 rounded-3xl bg-slate-900/50 hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all shadow-xl backdrop-blur-sm flex flex-col justify-between"
          >
            <DcsThumb
              storagePath={p.storage_path}
              alt={lang === "en" ? p.title_en : p.title_fr}
            />
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="font-mono text-xs bg-slate-800 text-slate-300 border-slate-700 px-3 py-1 rounded-full">
                    {p.section}
                  </Badge>
                  {p.unit && (
                    <span className="font-mono text-xs text-cyan-400 font-bold">
                      {p.unit}
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-white tracking-tight leading-tight group-hover:text-cyan-400 transition-colors">
                  {lang === "en" ? p.title_en : p.title_fr}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 group-hover:text-cyan-400 transition-colors font-mono">
                <span>{lang === "en" ? "Inspect Console" : "Inspecter Console"}</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </div>
          </Link>
        ))}
        {list.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-16 font-mono text-sm bg-slate-900/40 border border-slate-800 rounded-3xl backdrop-blur-sm">
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
