// src/lib/engineeringJudgment.ts
// Rule-based Asset Integrity Judgment Engine.
//
// Unlike a black-box ML model, every output here is traceable to a real field
// in the GNL1Z master database (design/test pressure, weight, volume, unit,
// spare-part materials & nominal sizes) plus published code rules (ASME VIII,
// API 510/570/610, NACE MR0175/ISO 15156). No sensor telemetry is available in
// this platform, so this intentionally does NOT claim a statistical
// "Remaining Useful Life" — it produces an auditable Risk Tier + recommended
// test/inspection program that a QA/QC engineer can verify line-by-line.
//
// Mirrored (duplicated, not imported) in functions/api/ai-agent.ts so the
// Cloudflare Pages Function stays fully self-contained with zero build-time
// cross-directory import risk — keep both copies in sync when editing rules.

import type { Equipment } from "@/data";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ProcessService {
  fluidEn: string;
  fluidFr: string;
  tempRangeEn: string;
  tempRangeFr: string;
  corrosivityEn: string;
  corrosivityFr: string;
}

export interface PressureAnalysis {
  operatingBar: number | null;
  designBar: number | null;
  testBar: number | null;
  ratio: number | null;          // test / design
  isShellTube: boolean;
  shellDesignBar?: number | null;
  shellTestBar?: number | null;
  tubeDesignBar?: number | null;
  tubeTestBar?: number | null;
  belowCodeMinMargin: boolean;   // ratio < 1.25 (below typical 1.3x/1.5x margin)
  dataMissing: boolean;
}

export interface EngineeringJudgment {
  tag: string;
  unit: string;
  section: string;
  typeCode: string;
  typeName: string;
  service: ProcessService;
  pressure: PressureAnalysis;
  materials: string[];
  representativeBoltSize: string | null;
  recommendedTests: { en: string; fr: string }[];
  riskTier: RiskTier;
  riskFactors: { en: string; fr: string }[];
  safetyRecommendations: { en: string; fr: string }[];
  processRecommendations: { en: string; fr: string }[];
}

// ── Unit → process service inference (from the real AP-C3MR™ block flow) ────
const UNIT_SERVICE: Record<string, ProcessService> = {
  X01: {
    fluidEn: "Lean/Rich MEA amine solution + sour acid gas (CO₂/H₂S)",
    fluidFr: "Solution d'amine MEA pauvre/riche + gaz acide (CO₂/H₂S)",
    tempRangeEn: "25°C – 155°C (reboiler)",
    tempRangeFr: "25°C – 155°C (rebouilleur)",
    corrosivityEn: "Sour / wet-acid-gas service — Amine Stress Corrosion Cracking (ASCC) and wet H₂S risk",
    corrosivityFr: "Service acide humide — risque de corrosion sous contrainte (ASCC) et fissuration H₂S humide",
  },
  X02: {
    fluidEn: "Sweet natural gas over 4A molecular sieve + trace mercury",
    fluidFr: "Gaz naturel adouci sur tamis moléculaire 4A + traces de mercure",
    tempRangeEn: "45°C process / up to 260°C regeneration cycle",
    tempRangeFr: "45°C procédé / jusqu'à 260°C en régénération",
    corrosivityEn: "Low corrosivity dry gas, but mercury carryover threatens downstream aluminum (Liquid Metal Embrittlement)",
    corrosivityFr: "Gaz sec peu corrosif, mais l'entraînement de mercure menace l'aluminium en aval (fragilisation LME)",
  },
  X03: {
    fluidEn: "Pure commercial propane refrigerant (closed loop)",
    fluidFr: "Propane commercial pur (boucle fermée)",
    tempRangeEn: "-37°C to 75°C",
    tempRangeFr: "-37°C à 75°C",
    corrosivityEn: "Low corrosivity hydrocarbon, but low-temperature embrittlement risk on carbon steel",
    corrosivityFr: "Hydrocarbure peu corrosif, mais risque de fragilisation à froid sur acier au carbone",
  },
  X04: {
    fluidEn: "Propane refrigerant / pre-cooled natural gas feed",
    fluidFr: "Réfrigérant propane / gaz naturel pré-refroidi",
    tempRangeEn: "-32°C to 45°C",
    tempRangeFr: "-32°C à 45°C",
    corrosivityEn: "Low corrosivity hydrocarbon service; verify low-temperature impact toughness (Charpy)",
    corrosivityFr: "Service hydrocarbure peu corrosif ; vérifier la résilience à froid (Charpy)",
  },
  X05: {
    fluidEn: "Mixed Refrigerant (N₂/CH₄/C₂H₆/C₃H₈/C₄H₁₀), MP/HP compression stages",
    fluidFr: "Réfrigérant Mixte (N₂/CH₄/C₂H₆/C₃H₈/C₄H₁₀), étages de compression MP/HP",
    tempRangeEn: "-40°C to 75°C",
    tempRangeFr: "-40°C à 75°C",
    corrosivityEn: "Low corrosivity, cryogenic embrittlement risk — verify low-temperature carbon steel grade",
    corrosivityFr: "Peu corrosif, risque de fragilisation cryogénique — vérifier la nuance d'acier basse température",
  },
  X06: {
    fluidEn: "Sub-cooled LNG + Mixed Refrigerant in the MCHE core (Aluminum construction)",
    fluidFr: "GNL sous-refroidi + Réfrigérant Mixte dans le cœur MCHE (construction aluminium)",
    tempRangeEn: "-162°C to -36°C (deep cryogenic)",
    tempRangeFr: "-162°C à -36°C (cryogénique profond)",
    corrosivityEn: "Deep cryogenic aluminum service — Liquid Metal Embrittlement (mercury) and brittle fracture are the dominant threats",
    corrosivityFr: "Service aluminium cryogénique profond — fragilisation par métaux liquides (mercure) et rupture fragile sont les menaces dominantes",
  },
  X07: {
    fluidEn: "Methane-rich overhead / C₂+ NGL bottoms (Demethaniser)",
    fluidFr: "Tête riche en méthane / fond NGL C₂+ (Déméthaniseur)",
    tempRangeEn: "-90°C to 20°C",
    tempRangeFr: "-90°C à 20°C",
    corrosivityEn: "Low corrosivity NGL service, moderate cryogenic exposure on column internals",
    corrosivityFr: "Service NGL peu corrosif, exposition cryogénique modérée sur les internes",
  },
  X08: {
    fluidEn: "Ethane overhead / propane+ bottoms (De-ethaniser)",
    fluidFr: "Tête éthane / fond propane+ (Dééthaniseur)",
    tempRangeEn: "-30°C to 60°C",
    tempRangeFr: "-30°C à 60°C",
    corrosivityEn: "Low corrosivity NGL/LPG service",
    corrosivityFr: "Service NGL/GPL peu corrosif",
  },
  X09: {
    fluidEn: "Propane (LPG) overhead / butanes+ bottoms (Depropaniser)",
    fluidFr: "Tête propane (GPL) / fond butanes+ (Dépropaniseur)",
    tempRangeEn: "0°C to 70°C",
    tempRangeFr: "0°C à 70°C",
    corrosivityEn: "Low corrosivity LPG service",
    corrosivityFr: "Service GPL peu corrosif",
  },
  X10: {
    fluidEn: "Butane (LPG) overhead / natural gasoline bottoms (Debutaniser)",
    fluidFr: "Tête butane (GPL) / fond essence naturelle (Débutaniseur)",
    tempRangeEn: "20°C to 90°C",
    tempRangeFr: "20°C à 90°C",
    corrosivityEn: "Low corrosivity LPG/condensate service",
    corrosivityFr: "Service GPL/condensat peu corrosif",
  },
  "7X3": {
    fluidEn: "Plant utility service (cooling water / steam / utility fluid)",
    fluidFr: "Service utilités (eau de refroidissement / vapeur / fluide utilitaire)",
    tempRangeEn: "Ambient to 150°C",
    tempRangeFr: "Ambiante à 150°C",
    corrosivityEn: "Utility-grade water/steam service — general corrosion and scaling risk",
    corrosivityFr: "Service eau/vapeur utilitaire — risque de corrosion générale et d'entartrage",
  },
};

const DEFAULT_SERVICE: ProcessService = {
  fluidEn: "Process hydrocarbon / utility fluid (unit not classified)",
  fluidFr: "Hydrocarbure de procédé / fluide utilitaire (unité non classée)",
  tempRangeEn: "Not specified",
  tempRangeFr: "Non spécifié",
  corrosivityEn: "General process service",
  corrosivityFr: "Service procédé général",
};

function analyzePressure(eq: Equipment): PressureAnalysis {
  const tp = eq.technical?.test_pressure;
  const isShellTube = !!(tp?.shell_design_bar || tp?.tube_design_bar);

  if (isShellTube) {
    const ratio = tp?.shell_design_bar && tp?.shell_test_bar ? tp.shell_test_bar / tp.shell_design_bar : null;
    return {
      operatingBar: eq.technical?.pressure_bar ?? null,
      designBar: tp?.shell_design_bar ?? null,
      testBar: tp?.shell_test_bar ?? null,
      ratio,
      isShellTube: true,
      shellDesignBar: tp?.shell_design_bar ?? null,
      shellTestBar: tp?.shell_test_bar ?? null,
      tubeDesignBar: tp?.tube_design_bar ?? null,
      tubeTestBar: tp?.tube_test_bar ?? null,
      belowCodeMinMargin: ratio !== null && ratio < 1.25,
      dataMissing: !tp?.shell_design_bar,
    };
  }

  const designBar = tp?.design_bar ?? null;
  const testBar = tp?.test_bar ?? null;
  const ratio = designBar && testBar ? testBar / designBar : null;

  return {
    operatingBar: eq.technical?.pressure_bar ?? null,
    designBar,
    testBar,
    ratio,
    isShellTube: false,
    belowCodeMinMargin: ratio !== null && ratio < 1.25,
    dataMissing: !designBar,
  };
}

function getMaterials(eq: Equipment): string[] {
  const set = new Set<string>();
  (eq.spare_parts?.items ?? []).forEach((i) => {
    if (i.material) set.add(i.material);
  });
  return [...set];
}

function getRepresentativeBoltSize(eq: Equipment): string | null {
  const sizes = (eq.spare_parts?.items ?? [])
    .filter((i) => i.category === "Stud Bolt / Goujon" || i.category === "Gasket / Joint")
    .map((i) => i.size_nominal)
    .filter(Boolean) as string[];
  if (sizes.length === 0) return null;
  // pick the largest nominal diameter mentioned (rough numeric parse)
  const parsed = sizes.map((s) => ({ raw: s, n: parseFloat(s.replace(/[^0-9.]/g, "")) || 0 }));
  parsed.sort((a, b) => b.n - a.n);
  return parsed[0].raw;
}

export function buildEngineeringJudgment(eq: Equipment): EngineeringJudgment {
  const unit = eq.unit;
  const service = UNIT_SERVICE[unit] ?? DEFAULT_SERVICE;
  const pressure = analyzePressure(eq);
  const materials = getMaterials(eq);
  const representativeBoltSize = getRepresentativeBoltSize(eq);
  const typeCode = eq.type?.code ?? "";
  const typeName = eq.type?.name ?? "";
  const isDerogation = eq.testing_status === "DEROGATION";

  const recommendedTests: { en: string; fr: string }[] = [];
  const riskFactors: { en: string; fr: string }[] = [];
  const safetyRecommendations: { en: string; fr: string }[] = [];
  const processRecommendations: { en: string; fr: string }[] = [];

  // ── Test-type judgment by equipment type ──────────────────────────────────
  if (typeCode === "P") {
    recommendedTests.push(
      { en: "API 610 Mechanical Run Test — vibration, bearing temperature, and NPSH margin verification.", fr: "Essai mécanique API 610 — vibrations, température des paliers, marge NPSH." },
      { en: "Mechanical seal leak test and coupling alignment check (laser alignment tolerance ±0.05 mm).", fr: "Test d'étanchéité du joint mécanique et alignement d'accouplement (tolérance laser ±0.05 mm)." }
    );
  } else if (pressure.isShellTube) {
    recommendedTests.push(
      { en: `Hydrostatic Pressure Test per ASME VIII UG-99 — Shell side to ${pressure.shellTestBar ?? "N/A"} bar, Tube side to ${pressure.tubeTestBar ?? "N/A"} bar.`, fr: `Épreuve hydrostatique selon ASME VIII UG-99 — Calandre à ${pressure.shellTestBar ?? "N/A"} bar, Faisceau à ${pressure.tubeTestBar ?? "N/A"} bar.` },
      { en: "Eddy Current Testing (ECT) on tube bundle — detects wall thinning/pitting without bundle removal.", fr: "Contrôle par Courants de Foucault (ECT) sur le faisceau — détecte l'amincissement/piqûration sans démontage." }
    );
  } else if (!pressure.dataMissing) {
    recommendedTests.push(
      { en: `Hydrostatic Pressure Test per ASME VIII UG-99 at ${pressure.testBar} bar (${pressure.ratio ? pressure.ratio.toFixed(2) : "N/A"}× design pressure of ${pressure.designBar} bar).`, fr: `Épreuve hydrostatique selon ASME VIII UG-99 à ${pressure.testBar} bar (${pressure.ratio ? pressure.ratio.toFixed(2) : "N/A"}× la pression de calcul de ${pressure.designBar} bar).` }
    );
  } else {
    recommendedTests.push(
      { en: "⚠️ Design/test pressure data is missing in the master record — perform an External Visual Inspection (VT) and populate the design basis before scheduling a hydrotest.", fr: "⚠️ Données de pression de calcul/épreuve manquantes — réaliser une inspection visuelle externe (VT) et compléter la base de conception avant de programmer une épreuve." }
    );
    riskFactors.push({ en: "Incomplete design-pressure record prevents a code-compliant test plan.", fr: "Fiche de pression de calcul incomplète, empêche un plan d'essai conforme au code." });
  }

  // ── Service-specific NDT / metallurgy judgment ────────────────────────────
  if (unit === "X06" || service.fluidEn.includes("MCHE")) {
    recommendedTests.push(
      { en: "Helium Leak Testing (Mass Spectrometry) — validates cryogenic tube-to-tubesheet joint integrity below 10⁻⁸ mbar·L/s.", fr: "Test de fuite à l'hélium (spectrométrie de masse) — valide l'intégrité des joints tube/plaque tubulaire sous 10⁻⁸ mbar·L/s." },
      { en: "Phased Array Ultrasonic Testing (PAUT) on aluminum shell welds and nozzle attachments.", fr: "Ultrasons multi-éléments (PAUT) sur les soudures de calandre aluminium et tubulures." }
    );
    riskFactors.push({ en: "Cryogenic aluminum construction is highly sensitive to Liquid Metal Embrittlement from trace mercury.", fr: "La construction aluminium cryogénique est très sensible à la fragilisation par métaux liquides (mercure)." });
    safetyRecommendations.push({ en: "Confirm upstream X02 mercury guard-bed performance (<0.01 µg/Nm³) before every extended run.", fr: "Confirmer la performance du lit de garde mercure X02 en amont (<0.01 µg/Nm³) avant chaque marche prolongée." });
  }
  if (unit === "X01") {
    recommendedTests.push(
      { en: "Wet Fluorescent Magnetic Particle Testing (WFMT) along weld heat-affected zones — detects Amine Stress Corrosion Cracking.", fr: "Magnétoscopie fluorescente humide (WFMT) le long des zones affectées thermiquement — détecte la corrosion sous contrainte amine." },
      { en: "Automated Ultrasonic Testing (AUT) thickness mapping for erosion-corrosion in rich-amine piping.", fr: "Cartographie d'épaisseur par ultrasons automatisés (AUT) pour l'érosion-corrosion en tuyauterie amine riche." }
    );
    riskFactors.push({ en: "Sour amine/CO₂ service is subject to ASCC and wet H₂S (HIC/SOHIC) cracking mechanisms.", fr: "Le service amine acide/CO₂ est soumis à l'ASCC et à la fissuration H₂S humide (HIC/SOHIC)." });
    processRecommendations.push({ en: "Verify Post-Weld Heat Treatment (PWHT) records are on file per NACE MR0175 / ISO 15156.", fr: "Vérifier que les registres de traitement thermique après soudage (PWHT) sont archivés selon NACE MR0175 / ISO 15156." });
  }
  if (unit === "X02") {
    processRecommendations.push({ en: "Trend the mercury guard-bed breakthrough curve; schedule adsorbent replacement before saturation.", fr: "Suivre la courbe de percée du lit de garde mercure ; planifier le remplacement de l'adsorbant avant saturation." });
  }
  if (["X03", "X04", "X05"].includes(unit)) {
    recommendedTests.push({ en: "Charpy V-notch impact test verification on carbon steel components exposed below -29°C (low-temperature embrittlement).", fr: "Vérification de l'essai de résilience Charpy V sur composants en acier carbone exposés sous -29°C (fragilisation à froid)." });
  }

  // ── General API mechanical integrity coverage ─────────────────────────────
  if (typeCode !== "P") {
    recommendedTests.push({ en: "External Visual Inspection (VT) — insulation, coating, anchor bolts, and foundation condition.", fr: "Inspection visuelle externe (VT) — calorifuge, revêtement, boulons d'ancrage, état des fondations." });
  }

  // ── Bolting / gasket data-driven guidance (from REAL spare-parts records) ──
  if (representativeBoltSize) {
    processRecommendations.push({
      en: `Registered spare parts show a representative bolting/gasket size of ${representativeBoltSize} — confirm torque values before re-assembly.`,
      fr: `Les pièces de rechange enregistrées indiquent une taille de boulonnage/joint représentative de ${representativeBoltSize} — confirmer les couples de serrage avant remontage.`,
    });
  }
  if (materials.some((m) => m.includes("316"))) {
    processRecommendations.push({ en: "Stainless 316/316L internals detected in spare-parts records — confirm chloride exposure limits if cooling water contacts this equipment.", fr: "Internes en inox 316/316L détectés dans les pièces de rechange — vérifier les limites d'exposition aux chlorures en cas de contact avec l'eau de refroidissement." });
  }

  // ── Risk tier scoring (transparent, auditable — NOT a black-box ML score) ──
  let score = 0;
  if (isDerogation) score += 3;
  if (pressure.belowCodeMinMargin) score += 2;
  if (pressure.dataMissing) score += 1;
  if (unit === "X06") score += 2; // cryogenic aluminum inherent severity
  if (unit === "X01") score += 1; // sour service inherent severity
  if (["X03", "X04", "X05"].includes(unit)) score += 1; // low-temp embrittlement

  let riskTier: RiskTier = "LOW";
  if (score >= 6) riskTier = "CRITICAL";
  else if (score >= 4) riskTier = "HIGH";
  else if (score >= 2) riskTier = "MEDIUM";

  if (isDerogation) {
    riskFactors.push({ en: "Asset is currently operating under an active inspection DEROGATION.", fr: "L'équipement fonctionne actuellement sous DÉROGATION d'inspection active." });
    safetyRecommendations.push({ en: "Confirm the derogation expiry date and prioritize the outstanding NDT/hydrotest before it lapses.", fr: "Vérifier la date d'échéance de la dérogation et prioriser le CND/épreuve en attente avant expiration." });
  }
  if (pressure.belowCodeMinMargin) {
    riskFactors.push({ en: `Test/design pressure ratio (${pressure.ratio?.toFixed(2)}×) is below the typical 1.3×–1.5× code margin — re-verify MAWP basis.`, fr: `Le ratio pression d'épreuve/calcul (${pressure.ratio?.toFixed(2)}×) est sous la marge de code typique 1.3×–1.5× — revérifier la base MAWP.` });
  }

  if (riskFactors.length === 0) {
    riskFactors.push({ en: "No elevated risk factors identified from the current master record.", fr: "Aucun facteur de risque élevé identifié dans la fiche actuelle." });
  }
  if (safetyRecommendations.length === 0) {
    safetyRecommendations.push({ en: "Maintain the standard preventive inspection interval; no immediate safety action required.", fr: "Maintenir l'intervalle d'inspection préventive standard ; aucune action de sécurité immédiate requise." });
  }
  if (processRecommendations.length === 0) {
    processRecommendations.push({ en: "No specific process deviation identified; continue standard operating envelope monitoring.", fr: "Aucune déviation de procédé spécifique identifiée ; poursuivre la surveillance standard." });
  }

  return {
    tag: eq.tag,
    unit,
    section: eq.section,
    typeCode,
    typeName,
    service,
    pressure,
    materials,
    representativeBoltSize,
    recommendedTests,
    riskTier,
    riskFactors,
    safetyRecommendations,
    processRecommendations,
  };
}
