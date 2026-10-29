// src/pages/News.tsx
import { useEffect, useState, useMemo } from "react";
import {
  Newspaper, TrendingUp, Globe,
  ArrowUpRight, ExternalLink, Zap, Activity,
  LucideIcon, Filter, Flame, Factory, MapPin,
  Search, X, ArrowDownUp,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { GNL1Z_ASSETS } from "@/utils/assets";

/* ─── HERO SLIDES ─────────────────────────────────────────────────────────── */
const newsSlides = [
  { tag: "Market Ops", ...GNL1Z_ASSETS.unitImages.unit40 },
  { tag: "Strategic Hub", ...GNL1Z_ASSETS.unitImages.unit30 },
  { tag: "Export Terminal", ...GNL1Z_ASSETS.unitImages.unit50 },
] as const;

/* ─── NEWS FEED ───────────────────────────────────────────────────────────── */
type Category = "All" | "Operations" | "Market" | "Algeria" | "Global";

interface Article {
  id: number;
  category: Exclude<Category, "All">;
  title: string;
  title_fr: string;
  summary: string;
  summary_fr: string;
  /** ISO date (YYYY-MM-DD) — stable for sorting and locale formatting. */
  dateISO: string;
  source: string;
  /** External reference URL, or "#" for internal dispatches with no public link. */
  link: string;
  featured?: boolean;
}

const NEWS: Article[] = [
  /* ── OPERATIONS ── */
  {
    id: 1,
    category: "Operations",
    featured: true,
    title: "GNL1Z Digital Twin Deployment Complete — Full Process Simulation Online",
    title_fr: "Jumelle numérique du GNL1Z déployée — simulation complète du procédé en ligne",
    summary: "Real-time simulation of the full liquefaction cycle is now live, enabling operators to run start-up/shutdown scenarios, test alarm logic, and benchmark energy efficiency without touching the live process. The twin ingests DCS data every 30 seconds and flags deviations beyond 0.5%.",
    summary_fr: "La simulation en temps réel du cycle de liquéfaction complet est en ligne : les opérateurs peuvent exécuter des scénarios démarrage/arrêt, tester la logique d'alarme et comparer l'efficacité énergétique sans toucher au procédé réel. La jumelle ingère les données DCS toutes les 30 secondes et signale les écarts supérieurs à 0,5 %.",
    dateISO: "2026-06-02",
    source: "GNL1Z Operations",
    link: "#",
  },
  {
    id: 2,
    category: "Operations",
    title: "E-501 MCHE Quarterly Inspection Clears — Zero Tube Anomalies",
    title_fr: "Inspection trimestrielle de l'ECHANGEUR E-501 (MCHE) validée — zéro anomalie de tubes",
    summary: "Non-destructive testing of the main cryogenic heat exchanger confirmed zero tube leaks. New seal oil specification implemented across all MCR compressors reduced vibration by 12%.",
    summary_fr: "Les essais non destructifs de l'échangeur cryogénique principal ont confirmé l'absence totale de fuites de tubes. La nouvelle spécification d'huile de garniture étanchéité appliquée à tous les compresseurs MCR a réduit les vibrations de 12 %.",
    dateISO: "2026-05-28",
    source: "Maintenance Dept.",
    link: "#",
  },
  {
    id: 3,
    category: "Operations",
    title: "Arzew Compressor Train 3 Hits 98.2% Availability — Q1 2026 Record",
    title_fr: "Train de compresseurs 3 d'Arzew : disponibilité de 98,2 % — record du 1er trimestre 2026",
    summary: "Preventive maintenance programme and updated lube-oil flush procedures brought Train 3 to its highest quarterly availability since commissioning. Target for Q2 is 98.5%.",
    summary_fr: "Le programme de maintenance préventive et les procédures de rinçage d'huile de lubrification mises à jour ont porté le train 3 à sa plus haute disponibilité trimestrielle depuis la mise en service. Objectif du 2e trimestre : 98,5 %.",
    dateISO: "2026-05-15",
    source: "GNL1Z Operations",
    link: "#",
  },
  {
    id: 4,
    category: "Operations",
    title: "New MCHE Warm-End Efficiency Protocol Cuts Specific Energy 3.2%",
    title_fr: "Nouveau protocole d'efficacité chaude du MCHE : énergie spécifique réduite de 3,2 %",
    summary: "Adjusted mixed-refrigerant composition and revised warm-bundle approach temperatures lower the specific power consumption of liquefaction from 0.31 to 0.30 kWh/kg LNG.",
    summary_fr: "La composition du réfrigérant mixte ajustée et les températures d'approche du faisceau chaud révisées abaissent la consommation spécifique de liquéfaction de 0,31 à 0,30 kWh/kg GNL.",
    dateISO: "2026-05-05",
    source: "Process Engineering",
    link: "#",
  },

  /* ── MARKET ── */
  {
    id: 5,
    category: "Market",
    title: "Algerian LNG Deliveries to Europe Hit Record — 18.5 Bcm in Q1 2026",
    title_fr: "Livraisons algériennes de GNL vers l'Europe au record — 18,5 Mdm³ au 1er trimestre 2026",
    summary: "Record quarterly deliveries via both the Arzew and Skikda terminals underscore Algeria's role as Europe's primary alternative supplier as Russian pipeline flows remain constrained.",
    summary_fr: "Les livraisons trimestrielles record via les terminaux d'Arzew et de Skikda confirment le rôle de l'Algérie en tant que principal fournisseur alternatif de l'Europe, alors que les flux gaziers russes restent contraints.",
    dateISO: "2026-06-01",
    source: "S&P Global Commodity Insights",
    link: "https://spglobal.com",
  },
  {
    id: 6,
    category: "Market",
    title: "TTF Gas Benchmark Rises €31.44 — Winter Injection Season Begins",
    title_fr: "Le TTF remonte à 31,44 € — début de la saison d'injection hivernale",
    summary: "European hubs saw a 2.4% week-on-week increase as underground storage injection season started with inventories 7% below the five-year average. Spot LNG demand is expected to remain firm through September.",
    summary_fr: "Les hubs européens ont progressé de 2,4 % en une semaine au lancement de la campagne d'injection en stockage souterrain, avec des niveaux situés à 7 % sous la moyenne quinquennale. La demande de GNL au comptant devrait rester ferme jusqu'en septembre.",
    dateISO: "2026-06-01",
    source: "ICIS",
    link: "https://icis.com",
  },
  {
    id: 7,
    category: "Market",
    title: "JKM Asian Spot Price Recovers to $12.10/MMBtu — Japan, Korea Accelerate Buying",
    title_fr: "Le JKM asiatique remonte à 12,10 $/MMBtu — Japon et Corée accélèrent leurs achats",
    summary: "Asian LNG buyers accelerated term contracting as spot premiums tightened during summer peak season. South Korean utilities signed two 5-year extension deals with Qatari and Algerian suppliers.",
    summary_fr: "Les acheteurs asiatiques de GNL ont accéléré les contrats à long terme tandis que les primes au comptant se tendaient en pleine saison estivale. Deux services sud-coréens ont signé des prolongations de cinq ans avec des fournisseurs qatariens et algériens.",
    dateISO: "2026-05-30",
    source: "Platts",
    link: "#",
  },
  {
    id: 8,
    category: "Market",
    title: "LNG Spot Freight Surges 40% on Panama Canal Restrictions",
    title_fr: "Fret au comptant du GNL en hausse de 40 % à cause des restrictions du canal de Panama",
    summary: "Q-Flex vessel diversions via Cape of Good Hope are adding 15 days to Atlantic-Pacific LNG routes, tightening fleet availability and pushing spot freight to $95,000/day on key routes.",
    summary_fr: "Les navires Q-Flex déroutés par le cap de Bonne-Espérance ajoutent 15 jours sur les routes atlantique-Pacifique, tendant la disponibilité de la flotte et portant le fret au comptant à 95 000 $/jour sur les axes clés.",
    dateISO: "2026-05-18",
    source: "Clarksons Research",
    link: "#",
  },
  {
    id: 9,
    category: "Market",
    title: "Henry Hub Stabilises at $2.85 — US Storage Deficit Narrows",
    title_fr: "Le Henry Hub se stabilise à 2,85 $ — le déficit de stockage américain se resserre",
    summary: "Mild spring temperatures and rising Permian gas output brought Henry Hub down 0.8% on the week, narrowing the storage deficit to 3.8% below the five-year average. Implications for Atlantic LNG arbitrage remain neutral.",
    summary_fr: "Des températures douces et la hausse de la production gazière du Permian ont ramené le Henry Hub à -0,8 % sur la semaine, réduisant l'écart de stockage à 3,8 % sous la moyenne quinquennale. Les implications pour l'arbitrage GNL atlantique restent neutres.",
    dateISO: "2026-05-12",
    source: "EIA",
    link: "https://eia.gov",
  },

  /* ── ALGERIA ── */
  {
    id: 10,
    category: "Algeria",
    title: "Sonatrach & TotalEnergies Sign Timimoun Phase 2 MOU — 4 New Saharan Blocks",
    title_fr: "Sonatrach et TotalEnergies signent un protocole Timimoun phase 2 — 4 nouveaux blocs sahariens",
    summary: "An expanded exploration and production sharing framework covers 4 new blocks in the Ahnet and Timimoun basins, targeting 2.5 Bcm/year of incremental production by 2030.",
    summary_fr: "Un cadre élargi de partage de la production et de l'exploration couvre 4 nouveaux blocs dans les bassins d'Ahnet et de Timimoun, visant 2,5 Mdm³/an de production supplémentaire d'ici 2030.",
    dateISO: "2026-05-28",
    source: "Sonatrach",
    link: "https://sonatrach.com",
  },
  {
    id: 11,
    category: "Algeria",
    title: "Sonatrach Participates in Istanbul Natural Resources Summit 2026",
    title_fr: "Sonatrach participe au sommet d'Istanbul sur les ressources naturelles 2026",
    summary: "High-level discussions on Mediterranean energy security, hydrogen corridors, and regional LNG trade integration. Algeria positioned as anchor supplier for the EU's LNG diversification strategy.",
    summary_fr: "Hautes discussions sur la sécurité énergétique méditerranéenne, les corridors d'hydrogène et l'intégration régionale du commerce de GNL. L'Algérie s'affirme comme fournisseur d'ancrage de la stratégie de diversification GNL de l'UE.",
    dateISO: "2026-05-22",
    source: "Sonatrach Press",
    link: "https://sonatrach.com",
  },
  {
    id: 12,
    category: "Algeria",
    title: "ALNAFT Hydrocarbon Bid Round 2026 — 24 Onshore Blocks Open for Nomination",
    title_fr: "Appel d'offres hydrocarbures ALNAFT 2026 — 24 blocs terrestres ouverts à la candidature",
    summary: "Official launch of Algeria's 2026 bid round opens nomination for 24 onshore blocks across the Illizi, Berkine, and Ghadames basins. Closing date for technical submissions is 15 September 2026.",
    summary_fr: "Le lancement officiel de la campagne algérienne 2026 ouvre la candidature pour 24 blocs terrestres des bassins d'Illizi, Berkine et Ghadames. Clôture des dossiers techniques : 15 septembre 2026.",
    dateISO: "2026-05-15",
    source: "ALNAFT",
    link: "https://www.alnaft.dz",
  },
  {
    id: 13,
    category: "Algeria",
    title: "Algeria-Italy Medgaz Pipeline Throughput Reaches Annual Record",
    title_fr: "Le gazoduc Medgaz Algérie-Italie atteint un débit annuel record",
    summary: "Full-capacity utilisation of the direct undersea pipeline continued through Q1, with cumulative throughput 8% above the 2025 record. Expansion feasibility study targeting +4 Bcm/year commissioned.",
    summary_fr: "L'exploitation à pleine capacité du gazoduc sous-marin direct s'est poursuivie au 1er trimestre, avec un débit cumulé de 8 % au-dessus du record 2025. Une étude de faisabilité d'extension visant +4 Mdm³/an a été lancée.",
    dateISO: "2026-06-02",
    source: "Medgaz S.A.",
    link: "#",
  },
  {
    id: 14,
    category: "Algeria",
    title: "Sonatrach Announces 1 GW Solar Target for Arzew Industrial Zone by 2030",
    title_fr: "Sonatrach vise 1 GW solaire pour la zone industrielle d'Arzew d'ici 2030",
    summary: "Green energy roadmap targets 15% renewable electricity share at the Arzew-Bethioua complex. Phase 1 pilot of 120 MW PV plant breaks ground Q3 2026, with green hydrogen electrolyser integration planned for Phase 2.",
    summary_fr: "La feuille de route énergétique vise 15 % d'électricité renouvelable sur le complexe Arzew-Bethioua. Le pilote de phase 1 (centrale photovoltaïque de 120 MW) débutera au 3e trimestre 2026, l'intégration d'un électrolyseur d'hydrogène vert étant prévue en phase 2.",
    dateISO: "2026-05-05",
    source: "Ministry of Energy",
    link: "#",
  },

  /* ── GLOBAL ── */
  {
    id: 15,
    category: "Global",
    title: "LNG Canada Phase 1 Ships First Commercial Cargo — Supply Balance Shifts",
    title_fr: "LNG Canada phase 1 expédie son premier cargo commercial — l'offre se rééquilibre",
    summary: "The first LNG cargo from Kitimat, British Columbia heads to Japanese buyers, adding 14 MTPA of Pacific-facing supply and easing Asian spot prices. Full nameplate capacity expected by Q3 2026.",
    summary_fr: "Le premier cargo de GNL de Kitimat (Colombie-Britannique) part vers des acheteurs japonais, ajoutant 14 MTPA d'offre orientée Pacifique et détendant les prix asiatiques au comptant. Pleine capacité nominale attendue au 3e trimestre 2026.",
    dateISO: "2026-06-01",
    source: "Shell",
    link: "#",
  },
  {
    id: 16,
    category: "Global",
    title: "Qatar Lifts LNG Output Forecast to 142 MTPA by 2030",
    title_fr: "Le Qatar porte ses prévisions de production de GNL à 142 MTPA d'ici 2030",
    summary: "QatarEnergy confirms an accelerated timeline for North Field East and South expansion trains, raising the national production ceiling by 55 MTPA. Long-term SPAs signed with European, Asian, and South American utilities.",
    summary_fr: "QatarEnergy confirme un calendrier accéléré pour les trains d'extension North Field East et South, portant le plafond national de production de 55 MTPA. Des contrats d'approvisionnement à long terme ont été signés avec des utilitaires européens, asiatiques et sud-américains.",
    dateISO: "2026-05-26",
    source: "QatarEnergy",
    link: "#",
  },
  {
    id: 17,
    category: "Global",
    title: "EU Commission Updates LNG Infrastructure Regulation — 20% Buffer Mandate",
    title_fr: "La Commission européenne actualise sa réglementation GNL — obligation de réserve de 20 %",
    summary: "Brussels mandates minimum LNG buffer regasification capacity of 20% for all member states by Q3 2026. Five new FSRU terminals approved under expedited environmental permitting procedures.",
    summary_fr: "Bruxelles impose une capacité de régazéification de réserve d'au moins 20 % pour tous les États membres d'ici le 3e trimestre 2026. Cinq nouveaux terminaux FSRU ont été approuvés via des procédures environnementales accélérées.",
    dateISO: "2026-05-20",
    source: "European Commission",
    link: "https://ec.europa.eu",
  },
  {
    id: 18,
    category: "Global",
    title: "Russian Pipeline Gas to Europe at Historic 5-Year Low — LNG Fills the Gap",
    title_fr: "Gaz russe par gazoduc au plus bas depuis 5 ans — le GNL comble l'écart",
    summary: "Transit agreements expiration leaves LNG from Algeria, the USA, and Qatar covering 34% of EU import needs. Algeria's share of EU LNG imports rose to 18.3%, second only to the USA.",
    summary_fr: "L'expiration des accords de transit laisse le GNL algérien, américain et qatari couvrir 34 % des besoins d'importation de l'UE. La part de l'Algérie dans les importations européennes de GNL est passée à 18,3 %, seconde derrière les États-Unis.",
    dateISO: "2026-05-08",
    source: "Bruegel Institute",
    link: "#",
  },
];

const CATEGORIES: Category[] = ["All", "Operations", "Market", "Algeria", "Global"];

const CAT_LABEL_FR: Record<Category, string> = {
  All: "Tous",
  Operations: "Opérations",
  Market: "Marché",
  Algeria: "Algérie",
  Global: "Mondial",
};

const CAT_META: Record<Exclude<Category, "All">, { icon: LucideIcon; color: string; badge: string }> = {
  Operations: { icon: Factory,   color: "text-sky-400",     badge: "border-sky-500/30 text-sky-400 bg-sky-500/5" },
  Market:     { icon: TrendingUp, color: "text-emerald-700 dark:text-emerald-400", badge: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5" },
  Algeria:    { icon: MapPin,    color: "text-orange-400",  badge: "border-orange-500/30 text-orange-400 bg-orange-500/5" },
  Global:     { icon: Globe,     color: "text-violet-400",  badge: "border-violet-500/30 text-violet-400 bg-violet-500/5" },
};

/** Localized absolute date; UTC keeps ISO dates stable across time zones. */
function fmtDate(dateISO: string, lang: "en" | "fr"): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-US", {
    month: "long", day: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${dateISO}T00:00:00Z`));
}

const L = (lang: "en" | "fr", en: string, fr: string) => (lang === "fr" ? fr : en);
const hasPublicLink = (article: Article) => article.link !== "#" && article.link.trim() !== "";

/* ─── COMPONENT ───────────────────────────────────────────────────────────── */
export default function News() {
  const { lang } = useI18n();
  const [slideIndex, setSlideIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [searchQ, setSearchQ] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    if (heroPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setSlideIndex(p => (p + 1) % newsSlides.length), 5500);
    return () => clearInterval(id);
  }, [heroPaused]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const list = NEWS.filter(a => {
      if (activeCategory !== "All" && a.category !== activeCategory) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.title_fr.toLowerCase().includes(q)
        || a.summary.toLowerCase().includes(q) || a.summary_fr.toLowerCase().includes(q)
        || a.source.toLowerCase().includes(q);
    });
    const byNewest = (a: Article, b: Article) => b.dateISO.localeCompare(a.dateISO) || b.id - a.id;
    return [...list].sort(sortOrder === "newest" ? byNewest : (a, b) => byNewest(b, a));
  }, [activeCategory, searchQ, sortOrder]);

  const featured = filtered.find(a => a.featured);
  const grid = featured ? filtered.filter(a => a.id !== featured.id) : filtered;

  const curatedDate = NEWS.reduce((max, a) => (a.dateISO > max ? a.dateISO : max), NEWS[0].dateISO);
  const clearFilters = () => { setActiveCategory("All"); setSearchQ(""); };

  return (
    <div className="industrial-grid min-h-screen bg-background pb-16 space-y-10">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b border-border min-h-[420px] flex items-center bg-zinc-950 isolation-isolate w-full"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocusCapture={() => setHeroPaused(true)}
        onBlurCapture={() => setHeroPaused(false)}
      >
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img key={slideIndex} src={newsSlides[slideIndex].src} srcSet={newsSlides[slideIndex].srcSet} sizes="100vw" alt={newsSlides[slideIndex].tag} decoding="async" className="absolute inset-0 h-full w-full object-cover object-center opacity-75" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/85 via-zinc-950/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 stripe-warning z-20" />

        <div className="relative px-4 md:px-10 py-16 max-w-7xl mx-auto z-20 w-full">
          <div className="max-w-3xl space-y-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-orange-300 font-mono font-bold">
              / {L(lang, "LNG MARKET INTELLIGENCE", "INTELLIGENCE DU MARCHÉ GNL")}
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold text-white tracking-tight leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              {L(lang, "LNG Market Hub", "Hub Marché GNL")}
              <span className="h-3 w-3 rounded-full bg-orange-500 inline-block ml-1.5 translate-y-[-4px]" />
            </h1>
            <p className="text-sm md:text-base text-zinc-300 max-w-xl leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {lang === "en"
                ? `${NEWS.length} industry dispatches · reference market snapshots · Sonatrach & global LNG · curated ${fmtDate(curatedDate, lang)}`
                : `${NEWS.length} dépêches · indices de marché de référence · Sonatrach & GNL mondial · compilé le ${fmtDate(curatedDate, lang)}`}
            </p>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
              <MarketStat icon={TrendingUp} label="TTF (EU)"   value="€31.44" trend="+2.4%" />
              <MarketStat icon={Zap}        label="Henry Hub"  value="$2.85"  trend="-0.8%" />
              <MarketStat icon={Globe}      label="JKM (Asia)" value="$12.10" trend="+1.1%" />
              <MarketStat icon={Activity}   label="Spot Vol"   value="HIGH" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              {L(lang, "Reference snapshot — curated values, not live market data", "Snapshot de référence — valeurs compilées, pas de données de marché en direct")}
            </p>

            {/* Slide indicators — manual control also serves reduced-motion users */}
            <div className="flex items-center gap-2 pt-1" role="group" aria-label={L(lang, "Hero slides", "Diaporama d'en-tête")}>
              {newsSlides.map((slide, index) => (
                <button
                  key={slide.tag}
                  type="button"
                  onClick={() => setSlideIndex(index)}
                  aria-label={L(lang, `Show slide ${index + 1}`, `Afficher la diapositive ${index + 1}`)}
                  aria-current={slideIndex === index}
                  className={`h-1.5 rounded-full transition-all ${slideIndex === index ? "w-6 bg-orange-500" : "w-2.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER BAR ─────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-10 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <Newspaper className="h-6 w-6 text-orange-500 shrink-0" />
            <h2 className="text-2xl font-display font-bold">
              {L(lang, "Industry News", "Actualités Secteur")}
            </h2>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={[
                  "px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wide transition-all border",
                  activeCategory === cat
                    ? "bg-orange-500 border-orange-500 text-foreground"
                    : "border-border text-muted-foreground hover:border-orange-500/40 hover:text-foreground",
                ].join(" ")}
              >
                {lang === "fr" ? CAT_LABEL_FR[cat] : cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSortOrder(o => (o === "newest" ? "oldest" : "newest"))}
              aria-label={L(lang, `Sort: ${sortOrder}`, `Tri : ${sortOrder === "newest" ? "récent d'abord" : "ancien d'abord"}`)}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wide border border-border text-muted-foreground hover:border-orange-500/40 hover:text-foreground transition-all"
            >
              <ArrowDownUp className="h-3 w-3" />
              {L(lang, sortOrder === "newest" ? "Newest" : "Oldest", sortOrder === "newest" ? "Récent" : "Ancien")}
            </button>
          </div>
        </div>

        {/* Search within news */}
        <div className="mt-4 mb-8 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            aria-label={L(lang, "Search dispatches", "Rechercher des dépêches")}
            placeholder={L(lang, "Search headlines…", "Rechercher…")}
            className="w-full pl-9 pr-9 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-orange-500/60 font-mono placeholder:text-muted-foreground/50"
          />
          {searchQ && (
            <button
              type="button"
              onClick={() => setSearchQ("")}
              aria-label={L(lang, "Clear search", "Effacer la recherche")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── FEATURED ─────────────────────────────────────────────────────── */}
        {featured && (
          <FeaturedCard article={featured} lang={lang} />
        )}

        {/* ── GRID ─────────────────────────────────────────────────────────── */}
        {grid.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grid.map(article => (
              <ArticleCard key={article.id} article={article} lang={lang} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-20">
            <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-mono text-sm">{L(lang, "No articles match your filter.", "Aucun article ne correspond à votre filtre.")}</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-4 py-1.5 rounded-full border border-border text-xs font-mono uppercase tracking-wide hover:border-orange-500/50 hover:text-orange-500 transition-all"
            >
              {L(lang, "Clear filters", "Réinitialiser les filtres")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── SUB-COMPONENTS ──────────────────────────────────────────────────────── */

function CategoryBadge({ category, lang }: { category: Exclude<Category, "All">; lang: "en" | "fr" }) {
  const meta = CAT_META[category];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-widest ${meta.badge}`}>
      <Icon className="h-3 w-3" />{lang === "fr" ? CAT_LABEL_FR[category] : category}
    </span>
  );
}

function FeaturedCard({ article, lang }: { article: Article; lang: "en" | "fr" }) {
  const title = lang === "fr" ? article.title_fr : article.title;
  const summary = lang === "fr" ? article.summary_fr : article.summary;
  const external = hasPublicLink(article);

  const body = (
    <>
      <div className="flex flex-col md:flex-row">
        <div className="md:flex-1 p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500 text-[10px] font-mono font-bold text-foreground uppercase tracking-widest">
              <Flame className="h-3 w-3" /> {L(lang, "Featured", "À la une")}
            </span>
            <CategoryBadge category={article.category} lang={lang} />
          </div>
          <h3 className="text-2xl md:text-3xl font-display font-extrabold leading-tight group-hover:text-orange-400 transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground leading-relaxed max-w-2xl">{summary}</p>
          <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <span>{fmtDate(article.dateISO, lang)} · {article.source}</span>
            {external ? (
              <span className="flex items-center gap-1 group-hover:gap-2 transition-all text-orange-500">
                {L(lang, "Read More", "Lire")} <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="text-muted-foreground/70">{L(lang, "Internal dispatch", "Dépêche interne")}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (!external) {
    return (
      <article className="group block mb-6 border border-border rounded-2xl bg-card overflow-hidden hover:border-orange-500/50 transition-all shadow-sm">
        {body}
      </article>
    );
  }
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer"
      className="group block mb-6 border border-border rounded-2xl bg-card overflow-hidden hover:border-orange-500/50 transition-all hover:-translate-y-0.5 shadow-sm">
      {body}
    </a>
  );
}

function ArticleCard({ article, lang }: { article: Article; lang: "en" | "fr" }) {
  const title = lang === "fr" ? article.title_fr : article.title;
  const summary = lang === "fr" ? article.summary_fr : article.summary;
  const external = hasPublicLink(article);

  const content = (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <CategoryBadge category={article.category} lang={lang} />
          {external && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-orange-500 transition-colors shrink-0 mt-0.5" />}
        </div>
        <h3 className="font-display font-bold leading-snug text-base group-hover:text-orange-400 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {summary}
        </p>
      </div>
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        <span>{fmtDate(article.dateISO, lang)}</span>
        <span className="flex items-center gap-1 group-hover:gap-2 transition-all group-hover:text-orange-500">
          {article.source} {external && <ArrowUpRight className="h-3 w-3" />}
        </span>
      </div>
    </>
  );

  const className =
    "group border border-border rounded-xl bg-card p-5 flex flex-col justify-between transition-all shadow-sm"
    + (external ? " hover:border-orange-500/40 hover:-translate-y-1" : "");

  if (!external) {
    return <article className={className} data-testid="internal-dispatch">{content}</article>;
  }
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}

function MarketStat({ icon: Icon, label, value, trend }: { icon: LucideIcon; label: string; value: string; trend?: string }) {
  return (
    <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl">
      <div className="flex items-center gap-2 text-zinc-400 text-[10px] uppercase tracking-widest mb-2 font-mono">
        <Icon className="h-3 w-3 text-orange-500" />{label}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-display font-extrabold text-foreground">{value}</span>
        {trend && (
          <span className={`text-[10px] font-mono ${trend.startsWith("+") ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{trend}</span>
        )}
      </div>
    </div>
  );
}
