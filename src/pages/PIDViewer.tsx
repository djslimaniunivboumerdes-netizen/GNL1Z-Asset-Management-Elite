import React, { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { X, ZoomIn, ExternalLink, Search, Filter, ChevronRight, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const ACCENT = "#f97316";

// ─── PID Sections ────────────────────────────────────────────────────────────
type SectionKey =
  | "co2"
  | "dehydr"
  | "propane"
  | "feed_chill"
  | "mcr"
  | "main_exch"
  | "demetha"
  | "deetha"
  | "depropa"
  | "debuta"
  | "utilities"
  | "fuel";

const SECTIONS: Record<SectionKey, { en: string; fr: string; color: string; icon: string }> = {
  co2:        { en: "CO₂ Removal (MEA)",       fr: "Élimination CO₂ (MEA)",       color: "#10b981", icon: "X01" },
  dehydr:     { en: "Dehydration / Dryer",      fr: "Déshydratation / Sécheur",    color: "#a78bfa", icon: "X02" },
  propane:    { en: "Propane Compression",      fr: "Compression Propane",         color: "#60a5fa", icon: "X03" },
  feed_chill: { en: "MCR & Feed Chilling",      fr: "Refroidissement MCR & Alim.", color: "#f59e0b", icon: "X04" },
  mcr:        { en: "MCR Compression",          fr: "Compression MCR",             color: "#a855f7", icon: "X05" },
  main_exch:  { en: "Main Exchanger (MCHE)",    fr: "Échangeur Principal (MCHE)",  color: "#22d3ee", icon: "X06" },
  demetha:    { en: "Demethaniser",             fr: "Déméthaniseur",               color: "#22c55e", icon: "X07" },
  deetha:     { en: "De-ethaniser",             fr: "Dééthaniseur",                color: "#4ade80", icon: "X08" },
  depropa:    { en: "Depropaniser",             fr: "Dépropaniseur",               color: "#84cc16", icon: "X09" },
  debuta:     { en: "Debutaniser",              fr: "Débutaniseur",                color: "#eab308", icon: "X10" },
  utilities:  { en: "Utilities / Steam",        fr: "Utilités / Vapeur",           color: "#94a3b8", icon: "X00" },
  fuel:       { en: "Fuel Gas",                 fr: "Gaz Combustible",             color: "#ef4444", icon: "K13" },
};

// ─── PID Sheet Data ───────────────────────────────────────────────────────────
interface PIDSheet {
  id: string;
  driveId: string;
  title: { en: string; fr: string };
  drawing: string;
  section: SectionKey;
  equipment: string[];
  tags?: string;
}

const PID_SHEETS: PIDSheet[] = [
  // CO₂ Removal
  {
    id: "x01-1",
    driveId: "1XnQlsFf0j5eNlUDr9rKZfZkr3h2tGNDi",
    title: { en: "MEA CO₂ Absorber", fr: "Absorbeur CO₂ MEA" },
    drawing: "85-X01-10.3",
    section: "co2",
    equipment: ["G507"],
    tags: "MEA amine absorber flash drum CO2",
  },
  {
    id: "x01-2",
    driveId: "1DRydZxIMQCB7dy5I5C_nnVdQyjEzV4mn",
    title: { en: "MEA CO₂ Removal — Absorber System", fr: "Élimination CO₂ MEA — Système Absorbeur" },
    drawing: "85-X01-10.15",
    section: "co2",
    equipment: ["P501", "P502", "F502", "E504", "E506", "J510", "J511"],
    tags: "MEA solution cooler carbon filter pumps wash water",
  },

  // Dehydration / Dryer
  {
    id: "x02-1",
    driveId: "1s-HhZ9SDd9IrC54FoJgW3qgctdfKyBR4",
    title: { en: "Dryer Section — Sheet 1", fr: "Section Sécheur — Feuille 1" },
    drawing: "85-X02-10.1",
    section: "dehydr",
    equipment: ["G787", "R310", "R311"],
    tags: "molecular sieve drier separator dehydration",
  },
  {
    id: "x02-2",
    driveId: "17Ixt5YVT0PCuNO0tQdt__ruax58T3o8x",
    title: { en: "Dryer Section — Mercury Removal Sheet 2", fr: "Section Sécheur — Démercurisation Feuille 2" },
    drawing: "85-X02-10.2",
    section: "dehydr",
    equipment: ["R312", "P312", "R314"],
    tags: "mercury removal dust filters vessel demercurisation",
  },
  {
    id: "x02-4",
    driveId: "1iBYssKKcfcQFf28qmZqLcuhhpY3n6c43",
    title: { en: "Dryer Reactivation — Blower & Cooler", fr: "Réactivation Sécheur — Soufflante & Refroidisseur" },
    drawing: "85-X02-10.4",
    section: "dehydr",
    equipment: ["K301", "G314", "E315"],
    tags: "reactivation blower separator cooler dryer",
  },

  // Propane Compression
  {
    id: "x03-1",
    driveId: "1ptzlIPKMw4oC6aT5tbhw--LcivaqSt6c",
    title: { en: "Propane Compression", fr: "Compression Propane" },
    drawing: "85-X03-10.1",
    section: "propane",
    equipment: ["E513", "K110"],
    tags: "propane compressor desuperheater turbine woodward governor",
  },
  {
    id: "x03-2",
    driveId: "1UX683Oz0fNogWftWMBUUtitF7ye8VB2s",
    title: { en: "Propane Condensers", fr: "Condenseurs Propane" },
    drawing: "85-X03-10.2",
    section: "propane",
    equipment: ["E514A", "E514B", "E515", "F516", "G786"],
    tags: "propane condenser accumulator purge column vent",
  },
  {
    id: "x03-4",
    driveId: "1li0MiuwYTB0l1J6r5J7jz9RPV0XBTe4I",
    title: { en: "Propane & MCR Compressors — Oil Flow", fr: "Compresseurs Propane & MCR — Flux d'Huile" },
    drawing: "85-X03-10.4",
    section: "propane",
    equipment: ["K110"],
    tags: "oil flow lubrication seal centrifuge GE turbine GOK4",
  },

  // MCR & Feed Chilling (X04)
  {
    id: "x04-1",
    driveId: "1aNlMZ1PutUuOBqEh70GRxyyy7RF8wM9w",
    title: { en: "Scrub Tower Section", fr: "Section Tour de Lavage" },
    drawing: "85-X04-10.1",
    section: "feed_chill",
    equipment: ["F711", "E713", "E717", "E523"],
    tags: "scrub tower reboiler condenser heavy hydrocarbons C5+",
  },
  {
    id: "x04-25",
    driveId: "1l2sSD2QO7VU29tmAFciLRJKUra7HCUiC",
    title: { en: "MCR & Feed Chilling — Propane Chillers", fr: "Refroidissement MCR & Alim. — Chillers Propane" },
    drawing: "85-X04-10.25",
    section: "feed_chill",
    equipment: ["E522", "E524", "E525A", "E525B", "E526A", "E526B", "G785", "G790"],
    tags: "propane chiller medium pressure MCR suction drum",
  },
  {
    id: "x04-3",
    driveId: "1iStV_uflAm7IosS2RzVGWR-i4cU9nEFM",
    title: { en: "MCR & Feed Chilling — Transfer & Precooler", fr: "Refroidissement MCR & Alim. — Transfert & Prérefroidisseur" },
    drawing: "85-X04-10.3",
    section: "feed_chill",
    equipment: ["E521", "G791", "J795", "E797"],
    tags: "propane transfer heater sideload suction drum precooler",
  },
  {
    id: "x04-4",
    driveId: "18tZeKQIV2gkVqp7FtaJouHbiXmCGTl3r",
    title: { en: "MCR & Feed Chilling — Sheet 3 Scrub Reflux", fr: "Refroidissement MCR & Alim. — Feuille 3 Reflux Lavage" },
    drawing: "85-X04-10.4",
    section: "feed_chill",
    equipment: ["E540", "G714", "J715", "J716"],
    tags: "scrub column reflux pump",
  },

  // MCR Compression (X05)
  {
    id: "x05-1",
    driveId: "1JL1cUAjnwklIzAgssF8Lfjpyxy46Znvs",
    title: { en: "MCR Compression — 1st Stage", fr: "Compression MCR — 1er Étage" },
    drawing: "85-X05-10.1",
    section: "mcr",
    equipment: ["E511", "G788", "K120"],
    tags: "MCR compressor 1st stage suction drum intercooler turbine woodward",
  },
  {
    id: "x05-2",
    driveId: "12zjL0ltBTQyidegHSUYcbNioA3RLIXEB",
    title: { en: "MCR Compression — 2nd Stage", fr: "Compression MCR — 2ème Étage" },
    drawing: "85-X05-10.2",
    section: "mcr",
    equipment: ["E512", "G789", "K121"],
    tags: "MCR compressor 2nd stage suction drum aftercooler turbine",
  },

  // Main Exchanger / Liquefaction (X06)
  {
    id: "x06-1",
    driveId: "1HZw_f38-vQEkcDh5GmrROaYUsv7_Gs-s",
    title: { en: "Main Cryogenic Heat Exchanger — Sheet 1", fr: "Échangeur Cryogénique Principal — Feuille 1" },
    drawing: "85-X06-10.1",
    section: "main_exch",
    equipment: ["E520", "R792", "R793"],
    tags: "MCHE main exchanger MCR liquid warm cold strand",
  },
  {
    id: "x06-2",
    driveId: "1Sn9BM5N_0EbgZE1AlFhNGlgFG_yDOMx4",
    title: { en: "Main Exchanger — Sheet 2 (HP Separator & Strainer)", fr: "Échangeur Principal — Feuille 2 (Séparateur HP & Filtre)" },
    drawing: "85-X06-10.2",
    section: "main_exch",
    equipment: ["E530", "G780", "R784"],
    tags: "HP separator MCR strainer feed reject gas exchanger",
  },
  {
    id: "x06-3",
    driveId: "1hKdpV7rH_te70GxsECbuKJsDZQ38lhBi",
    title: { en: "Flash Drum & LNG Product Pumps", fr: "Ballon de Flash & Pompes Produit GNL" },
    drawing: "85-X06-10.3",
    section: "main_exch",
    equipment: ["G783", "J1020", "J1030"],
    tags: "nitrogen flash drum product pump LNG storage",
  },

  // Demethaniser (X07)
  {
    id: "x07-1",
    driveId: "10tqueQZHEfRYAZPEa3XVQLygMibHwkJo",
    title: { en: "Demethaniser", fr: "Déméthaniseur" },
    drawing: "85-X07-10",
    section: "demetha",
    equipment: ["F721", "F722", "E723", "G724", "E730"],
    tags: "demethaniser column condenser reboiler reflux drum pumps bottoms cooler",
  },
  {
    id: "x07-1b",
    driveId: "1BfnfCho8YP4wfevhbZyJWfg23yAtPZkD",
    title: { en: "Demethaniser (Annotated)", fr: "Déméthaniseur (Annoté)" },
    drawing: "85-X07-10 (rev+)",
    section: "demetha",
    equipment: ["F721", "F722", "E723", "G724", "E730"],
    tags: "demethaniser annotated revision",
  },

  // De-ethaniser (X08)
  {
    id: "x08-1",
    driveId: "16JOnZ04Stw9vnQXcSTTreby_gctLwmFb",
    title: { en: "De-ethaniser", fr: "Dééthaniseur" },
    drawing: "85-X08-10",
    section: "deetha",
    equipment: ["F731", "E732", "E733", "G734", "G736", "J735", "J740"],
    tags: "de-ethaniser column condenser reboiler propane separator reflux",
  },

  // Depropaniser (X09)
  {
    id: "x09-1",
    driveId: "1uaKCbX73t0udB6xVd89r_wSHEdGMm61f",
    title: { en: "Depropaniser", fr: "Dépropaniseur" },
    drawing: "85-X09-10",
    section: "depropa",
    equipment: ["F741", "E742", "E743", "G744", "J745", "J748"],
    tags: "depropaniser column condenser reboiler reflux drum pumps LPG",
  },

  // Debutaniser (X10)
  {
    id: "x10-1",
    driveId: "1YShEFvAQ7uczpYvz0Ek25XsvqVnjo5Lt",
    title: { en: "Debutaniser", fr: "Débutaniseur" },
    drawing: "85-X10-10.1",
    section: "debuta",
    equipment: ["F751", "E752", "E753", "G754", "J755", "J762"],
    tags: "debutaniser column condenser reboiler gasoline cooler reflux",
  },
  {
    id: "x10-2",
    driveId: "1bFhEhleLR12lnd5t17D1XTU6-cmuNbtC",
    title: { en: "Debutaniser — Reflux & Returns", fr: "Débutaniseur — Reflux & Retours" },
    drawing: "85-X10-10.2",
    section: "debuta",
    equipment: ["E738", "E739", "J737", "J747", "J757", "J761"],
    tags: "debutaniser reflux LNG returns subcooler ethane propane butane recycling",
  },
  {
    id: "x10-2b",
    driveId: "16Wr_zBkPUQKDZa7gQFHPIZw04YINiXV6",
    title: { en: "Debutaniser Reflux (Annotated)", fr: "Reflux Débutaniseur (Annoté)" },
    drawing: "85-X10-10.2 (rev+)",
    section: "debuta",
    equipment: ["E738", "E739", "J737", "J747", "J757", "J761"],
    tags: "annotated revision",
  },

  // Utilities / Steam (X00)
  {
    id: "x00-21-1",
    driveId: "1flhzKa5WKOSGcbgBh3RDgTIsMO7Fngyz",
    title: { en: "Steam & Condensate System — Sheet 1", fr: "Système Vapeur & Condensat — Feuille 1" },
    drawing: "85-X00-21.1",
    section: "utilities",
    equipment: ["K110", "K120"],
    tags: "steam condensate turbine compressor propane MCR",
  },
  {
    id: "x00-21-3",
    driveId: "1MRMS2pY4KFLjC8n3TnuFunCR4mSGPpj1",
    title: { en: "Steam & Condensate System — Sheet 3", fr: "Système Vapeur & Condensat — Feuille 3" },
    drawing: "85-X00-21.3",
    section: "utilities",
    equipment: ["E723", "E733", "E743", "E753"],
    tags: "steam condensate demethaniser de-ethaniser reboilers defrost heater",
  },
  {
    id: "x00-23",
    driveId: "1j6y5B_BvpckdxFoGwvXRA9KULviD9xjx",
    title: { en: "Miscellaneous Utilities — Train Distribution", fr: "Utilités Diverses — Distribution Train" },
    drawing: "85-X00-23",
    section: "utilities",
    equipment: ["G325", "T200"],
    tags: "instrument air utility stations LNG product pump miscellaneous",
  },
  {
    id: "g201",
    driveId: "1yXpb0sRNn4A0REPps_Ha9imyi1B2SWbf",
    title: { en: "Utility Station / Vessel G201", fr: "Poste Utilité / Capacité G201" },
    drawing: "85-X00",
    section: "utilities",
    equipment: ["G201", "J201"],
    tags: "utility station vessel pump",
  },

  // Fuel Gas
  {
    id: "x02-3",
    driveId: "1OwWhnqMPPY4-v3SAuWclv_IKurN5ntdO",
    title: { en: "Fuel Gas Compressor & Dryer Section", fr: "Compresseur Gaz Combustible & Section Sécheur" },
    drawing: "85-X02-10.3",
    section: "fuel",
    equipment: ["E316", "E317", "G304", "K130"],
    tags: "fuel gas compressor turbine aftercooler mixer vaporiser",
  },
  {
    id: "x02-5",
    driveId: "1hcKllyNgpLX48WcBPRpg7GkWY0ZrPhc1",
    title: { en: "Fuel Gas Compressor — Oil Flow", fr: "Compresseur Gaz Combustible — Flux d'Huile" },
    drawing: "85-X02-10.5",
    section: "fuel",
    equipment: ["K130"],
    tags: "fuel gas compressor turbine oil flow lubrication seal",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function thumbUrl(driveId: string) {
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w640`;
}
function viewUrl(driveId: string) {
  return `https://drive.google.com/file/d/${driveId}/view`;
}
function previewUrl(driveId: string) {
  return `https://drive.google.com/file/d/${driveId}/preview`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PIDViewer() {
  const { lang } = useI18n();
  const [activeSection, setActiveSection] = useState<SectionKey | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PIDSheet | null>(null);
  const [imgLoaded, setImgLoaded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    let list = PID_SHEETS;
    if (activeSection !== "all") list = list.filter((p) => p.section === activeSection);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.en.toLowerCase().includes(q) ||
          p.title.fr.toLowerCase().includes(q) ||
          p.drawing.toLowerCase().includes(q) ||
          p.equipment.some((e) => e.toLowerCase().includes(q)) ||
          (p.tags ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeSection, search]);

  const sectionKeys = Object.keys(SECTIONS) as SectionKey[];

  const openSheet = useCallback((sheet: PIDSheet) => {
    setSelected(sheet);
  }, []);

  const closeSheet = useCallback(() => setSelected(null), []);

  const T = (en: string, fr: string) => (lang === "fr" ? fr : en);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/50 px-4 md:px-10 py-8 max-w-7xl mx-auto">
        <div className="text-[10px] uppercase tracking-widest font-mono mb-2" style={{ color: ACCENT }}>
          / {T("Piping & Instrumentation Diagrams", "Schémas de Tuyauteries & Instrumentation")}
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-2">
          P&amp;ID {T("Library", "Bibliothèque")}
          <span style={{ color: ACCENT }}>.</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
          {T(
            "GNL1Z liquefaction train P&ID sheets organized by process section. Click any sheet to view the full diagram. Open in Google Drive for full resolution.",
            "Feuilles P&ID du train de liquéfaction GNL1Z organisées par section procédé. Cliquez une feuille pour afficher le schéma complet. Ouvrir dans Google Drive pour la pleine résolution."
          )}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={T("Search by tag, equipment, drawing…", "Rechercher par tag, équipement, plan…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-mono text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>{filtered.length} {T("sheets", "feuilles")}</span>
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* ── Sidebar Section Filter ───────────────────────────────── */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-border min-h-[calc(100vh-160px)] p-4 sticky top-0 self-start">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">
            {T("Sections", "Sections")}
          </div>
          <button
            onClick={() => setActiveSection("all")}
            className="w-full text-left px-3 py-2 rounded text-sm font-mono mb-1 transition-colors flex items-center justify-between"
            style={{
              background: activeSection === "all" ? `${ACCENT}20` : "transparent",
              color: activeSection === "all" ? ACCENT : "hsl(var(--foreground))",
            }}
          >
            <span>{T("All Sections", "Toutes les Sections")}</span>
            <span className="text-xs opacity-60">{PID_SHEETS.length}</span>
          </button>
          {sectionKeys.map((key) => {
            const s = SECTIONS[key];
            const count = PID_SHEETS.filter((p) => p.section === key).length;
            const active = activeSection === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className="w-full text-left px-3 py-2 rounded text-xs font-mono mb-0.5 transition-all flex items-center gap-2"
                style={{
                  background: active ? `${s.color}15` : "transparent",
                  color: active ? s.color : "hsl(var(--muted-foreground))",
                  borderLeft: active ? `2px solid ${s.color}` : "2px solid transparent",
                }}
              >
                <span className="font-bold opacity-60">{s.icon}</span>
                <span className="flex-1 truncate">{lang === "fr" ? s.fr : s.en}</span>
                <span className="opacity-50">{count}</span>
              </button>
            );
          })}
        </aside>

        {/* ── Main Gallery ─────────────────────────────────────────── */}
        <main className="flex-1 p-4 md:p-6">
          {/* Mobile section filter */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
            <button
              onClick={() => setActiveSection("all")}
              className="shrink-0 px-3 py-1.5 rounded text-xs font-mono border"
              style={{
                borderColor: activeSection === "all" ? ACCENT : "hsl(var(--border))",
                background: activeSection === "all" ? `${ACCENT}20` : "transparent",
                color: activeSection === "all" ? ACCENT : "hsl(var(--foreground))",
              }}
            >
              {T("All", "Tout")}
            </button>
            {sectionKeys.map((key) => {
              const s = SECTIONS[key];
              const active = activeSection === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className="shrink-0 px-3 py-1.5 rounded text-xs font-mono border"
                  style={{
                    borderColor: active ? s.color : "hsl(var(--border))",
                    background: active ? `${s.color}20` : "transparent",
                    color: active ? s.color : "hsl(var(--foreground))",
                  }}
                >
                  {s.icon}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground font-mono text-sm">
              {T("No P&ID sheets match your filter.", "Aucune feuille P&ID ne correspond à votre filtre.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((sheet) => {
                const sec = SECTIONS[sheet.section];
                return (
                  <button
                    key={sheet.id}
                    onClick={() => openSheet(sheet)}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ "--hover-color": sec.color } as React.CSSProperties}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">
                      {!imgLoaded[sheet.id] && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FileImage className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <img
                        src={thumbUrl(sheet.driveId)}
                        alt={lang === "fr" ? sheet.title.fr : sheet.title.en}
                        loading="lazy"
                        onLoad={() => setImgLoaded((p) => ({ ...p, [sheet.id]: true }))}
                        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                          imgLoaded[sheet.id] ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="flex items-center gap-2 text-white text-sm font-mono">
                          <ZoomIn className="h-4 w-4" /> {T("View", "Afficher")}
                        </div>
                      </div>
                      {/* Section badge */}
                      <div
                        className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                        style={{ background: `${sec.color}ee`, color: "white" }}
                      >
                        {sec.icon}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1.5">
                      <div className="text-[10px] font-mono text-muted-foreground">{sheet.drawing}</div>
                      <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                        {lang === "fr" ? sheet.title.fr : sheet.title.en}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sheet.equipment.slice(0, 4).map((eq) => (
                          <span
                            key={eq}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm border"
                            style={{ borderColor: `${sec.color}60`, color: sec.color }}
                          >
                            {eq}
                          </span>
                        ))}
                        {sheet.equipment.length > 4 && (
                          <span className="text-[9px] font-mono text-muted-foreground">
                            +{sheet.equipment.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Lightbox / Sheet Viewer ──────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col"
          onClick={closeSheet}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[hsl(220_25%_6%)] shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: SECTIONS[selected.section].color }}
              />
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-white/50 truncate">{selected.drawing}</div>
                <div className="text-sm font-semibold text-white truncate">
                  {lang === "fr" ? selected.title.fr : selected.title.en}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={viewUrl(selected.driveId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {T("Open in Drive", "Ouvrir dans Drive")}
              </a>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white" onClick={closeSheet}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Viewer body */}
          <div className="flex flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
            {/* Sidebar info */}
            <div className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/10 bg-[hsl(220_25%_6%)] p-4 gap-4 overflow-y-auto">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-mono mb-2" style={{ color: ACCENT }}>
                  {T("Section", "Section")}
                </div>
                <Badge
                  style={{
                    background: `${SECTIONS[selected.section].color}25`,
                    color: SECTIONS[selected.section].color,
                    border: `1px solid ${SECTIONS[selected.section].color}40`,
                  }}
                  className="text-xs font-mono"
                >
                  {lang === "fr" ? SECTIONS[selected.section].fr : SECTIONS[selected.section].en}
                </Badge>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest font-mono mb-2" style={{ color: ACCENT }}>
                  {T("Drawing No.", "N° Plan")}
                </div>
                <div className="text-white font-mono text-xs">{selected.drawing}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest font-mono mb-2" style={{ color: ACCENT }}>
                  {T("Equipment", "Équipements")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.equipment.map((eq) => (
                    <span
                      key={eq}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: `${SECTIONS[selected.section].color}60`,
                        color: SECTIONS[selected.section].color,
                      }}
                    >
                      {eq}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <a
                  href={viewUrl(selected.driveId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs font-mono border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {T("Full resolution in Drive", "Pleine résolution dans Drive")}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </a>
              </div>
            </div>

            {/* iframe preview */}
            <div className="flex-1 relative bg-[hsl(220_25%_4%)]">
              <iframe
                key={selected.driveId}
                src={previewUrl(selected.driveId)}
                title={lang === "fr" ? selected.title.fr : selected.title.en}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
      }
