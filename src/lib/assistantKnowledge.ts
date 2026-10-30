import knowledgeJson from "../data/assistant_knowledge.json";
import { buildAliasIndex, compactTag, resolveEquipmentTag, type AliasRecord, type AliasResolution } from "./equipmentAliases";
import { queryLineList, type LineListDataset, type LineListRow } from "./lineListCsv";
import { connectionsForTag, pidCoverage, pidSheetByFile } from "./pidIndex";
import { buildInstrumentIndex, findInstrument, type InstrumentEntry } from "./instrumentIndex";
import { instrumentContext } from "./instrumentLocation";
import { describeInstrument } from "./instrumentTags";

export interface KnowledgeEquipment extends AliasRecord {
  kind: "register";
  name: string;
  unit: string;
  section: string;
  type: { code: string; name: string };
  testing_status: string;
  technical: { pressure_bar: number | null; weight_kg: number | null; volume_m3: number | null; temperature_c: number | null; serial_no: string };
  maintenance: { last_tested: string; next_test_due: string };
  manualIds: string[];
  dcsPanelIds: string[];
  pidSheetIds: string[];
  pidFileIds: string[];
}
export interface DrawingAsset extends AliasRecord {
  kind: "drawing";
  pidSheetIds: string[];
  pidFileIds: string[];
  dcsPanelIds: string[];
  manualIds: string[];
}
export interface PidSheet { id: string; title_en: string; title_fr: string; drawing: string; section: string; equipment: string[]; keywords: string; localFile: string | null; textIndexed: boolean }
export interface PidFile { id: string; file: string; title: string; equipment: string[]; sheetId: string | null; textIndexed: boolean }
export interface KnowledgeDcsPanel { id: string; title_en: string; title_fr: string; section: string; unit: string | null; storage_path: string; detectedTags: string[]; equipmentTags: string[] }
export interface KnowledgeManual { id: string; title_en: string; title_fr: string; category: string }
export interface AssistantKnowledge {
  version: number;
  generatedAt: string;
  register: { source: string; recordCount: number; originalCsvAvailable: boolean; csvDerivative: string };
  coverage: Record<string, number | boolean>;
  equipment: KnowledgeEquipment[];
  drawingAssets: DrawingAsset[];
  pidSheets: PidSheet[];
  pidFiles: PidFile[];
  dcsPanels: KnowledgeDcsPanel[];
  manuals: KnowledgeManual[];
  aliasConflicts: Array<{ flowId: string; diag: string; declaredDbTag: string; reason: string }>;
}

export const KNOWLEDGE = knowledgeJson as unknown as AssistantKnowledge;
export type AssistantSourceKind = "equipment" | "dcs" | "manual" | "simulation" | "pid" | "csv" | "instrument";
export interface KnowledgeSource { kind: AssistantSourceKind; id: string; title: string; href?: string; detail?: string }
export type QuestionIntent = "line_count" | "line_sizes" | "pid" | "dcs" | "manual" | "alarm" | "equipment" | "instrument";
export interface ManualEvidence { id: string; title: string; snippets: string[] }
export interface LineListEvidenceInput { fileName: string; rows: LineListRow[]; warnings?: string[] }
export interface SimulatedAlarmEvidence { tag: string; name: string; unit: string; severity: string; description: string }

export interface KnowledgeAnswer {
  text: string;
  sources: KnowledgeSource[];
  intent: QuestionIntent;
  resolution: AliasResolution<KnowledgeEquipment | DrawingAsset>;
  verifiedLineList: boolean;
  coverage: string[];
}

const fr = (lang: string) => lang === "fr";
const L = (lang: string, en: string, french: string) => fr(lang) ? french : en;

export function allAliasRecords(): Array<KnowledgeEquipment | DrawingAsset> {
  return [
    ...KNOWLEDGE.equipment.map((item) => ({ ...item, kind: "register" as const })),
    ...KNOWLEDGE.drawingAssets.map((item) => ({ ...item, kind: "drawing" as const })),
  ];
}

export function detectIntent(prompt: string): QuestionIntent {
  const q = prompt.toLowerCase();
  if (/(how many|count|number of|combien|nombre de).*(pipe|line|ligne|tuyaut)|(pipe|line|ligne|tuyaut).*(how many|count|combien|nombre)/.test(q)) return "line_count";
  // French asks it as "quels diamètres sont raccordés à …", without a pipe/line noun.
  if (/(size|diameter|diam[eèè]tre|diam[eè]tres|dn|nps|taille|dimension).*(pipe|line|ligne|tuyaut|connect|raccord|branch)|(pipe|line|ligne|tuyaut).*(size|diameter|diam[eè]tre|dn|nps|taille)/.test(q)) return "line_sizes";
  if (/(alarm|alert|alarme|alerte|simulat)/.test(q)) return "alarm";
  if (/(manual|procedure|procédure|procedures|manuel|s\d{2})/.test(q)) return "manual";
  if (/(dcs|panel|panneau|screen|écran|ecran|synoptique)/.test(q)) return "dcs";
  if (/(p&id|pid|p\s*&\s*id|drawing|schéma|schema|plan)/.test(q)) return "pid";
  return "equipment";
}

export function resolvePrompt(prompt: string, currentTag?: string | null): AliasResolution<KnowledgeEquipment | DrawingAsset> {
  const resolution = resolveEquipmentTag(prompt, allAliasRecords(), currentTag);
  if (resolution.status === "unknown" && currentTag && !/[A-Z]{1,3}[-\s._]*\d{2,4}/i.test(prompt)) {
    return resolveEquipmentTag(currentTag, allAliasRecords(), currentTag);
  }
  return resolution;
}

function pidSources(ids: string[], fileIds: string[], lang: string): KnowledgeSource[] {
  const sources: KnowledgeSource[] = [];
  for (const id of ids) {
    const sheet = KNOWLEDGE.pidSheets.find((item) => item.id === id);
    if (!sheet) continue;
    sources.push({
      kind: "pid", id: sheet.id, title: `${sheet.drawing} — ${fr(lang) ? sheet.title_fr : sheet.title_en}`,
      href: sheet.localFile ?? `/pids?sheet=${encodeURIComponent(sheet.id)}`,
      detail: L(lang, "P&ID sheet · revision must be verified", "Feuille P&ID · révision à vérifier"),
    });
  }
  for (const id of fileIds) {
    const file = KNOWLEDGE.pidFiles.find((item) => item.id === id);
    if (!file || sources.some((source) => source.href === file.file)) continue;
    const indexed = pidSheetByFile(file.file);
    const detail = indexed
      ? (indexed.verified
        ? L(lang, `Reviewed drawing extraction · ${indexed.sizes.length} size(s) read`, `Extraction de plan relue · ${indexed.sizes.length} diamètre(s) lus`)
        : L(lang, `Drawing index (OCR) · ${indexed.sizes.length} size(s) read · not verified`, `Index de plan (OCR) · ${indexed.sizes.length} diamètre(s) lus · non vérifié`))
      : L(lang, "Local P&ID PDF · not indexed", "PDF P&ID local · non indexé");
    sources.push({ kind: "pid", id: file.id, title: file.title, href: file.file, detail });
  }
  return sources;
}

function dcsSources(ids: string[], lang: string): KnowledgeSource[] {
  return ids.flatMap((id) => {
    const panel = KNOWLEDGE.dcsPanels.find((item) => item.id === id);
    if (!panel) return [];
    return [{ kind: "dcs" as const, id: panel.id, title: fr(lang) ? panel.title_fr : panel.title_en, href: `/dcs/${encodeURIComponent(panel.id)}`, detail: L(lang, `${panel.detectedTags.length} pre-scanned tags · image not re-verified`, `${panel.detectedTags.length} tags pré-détectés · image non revérifiée`) }];
  });
}

function manualSources(ids: string[], lang: string): KnowledgeSource[] {
  return ids.flatMap((id) => {
    const manual = KNOWLEDGE.manuals.find((item) => item.id === id);
    if (!manual) return [];
    return [{ kind: "manual" as const, id: manual.id, title: `${manual.id} — ${fr(lang) ? manual.title_fr : manual.title_en}`, href: "/manuals", detail: L(lang, "Operational manual reference", "Référence de manuel opérationnel") }];
  });
}

export function gatherAssetEvidence(record: KnowledgeEquipment | DrawingAsset, lang: string) {
  const sources: KnowledgeSource[] = [];
  if (record.kind === "register") {
    sources.push({ kind: "equipment", id: record.tag, title: `${record.tag} — ${record.name}`, href: `/equipment/${encodeURIComponent(record.tag)}`, detail: record.type.name });
  } else {
    sources.push({ kind: "equipment", id: record.tag, title: `${record.tag} — ${L(lang, "drawing-only tag", "repère présent sur plan uniquement")}`, detail: L(lang, "Not present in the equipment register", "Absent du registre des équipements") });
  }
  sources.push(...pidSources(record.pidSheetIds, record.pidFileIds, lang));
  sources.push(...dcsSources(record.dcsPanelIds, lang));
  sources.push(...manualSources(record.manualIds, lang));
  const coverage: string[] = [];
  if (record.kind === "drawing") coverage.push(L(lang, `${record.tag} appears on P&ID sources but is not in the 77-record equipment register.`, `${record.tag} apparaît sur les sources P&ID mais pas dans le registre de 77 équipements.`));
  if (!record.pidSheetIds.length && !record.pidFileIds.length) coverage.push(L(lang, "No matching P&ID sheet was found in the local index.", "Aucune feuille P&ID correspondante dans l'index local."));
  if (!record.dcsPanelIds.length) coverage.push(L(lang, "No DCS panel is explicitly mapped to this tag.", "Aucun panneau DCS n'est explicitement associé à ce repère."));
  if (!record.manualIds.length) coverage.push(L(lang, "No operational manual is explicitly mapped to this tag.", "Aucun manuel opérationnel n'est explicitement associé à ce repère."));
  coverage.push(L(lang, "P&ID PDFs are not text-indexed; a filename match does not verify connections or sizes.", "Les PDF P&ID ne sont pas indexés en texte ; un nom de fichier ne vérifie ni les raccordements ni les diamètres."));
  return { sources, coverage };
}

function value(value: unknown, unit: string, lang: string): string {
  return value == null || value === "" ? L(lang, "not recorded", "non enregistré") : `${value}${unit}`;
}

function lineListDataset(input: LineListEvidenceInput): LineListDataset {
  return { fileName: input.fileName, rowCount: input.rows.length, rows: input.rows, warnings: input.warnings ?? [], delimiter: "," };
}

function resolvesTo(target: KnowledgeEquipment | DrawingAsset) {
  const index = buildAliasIndex(allAliasRecords());
  return (candidate: string) => {
    const resolution = resolveEquipmentTag(candidate, allAliasRecords());
    if (resolution.status === "resolved") return resolution.matches.some((match) => match.record.tag === target.tag);
    // Allow exact compact equality for CSV cells that are already canonical.
    return compactTag(candidate) === compactTag(target.tag) || (index.get(compactTag(candidate)) ?? []).some((match) => match.record.tag === target.tag);
  };
}

/**
 * Instrument tags seen in a prompt, e.g. "LIC101204", "XV-101-223", "FIQ10602".
 * Equipment aliases are handled by resolvePrompt; this is the DCS instrument
 * corpus, which the alias index does not cover.
 */
export function instrumentTagsIn(prompt: string): string[] {
  const found = prompt
    .toUpperCase()
    .match(/\b[A-Z]{1,4}(?:[-\s._]*\d{1,8})+[A-Z]?\b/g) ?? [];
  return [...new Set(found.map((token) => token.replace(/[\s._-]+/g, "")))];
}

/** The instrument a prompt is asking about, if the corpus has it. */
export function resolveInstrument(prompt: string, currentTag?: string | null): InstrumentEntry | null {
  for (const candidate of instrumentTagsIn(prompt)) {
    const entry = findInstrument(candidate);
    if (entry) return entry;
  }
  if (currentTag) {
    const fromContext = findInstrument(currentTag);
    if (fromContext) return fromContext;
  }
  return null;
}

const SOURCE_LABEL: Record<string, { en: string; fr: string }> = {
  isa: { en: "ISA tag decode", fr: "Décodage du tag ISA" },
  dcs: { en: "DCS scan — image not re-verified", fr: "Relevé DCS — image non revérifiée" },
  register: { en: "Equipment register", fr: "Registre des équipements" },
  drawing: { en: "Drawing index (OCR) — not verified", fr: "Index de plan (OCR) — non vérifié" },
};

/**
 * The instrument answer, built from exactly the same context the Instrument
 * Finder shows — so the assistant can never say more than the UI does.
 *
 * Every claim is labelled with where it came from, the drawings are offered as
 * unit-level leads (never as "this tag is on this sheet"), and the gaps are
 * stated. Nothing here infers a line, a range, or a connection.
 */
export function buildInstrumentAnswer(entry: InstrumentEntry, lang: string): {
  sections: string[];
  sources: KnowledgeSource[];
  coverage: string[];
} {
  // Narrow once: the instrument context is typed to the UI's language union.
  const l: "en" | "fr" = fr(lang) ? "fr" : "en";
  const context = instrumentContext(entry, l);
  const sources: KnowledgeSource[] = [{
    kind: "instrument",
    id: entry.tag,
    title: `${entry.tag} — ${describeInstrument(entry.parsed, l)}`,
    href: `/instruments?q=${encodeURIComponent(entry.tag)}`,
    detail: L(lang, "DCS instrument index", "Index d'instruments DCS"),
  }];
  const sections: string[] = [];
  const coverage: string[] = [];

  sections.push(L(lang,
    `### Instrument \`${entry.tag}\`\n\n**${describeInstrument(entry.parsed, l)}** — decoded from the ISA tag. This decoding is a reading of the tag letters; it is not proof of the instrument's function.`,
    `### Instrument \`${entry.tag}\`\n\n**${describeInstrument(entry.parsed, l)}** — décodé depuis le tag ISA. Ce décodage est une lecture des lettres du tag ; ce n'est pas une preuve de la fonction de l'instrument.`));

  const unitLine = [
    context.unitCode ? `unit \`${context.unitCode}\`` : null,
    context.unitEn ? (fr(lang) ? context.unitFr : context.unitEn) : null,
    entry.parsed.train ? `${L(lang, "train", "train")} ${entry.parsed.train}` : null,
    entry.parsed.loop ? `${L(lang, "loop", "boucle")} ${entry.parsed.loop}` : null,
  ].filter(Boolean).join(" · ");
  if (unitLine) {
    sections.push(L(lang,
      `### Unit and train\n\n${unitLine}.\n\n${L(lang, "Source:", "Source :")} ${SOURCE_LABEL.isa.en}.`,
      `### Unité et train\n\n${unitLine}.\n\n${L(lang, "Source:", "Source :")} ${SOURCE_LABEL.isa.fr}.`));
  }

  if (entry.panels.length) {
    const panels = entry.panels.slice(0, 4).map((panel) => {
      sources.push({
        kind: "dcs", id: panel.id, title: fr(lang) ? panel.titleFr : panel.titleEn,
        href: `/dcs/${encodeURIComponent(panel.id)}`,
        detail: L(lang, "Pre-scanned DCS tags · image not re-verified", "Tags DCS pré-détectés · image non revérifiée"),
      });
      return `- ${fr(lang) ? panel.titleFr : panel.titleEn}`;
    }).join("\n");
    sections.push(L(lang,
      `### Read on these DCS screens\n\n${panels}\n\n${SOURCE_LABEL.dcs.en}.`,
      `### Lu sur ces écrans DCS\n\n${panels}\n\n${SOURCE_LABEL.dcs.fr}.`));
  }

  /* Drawings: a lead, never a location. */
  if (context.placements.length) {
    const rows = context.placements.slice(0, 4).map((placement) => {
      const title = (fr(lang) ? placement.titleFr : placement.titleEn) ?? placement.title;
      sources.push({
        kind: "pid",
        id: placement.file,
        title: placement.drawing ? `${placement.drawing} — ${title}` : title,
        href: placement.url,
        detail: L(lang,
          `Covers unit ${placement.matchedUnit ?? "?"} · not verified`,
          `Couvre l'unité ${placement.matchedUnit ?? "?"} · non vérifié`),
      });
      const reason = placement.matchedByUnitDrawing
        ? L(lang, `numbered for unit ${placement.unit}`, `numéroté pour l'unité ${placement.unit}`)
        : L(lang, "no drawing number on the title block; listed because it shows this unit's equipment", "pas de numéro sur le cartouche ; listé car il montre des équipements de cette unité");
      return `- **${placement.drawing ?? title}** — ${title} → [${L(lang, "open drawing", "ouvrir le plan")}](${placement.url})\n  - ${reason}`;
    }).join("\n");
    sections.push(L(lang,
      `### Drawings to inspect\n\n${rows}\n\n**Unit-level association — not a verified location.** These drawings cover unit ${context.unitCode ?? "?"}. No drawing in this system has been shown to carry \`${entry.tag}\` as text, so I cannot tell you which sheet the instrument is on: open the drawings above and look for loop ${entry.parsed.loop ?? "?"}.`,
      `### Plans à consulter\n\n${rows}\n\n**Association au niveau de l'unité — ce n'est pas une localisation vérifiée.** Ces plans couvrent l'unité ${context.unitCode ?? "?"}. Aucun plan de ce système ne porte \`${entry.tag}\` en texte : je ne peux donc pas dire sur quelle feuille se trouve l'instrument. Ouvrez les plans ci-dessus et cherchez la boucle ${entry.parsed.loop ?? "?"}.`));
  } else {
    sections.push(L(lang,
      `### Drawings\n\n${context.missing[0] ?? "No drawing could be tied to this tag."}`,
      `### Plans\n\n${context.missing[0] ?? "Aucun plan n'a pu être relié à ce tag."}`));
  }

  /* What is around it, labelled by source. */
  if (context.equipmentOnDrawings.length || context.lines.length) {
    const parts: string[] = [];
    if (context.equipmentOnDrawings.length) {
      const items = context.equipmentOnDrawings.slice(0, 8).map((item) =>
        item.inRegister
          ? `\`${item.tag}\` (${L(lang, "in the equipment register", "dans le registre des équipements")})`
          : `\`${item.tag}\` (${L(lang, "read on the drawing, not in the register", "lu sur le plan, absent du registre")})`,
      ).join(", ");
      parts.push(L(lang, `**Equipment shown on those drawings:** ${items}`, `**Équipements figurant sur ces plans :** ${items}`));
    }
    if (context.lines.length) {
      const calls = context.lines.slice(0, 8).map((line) => `\`${line.asRead}\``).join(", ");
      parts.push(L(lang,
        `**Piping carried by those drawings:** ${calls} — ${L(lang, "read by OCR, and not a connection of this instrument.", "lu par OCR, et non un raccordement de cet instrument.")}`,
        `**Tuyauteries portées par ces plans :** ${calls} — ${L(lang, "read by OCR, and not a connection of this instrument.", "lu par OCR, et non un raccordement de cet instrument.")}`));
    }
    sections.push(L(lang, `### Around it on those drawings\n\n${parts.join("\n\n")}`, `### Autour de lui sur ces plans\n\n${parts.join("\n\n")}`));
  }

  /* Specifications, each with its source. */
  if (context.specs.length) {
    const rows = context.specs.slice(0, 10).map((spec) => {
      const label = fr(lang) ? spec.labelFr : spec.labelEn;
      const source = SOURCE_LABEL[spec.source]?.[fr(lang) ? "fr" : "en"] ?? spec.source;
      return `- **${label}:** ${spec.value} — _${source}_${spec.verified ? ` (${L(lang, "verified", "vérifié")})` : ""}`;
    }).join("\n");
    sections.push(L(lang, `### Specifications\n\n${rows}`, `### Caractéristiques\n\n${rows}`));
  }

  /* The gaps. */
  sections.push(L(lang,
    `### What I cannot tell you\n\n${context.missing.map((item) => `- ${item}`).join("\n")}`,
    `### Ce que je ne peux pas vous dire\n\n${context.missing.map((item) => `- ${item}`).join("\n")}`));

  sections.push(L(lang,
    `### Links\n\n- [Instrument Finder](${`/instruments?q=${encodeURIComponent(entry.tag)}`})\n- [P&ID library](/pids)`,
    `### Liens\n\n- [Recherche d'instruments](${`/instruments?q=${encodeURIComponent(entry.tag)}`})\n- [Bibliothèque P&ID](/pids)`));

  coverage.push(L(lang,
    `Instrument decoded from the DCS tag index; drawings from the P&ID index (${pidCoverage().indexed}/${pidCoverage().sheets} sheets, ${pidCoverage().backend}), none of which has been signed off by an engineer.`,
    `Instrument décodé depuis l'index de tags DCS ; plans issus de l'index P&ID (${pidCoverage().indexed}/${pidCoverage().sheets} feuilles, ${pidCoverage().backend}), dont aucune n'a été validée par un ingénieur.`));

  return { sections, sources: sources.slice(0, 10), coverage };
}

export function buildKnowledgeAnswer(options: {
  prompt: string;
  lang: string;
  currentTag?: string | null;
  lineList?: LineListEvidenceInput | null;
  manualEvidence?: ManualEvidence[];
  alarms?: SimulatedAlarmEvidence[];
}): KnowledgeAnswer {
  const { prompt, lang, currentTag, lineList, manualEvidence = [], alarms = [] } = options;
  const intent = detectIntent(prompt);
  const resolution = resolvePrompt(prompt, currentTag);
  const sources: KnowledgeSource[] = [];
  const coverage: string[] = [];
  const sections: string[] = [];
  let verifiedLineList = false;

  if (resolution.status === "ambiguous") {
    const candidates = resolution.candidates.slice(0, 6).map((match) => `- \`${match.record.tag}\`${match.record.name ? ` — ${match.record.name}` : ""}`).join("\n");
    sections.push(L(lang, `### Which equipment do you mean?\n\nThe tag is ambiguous. Please choose one:\n${candidates}`, `### Quel équipement voulez-vous dire ?\n\nLe repère est ambigu. Veuillez choisir :\n${candidates}`));
    return { text: sections.join("\n\n"), sources, intent, resolution, verifiedLineList, coverage };
  }

  // A DCS instrument tag is answered from the instrument index: the alias index
  // only covers equipment and drawing assets, so it would report "not found".
  const instrument = resolveInstrument(prompt, currentTag);
  if (instrument) {
    const answer = buildInstrumentAnswer(instrument, lang);
    answer.sections.push(L(lang,
      "### Boundaries\n\nThis is a reference answer built from the DCS tag index and the P&ID index. It is advisory only: it is not an operating instruction, a work permit, or an approved engineering decision. Nothing here states where the instrument sits on a sheet, and nothing here is a verified process connection.",
      "### Limites\n\nCeci est une réponse de référence construite à partir de l'index de tags DCS et de l'index P&ID. Elle est donnée à titre indicatif : ce n'est ni une consigne d'exploitation, ni une autorisation de travail, ni une décision d'ingénierie approuvée. Rien n'indique ici où se trouve l'instrument sur une feuille, et rien ne constitue un raccordement process vérifié."));
    if (answer.coverage.length) {
      answer.sections.push(L(lang,
        `### Source coverage\n\n${[...new Set(answer.coverage)].map((item) => `- ${item}`).join("\n")}`,
        `### Couverture des sources\n\n${[...new Set(answer.coverage)].map((item) => `- ${item}`).join("\n")}`));
    }
    return {
      text: answer.sections.join("\n\n"),
      sources: answer.sources,
      intent: "instrument" as QuestionIntent,
      resolution,
      verifiedLineList: false,
      coverage: answer.coverage,
    };
  }

  const record = resolution.status === "resolved" ? resolution.matches[0].record : null;
  if (resolution.status === "resolved" && resolution.matches.length > 1 && (intent === "line_count" || intent === "line_sizes")) {
    sections.push(L(lang, "### One equipment at a time\n\nLine-list queries currently support one resolved tag. Please ask about a single equipment tag.", "### Un équipement à la fois\n\nLes requêtes de liste de lignes prennent en charge un seul repère résolu. Veuillez interroger un seul repère."));
    return { text: sections.join("\n\n"), sources, intent, resolution, verifiedLineList, coverage };
  }

  if (!record) {
    sections.push(L(lang,
      `### Equipment not found\n\nI could not match that tag to the equipment register or the local P&ID index. Try formats such as \`E-501\`, \`E 501\`, \`X01 E 501\`, or \`X01-E-501\`. I will not substitute a nearby tag.`,
      `### Équipement introuvable\n\nJe n'ai pas trouvé ce repère dans le registre ou l'index P&ID local. Essayez \`E-501\`, \`E 501\`, \`X01 E 501\` ou \`X01-E-501\`. Je ne remplace pas par un repère voisin.`));
    coverage.push(L(lang, `Checked ${KNOWLEDGE.coverage.equipmentRecords} register records and ${KNOWLEDGE.coverage.pidLocalFiles} local P&ID files.`, `${KNOWLEDGE.coverage.equipmentRecords} fiches du registre et ${KNOWLEDGE.coverage.pidLocalFiles} fichiers P&ID locaux vérifiés.`));
  } else {
    const match = resolution.status === "resolved" ? resolution.matches[0] : null;
    if (match && match.alias !== record.tag) sections.push(L(lang, `**Matched:** \`${match.alias}\` → \`${record.tag}\``, `**Correspondance :** \`${match.alias}\` → \`${record.tag}\``));
    const evidence = gatherAssetEvidence(record, lang);
    sources.push(...evidence.sources);
    coverage.push(...evidence.coverage);

    if (intent === "line_count" || intent === "line_sizes") {
      if (lineList?.rows?.length) {
        const dataset = lineListDataset(lineList);
        const result = queryLineList(dataset, record.tag, resolvesTo(record));
        verifiedLineList = true;
        sources.unshift({ kind: "csv", id: "line-list", title: dataset.fileName, href: "/data/gnl1z_equipment_register.csv", detail: L(lang, "User-supplied line list", "Liste de lignes fournie par l'utilisateur") });
        if (intent === "line_count") {
          sections.push(L(lang,
            `### Verified line-list count\n\n**${result.distinctLineCount}** distinct pipeline line(s) are associated with \`${record.tag}\` in \`${dataset.fileName}\` (from/to columns, deduplicated by line number).`,
            `### Nombre vérifié depuis la liste de lignes\n\n**${result.distinctLineCount}** ligne(s) de tuyauterie distincte(s) sont associées à \`${record.tag}\` dans \`${dataset.fileName}\` (colonnes from/to, dédupliquées par numéro de ligne).`));
        } else {
          sections.push(L(lang,
            `### Verified pipe sizes\n\nSizes recorded for \`${record.tag}\` in \`${dataset.fileName}\`: **${result.sizes.length ? result.sizes.join(", ") : "not recorded"}**.`,
            `### Diamètres vérifiés\n\nDiamètres enregistrés pour \`${record.tag}\` dans \`${dataset.fileName}\` : **${result.sizes.length ? result.sizes.join(", ") : "non enregistré"}**.`));
        }
        if (result.matchedRows.length) {
          const rows = result.matchedRows.slice(0, 20).map((row) => `- \`${row.lineNumber || `row ${row.row}`}\` · ${row.from || "?"} → ${row.to || "?"} · ${row.size || L(lang, "size not recorded", "diamètre non enregistré")}${row.service ? ` · ${row.service}` : ""} (CSV row ${row.row})`).join("\n");
          sections.push(L(lang, `### Matching rows\n\n${rows}${result.matchedRows.length > 20 ? `\n- …${result.matchedRows.length - 20} more row(s)` : ""}`, `### Lignes correspondantes\n\n${rows}${result.matchedRows.length > 20 ? `\n- …${result.matchedRows.length - 20} ligne(s) supplémentaire(s)` : ""}`));
        }
        coverage.push(...result.warnings);
        coverage.push(L(lang, "Counts and sizes are only as complete as the supplied CSV; they are not a field verification.", "Les nombres et diamètres dépendent de l'exhaustivité du CSV fourni ; ce n'est pas une vérification sur site."));
      } else {
        // No verified CSV — answer from the drawings that were read once and
        // indexed, and be explicit about how trustworthy that reading is.
        const connections = connectionsForTag(record.tag);
        if (connections.sheets.length && (connections.sizes.length || connections.lineCalls.length)) {
          const perSheet = connections.sheets.slice(0, 4).map((sheet) => {
            const title = sheet.titleEn ?? sheet.title;
            const drawing = sheet.drawing ? ` · ${sheet.drawing}` : "";
            const sizes = sheet.sizes.length
              ? sheet.sizes.join(", ")
              : L(lang, "no size read on this sheet", "aucun diamètre lu sur cette feuille");
            const calls = sheet.lineCalls.slice(0, 6).map((call) => `\`${call.asRead}\``).join(", ");
            return `- **${title}**${drawing} → [${L(lang, "open drawing", "ouvrir le plan")}](${sheet.file})\n  - ${L(lang, "Nominal sizes read", "Diamètres nominaux lus")}: ${sizes}${calls ? `\n  - ${L(lang, "Line callouts read", "Repères de ligne lus")}: ${calls}` : ""}`;
          }).join("\n");
          sections.push(L(lang,
            `### Pipe sizes read on the P&ID${connections.verified ? "" : " (not verified)"}\n\n\`${record.tag}\` appears on ${connections.sheets.length} drawing(s) in the P&ID index (${pidCoverage().indexed}/${pidCoverage().sheets} sheets indexed).\n\n${perSheet}\n\n**Distinct sizes across those drawings:** ${connections.sizes.join(", ") || L(lang, "none read", "aucun lu")}.`,
            `### Diamètres lus sur le P&ID${connections.verified ? "" : " (non vérifié)"}\n\n\`${record.tag}\` apparaît sur ${connections.sheets.length} plan(s) de l'index P&ID (${pidCoverage().indexed}/${pidCoverage().sheets} feuilles indexées).\n\n${perSheet}\n\n**Diamètres distincts sur ces plans :** ${connections.sizes.join(", ") || L(lang, "aucun lu", "aucun lu")}.`));
          if (!connections.verified) {
            sections.push(L(lang,
              `### Read this before you use the numbers\n\nThe drawings are scans, so these sizes were read by OCR over the raster and **no engineer has signed them off**. OCR confuses digits and separators on dense callouts (\`5\`/\`S\`, \`-\`/\`=\`). Treat every value as a pointer to where to look on the drawing, never as a design or work-permit value. For a verified answer, attach the piping line list CSV (line number, from/to, size) and I will answer from those rows instead.`,
              `### À lire avant d'utiliser ces valeurs\n\nLes plans sont des scans : ces diamètres ont été lus par OCR sur l'image et **aucun ingénieur ne les a validés**. L'OCR confond chiffres et séparateurs sur les repères denses (\`5\`/\`S\`, \`-\`/\`=\`). Considérez chaque valeur comme une indication de où chercher sur le plan, jamais comme une valeur de conception ou d'autorisation de travail. Pour une réponse vérifiée, joignez le CSV de liste de lignes (numéro de ligne, from/to, diamètre) et je répondrai depuis ces lignes.`));
          }
          coverage.push(L(lang,
            `Sizes and callouts come from the P&ID index (${pidCoverage().backend}, generated ${pidCoverage().generatedAt.slice(0, 10)}): ${pidCoverage().note}`,
            `Diamètres et repères issus de l'index P&ID (${pidCoverage().backend}, généré le ${pidCoverage().generatedAt.slice(0, 10)}) : ${pidCoverage().note}`));
        } else {
          sections.push(L(lang,
            `### Piping answer not yet verified\n\nI located \`${record.tag}\` in the reference sources, but no verified piping line list is loaded and no drawing yielded a readable callout for this tag. I will not infer a pipe size from a filename. Attach a line-list CSV with line number, from/to, and size columns, or open the matched P&ID for an engineered takeoff.`,
            `### Réponse tuyauterie non encore vérifiée\n\nJ'ai localisé \`${record.tag}\` dans les sources, mais aucune liste de lignes vérifiée n'est chargée et aucun plan n'a fourni de repère lisible pour ce repère. Je ne déduis pas un diamètre à partir d'un nom de fichier. Joignez un CSV de liste de lignes avec numéro de ligne, from/to et diamètre, ou ouvrez le P&ID correspondant pour un relevé d'ingénierie.`));
        }
      }
    } else if (record.kind === "register") {
      const missing = [
        record.technical.temperature_c == null ? L(lang, "service temperature", "température de service") : null,
        !record.maintenance.last_tested ? L(lang, "last test", "dernier essai") : null,
        !record.maintenance.next_test_due ? L(lang, "next due date", "prochaine échéance") : null,
      ].filter(Boolean);
      sections.push(L(lang,
        `### Register reference\n\n**${record.tag} — ${record.name}**\n- Type: ${record.type.name}; unit: ${record.unit}.\n- Recorded pressure: ${value(record.technical.pressure_bar, " bar", lang)}; mass: ${value(record.technical.weight_kg, " kg", lang)}.\n- Register last test: ${value(record.maintenance.last_tested, "", lang)}; next due: ${value(record.maintenance.next_test_due, "", lang)}.\n${missing.length ? `- Missing data: ${missing.join(", ")}.` : "- No missing fields among the checked values."}`,
        `### Référence du registre\n\n**${record.tag} — ${record.name}**\n- Type : ${record.type.name} ; unité : ${record.unit}.\n- Pression enregistrée : ${value(record.technical.pressure_bar, " bar", lang)} ; masse : ${value(record.technical.weight_kg, " kg", lang)}.\n- Dernier essai : ${value(record.maintenance.last_tested, "", lang)} ; prochaine échéance : ${value(record.maintenance.next_test_due, "", lang)}.\n${missing.length ? `- Données manquantes : ${missing.join(", ")}.` : "- Aucun champ manquant parmi les valeurs vérifiées."}`));
    }
  }

  if (intent === "manual" || manualEvidence.length) {
    if (manualEvidence.length) {
      const quotes = manualEvidence.slice(0, 3).map((manual) => `**${manual.id} — ${manual.title}**\n${manual.snippets.slice(0, 2).map((snippet) => `> ${snippet.replace(/\n/g, " ")}`).join("\n")}`).join("\n\n");
      sections.push(L(lang, `### Retrieved manual excerpts\n\n${quotes}\n\nExcerpts are search hits, not a complete approved procedure.`, `### Extraits de manuels récupérés\n\n${quotes}\n\nCes extraits sont des résultats de recherche, pas une procédure approuvée complète.`));
      for (const manual of manualEvidence) sources.push({ kind: "manual", id: manual.id, title: `${manual.id} — ${manual.title}`, href: "/manuals", detail: L(lang, "Retrieved text excerpt", "Extrait de texte récupéré") });
    } else if (intent === "manual") {
      sections.push(L(lang, "### Manual content not loaded\n\nOnly manual titles are indexed locally. Use the Manuals page search to retrieve document text, or ask a register/P&ID question.", "### Contenu des manuels non chargé\n\nSeuls les titres sont indexés localement. Utilisez la recherche de la page Manuels pour récupérer le texte, ou posez une question sur le registre/P&ID."));
    }
  }

  if (intent === "dcs" && record) {
    const panels = KNOWLEDGE.dcsPanels.filter((panel) => record.dcsPanelIds.includes(panel.id));
    if (panels.length) sections.push(L(lang, `### DCS references\n\n${panels.map((panel) => `- **${panel.title_en}**: ${panel.detectedTags.length} pre-scanned instrument tags. The image itself has not been re-verified in this answer.`).join("\n")}`, `### Références DCS\n\n${panels.map((panel) => `- **${panel.title_fr}** : ${panel.detectedTags.length} tags d'instruments pré-détectés. L'image elle-même n'a pas été revérifiée dans cette réponse.`).join("\n")}`));
  }
  if (intent === "pid" && record) {
    const connections = connectionsForTag(record.tag);
    const read = connections.sheets.filter((sheet) => sheet.sizes.length || sheet.lineCalls.length);
    if (read.length) {
      sections.push(L(lang,
        `### What the drawing index read\n\n${read.slice(0, 4).map((sheet) => `- **${sheet.titleEn ?? sheet.title}**: ${sheet.sizes.length ? `${L(lang, "sizes", "diamètres")} ${sheet.sizes.slice(0, 8).join(", ")}` : L(lang, "no size read", "aucun diamètre lu")} · ${sheet.lineCalls.length} ${L(lang, "line callout(s)", "repère(s) de ligne")}`).join("\n")}\n\n${connections.verified ? "" : L(lang, "OCR reading of a scanned drawing — confirm on the drawing itself.", "Lecture OCR d'un plan scanné — à confirmer sur le plan.")}`,
        `### Ce que l'index de plans a lu\n\n${read.slice(0, 4).map((sheet) => `- **${sheet.titleFr ?? sheet.titleEn ?? sheet.title}** : ${sheet.sizes.length ? `${L(lang, "diamètres", "diamètres")} ${sheet.sizes.slice(0, 8).join(", ")}` : L(lang, "aucun diamètre lu", "aucun diamètre lu")} · ${sheet.lineCalls.length} ${L(lang, "repère(s) de ligne", "repère(s) de ligne")}`).join("\n")}\n\n${connections.verified ? "" : L(lang, "Lecture OCR d'un plan scanné — à confirmer sur le plan.", "Lecture OCR d'un plan scanné — à confirmer sur le plan.")}`));
    } else {
      sections.push(L(lang, "### P&ID references\n\nThe matched sheets/PDFs are listed below. They are drawing references, not a verified line takeoff. Confirm the approved revision before engineering use.", "### Références P&ID\n\nLes feuilles/PDF correspondants sont listés ci-dessous. Ce sont des références de plan, pas un relevé de lignes vérifié. Confirmez la révision approuvée avant usage d'ingénierie."));
    }
  }
  if (intent === "alarm") {
    const relevant = record ? alarms.filter((alarm) => compactTag(alarm.tag) === compactTag(record.tag)) : alarms;
    sections.push(L(lang, `### Simulated alarms\n\n${relevant.length ? relevant.slice(0, 5).map((alarm) => `- **${alarm.tag}** (${alarm.severity}): ${alarm.description}`).join("\n") : "No matching active simulated alarms."}\n\nThis is not real-time telemetry.`, `### Alarmes simulées\n\n${relevant.length ? relevant.slice(0, 5).map((alarm) => `- **${alarm.tag}** (${alarm.severity}) : ${alarm.description}`).join("\n") : "Aucune alarme simulée active correspondante."}\n\nCeci n'est pas une télémétrie temps réel.`));
    for (const alarm of relevant.slice(0, 3)) sources.push({ kind: "simulation", id: alarm.tag, title: `${alarm.tag} — ${alarm.name}`, href: "/flow", detail: L(lang, "Simulated alarm", "Alarme simulée") });
  }

  if (coverage.length) sections.push(L(lang, `### Source coverage\n\n${[...new Set(coverage)].map((item) => `- ${item}`).join("\n")}`, `### Couverture des sources\n\n${[...new Set(coverage)].map((item) => `- ${item}`).join("\n")}`));
  sections.push(L(lang,
    "### Boundaries\n\nThese values come from the supplied register, drawing index, and any user-provided line list. They are not real-time telemetry, a test plan, a lift plan, or an operating authorization. Verify approved procedures and drawing revisions.",
    "### Limites\n\nCes valeurs proviennent du registre fourni, de l'index de plans et de toute liste de lignes fournie. Elles ne constituent pas une télémétrie temps réel, un plan d'essai, un plan de levage ni une autorisation d'exploitation. Vérifiez les procédures approuvées et les révisions de plans."));
  return { text: sections.join("\n\n"), sources: sources.slice(0, 10), intent, resolution, verifiedLineList, coverage };
}

export function knowledgeProviderContext(answer: KnowledgeAnswer) {
  const tags = answer.resolution.status === "resolved" ? answer.resolution.matches.map((match) => match.record.tag) : [];
  return {
    register: KNOWLEDGE.register,
    coverage: KNOWLEDGE.coverage,
    resolvedTags: tags,
    equipment: KNOWLEDGE.equipment.filter((item) => tags.includes(item.tag)),
    drawingAssets: KNOWLEDGE.drawingAssets.filter((item) => tags.includes(item.tag)),
    pidSheets: KNOWLEDGE.pidSheets.filter((sheet) => answer.sources.some((source) => source.kind === "pid" && source.id === sheet.id)),
    pidIndex: answer.resolution.status === "resolved"
      ? (() => {
          const connections = connectionsForTag(answer.resolution.matches[0].record.tag);
          return {
            coverage: pidCoverage(),
            sheets: connections.sheets.map((sheet) => ({
              file: sheet.file,
              drawing: sheet.drawing,
              verified: sheet.verified,
              sizes: sheet.sizes,
              lineCalls: sheet.lineCalls.slice(0, 10).map((call) => call.asRead),
            })),
          };
        })()
      : null,
    dcsPanels: KNOWLEDGE.dcsPanels.filter((panel) => answer.sources.some((source) => source.kind === "dcs" && source.id === panel.id)),
    manuals: KNOWLEDGE.manuals.filter((manual) => answer.sources.some((source) => source.kind === "manual" && source.id === manual.id)),
    deterministicAnswer: answer.text,
    verifiedLineList: answer.verifiedLineList,
  };
}
