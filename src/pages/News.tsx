// src/pages/News.tsx
import { useEffect, useState, useMemo } from "react";
import {
  Newspaper, TrendingUp, Globe, BarChart3,
  ArrowUpRight, ExternalLink, Zap, Activity,
  LucideIcon, Filter, Flame, Factory, MapPin, Gauge,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { GNL1Z_ASSETS } from "@/utils/assets";
import { Badge } from "@/components/ui/badge";

/* ─── HERO SLIDES ─────────────────────────────────────────────────────────── */
const newsSlides = [
  { tag: "Market Ops",     image: GNL1Z_ASSETS.units.unit40 },
  { tag: "Strategic Hub",  image: GNL1Z_ASSETS.units.unit30 },
  { tag: "Export Terminal",image: GNL1Z_ASSETS.units.unit50 },
] as const;

/* ─── NEWS FEED ───────────────────────────────────────────────────────────── */
type Category = "All" | "Operations" | "Market" | "Algeria" | "Global";

interface Article {
  id: number;
  category: Exclude<Category, "All">;
  title: string;
  summary: string;
  date: string;
  source: string;
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
    summary: "Real-time simulation of the full liquefaction cycle is now live, enabling operators to run start-up/shutdown scenarios, test alarm logic, and benchmark energy efficiency without touching the live process. The twin ingests DCS data every 30 seconds and flags deviations beyond 0.5%.",
    date: "June 02, 2026",
    source: "GNL1Z Operations",
    link: "#",
  },
  {
    id: 2,
    category: "Operations",
    title: "E-501 MCHE Quarterly Inspection Clears — Zero Tube Anomalies",
    summary: "Non-destructive testing of the main cryogenic heat exchanger confirmed zero tube leaks. New seal oil specification implemented across all MCR compressors reduced vibration by 12%.",
    date: "May 28, 2026",
    source: "Maintenance Dept.",
    link: "#",
  },
  {
    id: 3,
    category: "Operations",
    title: "Arzew Compressor Train 3 Hits 98.2% Availability — Q1 2026 Record",
    summary: "Preventive maintenance programme and updated lube-oil flush procedures brought Train 3 to its highest quarterly availability since commissioning. Target for Q2 is 98.5%.",
    date: "May 15, 2026",
    source: "GNL1Z Operations",
    link: "#",
  },
  {
    id: 4,
    category: "Operations",
    title: "New MCHE Warm-End Efficiency Protocol Cuts Specific Energy 3.2%",
    summary: "Adjusted mixed-refrigerant composition and revised warm-bundle approach temperatures lower the specific power consumption of liquefaction from 0.31 to 0.30 kWh/kg LNG.",
    date: "May 05, 2026",
    source: "Process Engineering",
    link: "#",
  },

  /* ── MARKET ── */
  {
    id: 5,
    category: "Market",
    title: "Algerian LNG Deliveries to Europe Hit Record — 18.5 Bcm in Q1 2026",
    summary: "Record quarterly deliveries via both the Arzew and Skikda terminals underscore Algeria's role as Europe's primary alternative supplier as Russian pipeline flows remain constrained.",
    date: "June 01, 2026",
    source: "S&P Global Commodity Insights",
    link: "https://spglobal.com",
  },
  {
    id: 6,
    category: "Market",
    title: "TTF Gas Benchmark Rises €31.44 — Winter Injection Season Begins",
    summary: "European hubs saw a 2.4% week-on-week increase as underground storage injection season started with inventories 7% below the five-year average. Spot LNG demand is expected to remain firm through September.",
    date: "June 01, 2026",
    source: "ICIS",
    link: "https://icis.com",
  },
  {
    id: 7,
    category: "Market",
    title: "JKM Asian Spot Price Recovers to $12.10/MMBtu — Japan, Korea Accelerate Buying",
    summary: "Asian LNG buyers accelerated term contracting as spot premiums tightened during summer peak season. South Korean utilities signed two 5-year extension deals with Qatari and Algerian suppliers.",
    date: "May 30, 2026",
    source: "Platts",
    link: "#",
  },
  {
    id: 8,
    category: "Market",
    title: "LNG Spot Freight Surges 40% on Panama Canal Restrictions",
    summary: "Q-Flex vessel diversions via Cape of Good Hope are adding 15 days to Atlantic-Pacific LNG routes, tightening fleet availability and pushing spot freight to $95,000/day on key routes.",
    date: "May 18, 2026",
    source: "Clarksons Research",
    link: "#",
  },
  {
    id: 9,
    category: "Market",
    title: "Henry Hub Stabilises at $2.85 — US Storage Deficit Narrows",
    summary: "Mild spring temperatures and rising Permian gas output brought Henry Hub down 0.8% on the week, narrowing the storage deficit to 3.8% below the five-year average. Implications for Atlantic LNG arbitrage remain neutral.",
    date: "May 12, 2026",
    source: "EIA",
    link: "https://eia.gov",
  },

  /* ── ALGERIA ── */
  {
    id: 10,
    category: "Algeria",
    title: "Sonatrach & TotalEnergies Sign Timimoun Phase 2 MOU — 4 New Saharan Blocks",
    summary: "An expanded exploration and production sharing framework covers 4 new blocks in the Ahnet and Timimoun basins, targeting 2.5 Bcm/year of incremental production by 2030.",
    date: "May 28, 2026",
    source: "Sonatrach",
    link: "https://sonatrach.com",
  },
  {
    id: 11,
    category: "Algeria",
    featured: false,
    title: "Sonatrach Participates in Istanbul Natural Resources Summit 2026",
    summary: "High-level discussions on Mediterranean energy security, hydrogen corridors, and regional LNG trade integration. Algeria positioned as anchor supplier for the EU's LNG diversification strategy.",
    date: "May 22, 2026",
    source: "Sonatrach Press",
    link: "https://sonatrach.com",
  },
  {
    id: 12,
    category: "Algeria",
    title: "ALNAFT Hydrocarbon Bid Round 2026 — 24 Onshore Blocks Open for Nomination",
    summary: "Official launch of Algeria's 2026 bid round opens nomination for 24 onshore blocks across the Illizi, Berkine, and Ghadames basins. Closing date for technical submissions is 15 September 2026.",
    date: "May 15, 2026",
    source: "ALNAFT",
    link: "https://www.alnaft.dz",
  },
  {
    id: 13,
    category: "Algeria",
    title: "Algeria-Italy Medgaz Pipeline Throughput Reaches Annual Record",
    summary: "Full-capacity utilisation of the direct undersea pipeline continued through Q1, with cumulative throughput 8% above the 2025 record. Expansion feasibility study targeting +4 Bcm/year commissioned.",
    date: "June 02, 2026",
    source: "Medgaz S.A.",
    link: "#",
  },
  {
    id: 14,
    category: "Algeria",
    title: "Sonatrach Announces 1 GW Solar Target for Arzew Industrial Zone by 2030",
    summary: "Green energy roadmap targets 15% renewable electricity share at the Arzew-Bethioua complex. Phase 1 pilot of 120 MW PV plant breaks ground Q3 2026, with green hydrogen electrolyser integration planned for Phase 2.",
    date: "May 05, 2026",
    source: "Ministry of Energy",
    link: "#",
  },

  /* ── GLOBAL ── */
  {
    id: 15,
    category: "Global",
    title: "LNG Canada Phase 1 Ships First Commercial Cargo — Supply Balance Shifts",
    summary: "The first LNG cargo from Kitimat, British Columbia heads to Japanese buyers, adding 14 MTPA of Pacific-facing supply and easing Asian spot prices. Full nameplate capacity expected by Q3 2026.",
    date: "June 01, 2026",
    source: "Shell",
    link: "#",
  },
  {
    id: 16,
    category: "Global",
    title: "Qatar Lifts LNG Output Forecast to 142 MTPA by 2030",
    summary: "QatarEnergy confirms an accelerated timeline for North Field East and South expansion trains, raising the national production ceiling by 55 MTPA. Long-term SPAs signed with European, Asian, and South American utilities.",
    date: "May 26, 2026",
    source: "QatarEnergy",
    link: "#",
  },
  {
    id: 17,
    category: "Global",
    title: "EU Commission Updates LNG Infrastructure Regulation — 20% Buffer Mandate",
    summary: "Brussels mandates minimum LNG buffer regasification capacity of 20% for all member states by Q3 2026. Five new FSRU terminals approved under expedited environmental permitting procedures.",
    date: "May 20, 2026",
    source: "European Commission",
    link: "https://ec.europa.eu",
  },
  {
    id: 18,
    category: "Global",
    title: "Russian Pipeline Gas to Europe at Historic 5-Year Low — LNG Fills the Gap",
    summary: "Transit agreements expiration leaves LNG from Algeria, the USA, and Qatar covering 34% of EU import needs. Algeria's share of EU LNG imports rose to 18.3%, second only to the USA.",
    date: "May 08, 2026",
    source: "Bruegel Institute",
    link: "#",
  },
];

const CATEGORIES: Category[] = ["All", "Operations", "Market", "Algeria", "Global"];

const CAT_META: Record<Exclude<Category,"All">, { icon: LucideIcon; color: string; badge: string }> = {
  Operations: { icon: Factory,   color: "text-sky-400",     badge: "border-sky-500/30 text-sky-400 bg-sky-500/5" },
  Market:     { icon: TrendingUp,color: "text-emerald-400", badge: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" },
  Algeria:    { icon: MapPin,    color: "text-orange-400",  badge: "border-orange-500/30 text-orange-400 bg-orange-500/5" },
  Global:     { icon: Globe,     color: "text-violet-400",  badge: "border-violet-500/30 text-violet-400 bg-violet-500/5" },
};

/* ─── COMPONENT ───────────────────────────────────────────────────────────── */
export default function News() {
  const { lang } = useI18n();
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const id = setInterval(() => setSlideIndex(p => (p + 1) % newsSlides.length), 5500);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return NEWS.filter(a => {
      if (activeCategory !== "All" && a.category !== activeCategory) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.source.toLowerCase().includes(q);
    });
  }, [activeCategory, searchQ]);

  const featured = filtered.find(a => a.featured);
  const grid     = filtered.filter(a => !a.featured || !featured || a.id !== featured.id);

  return (
    <div className="industrial-grid min-h-screen bg-background pb-16 space-y-10">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border min-h-[420px] flex items-center bg-zinc-950 isolation-isolate w-full">
        <div className="absolute inset-0 z-0 pointer-events-none">
          {newsSlides.map((slide, idx) => (
            <img key={idx} src={slide.image} alt={slide.tag}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out
                ${idx === slideIndex ? "opacity-75 scale-100" : "opacity-0 scale-105"}`} />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/85 via-zinc-950/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 stripe-warning z-20" />

        <div className="relative px-4 md:px-10 py-16 max-w-7xl mx-auto z-20 w-full">
          <div className="max-w-3xl space-y-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-orange-500 font-mono font-bold">
              / {lang === "en" ? "REAL-TIME MARKET INTELLIGENCE" : "INTELLIGENCE MARCHÉ EN TEMPS RÉEL"}
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold text-white tracking-tight leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              LNG Market Hub
              <span className="h-3 w-3 rounded-full bg-orange-500 inline-block ml-1.5 translate-y-[-4px]" />
            </h1>
            <p className="text-sm md:text-base text-zinc-300 max-w-xl leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {lang === "en"
                ? `${NEWS.length} industry dispatches · live market benchmarks · Sonatrach & global LNG`
                : `${NEWS.length} dépêches · indices de marché en direct · Sonatrach & GNL mondial`}
            </p>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
              <MarketStat icon={TrendingUp} label="TTF (EU)"   value="€31.44" trend="+2.4%" />
              <MarketStat icon={Zap}        label="Henry Hub"  value="$2.85"  trend="-0.8%" />
              <MarketStat icon={Globe}      label="JKM (Asia)" value="$12.10" trend="+1.1%" />
              <MarketStat icon={Activity}   label="Spot Vol"   value="HIGH" />
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
              {lang === "en" ? "Industry News" : "Actualités Secteur"}
            </h2>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  "px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wide transition-all border",
                  activeCategory === cat
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "border-border text-muted-foreground hover:border-orange-500/40 hover:text-foreground",
                ].join(" ")}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Search within news */}
        <div className="mt-4 mb-8 relative max-w-sm">
          <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={lang === "en" ? "Search headlines…" : "Rechercher…"}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-orange-500/60 font-mono placeholder:text-muted-foreground/50"
          />
        </div>

        {/* ── FEATURED ─────────────────────────────────────────────────────── */}
        {featured && (
          <a href={featured.link} target="_blank" rel="noopener noreferrer"
            className="group block mb-6 border border-border rounded-2xl bg-card overflow-hidden hover:border-orange-500/50 transition-all hover:-translate-y-0.5 shadow-sm">
            <div className="flex flex-col md:flex-row">
              <div className="md:flex-1 p-6 md:p-8 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500 text-[10px] font-mono font-bold text-white uppercase tracking-widest">
                    <Flame className="h-3 w-3" /> Featured
                  </span>
                  <CategoryBadge category={featured.category} />
                </div>
                <h3 className="text-2xl md:text-3xl font-display font-extrabold leading-tight group-hover:text-orange-400 transition-colors">
                  {featured.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-2xl">{featured.summary}</p>
                <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <span>{featured.date} · {featured.source}</span>
                  <span className="flex items-center gap-1 group-hover:gap-2 transition-all text-orange-500">
                    Read More <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </a>
        )}

        {/* ── GRID ─────────────────────────────────────────────────────────── */}
        {grid.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grid.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-20">
            <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-mono text-sm">No articles match your filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── SUB-COMPONENTS ──────────────────────────────────────────────────────── */

function CategoryBadge({ category }: { category: Exclude<Category,"All"> }) {
  const meta = CAT_META[category];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-widest ${meta.badge}`}>
      <Icon className="h-3 w-3" />{category}
    </span>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer"
      className="group border border-border rounded-xl bg-card p-5 flex flex-col justify-between hover:border-orange-500/40 hover:-translate-y-1 transition-all shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <CategoryBadge category={article.category} />
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-orange-500 transition-colors shrink-0 mt-0.5" />
        </div>
        <h3 className="font-display font-bold leading-snug text-base group-hover:text-orange-400 transition-colors">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {article.summary}
        </p>
      </div>
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
        <span>{article.date}</span>
        <span className="flex items-center gap-1 group-hover:gap-2 transition-all group-hover:text-orange-500">
          {article.source} <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
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
        <span className="text-xl font-display font-extrabold text-white">{value}</span>
        {trend && (
          <span className={`text-[10px] font-mono ${trend.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>{trend}</span>
        )}
      </div>
    </div>
  );
    }
