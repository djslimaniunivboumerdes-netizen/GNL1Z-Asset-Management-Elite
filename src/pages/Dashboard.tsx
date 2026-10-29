import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Database, Cpu, BookOpen, User, Info, Factory, Package, Workflow, Newspaper, Search, Pause, Play, CalendarClock, ShieldAlert } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { META, EQUIPMENT } from "@/data";
import { GNL1Z_ASSETS } from "@/utils/assets";
import { TestScheduleWidget } from "@/components/TestScheduleWidget";
import FastAlertDashboardWidget from "@/components/FastAlertDashboardWidget";
import { Button } from "@/components/ui/button";

const modules = [
  { key: "equipment", to: "/equipment", icon: Database, badge: "catalogBadge", color: "text-amber-600 dark:text-amber-400", en: "Technical files, spare parts and maintenance history.", fr: "Dossiers techniques, pièces de rechange et historique de maintenance." },
  { key: "testSchedule", to: "/test-schedule", icon: CalendarClock, badge: "operationsBadge", color: "text-emerald-600 dark:text-emerald-400", en: "Plan upcoming tests and follow overdue equipment.", fr: "Planifiez les essais et suivez les équipements en retard." },
  { key: "dcs", to: "/dcs", icon: Cpu, badge: "integrationBadge", color: "text-sky-600 dark:text-sky-400", en: "Instrument-to-panel mapping and control documentation.", fr: "Correspondance instruments-panneaux et documentation de contrôle." },
  { key: "flow", to: "/smart-flow", icon: Workflow, badge: "processBadge", color: "text-cyan-600 dark:text-cyan-400", en: "Explore the AP-C3MR™ process and linked equipment.", fr: "Explorez le procédé AP-C3MR™ et les équipements associés." },
  { key: "manuals", to: "/manuals", icon: BookOpen, badge: "operationsBadge", color: "text-blue-600 dark:text-blue-400", en: "Find operating procedures and system documentation.", fr: "Consultez les procédures et la documentation des systèmes." },
  { key: "alerts", to: "/alerts", icon: ShieldAlert, badge: "operationsBadge", color: "text-rose-600 dark:text-rose-400", en: "Report safety observations and review incident status.", fr: "Signalez les observations et consultez le suivi des incidents." },
  { key: "news", to: "/news", icon: Newspaper, badge: "marketBadge", color: "text-purple-600 dark:text-purple-400", en: "LNG market intelligence and Sonatrach updates.", fr: "Actualités du marché GNL et de Sonatrach." },
  { key: "about", to: "/about", icon: Info, badge: "executiveBadge", color: "text-slate-600 dark:text-slate-400", en: "Facility overview, process and key specifications.", fr: "Présentation du complexe, du procédé et des spécifications." },
  { key: "author", to: "/author", icon: User, badge: "credentialsBadge", color: "text-orange-600 dark:text-orange-400", en: "Project information, contact channels and downloads.", fr: "Informations projet, contacts et téléchargements." },
];
const slides = [
  { tag: "Unit 40 · Liquefaction", ...GNL1Z_ASSETS.unitImages.unit40 },
  { tag: "Unit 30 · Compression", ...GNL1Z_ASSETS.unitImages.unit30 },
  { tag: "Unit 50 · Storage", ...GNL1Z_ASSETS.unitImages.unit50 },
  { tag: "Unit 60 · Export", ...GNL1Z_ASSETS.unitImages.unit60 },
  { tag: "Unit 70 · Utilities", ...GNL1Z_ASSETS.unitImages.unit70 },
];

export default function Dashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused]);
  // Prefetch only the next photograph, not the entire gallery.
  useEffect(() => {
    const image = new Image();
    const next = slides[(slideIndex + 1) % slides.length];
    image.sizes = "(max-width: 1440px) 100vw, 1440px";
    image.srcset = next.srcSet;
    image.src = next.src;
  }, [slideIndex]);

  const slide = slides[slideIndex];
  return (
    <div className="mx-auto max-w-[1440px] space-y-7 px-4 py-5 sm:px-6 md:py-7 lg:px-8">
      <section aria-labelledby="dashboard-title" className="relative isolate overflow-hidden rounded-2xl bg-slate-950 text-white">
        <img key={slide.src} src={slide.src} srcSet={slide.srcSet} sizes="(max-width: 1440px) 100vw, 1440px" alt={slide.tag} decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/20" />
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-300 sm:text-xs"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />{L("Sonatrach · Arzew LNG complex", "Sonatrach · Complexe GNL d'Arzew")}</div>
          <div className="max-w-2xl">
            <h1 id="dashboard-title" className="text-4xl font-bold tracking-tight sm:text-5xl">GNL1Z <span className="font-normal text-slate-300">{L("Asset Management", "Gestion des actifs")}</span></h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">{L("Your equipment, maintenance schedule and technical documentation. One workspace for the AP-C3MR™ facility.", "Vos équipements, essais et documents techniques. Un espace de travail pour le complexe AP-C3MR™.")}</p>
          </div>
          <form role="search" className="mt-7 flex max-w-xl items-center gap-2 rounded-xl border border-white/15 bg-slate-950/70 p-1.5 focus-within:ring-2 focus-within:ring-cyan-400" onSubmit={(event) => { event.preventDefault(); navigate(`/equipment${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`); }}>
            <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <label htmlFor="dashboard-search" className="sr-only">{t("searchEquipment")}</label>
            <input id="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L("Find an equipment tag, name or part…", "Rechercher un tag, nom ou pièce…")} className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
            <Button type="submit" className="bg-cyan-600 text-white hover:bg-cyan-500"><span className="hidden sm:inline">{L("Search", "Rechercher")}</span><ArrowRight className="h-4 w-4 sm:ml-2" /><span className="sr-only sm:hidden">{L("Search equipment", "Rechercher un équipement")}</span></Button>
          </form>
          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2"><Factory className="h-4 w-4 text-cyan-400" /><strong className="text-white">{META.trains}</strong> {t("trains")}</span>
            <span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-amber-400" /><strong className="text-white">{EQUIPMENT.length}</strong> {t("equipment")}</span>
            <span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-emerald-400" /><strong className="text-white">{META.spare_parts_count}</strong> {t("spareParts")}</span>
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11px] text-slate-300">
            <span aria-live="off">{slide.tag}</span>
            <div className="flex items-center gap-1">
              {slides.map((item, index) => <button key={item.tag} onClick={() => { setSlideIndex(index); setPaused(true); }} aria-label={`${L("Show", "Afficher")} ${item.tag}`} aria-pressed={index === slideIndex} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><span className={`h-1.5 rounded-full transition-all ${index === slideIndex ? "w-5 bg-cyan-400" : "w-1.5 bg-white/40"}`} /></button>)}
              <button onClick={() => setPaused((value) => !value)} aria-label={paused ? L("Play slideshow", "Lancer le diaporama") : L("Pause slideshow", "Mettre en pause")} className="ml-1 rounded-full p-2 hover:bg-white/10">{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-stretch gap-5 lg:grid-cols-2"><TestScheduleWidget /><FastAlertDashboardWidget /></div>

      <section aria-labelledby="modules-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 id="modules-title" className="text-lg font-semibold">{t("systemModules")}</h2><p className="mt-1 text-sm text-muted-foreground">{L("Tools and documentation for your daily workflow", "Outils et documentation pour votre travail quotidien")}</p></div><span className="text-xs text-muted-foreground">{L("Updated", "Mis à jour")} {META.last_updated}</span></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => <Link key={module.key} to={module.to} className="group flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-cyan-500/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="mb-4 flex items-center justify-between"><span className={`rounded-lg bg-muted p-2.5 ${module.color}`}><module.icon className="h-5 w-5" /></span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(module.badge)}</span></div>
            <h3 className="font-display text-base font-semibold group-hover:text-cyan-700 dark:group-hover:text-cyan-400">{t(module.key)}</h3><p className="mb-5 mt-1.5 text-sm leading-relaxed text-muted-foreground">{L(module.en, module.fr)}</p>
            <div className="mt-auto flex items-center justify-between text-xs font-medium"><span>{t("exploreModule")}</span><ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" /></div>
          </Link>)}
        </div>
      </section>
      <p className="border-t border-border pt-5 text-xs text-muted-foreground">{L("Planning and documentation workspace. Verify current plant conditions against approved operating procedures.", "Espace de planification et documentation. Vérifiez les conditions actuelles selon les procédures approuvées.")}</p>
    </div>
  );
}
