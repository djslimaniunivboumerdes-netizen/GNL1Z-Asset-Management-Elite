import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Database, Cpu, BookOpen, User, Info,
  Factory, Activity, Package, Workflow, Newspaper, LucideIcon, Zap
} from "lucide-react";

import { useI18n } from "@/contexts/I18nContext";
import { META, EQUIPMENT } from "@/data";
import { GNL1Z_ASSETS } from "@/utils/assets";
import { runAlertEngine } from "@/lib/alertEngine";

import { TestScheduleWidget } from "@/components/TestScheduleWidget";
import FastAlertDashboardWidget from "@/components/FastAlertDashboardWidget";

const moduleCards = [
  {
    key: "equipment",
    to: "/equipment",
    icon: Database,
    color: "border-amber-500/30 hover:border-amber-500/60 text-amber-400 bg-gradient-to-br from-amber-500/10 to-transparent",
    badgeKey: "catalogBadge",
    descEn: "Searchable master of 77 equipment items with 713 spare parts and full technical files.",
    descFr: "Maître recherchable de 77 équipements avec 713 pièces et dossiers techniques complets."
  },
  {
    key: "dcs",
    to: "/dcs",
    icon: Cpu,
    color: "border-sky-500/30 hover:border-sky-500/60 text-sky-400 bg-gradient-to-br from-sky-500/10 to-transparent",
    badgeKey: "integrationBadge",
    descEn: "Instrument-to-panel mapping, loop diagrams and control narratives across all units.",
    descFr: "Mapping instrument-vers-panneau, schémas de boucle et descriptifs de contrôle."
  },
  {
    key: "flow",
    to: "/flow",
    icon: Workflow,
    color: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 bg-gradient-to-br from-emerald-500/10 to-transparent",
    badgeKey: "processBadge",
    descEn: "Interactive AP-C3MR™ process diagram — from MEA decarbonation to LNG storage.",
    descFr: "Diagramme procédé AP-C3MR™ interactif — de la décarbonatation MEA au stockage GNL."
  },
  {
    key: "news",
    to: "/news",
    icon: Newspaper,
    color: "border-purple-500/30 hover:border-purple-500/60 text-purple-400 bg-gradient-to-br from-purple-500/10 to-transparent",
    badgeKey: "marketBadge",
    descEn: "Live LNG market intelligence — spot prices, top 10 headlines and Sonatrach updates.",
    descFr: "Intelligence marché GNL en direct — prix spot, top 10 actualités et mises à jour Sonatrach."
  },
  {
    key: "manuals",
    to: "/manuals",
    icon: BookOpen,
    color: "border-blue-500/30 hover:border-blue-500/60 text-blue-400 bg-gradient-to-br from-blue-500/10 to-transparent",
    badgeKey: "operationsBadge",
    descEn: "Operational procedures in 23 documents (S01 → S15) covering all systems.",
    descFr: "Procédures opérationnelles en 23 documents (S01 → S15) couvrant tous les systèmes."
  },
  {
    key: "about",
    to: "/about",
    icon: Info,
    color: "border-zinc-500/30 hover:border-zinc-500/60 text-zinc-400 bg-gradient-to-br from-zinc-500/10 to-transparent",
    badgeKey: "executiveBadge",
    descEn: "Executive summary of the AP-C3MR™ liquefaction facility, capacity & geography.",
    descFr: "Résumé exécutif de l'usine de liquéfaction AP-C3MR™, capacité et géographie."
  },
  {
    key: "author",
    to: "/author",
    icon: User,
    color: "border-orange-500/30 hover:border-orange-500/60 text-orange-400 bg-gradient-to-br from-orange-500/10 to-transparent",
    badgeKey: "credentialsBadge",
    descEn: "Project author, credentials, ORCID, contact channels and mobile app downloads.",
    descFr: "Auteur du projet, références, ORCID, canaux de contact et téléchargements de l'application."
  },
] as const;

const heroSlides = [
  { tag: "Unit 40", image: GNL1Z_ASSETS.units.unit40 },
  { tag: "Unit 30", image: GNL1Z_ASSETS.units.unit30 },
  { tag: "Unit 50", image: GNL1Z_ASSETS.units.unit50 },
  { tag: "Unit 60", image: GNL1Z_ASSETS.units.unit60 },
  { tag: "Unit 70", image: GNL1Z_ASSETS.units.unit70 }
] as const;

export default function Dashboard() {
  const { t, lang } = useI18n();
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    runAlertEngine().catch(e => console.warn("[GNL1Z] alert engine sync note:", e));

    const sequence = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5500);
    return () => clearInterval(sequence);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-cyan-500 selection:text-slate-900">
      {/* PREMIUM HERO SECTION */}
      <section className="relative overflow-hidden border-b border-slate-800 min-h-[480px] flex items-center bg-slate-950 w-full shadow-2xl">
        <div className="absolute inset-0 z-0">
          {heroSlides.map((slide, idx) => (
            <img
              key={idx}
              src={slide.image}
              alt={slide.tag}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 transform ${
                idx === slideIndex ? "opacity-60 scale-100" : "opacity-0 scale-105"
              }`}
            />
          ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] z-10" />

        <div className="relative px-6 md:px-12 py-16 max-w-7xl mx-auto z-20 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-6 shadow-inner animate-pulse">
            <Zap className="h-3.5 w-3.5" /> {t("facilityTag")}
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            GNL1Z
          </h1>

          <p className="mt-4 text-slate-300 max-w-2xl text-lg leading-relaxed font-light">
            {lang === "en"
              ? "Integrated Industrial Asset Integrity Management & Live DCS Supervisory Platform for Arzew LNG Complex."
              : "Plateforme intégrée de gestion de l'intégrité des actifs et supervision DCS en direct pour le complexe GNL d'Arzew."}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            <Stat icon={Factory} label={t("trains")} value={META.trains} color="text-cyan-400" />
            <Stat icon={Database} label={t("equipCount")} value={EQUIPMENT.length} color="text-amber-400" />
            <Stat icon={Package} label={t("spareParts")} value={META.spare_parts_count} color="text-emerald-400" />
            <Stat icon={Activity} label={t("lastUpdate")} value={META.last_updated} color="text-purple-400" mono />
          </div>
        </div>
      </section>

      {/* CORE OPERATION WIDGETS */}
      <div className="px-6 md:px-12 pt-12 max-w-7xl mx-auto space-y-8">
        <TestScheduleWidget />
        <FastAlertDashboardWidget />
      </div>

      {/* PREMIUM MODULE CARDS */}
      <section className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-4 w-1 bg-cyan-500 rounded-full"></div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{t("systemModules")}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moduleCards.map((m) => {
            const IconComponent = m.icon;
            return (
              <Link
                key={m.key}
                to={m.to}
                className={`group relative border rounded-2xl p-6 bg-slate-900/50 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between ${m.color}`}
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 group-hover:border-current transition-colors">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 tracking-wider">
                      {t(m.badgeKey)}
                    </span>
                  </div>

                  <h3 className="font-bold text-xl text-white group-hover:text-cyan-400 transition-colors">
                    {t(m.key)}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed font-light">
                    {lang === "en" ? m.descEn : m.descFr}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 group-hover:text-cyan-400 transition-colors font-mono">
                  <span>{t("exploreModule")}</span>
                  <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  mono
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-lg">
      <div className="text-xs text-slate-400 flex items-center gap-2 font-medium">
        <Icon className={`h-4 w-4 ${color}`} />
        {label}
      </div>
      <div className={`text-2xl md:text-3xl font-extrabold text-white mt-2 tracking-tight ${mono ? "font-mono text-xl md:text-2xl" : ""}`}>
        {value}
      </div>
    </div>
  );
}
