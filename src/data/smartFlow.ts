// src/data/smartFlow.ts
//
// Everything the interactive process-flow page needs to draw the GNL1Z AP-C3MR
// liquefaction diagram: the section theme, the annotated equipment tags with
// their coordinates on the P&FD, and the instrument tags carried by each DCS
// panel.
//
// Kept out of src/pages/SmartFlow.tsx so the page stays a component, the data
// can be unit-tested on its own, and the catalogue is not tangled with pan,
// zoom and simulation state.

/** Native pixel size of gnl1z-pfd-labeled.png — drives the overlay box and clamping. */
export const PFD_WIDTH = 1218;
export const PFD_HEIGHT = 934;

export type Section =
  | "treatment" | "dehydration" | "propane"
  | "liquefaction" | "fractionation" | "compressor";

export const SECT: Record<Section, { en: string; fr: string; color: string; bg: string; border: string }> = {
  treatment:    { en:"Treatment",    fr:"Traitement",    color:"#00e5a0", bg:"rgba(0,229,160,.16)",   border:"rgba(0,229,160,.5)"   },
  dehydration:  { en:"Dehydration",  fr:"Déshydratation",color:"#38bdf8", bg:"rgba(56,189,248,.16)",  border:"rgba(56,189,248,.5)"  },
  propane:      { en:"Propane",      fr:"Propane",       color:"#fb923c", bg:"rgba(251,146,60,.16)",  border:"rgba(251,146,60,.5)"  },
  liquefaction: { en:"Liquefaction", fr:"Liquéfaction",  color:"#a78bfa", bg:"rgba(167,139,250,.16)", border:"rgba(167,139,250,.5)" },
  fractionation:{ en:"Fractionation",fr:"Fractionnement",color:"#ffb020", bg:"rgba(255,176,32,.16)",  border:"rgba(255,176,32,.5)"  },
  compressor:   { en:"Compression",  fr:"Compression",   color:"#ff4d6a", bg:"rgba(255,77,106,.16)",  border:"rgba(255,77,106,.5)"  },
};

/* ─── Instrument tags per DCS panel ─────────────────────────────────────── */
export const INSTR: Record<string, string[]> = {
  "decarbonation-01": ["FIC101205","XV-101-223","LIC101204","TI101101","AI10138","TIC10125","LIC10121","PIC101215","TI101141","PIC10104","FI10105"],
  "decarbonation-2":  ["TI101115","LIC101218","TI101108","LI10113","TI101106","PIC10107","FIC10078","LIC10119","XV-100-271","FIC10176"],
  "dehydration-1":    ["101-F502","LIC10201","XV-102248","HV102172","TI102215","PDI10204A","TI102122","KV-102-13","KV-102-14","TI102762"],
  "dehydration-2":    ["TI102215","KV-10223","TI102214","KV-10222","TIC102208","PI102217","FIC102219","LIC10239","HIC102221"],
  "dehydration-3":    ["PI102149","PDI102153","PI102227","AAH102184","HIC102223","XV-102252","PDAH102229","PDALL102226"],
  "scrubber":         ["TI104102","TI104109","TIC10442","PI10412","LIC10417","FIC10409","TIC10413","LIC10421","FIC10449"],
  "propane-1":        ["TIC10304","FIC10301","XV-103-116","PIC103114A","TIC10313","TI103103","PI10307A","FIC10314"],
  "propane-2":        ["PI10321A","PIC10400","TI104112","LV10424A","LIC10424","LIC10401","TI103106","FIC10428"],
  "propane-3":        ["LV10435A","LIC10435","TI104104","TI104103","LV10440A","LIC10440","TI104113","ZI10442"],
  "liquefaction-2":   ["TIC10612","TI106123","TIC10611","ZI10610","PIC10610","FI10616A","AI106164","LIC10605"],
  "mcr-1":            ["FIC10505","FIC10503","FIC10504","SIC105231","PI105212","TI105101","TI105102","FIC10519","AI106164"],
  "mcr-2":            ["PI105312","SIC105331","TI105103","FIC10529","TI105104","XV-105-127","TI104113"],
  "mcr-3":            ["TI105102","PI105212","PI10515A","FIC10519","TI105101","HIC10519","FV-105-19"],
  "demethanisation":  ["XV-107-113","TI107101","TI107102","TIC10705","TI107106","LIC10709","FIC10713","FIC10715"],
  "deethanisation":   ["TI108106","PIC10802","TI108101","FIC10826","LIC10831","FIC10814","LIC10819","TIC10803"],
  "depropanisation":  ["PIC10901","PIC10912","TI109106","LIC10914","FIC10910","TI109101","TIC10902","LIC10916"],
  "debutanisation":   ["TI110106","PIC11009","FIC11000","TI110101","TIC11001","LIC11025","FIC11010","LIC11037"],
};

export interface TagDef {
  id: string; diag: string; x: number; y: number;
  nameEn: string; nameFr: string;
  section: Section; dbTag: string | null;
  dcsPanels: string[]; manuals: string[];
  descEn: string; specs: Record<string, string>;
}

export const TAGS: TagDef[] = [
  /* ── FEED TREATMENT ──────────────────────────────── */
  {
    id:"F502", diag:"101-F502", x:4.5, y:21.2,
    nameEn:"MEA Absorber",          nameFr:"Absorbeur MEA",
    section:"treatment", dbTag:"X01-F-502",
    dcsPanels:["decarbonation-01","decarbonation-2","scrubber","general-train"],
    manuals:["S01"],
    descEn:"High-pressure MEA absorber — 55.8 m × 5.5 m. Removes CO₂ from feed gas to <50 ppmv (LNG grade). 81 bar, HIC carbon steel.",
    specs:{ Pressure:"81 bar", Mass:"147 050 kg", Volume:"173 m³", Serial:"35960-6", Status:"DEROGATION" },
  },
  {
    id:"F501", diag:"101-F501", x:11.3, y:32.3,
    nameEn:"MEA Regenerator",       nameFr:"Régénérateur MEA",
    section:"treatment", dbTag:"X01-F-501",
    dcsPanels:["decarbonation-01","decarbonation-2","general-train"],
    manuals:["S01"],
    descEn:"Thermal stripping column where rich amine is heated by steam reboiler to break the MEA-CO₂ bond, releasing acid gas overhead.",
    specs:{ Pressure:"8.4 bar", Mass:"22 950 kg", Volume:"27 m³", Serial:"35959-6" },
  },
  {
    id:"E501", diag:"101-E501", x:10.5, y:7.3,
    nameEn:"Overhead Condenser",    nameFr:"Condenseur de Tête",
    section:"treatment", dbTag:"X01-E-501",
    dcsPanels:["decarbonation-01"],
    manuals:["S01"],
    descEn:"Condenses overhead steam from the regenerator column to recover pure water for the amine loop while separating and venting gaseous CO₂.",
    specs:{ Pressure:"8.6 bar", Mass:"600 kg" },
  },
  {
    id:"E502", diag:"101-E502", x:13.5, y:46.4,
    nameEn:"MEA Reboiler",          nameFr:"Rebouilleur de MEA",
    section:"treatment", dbTag:"X01-E-502",
    dcsPanels:["decarbonation-01","decarbonation-2"],
    manuals:["S01"],
    descEn:"Generates stripping steam and supplies thermal heat required to drive off CO₂ from rich amine solution in the regenerator column.",
    specs:{ Pressure:"7.2 bar", Mass:"600 kg" },
  },
  {
    id:"E503A", diag:"101-E503A", x:8.3, y:45.3,
    nameEn:"MEA Lean/Rich Exch. A", nameFr:"Échangeur MEA Lean/Rich A",
    section:"treatment", dbTag:"X01-E-503A",
    dcsPanels:["decarbonation-01","decarbonation-2"],
    manuals:["S01"],
    descEn:"Cross-exchange heat recovery between hot lean amine leaving the regenerator and cool rich amine leaving the absorber.",
    specs:{ Pressure:"8.6 bar", Mass:"600 kg" },
  },
  {
    id:"E504", diag:"101-E504", x:4.5, y:6.2,
    nameEn:"Feed Gas Pre-Heater",   nameFr:"Réchauffeur Gaz d'Alim.",
    section:"treatment", dbTag:"X01-E-504",
    dcsPanels:["decarbonation-01","scrubber"],
    manuals:["S01"],
    descEn:"Conditions the feed gas temperature to the optimal level before entering the amine contactor column.",
    specs:{ Pressure:"15.5 bar", Mass:"600 kg" },
  },
  {
    id:"G507", diag:"101-G507", x:7.8, y:12.3,
    nameEn:"Amine Flash Drum",      nameFr:"Ballon de Flash MEA",
    section:"treatment", dbTag:"X01-G-507",
    dcsPanels:["decarbonation-01","general-train"],
    manuals:["S01"],
    descEn:"Separates condensed water from overhead acid gas vapor to provide pure reflux water back to the regenerator column.",
    specs:{ Pressure:"7.8 bar", Mass:"300 kg", Serial:"V-2089-F" },
  },
  /* ── DEHYDRATION ─────────────────────────────────── */
  {
    id:"G0787", diag:"102-G07.87", x:21.2, y:20.5,
    nameEn:"Feed Gas Inlet Scrubber", nameFr:"Ballon Séparateur d'Alim.",
    section:"dehydration", dbTag:"X02-G-07.87",
    dcsPanels:["dehydration-1","dehydration-2","scrubber"],
    manuals:["S02"],
    descEn:"Knockout drum equipped with mist eliminator pads to separate free water droplets and residual amine carryover before entering dehydration beds.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  {
    id:"R0312", diag:"102-R03.12", x:27.5, y:22.3,
    nameEn:"Mole Sieve / Mercury Bed", nameFr:"Sécheur Tamis / Démercurisation",
    section:"dehydration", dbTag:"X02-R-03.12",
    dcsPanels:["dehydration-1","dehydration-2","dehydration-3","general-train"],
    manuals:["S02"],
    descEn:"Fixed-bed adsorption column packed with 4A molecular sieves (removing water to <0.5 ppm) and sulfur-impregnated activated carbon (removing mercury to <0.01 µg/Nm³).",
    specs:{ Mass:"8 000 kg", Status:"DEROGATION" },
  },
  {
    id:"E0315", diag:"102-E03.15", x:33.1, y:43.2,
    nameEn:"Regen Gas Cooler 1",    nameFr:"Refroidisseur Gaz Régén. 1",
    section:"dehydration", dbTag:"X02-E-03.15",
    dcsPanels:["dehydration-2","dehydration-3"],
    manuals:["S02"],
    descEn:"Cools hot regeneration gas leaving the molecular sieves during the desorption cycle to condense desorbed water vapor.",
    specs:{ Mass:"600 kg", Status:"DEROGATION" },
  },
  {
    id:"G0314", diag:"102-G03.14", x:27.6, y:43.2,
    nameEn:"Regen Gas Separator",   nameFr:"Ballon Séparateur Régén.",
    section:"dehydration", dbTag:"X02-G-03.14",
    dcsPanels:["dehydration-2","dehydration-3"],
    manuals:["S02"],
    descEn:"Knockout drum that separates condensed water from regeneration gas before recycling the gas back to the main feed compressor suction.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  {
    id:"G304", diag:"102-G304", x:33.8, y:18.2,
    nameEn:"Dry Gas Buffer Drum",   nameFr:"Ballon Tampon Gaz Sec",
    section:"dehydration", dbTag:"X02-G-304",
    dcsPanels:["dehydration-1","scrubber"],
    manuals:["S02"],
    descEn:"Surge drum stabilizing pressure fluctuations between the dehydration section and the downstream propane chilling section.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  /* ── PROPANE CHILLING ────────────────────────────── */
  {
    id:"F0516", diag:"103-F05.16", x:59.5, y:30.8,
    nameEn:"Propane Accumulator",   nameFr:"Accumulateur Propane",
    section:"propane", dbTag:"X03-F-05.16",
    dcsPanels:["propane-1","propane-2","propane-3","general-train"],
    manuals:["S03"],
    descEn:"Primary refrigerant storage vessel and stage-flashing economizer that supplies liquid propane to the kettle chillers and collects suction flash gas.",
    specs:{ Mass:"15 000 kg", Status:"DEROGATION" },
  },
  {
    id:"E0513", diag:"103-E05.13", x:59.5, y:13.2,
    nameEn:"C3 Condenser 1",        nameFr:"Condenseur Propane 1",
    section:"propane", dbTag:"X03-E-05.13",
    dcsPanels:["propane-1","propane-2"],
    manuals:["S03"],
    descEn:"Desuperheats and condenses high-pressure propane vapor discharged from the C3 refrigeration compressor against cooling water.",
    specs:{ Mass:"600 kg", Status:"DEROGATION" },
  },
  {
    id:"E0514A", diag:"103-E05.14A", x:59.5, y:8.5,
    nameEn:"C3 Condenser 2A",       nameFr:"Condenseur Propane 2A",
    section:"propane", dbTag:"X03-E-05.14A",
    dcsPanels:["propane-1","propane-2"],
    manuals:["S03"],
    descEn:"Operating in parallel with E-05.13 to handle the full massive propane refrigeration duty of the liquefaction train.",
    specs:{ Mass:"600 kg", Status:"DEROGATION" },
  },
  {
    id:"G0791", diag:"104-G07.91", x:51.8, y:66.7,
    nameEn:"Propane LP Suction Drum", nameFr:"Ballon Aspiration BP Propane",
    section:"propane", dbTag:"X04-G-07.91",
    dcsPanels:["propane-3"],
    manuals:["S03"],
    descEn:"LP propane suction drum — protects LP compressor stage from liquid carry-over at the coldest propane level (~−35 °C).",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  /* ── LIQUEFACTION / MCR ──────────────────────────── */
  {
    id:"E0520", diag:"106-E05.20", x:50.6, y:17.3,
    nameEn:"Main Cryogenic Exch.",  nameFr:"Échangeur Cryogénique Princ.",
    section:"liquefaction", dbTag:"X06-E-05.30",
    dcsPanels:["liquefaction-1","liquefaction-2","mcr-1","mcr-2","mcr-3","general-train"],
    manuals:["S05","S06"],
    descEn:"MCHE — coil-wound cryogenic heat exchanger. Liquefies feed gas to −162 °C using mixed refrigerant (N₂/CH₄/C₂H₆/C₃H₈/C₄H₁₀). Core of the AP-C3MR™ process.",
    specs:{ Status:"DEROGATION" },
  },
  {
    id:"G0783", diag:"106-G07.83", x:65.7, y:15.2,
    nameEn:"MCR HP Separator",      nameFr:"Séparateur MCR HP",
    section:"liquefaction", dbTag:"X06-G-07.83",
    dcsPanels:["mcr-1","mcr-2","liquefaction-1"],
    manuals:["S05"],
    descEn:"HP MCR separator — splits mixed refrigerant into light vapour (N₂/CH₄/C₂H₆) fed to MCHE warm bundle and heavy liquid (C₃/C₄) fed separately.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  {
    id:"G0788", diag:"105-G07.88", x:77.8, y:43.1,
    nameEn:"MCR LP Suction Drum",   nameFr:"Ballon Aspiration MCR BP",
    section:"liquefaction", dbTag:"X05-G-07.88",
    dcsPanels:["mcr-1","mcr-2"],
    manuals:["S05"],
    descEn:"MCR LP suction drum — separates mixed-refrigerant vapour returning from MCHE warm end before LP compressor stage.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  {
    id:"G0789", diag:"K05-G07.89", x:87.2, y:49.0,
    nameEn:"MCR HP Suction Drum",   nameFr:"Ballon Aspiration MCR HP",
    section:"liquefaction", dbTag:"X05-G-07.89",
    dcsPanels:["mcr-3"],
    manuals:["S05"],
    descEn:"MCR HP suction drum — final liquid/vapour separation before HP compressor stage. Ensures dry gas enters HP impellers.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  /* ── COMPRESSORS ─────────────────────────────────── */
  {
    id:"K110", diag:"103-K01.10", x:59.5, y:46.7,
    nameEn:"Propane Compressor",    nameFr:"Compresseur Propane",
    section:"compressor", dbTag:null,
    dcsPanels:["propane-1","propane-2","propane-3"],
    manuals:["S03"],
    descEn:"4-stage centrifugal propane compressor driven by condensing steam turbine. Circulates propane refrigerant through HP/MP/LP chilling levels.",
    specs:{},
  },
  {
    id:"G0786", diag:"103-G07.86", x:78.7, y:55.0,
    nameEn:"Propane LP Drum",       nameFr:"Ballon Propane BP",
    section:"propane", dbTag:"X03-G-07.86",
    dcsPanels:["propane-3"],
    manuals:["S03"],
    descEn:"Propane LP suction drum — lowest-pressure level of the propane refrigeration loop, feeds LP stage of compressor K01.10.",
    specs:{ Mass:"400 kg", Status:"DEROGATION" },
  },
  {
    id:"K120", diag:"105-K01.20", x:77.6, y:31.9,
    nameEn:"MCR Compressor LP/MP",  nameFr:"Compresseur MCR BP/MP",
    section:"compressor", dbTag:null,
    dcsPanels:["mcr-1","mcr-2","mcr-3"],
    manuals:["S05"],
    descEn:"MCR centrifugal compressor LP/MP bodies driven by steam turbine — first two compression stages of the mixed-refrigerant loop, with intercooling.",
    specs:{},
  },
  {
    id:"K121", diag:"105-K01.21", x:87.2, y:29.2,
    nameEn:"MCR Compressor HP",     nameFr:"Compresseur MCR HP",
    section:"compressor", dbTag:null,
    dcsPanels:["mcr-3"],
    manuals:["S05"],
    descEn:"MCR HP compressor body — final stage, discharges at ~44 bar. HP MCR passes through propane aftercooler before HP separator.",
    specs:{},
  },
  /* ── FRACTIONATION ───────────────────────────────── */
  {
    id:"F0721", diag:"107-F07.21", x:10.2, y:69.4,
    nameEn:"Demethaniser",          nameFr:"Déméthaniseur",
    section:"fractionation", dbTag:"X07-F-07.21",
    dcsPanels:["demethanisation","demethanisation-2","general-train"],
    manuals:["S07"],
    descEn:"Demethaniser — separates methane (LNG product) from C₂+ NGL. Overhead CH₄ recycles to liquefaction; bottoms feeds de-ethaniser.",
    specs:{ Mass:"15 000 kg", Status:"DEROGATION" },
  },
  {
    id:"F0731", diag:"108-F07.31", x:19.8, y:69.4,
    nameEn:"De-ethaniser",          nameFr:"Dééthaniseur",
    section:"fractionation", dbTag:"X08-F-07.31",
    dcsPanels:["deethanisation"],
    manuals:["S08"],
    descEn:"De-ethaniser — separates ethane (C₂) from propane/butane/gasoline. Ethane overhead is exported or re-injected; bottoms feeds depropaniser.",
    specs:{ Mass:"15 000 kg", Status:"DEROGATION" },
  },
  {
    id:"F0741", diag:"109-F07.41", x:34.8, y:69.4,
    nameEn:"Depropaniser",          nameFr:"Dépropaniseur",
    section:"fractionation", dbTag:"X09-F-07.41",
    dcsPanels:["depropanisation"],
    manuals:["S09"],
    descEn:"Depropaniser — separates propane (LPG) from butanes and natural gasoline. Propane overhead condensed and pumped to LPG storage.",
    specs:{ Mass:"15 000 kg", Status:"DEROGATION" },
  },
  {
    id:"F0751", diag:"110-F07.51", x:47.4, y:69.4,
    nameEn:"Debutaniser",           nameFr:"Débutaniseur",
    section:"fractionation", dbTag:"X10-F-07.51",
    dcsPanels:["debutanisation"],
    manuals:["S10"],
    descEn:"Debutaniser — separates butane (C₄) from natural gasoline (C₅+). Butane overhead → LPG blending; gasoline bottoms → export.",
    specs:{ Mass:"15 000 kg", Status:"DEROGATION" },
  },
];
