import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import { getCoordinate } from "@/utils/processFlowCoordinates";
import {
  ZoomIn, ZoomOut, RotateCcw, X, Search,
  Layers, ExternalLink, BookOpen, Menu, Zap,
  Activity, Gauge, Thermometer, Database, Cpu, AlertTriangle, CheckCircle2, Sliders,
  Bell, BellRing, Sparkles, ShieldCheck
} from "lucide-react";
import {
  pushAlarm, acknowledgeAlarm, subscribeAlarms, getActiveAlarms,
  type SimulatedAlarm
} from "@/lib/alarmStore";

/* ─── DEBUG MODE TOGGLE ─────────────────────────────────────────────────── */
const DEBUG_COORDINATES = false;

/* ─── Supabase storage ───────────────────────────────────────────────────── */
const STORAGE_PROJECT = import.meta.env.VITE_SUPABASE_URL || "https://gdkqetzkhgllwbpmqmux.supabase.co";
const SB = `${STORAGE_PROJECT}/storage/v1/object/public/equipment-images`;
const dcsUrl = (p: string) =>
  `${SB}/${p.split("/").map(encodeURIComponent).join("/")}`;

/* ─── Section theme ──────────────────────────────────────────────────────── */
type Section =
  | "treatment" | "dehydration" | "propane"
  | "liquefaction" | "fractionation" | "compressor";

const SECT: Record<Section, { en: string; fr: string; color: string; bg: string; border: string }> = {
  treatment:    { en:"Treatment",    fr:"Traitement",    color:"#00e5a0", bg:"rgba(0,229,160,.16)",   border:"rgba(0,229,160,.5)"   },
  dehydration:  { en:"Dehydration",  fr:"Déshydratation",color:"#38bdf8", bg:"rgba(56,189,248,.16)",  border:"rgba(56,189,248,.5)"  },
  propane:      { en:"Propane",      fr:"Propane",       color:"#fb923c", bg:"rgba(251,146,60,.16)",  border:"rgba(251,146,60,.5)"  },
  liquefaction: { en:"Liquefaction", fr:"Liquéfaction",  color:"#a78bfa", bg:"rgba(167,139,250,.16)", border:"rgba(167,139,250,.5)" },
  fractionation:{ en:"Fractionation",fr:"Fractionnement",color:"#ffb020", bg:"rgba(255,176,32,.16)",  border:"rgba(255,176,32,.5)"  },
  compressor:   { en:"Compression",  fr:"Compression",   color:"#ff4d6a", bg:"rgba(255,77,106,.16)",  border:"rgba(255,77,106,.5)"  },
};

/* ─── DCS panels ─────────────────────────────────────────────────────────── */
const DCS = [
  { id:"general-train",      title:"General Train",        path:"dcs/general train.jpg"                      },
  { id:"decarbonation-01",   title:"Decarbonation MEA 1",  path:"dcs/decarbonation-01.jpg"                   },
  { id:"decarbonation-2",    title:"Decarbonation MEA 2",  path:"dcs/decarbonation-2.jpg"                    },
  { id:"dehydration-1",      title:"Dehydration 1",        path:"dcs/dehydration-1.jpg"                      },
  { id:"dehydration-2",      title:"Dehydration 2",        path:"dcs/dehydration-2.jpg"                      },
  { id:"dehydration-3",      title:"Dehydration 3",        path:"dcs/dehydration-3.jpg"                      },
  { id:"scrubber",           title:"Inlet Scrubber",       path:"dcs/scrubber.jpg"                           },
  { id:"propane-1",          title:"Propane Loop 1",       path:"dcs/propane-1.jpg"                          },
  { id:"propane-2",          title:"Propane Loop 2",       path:"dcs/propane-2.jpg"                          },
  { id:"propane-3",          title:"Propane Loop 3",       path:"dcs/propane-3.jpg"                          },
  { id:"liquefaction-1",     title:"Liquefaction 1",       path:"dcs/liquefaction-1.jpg"                     },
  { id:"liquefaction-2",     title:"Liquefaction 2",       path:"dcs/liquefaction-2.jpg"                     },
  { id:"mcr-1",              title:"MCR Refrigeration 1",  path:"dcs/MCR-1.jpg"                              },
  { id:"mcr-2",              title:"MCR Refrigeration 2",  path:"dcs/MCR-2.jpg"                              },
  { id:"mcr-3",              title:"MCR Refrigeration 3",  path:"dcs/MCR-3.jpg"                              },
  { id:"demethanisation",    title:"Demethaniser",         path:"dcs/demethanisation.jpg"                    },
  { id:"demethanisation-2",  title:"Demethaniser 2",       path:"dcs/demethanisation-2.jpg"                  },
  { id:"deethanisation",     title:"Deethaniser",          path:"dcs/deethanisation.jpg"                     },
  { id:"depropanisation",    title:"Depropaniser",         path:"dcs/depropanisation.jpg"                    },
  { id:"debutanisation",     title:"Debutaniser",          path:"dcs/debutanisation.jpg"                     },
  { id:"echangeur-recup-gpl",title:"GPL Recovery Exch.",   path:"dcs/echangeur de recuperation gpl.jpg"      },
  { id:"retour-condensat",   title:"Condensate Return",    path:"dcs/Retour Condensat train.jpg"             },
  { id:"fuel-gas",           title:"Fuel Gas System",      path:"dcs/fuel gas sys.jpg"                       },
];

/* ─── Manuals ────────────────────────────────────────────────────────────── */
const MANUALS = [
  { id:"S01", title:"MEA — Decarbonation",  driveId:"103T3eROqirYc2Go3xE0vbcr6i_9cjSDi" },
  { id:"S02", title:"Dehydration",           driveId:"19VBliziY8yD7_tM_81SbZIRe28kk7eNg"  },
  { id:"S03", title:"Propane Refrigeration", driveId:"1g7KrNzjLyQM6Ijp29ISkv_uATUecADIN"  },
  { id:"S04", title:"Feed Separation",       driveId:"1nBATg7dpHHiFOf3qNXR9ZOU6hUqSedEQ"  },
  { id:"S05", title:"MCR Refrigeration",     driveId:"1sWLzexkdPf7w42D_GaPK7KY1CzhoemM8"  },
  { id:"S06", title:"Liquefaction",          driveId:"1yxKUQGBv1yAO6wR4bftRwJU9L0aibCMh"  },
  { id:"S07", title:"Demethanizer",          driveId:"1jY5d8TgWrXvAOaQXdS4D3IQmYB9Xe_N_"  },
  { id:"S08", title:"Deethanizer",           driveId:"1mpQ-cEh2cqfegsWBU7oFN7Y8NurZoLRn"  },
  { id:"S09", title:"Depropanizer",          driveId:"1uOjwdUaVrwG_TSfoa14GmZzrTs-jkYCI"  },
  { id:"S10", title:"Debutaniser",           driveId:"1HdmaZ0YTR9Es9G-TT3Acby_L6R8Dr0MC"  },
];

/* ─── Instrument tags per DCS panel ─────────────────────────────────────── */
const INSTR: Record<string, string[]> = {
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

interface TagDef {
  id: string; diag: string; x: number; y: number;
  nameEn: string; nameFr: string;
  section: Section; dbTag: string | null;
  dcsPanels: string[]; manuals: string[];
  descEn: string; specs: Record<string, string>;
}

const TAGS: TagDef[] = [
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

export default function SmartProcessFlow() {
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;

  const [selected,  setSelected]  = useState<TagDef | null>(null);
  const [filter,    setFilter]    = useState<Section | "all">("all");
  const [search,    setSearch]    = useState("");
  const [hovered,   setHovered]   = useState<string | null>(null);
  const [lightbox,  setLightbox]  = useState<{ url: string; title: string } | null>(null);
  const [scale,     setScale]     = useState(1);
  const [offset,    setOffset]    = useState({ x: 0, y: 0 });
  const [isMobile,  setIsMobile]  = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dashOpen,  setDashOpen]  = useState(false);
  const [simLoad,   setSimLoad]   = useState(100); // Process load %

  // Simulated Telemetry State
  const [telemetry, setTelemetry] = useState({
    feedFlow: 850,
    powerMCR: 42.3,
    powerC3: 28.5,
    mcheTemp: -162.4,
    c3Suction: 1.15,
    efficiency: 97.8
  });

  // Simulated live telemetry generator
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry(prev => ({
        feedFlow: Math.round((850 * (simLoad / 100)) + (Math.random() * 10 - 5)),
        powerMCR: Number(((42.3 * (simLoad / 100)) + (Math.random() * 0.6 - 0.3)).toFixed(1)),
        powerC3: Number(((28.5 * (simLoad / 100)) + (Math.random() * 0.4 - 0.2)).toFixed(1)),
        mcheTemp: Number((-162.4 + (Math.random() * 0.2 - 0.1)).toFixed(1)),
        c3Suction: Number((1.15 + (Math.random() * 0.04 - 0.02)).toFixed(2)),
        efficiency: Number((97.8 + (Math.random() * 0.4 - 0.2)).toFixed(1)),
      }));
    }, 2500);
    return () => clearInterval(timer);
  }, [simLoad]);

  // ── SIMULATED SAFETY ALARM ENGINE ─────────────────────────────────────────
  const [activeAlarms, setActiveAlarms] = useState<SimulatedAlarm[]>(getActiveAlarms());
  const [alarmPanelOpen, setAlarmPanelOpen] = useState(false);

  useEffect(() => subscribeAlarms(() => setActiveAlarms(getActiveAlarms())), []);

  // Higher process load + assets under DEROGATION status raise alarm probability —
  // ties the "what if" simLoad slider to a believable safety-instrumented-system feed.
  useEffect(() => {
    const alarmTemplates: { kind: string; kindFr: string; sev: "P1" | "P2" | "P3"; en: string; fr: string; actEn: string; actFr: string }[] = [
      { kind: "High Pressure", kindFr: "Haute Pression", sev: "P2",
        en: "Header pressure trending above the normal operating band.", fr: "Pression du collecteur au-dessus de la plage normale de marche.",
        actEn: "Verify PIC setpoint and check downstream relief/PSV status.", actFr: "Vérifier la consigne PIC et l'état de la soupape de sécurité en aval." },
      { kind: "High Temperature", kindFr: "Haute Température", sev: "P2",
        en: "Process temperature approaching the design ceiling.", fr: "Température de procédé proche de la limite de conception.",
        actEn: "Check cooling medium flow and verify TIC control loop response.", actFr: "Contrôler le débit du fluide de refroidissement et la boucle TIC." },
      { kind: "Level Deviation", kindFr: "Déviation de Niveau", sev: "P3",
        en: "Vessel level drifting outside the normal control band.", fr: "Niveau du ballon en dérive hors de la bande de contrôle normale.",
        actEn: "Inspect LIC transmitter calibration and downstream letdown valve.", actFr: "Inspecter l'étalonnage du transmetteur LIC et la vanne de détente aval." },
      { kind: "Vibration Alarm", sev: "P1", kindFr: "Alarme Vibration",
        en: "Elevated bearing vibration signature detected on rotating equipment.", fr: "Signature de vibration élevée détectée sur l'équipement tournant.",
        actEn: "Reduce load immediately and dispatch rotating-equipment specialist for inspection.", actFr: "Réduire immédiatement la charge et envoyer un spécialiste machines tournantes." },
      { kind: "DEROGATION Status", kindFr: "Statut DEROGATION", sev: "P3",
        en: "Asset operating under an active inspection derogation — monitor closely.", fr: "Équipement en fonctionnement sous dérogation d'inspection active — à surveiller.",
        actEn: "Confirm derogation expiry date and schedule the outstanding NDT/hydrotest.", actFr: "Vérifier la date d'échéance de la dérogation et planifier le CND/épreuve en attente." },
    ];

    const derogationTags = TAGS.filter(t => t.specs.Status === "DEROGATION");

    const timer = setInterval(() => {
      // Base probability scales with process load; DEROGATION assets are 2x more likely to fire.
      const loadFactor = Math.max(0, (simLoad - 70) / 30); // 0 at 70%, 1 at 100%
      const chance = 0.12 + loadFactor * 0.35;
      if (Math.random() > chance) return;

      const useDerogation = derogationTags.length > 0 && Math.random() < 0.55;
      const pool = useDerogation ? derogationTags : TAGS;
      const tag = pool[Math.floor(Math.random() * pool.length)];
      const tpl = useDerogation
        ? alarmTemplates[4]
        : alarmTemplates[Math.floor(Math.random() * 4)];

      pushAlarm({
        id: `${tag.id}-${tpl.kind}-${Date.now()}`,
        tag: tag.id,
        dbTag: tag.dbTag,
        nameEn: tag.nameEn,
        nameFr: tag.nameFr,
        unit: tag.dbTag ? tag.dbTag.split("-")[0] : tag.section,
        instrument: `${tpl.kind.includes("Pressure") ? "PAH" : tpl.kind.includes("Temp") ? "TAH" : tpl.kind.includes("Level") ? "LAL" : tpl.kind.includes("Vibration") ? "VAH" : "STATUS"}-${tag.diag.replace(/[^0-9]/g, "").slice(0, 6) || "000"}`,
        kind: tpl.kind,
        kindFr: tpl.kindFr,
        severity: tpl.sev,
        descriptionEn: tpl.en,
        descriptionFr: tpl.fr,
        actionEn: tpl.actEn,
        actionFr: tpl.actFr,
        triggeredAt: Date.now(),
        acknowledged: false,
      });
    }, 9000);

    return () => clearInterval(timer);
  }, [simLoad]);

  const dragStart  = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setViewportSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyZoom = useCallback((delta: number) => {
    setScale(s => Math.min(6, Math.max(0.3, s + delta)));
  }, []);
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(6, Math.max(0.3, s - e.deltaY * 0.001)));
  }, []);
  
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const clampOffset = useCallback((newOffset: { x: number; y: number }) => {
    const imgW = 1218;
    const imgH = 934;
    const containerW = viewportSize.w;
    const containerH = viewportSize.h;
    if (containerW === 0 || containerH === 0) return newOffset;

    const displayedW = imgW * scale;
    const displayedH = imgH * scale;
    const minVisible = 0.1;

    const maxX = (displayedW - containerW) * (1 - minVisible) + containerW * minVisible;
    const maxY = (displayedH - containerH) * (1 - minVisible) + containerH * minVisible;

    return {
      x: Math.max(-maxX, Math.min(maxX, newOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, newOffset.y)),
    };
  }, [scale, viewportSize]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(false);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const threshold = isMobile ? 12 : 4;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      setIsDragging(true);
    }
    setOffset(clampOffset({
      x: dragStart.current.ox + dx,
      y: dragStart.current.oy + dy,
    }));
  };
  
  const onPointerUp = () => {
    dragStart.current = null;
    setTimeout(() => setIsDragging(false), 0);
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelected(null); setLightbox(null); }
      if ((e.key === "+" || e.key === "=") && !e.ctrlKey) { e.preventDefault(); applyZoom(0.2); }
      if (e.key === "-" && !e.ctrlKey) { e.preventDefault(); applyZoom(-0.2); }
      if (e.key === "0") { e.preventDefault(); resetView(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [applyZoom]);

  const sc = selected ? SECT[selected.section] : null;

  const visibleTags = useMemo(() => {
    return TAGS.filter(t => {
      const matchSection = filter === "all" || t.section === filter;
      const query = search.toLowerCase().trim();
      const matchSearch = !query || 
        t.diag.toLowerCase().includes(query) || 
        t.id.toLowerCase().includes(query) ||
        t.nameEn.toLowerCase().includes(query) ||
        t.nameFr.toLowerCase().includes(query);
      return matchSection && matchSearch;
    });
  }, [filter, search]);

  const coordMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    TAGS.forEach(t => {
      const coord = getCoordinate(t.diag) ?? { x: t.x, y: t.y };
      map.set(t.id, coord);
    });
    return map;
  }, []);

  const [dashSearch, setDashSearch] = useState("");
  const dashboardTags = useMemo(() => {
    if (!dashSearch.trim()) return TAGS;
    const q = dashSearch.toLowerCase();
    return TAGS.filter(t =>
      t.diag.toLowerCase().includes(q) ||
      t.nameEn.toLowerCase().includes(q) ||
      t.nameFr.toLowerCase().includes(q) ||
      t.section.toLowerCase().includes(q)
    );
  }, [dashSearch]);

  const jumpToAlarmTag = (alarmTag: string) => {
    const tag = TAGS.find(t => t.id === alarmTag);
    if (tag) {
      setSelected(tag);
      setAlarmPanelOpen(false);
    }
  };

  const sevStyle = (sev: SimulatedAlarm["severity"]) =>
    sev === "P1"
      ? { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/40" }
      : sev === "P2"
      ? { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" }
      : { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/40" };

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-white font-sans overflow-hidden select-none">
      
      {/* PREMIUM TOP SUPERVISORY BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 md:px-8 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl z-30 shadow-2xl">
        
        {/* Left Side: Navigation & Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => setDashOpen(prev => !prev)}
            className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              dashOpen ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/20" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-500/50"
            }`}
            aria-label={L("Equipment Drawer", "Tiroir des Équipements")}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Sliders className="h-5 w-5" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                {L("Smart Process Flow", "Schéma Intelligent")}
                <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono animate-pulse">
                  {L("LIVE DCS TELEMETRY", "TÉLÉMESURE EN DIRECT")}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">AP-C3MR™ Liquefaction Diagram • Arzew LNG Complex</p>
            </div>
          </div>
        </div>

        {/* Center: Live Simulated Telemetry Widgets */}
        <div className="hidden lg:flex items-center gap-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl px-6 py-2 shadow-inner font-mono text-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">{L("Feed Flow:", "Alim:")}</span>
            <span className="text-emerald-400 font-bold">{telemetry.feedFlow} MMSCFD</span>
          </div>
          <div className="w-px h-4 bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <span className="text-slate-400">{L("MCR Power:", "MCR Puiss:")}</span>
            <span className="text-cyan-400 font-bold">{telemetry.powerMCR} MW</span>
          </div>
          <div className="w-px h-4 bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-amber-400" />
            <span className="text-slate-400">{L("C3 Power:", "C3 Puiss:")}</span>
            <span className="text-amber-400 font-bold">{telemetry.powerC3} MW</span>
          </div>
          <div className="w-px h-4 bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-blue-400" />
            <span className="text-slate-400">{L("MCHE Cold End:", "MCHE Extrémité:")}</span>
            <span className="text-blue-400 font-bold">{telemetry.mcheTemp} °C</span>
          </div>
        </div>

        {/* Right Side: Simulation Ramping & Search */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-1.5 shadow-inner">
            <span className="text-[11px] font-mono text-slate-400">{L("Process Load:", "Charge Procédé:")}</span>
            <input
              type="range"
              min="50" max="100" value={simLoad}
              onChange={e => setSimLoad(Number(e.target.value))}
              className="w-24 accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-cyan-400">{simLoad}%</span>
          </div>

          {/* SAFETY ALARM BELL — SIMULATED SIS FEED */}
          <button
            onClick={() => setAlarmPanelOpen(prev => !prev)}
            className={`relative p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              activeAlarms.length > 0
                ? "bg-rose-500/15 border-rose-500/60 text-rose-400 shadow-lg shadow-rose-500/20"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
            aria-label={L("Active Alarms", "Alarmes Actives")}
          >
            {activeAlarms.length > 0 ? <BellRing className="h-4 w-4 animate-pulse" /> : <Bell className="h-4 w-4" />}
            {activeAlarms.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-mono font-bold text-white border border-slate-900 shadow-md">
                {activeAlarms.length}
              </span>
            )}
          </button>

          <div className="relative w-48 md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L("Search tags, names...", "Rechercher repères...")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors font-mono"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SIMULATED ALARM DROPDOWN PANEL */}
      {alarmPanelOpen && (
        <div className="absolute top-16 right-4 md:right-8 w-[340px] max-h-[420px] bg-slate-900/95 border border-slate-800 backdrop-blur-2xl rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-400" /> {L("Live Safety Alarms", "Alarmes Sécurité en Direct")}
            </span>
            <button onClick={() => setAlarmPanelOpen(false)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeAlarms.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                {L("No active alarms — plant nominal.", "Aucune alarme active — usine nominale.")}
              </div>
            ) : (
              activeAlarms.map(a => {
                const s = sevStyle(a.severity);
                return (
                  <div key={a.id} className={`p-3 rounded-xl border ${s.bg} ${s.border} space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text} border ${s.border}`}>{a.severity}</span>
                      <span className="text-[10px] font-mono text-slate-500">{new Date(a.triggeredAt).toLocaleTimeString()}</span>
                    </div>
                    <button onClick={() => jumpToAlarmTag(a.tag)} className={`text-xs font-mono font-bold ${s.text} hover:underline cursor-pointer`}>
                      {a.dbTag || a.tag} — {L(a.nameEn, a.nameFr)}
                    </button>
                    <p className="text-[11px] text-slate-300 font-light">{L(a.kind, a.kindFr)}: {L(a.descriptionEn, a.descriptionFr)}</p>
                    <p className="text-[10px] text-slate-400 italic">{L(a.actionEn, a.actionFr)}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-slate-500">{a.instrument}</span>
                      <button
                        onClick={() => acknowledgeAlarm(a.id)}
                        className="text-[10px] font-mono font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 cursor-pointer transition-all"
                      >
                        {L("ACKNOWLEDGE", "ACQUITTER")}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {activeAlarms.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60">
              <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-cyan-500" />
                {L("Ask the AI Expert: \"any active alarms?\"", "Demandez à l'Expert IA : « des alarmes actives ? »")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-HEADER: SECTION FILTERS & ZOOM CONTROLS */}
      <div className="flex items-center justify-between px-4 md:px-8 py-2 bg-slate-900/40 border-b border-slate-800 backdrop-blur-md z-20 shadow-lg text-xs font-mono">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {(["all", ...Object.keys(SECT)] as (Section | "all")[]).map(s => {
            const active = filter === s;
            const color  = s === "all" ? "#fff"         : SECT[s as Section].color;
            const bg     = s === "all" ? "rgba(255,255,255,0.1)" : SECT[s as Section].bg;
            const bord   = s === "all" ? "rgba(255,255,255,0.2)" : SECT[s as Section].border;
            const lbl    = s === "all" ? L("ALL UNITS", "TOUTES UNITÉS") : L(SECT[s as Section].en, SECT[s as Section].fr);
            return (
              <button key={s} onClick={() => setFilter(s)}
                style={{
                  border: `1px solid ${active ? bord : "rgba(255,255,255,0.1)"}`,
                  background: active ? bg : "transparent",
                  color: active ? color : "rgba(255,255,255,0.4)",
                }}
                className="px-3.5 py-1.5 rounded-xl font-bold tracking-wider hover:border-slate-600 transition-all shrink-0 cursor-pointer shadow-sm"
              >
                {lbl}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button onClick={() => applyZoom(0.25)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => applyZoom(-0.25)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={resetView} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm">
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className="hidden sm:inline-block font-mono font-bold text-cyan-400 w-12 text-right">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* INTERACTIVE PROCESS VIEWPORT CANVAS */}
      <div className="flex-1 flex min-h-0 relative bg-slate-950 overflow-hidden" ref={viewportRef}>
        
        <div
          ref={wrapRef}
          className={`flex-1 relative overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-crosshair"} select-none`}
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => { if (!isDragging) setSelected(null); }}
        >
          <div style={{
            position:"absolute", inset:0,
            transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`,
            transformOrigin:"center center",
            transition: isDragging ? "none" : "transform 0.08s ease-out",
            display: "grid",
            placeItems: "center"
          }}>
            
            <div className="relative w-full max-w-[1218px] aspect-[1218/934] shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-slate-800/80 rounded-3xl overflow-hidden bg-slate-900/40 backdrop-blur-sm">
              <img
                src="/pfd/gnl1z-pfd-labeled.png"
                alt="GNL1Z Labeled Process Flow Diagram"
                draggable={false}
                onError={e => {
                  if ((e.target as HTMLImageElement).src !== "/pfd/gnl1z-pfd.jpg") {
                    (e.target as HTMLImageElement).src = "/pfd/gnl1z-pfd.jpg";
                  }
                }}
                className="w-full h-full block filter brightness-90 contrast-110 object-contain pointer-events-none"
              />

              {/* VECTOR TAG OVERLAYS */}
              {visibleTags.map(t => {
                const isActive = selected?.id === t.id;
                const isHov    = hovered === t.id;
                const c        = SECT[t.section];
                const coord    = coordMap.get(t.id);
                if (!coord || coord.x === undefined || coord.y === undefined) return null;

                return (
                  <div 
                    key={t.id}
                    style={{
                      position: "absolute",
                      left: `${coord.x}%`,
                      top: `${coord.y}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: isActive ? 25 : isHov ? 20 : 10,
                    }}
                  >
                    <button
                      onMouseEnter={() => setHovered(t.id)}
                      onMouseLeave={() => setHovered(null)}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        setSelected(isActive ? null : t);
                      }}
                      aria-label={t.diag + ' – ' + L(t.nameEn, t.nameFr)}
                      style={{
                        border: `1px solid ${isActive || isHov ? c.border : "rgba(0,200,255,0.3)"}`,
                        background: isActive ? c.bg : isHov ? "rgba(0,200,255,0.12)" : "rgba(3,11,18,0.9)",
                        color: isActive || isHov ? c.color : "rgba(255,255,255,0.8)",
                        boxShadow: isActive ? `0 0 20px ${c.border}` : isHov ? "0 0 12px rgba(0,200,255,0.3)" : "none",
                        transform: `scale(${isActive ? 1.15 : isHov ? 1.08 : 1})`,
                      }}
                      className="font-mono text-[10px] md:text-xs font-bold whitespace-nowrap px-2.5 py-1 rounded-xl backdrop-blur-md transition-all duration-150 cursor-pointer shadow-lg"
                    >
                      {t.diag}
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* DESKTOP EQUIPMENT INSPECTION DRAWER */}
        {!isMobile && selected && sc && (
          <div className="w-[420px] bg-slate-900/90 border-l border-slate-800 backdrop-blur-2xl flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/40">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold border" style={{ color: sc.color, borderColor: sc.border, backgroundColor: sc.bg }}>
                    {L(sc.en, sc.fr).toUpperCase()}
                  </span>
                  {selected.dbTag && (
                    <Link to={`/equipment/${selected.dbTag}`} className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-slate-800 border border-slate-700 text-cyan-400 hover:bg-slate-700 transition-colors flex items-center gap-1">
                      <Database className="h-3 w-3" /> {L("Master File", "Dossier")}
                    </Link>
                  )}
                </div>
                <span className="font-mono text-xs text-slate-400">{selected.diag}</span>
                <h2 className="text-2xl font-bold text-white tracking-tight mt-1">{L(selected.nameEn, selected.nameFr)}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <PanelContent tag={selected} lang={lang} onPreviewDcs={(title, path) => setLightbox({ url: dcsUrl(path), title })} telemetry={telemetry} />
            </div>
          </div>
        )}

        {/* MOBILE BOTTOM SHEET */}
        {isMobile && selected && sc && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-2xl rounded-t-3xl z-40 max-h-[70vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-700"></div>
            </div>
            <div className="px-6 pb-4 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold">{selected.diag}</span>
                <h2 className="text-xl font-bold text-white tracking-tight">{L(selected.nameEn, selected.nameFr)}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <PanelContent tag={selected} lang={lang} onPreviewDcs={(title, path) => setLightbox({ url: dcsUrl(path), title })} telemetry={telemetry} />
            </div>
          </div>
        )}
      </div>

      {/* DASHBOARD EQUIPMENT DRAWER */}
      {dashOpen && (
        <div className={`absolute top-0 left-0 bottom-0 ${isMobile ? "w-full" : "w-[360px]"} bg-slate-900/95 border-r border-slate-800 backdrop-blur-2xl z-50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200`}>
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Database className="h-5 w-5" />
              </div>
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                {L("Equipment Dashboard", "Tableau de Bord")}
              </span>
            </div>
            <button onClick={() => setDashOpen(false)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 border-b border-slate-800 bg-slate-950/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={dashSearch}
                onChange={e => setDashSearch(e.target.value)}
                placeholder={L("Search all equipment...", "Rechercher un équipement...")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(["treatment","dehydration","propane","liquefaction","fractionation","compressor"] as Section[]).map(section => {
              const tags = dashboardTags.filter(t => t.section === section);
              if (tags.length === 0) return null;
              const secColor = SECT[section].color;
              return (
                <div key={section} className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider pb-1 border-b border-slate-800" style={{ color: secColor }}>
                    {L(SECT[section].en, SECT[section].fr)}
                  </div>
                  <div className="space-y-1.5">
                    {tags.map(t => {
                      const isSelected = selected?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setSelected(t); setDashOpen(false); }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-inner" : "bg-slate-950/40 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white"
                          }`}
                          onMouseEnter={() => setHovered(t.id)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          <span className="font-mono font-bold text-xs">{t.diag}</span>
                          <span className="text-xs font-light text-slate-400 truncate max-w-[60%]">
                            {L(t.nameEn, t.nameFr)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIGHTBOX FOR DCS SCREENSHOTS */}
      {lightbox && (
        <div 
          onClick={() => setLightbox(null)}
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-150"
        >
          <div className="relative max-w-[95vw] max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 md:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
              <span className="font-mono text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Cpu className="h-4 w-4" /> {lightbox.title}
              </span>
              <button onClick={() => setLightbox(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={lightbox.url} alt="DCS Console Screen" className="w-full max-h-[75vh] object-contain rounded-xl border border-slate-800" />
          </div>
        </div>
      )}
    </div>
  );
}

function PanelContent({ tag, lang, onPreviewDcs, telemetry }: { tag: TagDef; lang: string; onPreviewDcs: (title: string, path: string) => void; telemetry: any }) {
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  
  const filteredDcs = useMemo(() => DCS.filter(d => tag.dcsPanels.includes(d.id)), [tag.dcsPanels]);
  const filteredManuals = useMemo(() => MANUALS.filter(m => tag.manuals.includes(m.id)), [tag.manuals]);
  const linkedInstruments = useMemo(() => {
    return [...new Set(tag.dcsPanels.flatMap(pid => INSTR[pid] ?? []))].slice(0, 24);
  }, [tag.dcsPanels]);

  const askAiExpert = () => {
    const prompt = lang === "fr"
      ? `Donne-moi l'analyse QA/QC, les tuyauteries/brides et l'état d'inspection de ${tag.dbTag ?? tag.diag} (${tag.nameFr}).`
      : `Give me the QA/QC analysis, piping/flange specs, and inspection status for ${tag.dbTag ?? tag.diag} (${tag.nameEn}).`;
    window.dispatchEvent(new CustomEvent("gnl1z:ask-ai", { detail: { prompt } }));
  };

  return (
    <div className="space-y-6">
      {/* Ask AI Expert deep-link */}
      <button
        onClick={askAiExpert}
        className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 hover:from-cyan-600/30 hover:to-blue-600/30 hover:border-cyan-400/60 transition-all cursor-pointer shadow-inner font-mono text-xs font-bold"
      >
        <Sparkles className="h-4 w-4 text-cyan-400" />
        {L(`Ask AI Expert about ${tag.diag}`, `Demander à l'Expert IA sur ${tag.diag}`)}
      </button>

      {/* Description */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" /> {L("Equipment Description", "Description de l'Équipement")}
        </h4>
        <p className="text-sm leading-relaxed text-slate-200 font-light">{tag.descEn}</p>
      </div>

      {/* Simulated Dynamic Equipment Health / Telemetry */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner space-y-4">
        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400 animate-pulse" /> {L("Live Telemetry & Status", "Télémesure & Statut en Direct")}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-slate-400">{L("OPERATING FLUID", "FLUIDE OPÉRATOIRE")}</span>
            <span className="text-xs font-mono font-bold text-cyan-400 mt-1 truncate">
              {tag.section === "treatment" ? "Lean MEA / Gas" : tag.section === "dehydration" ? "Dry Gas" : tag.section === "propane" ? "Pure Propane" : "Mixed Refrig"}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-slate-400">{L("SYSTEM HEALTH", "SANTÉ DU SYSTÈME")}</span>
            <span className="text-xs font-mono font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% OPTIMAL
            </span>
          </div>
        </div>
      </div>

      {/* Specs table */}
      {Object.keys(tag.specs).length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" /> {L("Technical Details", "Détails Techniques")}
          </h4>
          <div className="divide-y divide-slate-800">
            {Object.entries(tag.specs).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center py-2 text-xs font-mono">
                <span className="text-slate-400">{key}</span>
                <span className={`font-bold ${key === "Status" && val === "DEROGATION" ? "text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full" : "text-white"}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DCS panels */}
      {filteredDcs.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" /> {L("Linked DCS Panels", "Écrans DCS Associés")} ({filteredDcs.length})
          </h4>
          <div className="grid grid-cols-1 gap-2.5">
            {filteredDcs.map(d => (
              <button
                key={d.id}
                onClick={() => onPreviewDcs(d.title, d.path)}
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all flex items-center justify-between cursor-pointer group shadow-sm"
              >
                <span className="font-mono font-bold text-xs truncate mr-4 group-hover:text-white transition-colors">{d.title}</span>
                <ExternalLink className="h-4 w-4 text-cyan-500 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Telemetry tags */}
      {linkedInstruments.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" /> {L("Telemetry Tags", "Instruments de Télémesure")}
          </h4>
          <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-2">
            {linkedInstruments.map(ins => (
              <span key={ins} className="font-mono text-xs bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-xl shadow-inner hover:border-purple-500/60 transition-colors cursor-default">
                {ins}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manuals */}
      {filteredManuals.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" /> {L("Operational Manuals", "Manuels Opérationnels")}
          </h4>
          <div className="space-y-2.5">
            {filteredManuals.map(m => (
              <a
                key={m.id}
                href={`https://drive.google.com/file/d/${m.driveId}/view`}
                target="_blank" rel="noopener noreferrer"
                className="w-full p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/20 transition-all flex items-center justify-between cursor-pointer group shadow-sm text-xs font-mono font-bold"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="truncate group-hover:text-white transition-colors">{m.title}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-amber-500 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
