// Regenerates the assistant knowledge index and a canonical equipment CSV from
// the checked-in master register. The original source CSV was not supplied;
// the CSV produced here is explicitly a derivative of gnl1z_database.json.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const db = JSON.parse(read("src/data/gnl1z_database.json"));
const detected = JSON.parse(read("src/data/dcs_detected_tags.json"));

function parseObjectEntries(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return [];
  const body = source.slice(start);
  const entries = [];
  const re = /\{[^{}]*\}/g;
  let match;
  while ((match = re.exec(body))) {
    const block = match[0];
    const get = (key) => block.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1] ?? null;
    const getList = (key) => {
      const raw = block.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1];
      return raw ? [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    };
    entries.push({ block, get, getList });
    if (entries.length > 500) break;
  }
  return entries;
}

const dcsMapSource = read("src/data/dcs_equipment_map.ts");
const dcsMap = Object.fromEntries([...dcsMapSource.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
const manuals = [...read("src/data/manuals.ts").matchAll(/\{\s*id:\s*"([^"]+)",\s*title_en:\s*"([^"]+)",\s*title_fr:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*drive_id:\s*"([^"]+)"\s*\}/g)].map((m) => ({ id: m[1], title_en: m[2], title_fr: m[3], category: m[4] }));
const dcsSource = read("src/data/dcs_panels.ts");
const dcsBody = dcsSource.slice(dcsSource.indexOf("export const DCS_PANELS"));
const panelBlocks = dcsBody.split(/\n  \{\n/).slice(1);
const panels = panelBlocks.map((block) => {
  const get = (key) => block.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1] ?? null;
  const getList = (key) => {
    const raw = block.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1];
    return raw ? [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  };
  return { id: get("id"), title_en: get("title_en"), title_fr: get("title_fr"), section: get("section"), unit: get("unit"), storage_path: get("storage_path"), tags: getList("tags"), related_tags: getList("related_tags") };
}).filter((panel) => panel.id);

const pidSource = read("src/pages/PIDViewer.tsx");
const pidBlock = pidSource.split("const PID_SHEETS: PIDSheet[] = [")[1]?.split("\n];")[0] ?? "";
const pidSheets = [...pidBlock.matchAll(/\{\s*id:\s*"([^"]+)",\s*driveId:\s*"([^"]+)",\s*title:\s*\{\s*en:\s*"([^"]+)",\s*fr:\s*"([^"]+)"\s*\},\s*drawing:\s*"([^"]+)",\s*section:\s*"([^"]+)",\s*equipment:\s*\[([^\]]*)\],\s*tags:\s*"([^"]*)",?\s*\}/g)].map((m) => ({
  id: m[1], title_en: m[3], title_fr: m[4], drawing: m[5], section: m[6],
  equipment: [...m[7].matchAll(/"([^"]+)"/g)].map((x) => x[1]), keywords: m[8],
}));

const flowSource = read("src/pages/SmartFlow.tsx");
const flowBlock = flowSource.split("const TAGS: TagDef[] = [")[1]?.split("\n];")[0] ?? "";
const flowTags = [...flowBlock.matchAll(/\{\s*id:\s*"([^"]+)",\s*diag:\s*"([^"]+)",[\s\S]*?dbTag:\s*(null|"[^"]+"),\s*dcsPanels:\s*\[([^\]]*)\],\s*manuals:\s*\[([^\]]*)\],/g)].map((m) => ({
  id: m[1], diag: m[2], dbTag: m[3] === "null" ? null : m[3].slice(1, -1),
  dcsPanels: [...m[4].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  manuals: [...m[5].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
}));

function suffixKey(tag) {
  const match = String(tag).toUpperCase().match(/([A-Z]{1,3})[-\s._]*(\d{2,4}(?:\.\d{1,3})?)([A-Z]?)$/);
  if (!match) return String(tag).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${match[1]}${match[2].replace(/\./g, "").replace(/^0+/, "")}${match[3]}`;
}
const compact = (value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

const pdfFiles = fs.readdirSync(path.join(root, "public/pids")).filter((file) => file.endsWith(".pdf"));
function pdfTokens(file) {
  const base = file.replace(/\.pdf$/i, "");
  const tokens = new Set();
  for (const match of base.matchAll(/([A-Z])\s*(\d{3,4})(?:\s*-\s*([A-Z]))?/gi)) {
    const letter = match[1].toUpperCase();
    const number = match[2];
    if (match[3]) { tokens.add(`${letter}${number}${match[3].toUpperCase()}`); }
    else tokens.add(`${letter}${number}`);
  }
  // Expand E514A-B style ranges.
  for (const match of base.matchAll(/([A-Z])(\d{3,4})([A-Z])\s*-\s*([A-Z])/gi)) {
    tokens.add(`${match[1].toUpperCase()}${match[2]}${match[3].toUpperCase()}`);
    tokens.add(`${match[1].toUpperCase()}${match[2]}${match[4].toUpperCase()}`);
  }
  return tokens;
}
for (const sheet of pidSheets) {
  const expected = new Set(sheet.equipment.map(compact));
  const exact = pdfFiles.find((file) => {
    const tokens = pdfTokens(file);
    return tokens.size === expected.size && [...expected].every((token) => tokens.has(token));
  });
  sheet.localFile = exact ? `/pids/${exact}` : null;
  sheet.textIndexed = false;
}

const pidFiles = pdfFiles.map((file, index) => {
  const tokens = [...pdfTokens(file)];
  const expected = new Set(tokens.map(compact));
  const sheet = pidSheets.find((candidate) => {
    const set = new Set(candidate.equipment.map(compact));
    return set.size === expected.size && [...set].every((token) => expected.has(token));
  });
  return { id: `pid-file-${index + 1}`, file: `/pids/${file}`, title: file.replace(/\.pdf$/i, ""), equipment: tokens, sheetId: sheet?.id ?? null, textIndexed: false };
});

const conflicts = [];
const equipment = db.equipment.map((item) => {
  const aliases = new Set([item.tag]);
  const manualIds = new Set();
  const dcsPanelIds = new Set();
  const pidSheetIds = new Set();
  const pidFileIds = new Set();
  for (const [dcsTag, registerTag] of Object.entries(dcsMap)) if (registerTag === item.tag) aliases.add(dcsTag);
  for (const flow of flowTags) {
    if (flow.dbTag !== item.tag) continue;
    if (suffixKey(flow.id) !== suffixKey(item.tag) && suffixKey(flow.diag) !== suffixKey(item.tag)) {
      conflicts.push({ flowId: flow.id, diag: flow.diag, declaredDbTag: flow.dbTag, reason: "numeric suffix does not match declared register tag" });
      continue;
    }
    aliases.add(flow.id); aliases.add(flow.diag);
    flow.manuals.forEach((id) => manualIds.add(id));
    flow.dcsPanels.forEach((id) => dcsPanelIds.add(id));
  }
  for (const panel of panels) {
    if ((panel.related_tags ?? []).some((tag) => compact(tag) === compact(item.tag))) dcsPanelIds.add(panel.id);
  }
  for (const [panelId, tags] of Object.entries(detected)) {
    if (tags.some((tag) => dcsMap[tag] === item.tag)) dcsPanelIds.add(panelId);
  }
  for (const sheet of pidSheets) {
    if (sheet.equipment.some((tag) => suffixKey(tag) === suffixKey(item.tag))) {
      pidSheetIds.add(sheet.id);
      sheet.equipment.filter((tag) => suffixKey(tag) === suffixKey(item.tag)).forEach((tag) => aliases.add(tag));
    }
  }
  for (const file of pidFiles) {
    if (file.equipment.some((tag) => suffixKey(tag) === suffixKey(item.tag))) {
      pidFileIds.add(file.id);
      file.equipment.filter((tag) => suffixKey(tag) === suffixKey(item.tag)).forEach((tag) => aliases.add(tag));
    }
  }
  return {
    tag: item.tag, name: item.name, unit: item.unit, section: item.section,
    type: item.type, testing_status: item.testing_status,
    technical: { pressure_bar: item.technical.pressure_bar, weight_kg: item.technical.weight_kg, volume_m3: item.technical.volume_m3, temperature_c: item.technical.temperature_c ?? null, serial_no: item.technical.serial_no },
    maintenance: { last_tested: item.maintenance.last_tested, next_test_due: item.maintenance.next_test_due },
    aliases: [...aliases], manualIds: [...manualIds], dcsPanelIds: [...dcsPanelIds], pidSheetIds: [...pidSheetIds], pidFileIds: [...pidFileIds],
  };
});

const drawingAssets = [];
for (const sheet of pidSheets) {
  for (const tag of sheet.equipment) {
    if (equipment.some((item) => suffixKey(tag) === suffixKey(item.tag))) continue;
    let asset = drawingAssets.find((item) => item.tag === tag);
    if (!asset) { asset = { tag, aliases: [tag], pidSheetIds: [], pidFileIds: [] }; drawingAssets.push(asset); }
    if (!asset.pidSheetIds.includes(sheet.id)) asset.pidSheetIds.push(sheet.id);
  }
}
for (const file of pidFiles) {
  for (const tag of file.equipment) {
    if (equipment.some((item) => suffixKey(tag) === suffixKey(item.tag))) continue;
    let asset = drawingAssets.find((item) => item.tag === tag);
    if (!asset) { asset = { tag, aliases: [tag], pidSheetIds: [], pidFileIds: [] }; drawingAssets.push(asset); }
    if (!asset.pidFileIds.includes(file.id)) asset.pidFileIds.push(file.id);
  }
}
for (const asset of drawingAssets) {
  for (const sheet of pidSheets) if (sheet.equipment.includes(asset.tag) && !asset.pidSheetIds.includes(sheet.id)) asset.pidSheetIds.push(sheet.id);
  asset.dcsPanelIds = asset.dcsPanelIds ?? [];
  asset.manualIds = asset.manualIds ?? [];
  for (const flow of flowTags) {
    if (suffixKey(flow.id) !== suffixKey(asset.tag) && suffixKey(flow.diag) !== suffixKey(asset.tag)) continue;
    asset.aliases.push(flow.id, flow.diag);
    flow.dcsPanels.forEach((id) => asset.dcsPanelIds.push(id));
    flow.manuals.forEach((id) => asset.manualIds.push(id));
  }
  for (const [panelId, tags] of Object.entries(detected)) {
    if (tags.some((tag) => suffixKey(tag) === suffixKey(asset.tag))) asset.dcsPanelIds.push(panelId);
  }
  asset.aliases = [...new Set(asset.aliases)];
  asset.dcsPanelIds = [...new Set(asset.dcsPanelIds)];
  asset.manualIds = [...new Set(asset.manualIds)];
}

const dcsPanels = panels.map((panel) => ({
  id: panel.id, title_en: panel.title_en, title_fr: panel.title_fr, section: panel.section, unit: panel.unit,
  storage_path: panel.storage_path,
  detectedTags: detected[panel.id] ?? panel.tags ?? [],
  equipmentTags: [...new Set((detected[panel.id] ?? panel.tags ?? []).map((tag) => dcsMap[tag]).filter(Boolean))],
}));

const knowledge = {
  version: 1,
  generatedAt: new Date().toISOString(),
  register: { source: "src/data/gnl1z_database.json", recordCount: equipment.length, originalCsvAvailable: false, csvDerivative: "/data/gnl1z_equipment_register.csv" },
  coverage: {
    equipmentRecords: equipment.length,
    pidSheets: pidSheets.length,
    pidLocalFiles: pidFiles.length,
    pidTextIndexed: 0,
    dcsPanels: dcsPanels.length,
    manualTitles: manuals.length,
    manualContentLoaded: false,
    verifiedLineList: false,
    aliasConflicts: conflicts.length,
  },
  equipment, drawingAssets, pidSheets, pidFiles, dcsPanels, manuals, aliasConflicts: conflicts,
};
fs.mkdirSync(path.join(root, "src/data"), { recursive: true });
fs.writeFileSync(path.join(root, "src/data/assistant_knowledge.json"), JSON.stringify(knowledge, null, 2) + "\n");

const columns = ["tag", "name", "type", "unit", "section", "status", "weight_kg", "pressure_bar", "volume_m3", "serial_no", "aliases", "pid_sheets", "dcs_panels", "manuals"];
const escape = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const rows = db.equipment.map((item) => {
  const indexed = equipment.find((entry) => entry.tag === item.tag);
  return [item.tag, item.name, item.type.name, item.unit, item.section, item.testing_status, item.technical.weight_kg, item.technical.pressure_bar, item.technical.volume_m3, item.technical.serial_no, indexed.aliases.join("|"), [...indexed.pidSheetIds, ...indexed.pidFileIds].join("|"), indexed.dcsPanelIds.join("|"), indexed.manualIds.join("|")].map(escape).join(",");
});
fs.mkdirSync(path.join(root, "public/data"), { recursive: true });
fs.writeFileSync(path.join(root, "public/data/gnl1z_equipment_register.csv"), "\uFEFF" + columns.join(",") + "\n" + rows.join("\n") + "\n");
fs.writeFileSync(path.join(root, "public/data/assistant_coverage.json"), JSON.stringify(knowledge.coverage, null, 2) + "\n");
console.log(`Indexed ${equipment.length} equipment records, ${pidSheets.length} P&ID sheets, ${drawingAssets.length} drawing-only tags, ${conflicts.length} alias conflicts.`);
