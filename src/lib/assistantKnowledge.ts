import knowledgeJson from "../data/assistant_knowledge.json";
import { buildAliasIndex, compactTag, resolveEquipmentTag, type AliasRecord, type AliasResolution } from "./equipmentAliases";
import { queryLineList, type LineListDataset, type LineListRow } from "./lineListCsv";

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
export type AssistantSourceKind = "equipment" | "dcs" | "manual" | "simulation" | "pid" | "csv";
export interface KnowledgeSource { kind: AssistantSourceKind; id: string; title: string; href?: string; detail?: string }
export type QuestionIntent = "line_count" | "line_sizes" | "pid" | "dcs" | "manual" | "alarm" | "equipment";
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
  if (/(size|diameter|diamètre|diametre|dn|nps|taille|dimension).*(pipe|line|ligne|tuyaut|connect)|(pipe|line|ligne|tuyaut).*(size|diameter|diamètre|diametre|dn|nps|taille)/.test(q)) return "line_sizes";
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
    sources.push({ kind: "pid", id: file.id, title: file.title, href: file.file, detail: L(lang, "Local P&ID PDF · not text-indexed", "PDF P&ID local · non indexé en texte") });
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
        sections.push(L(lang,
          `### Piping answer not yet verified\n\nI located \`${record.tag}\` in the reference sources, but no verified piping line list is loaded. I cannot give a trustworthy pipeline count or connected pipe sizes from a P&ID filename alone. Attach a line-list CSV with line number, from/to, and size columns, or open the matched P&ID for an engineered takeoff.`,
          `### Réponse tuyauterie non encore vérifiée\n\nJ'ai localisé \`${record.tag}\` dans les sources, mais aucune liste de lignes vérifiée n'est chargée. Je ne peux pas donner un nombre fiable de tuyauteries ni les diamètres raccordés à partir du seul nom d'un P&ID. Joignez un CSV de liste de lignes avec numéro de ligne, from/to et diamètre, ou ouvrez le P&ID correspondant pour un relevé d'ingénierie.`));
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
    sections.push(L(lang, "### P&ID references\n\nThe matched sheets/PDFs are listed below. They are drawing references, not a verified line takeoff. Confirm the approved revision before engineering use.", "### Références P&ID\n\nLes feuilles/PDF correspondants sont listés ci-dessous. Ce sont des références de plan, pas un relevé de lignes vérifié. Confirmez la révision approuvée avant usage d'ingénierie."));
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
    dcsPanels: KNOWLEDGE.dcsPanels.filter((panel) => answer.sources.some((source) => source.kind === "dcs" && source.id === panel.id)),
    manuals: KNOWLEDGE.manuals.filter((manual) => answer.sources.some((source) => source.kind === "manual" && source.id === manual.id)),
    deterministicAnswer: answer.text,
    verifiedLineList: answer.verifiedLineList,
  };
}
