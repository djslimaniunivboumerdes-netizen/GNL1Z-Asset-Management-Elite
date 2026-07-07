// src/pages/About.tsx
import { useEffect, useState } from "react";
import { 
  Factory, MapPin, ShieldCheck, Layers, Flame, 
  Gauge, Anchor, Award, LucideIcon 
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { GNL1Z_ASSETS } from "@/utils/assets";

/* ─── ABOUT PAGE BACKGROUND SLIDES ─── */
const aboutSlides = [
  { tag: "Complex Overview", image: GNL1Z_ASSETS.units.unit40 },
  { tag: "Liquefaction Train", image: GNL1Z_ASSETS.units.unit30 },
  { tag: "Cryogenic Storage", image: GNL1Z_ASSETS.units.unit50 }
] as const;

export default function About() {
  const { lang } = useI18n();
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const sequence = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % aboutSlides.length);
    }, 6000);
    return () => clearInterval(sequence);
  }, []);

  return (
    <div className="industrial-grid min-h-screen bg-background pb-16 space-y-12">
      
      {/* ─── HERO BANNER: WIDESCREEN IMMERSIVE CAROUSEL ─── */}
      <section className="relative overflow-hidden border-b border-border min-h-[460px] flex items-center bg-zinc-950 isolation-isolate w-full">
        
        {/* Layer 1: High-Definition Background Photos */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {aboutSlides.map((slide, idx) => (
            <img
              key={idx}
              src={slide.image}
              alt={slide.tag}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out
                ${idx === slideIndex ? "opacity-80 scale-100" : "opacity-0 scale-105"}`}
            />
          ))}
        </div>

        {/* Layer 2: Scrim — left text area readable, image visible everywhere */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/85 via-zinc-950/20 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 stripe-warning z-20" />

        {/* Layer 3: Typography Header */}
        <div className="relative px-4 md:px-10 py-16 max-w-7xl mx-auto z-20 w-full">
          <div className="max-w-3xl space-y-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-orange-500 font-mono font-bold">
              {lang === "en" ? "/ COMPLEX OVERVIEW & SPECS" : "/ APPERÇU DU COMPLEXE & SPECS"}
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold text-white tracking-tight leading-none">
              About GNL1Z
              <span className="h-3 w-3 rounded-full bg-orange-500 inline-block ml-1.5 translate-y-[-4px]" />
            </h1>
            <p className="text-base md:text-xl text-zinc-200 font-light leading-relaxed drop-shadow-md">
              {lang === "en"
                ? "The GL1Z liquefaction complex stands as a cornerstone of Sonatrach's downstream hydrocarbon processing infrastructure, employing the proven Air Products C3MR™ process cycle."
                : "Le complexe de liquéfaction GL1Z constitue un pilier de l'infrastructure de traitement aval de Sonatrach, utilisant le cycle de procédé éprouvé Air Products C3MR™."}
            </p>
          </div>
        </div>
      </section>

      {/* ─── TECHNICAL SPECIFICATIONS GRID ─── */}
      <section className="px-4 md:px-10 max-w-7xl mx-auto space-y-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-orange-500 font-mono mb-1">/ Parameters</div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">Technical Architecture</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TechCard 
            icon={Layers} 
            title={lang === "en" ? "Process Cycle" : "Cycle de Procédé"}
            value="AP-C3MR™" 
            sub={lang === "en" ? "Propane Pre-cooled Mixed Refrigerant" : "Refrigérant Mixte Pré-refroidi au Propane"}
          />
          <TechCard 
            icon={Gauge} 
            title={lang === "en" ? "Design Capacity" : "Capacité Nominale"} 
            value="10.5 MTA" 
            sub={lang === "en" ? "Million Tons per Annum Liquefied Gas" : "Millions de Tonnes par An de Gaz Liquéfié"}
          />
          <TechCard 
            icon={Flame} 
            title={lang === "en" ? "Cryogenic Storage" : "Stockage Cryogénique"} 
            value="300,000 m³" 
            sub={lang === "en" ? "Total containment structural tanks" : "Réservoirs à intégrité totale"}
          />
          <TechCard 
            icon={Anchor} 
            title={lang === "en" ? "Marine Terminal" : "Terminal Maritime"} 
            value="2 Loading Berths" 
            sub={lang === "en" ? "High-rate simultaneous LNG exporting" : "Exportation simultanée à haut débit"}
          />
        </div>
      </section>

      {/* ─── DETAILED INFORMATION PROFILE ─── */}
      <section className="px-4 md:px-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        
        {/* Geographic Context */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between hover:border-sky-500/30 transition-all duration-200">
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 w-fit border border-sky-500/20">
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-display font-bold tracking-tight">
              {lang === "en" ? "Geographic Location" : "Emplacement Géographique"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === "en"
                ? "Situated within the industrial zone of Arzew/Bethioua, Algeria. The facility benefits from prime Mediterranean coastal placement, enabling streamlined pipeline delivery routes from Hassi R'Mel gas fields and optimal maritime export access."
                : "Situé dans la zone industrielle d'Arzew/Bethioua, Algérie. L'usine bénéficie d'un emplacement côtier privilégié, facilitant l'acheminement par gazoduc depuis Hassi R'Mel et l'exportation maritime."}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Coordinates: 35.8122° N, 0.2851° W
          </div>
        </div>

        {/* Operational Focus */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between hover:border-amber-500/30 transition-all duration-200">
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit border border-amber-500/20">
              <Factory className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-display font-bold tracking-tight">
              {lang === "en" ? "Industrial Infrastructure" : "Infrastructures Industrielles"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === "en"
                ? "The plant features advanced feed gas treatment units, heavy hydrocarbon extraction units, and high-horsepower refrigeration compressor strings. This hub acts as the main software analytics platform tracking rotating asset health and thermodynamic loop efficiencies."
                : "L'usine comprend des unités avancées de traitement du gaz d'alimentation, d'extraction des hydrocarbures lourds, et des trains de compresseurs de réfrigération. Ce hub sert de plateforme d'analyse principale."}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Configuration: 6 Processing Trains
          </div>
        </div>

        {/* Asset Integrity Standards */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-200">
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit border border-emerald-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-display font-bold tracking-tight">
              {lang === "en" ? "Asset Integrity & HSE" : "Intégrité des Actifs & HSE"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === "en"
                ? "Operating under international hydrocarbon processing metrics and safety criteria. Continuous dynamic scheduling ensures rigorous mechanical integrity inspections, structural stress monitoring, and structural preventive scheduling for cryogenic heat exchangers."
                : "Opérant selon des critères internationaux de traitement des hydrocarbures et de sécurité. Une planification dynamique continue assure des inspections rigoureuses de l'intégrité mécanique."}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Compliance: ISO 9001 / OSHA Standards
          </div>
        </div>

      </section>
    </div>
  );
}

interface TechCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  sub: string;
}

function TechCard({ icon: Icon, title, value, sub }: TechCardProps) {
  return (
    <div className="bg-zinc-900/40 border border-border/60 rounded-xl p-5 hover:border-orange-500/20 transition-colors duration-200">
      <div className="flex items-center gap-2 text-zinc-400 text-[10px] uppercase tracking-widest font-mono mb-3">
        <Icon className="h-3.5 w-3.5 text-orange-500" />
        {title}
      </div>
      <div className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
        {value}
      </div>
      <p className="text-xs text-muted-foreground mt-2 font-normal leading-normal">
        {sub}
      </p>
    </div>
  );
}
