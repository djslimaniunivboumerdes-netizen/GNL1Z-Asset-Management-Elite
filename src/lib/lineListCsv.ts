// Client-side parsing for user-supplied piping line lists. The assistant only
// sends rows that match the resolved equipment tag; raw files are not uploaded.

export interface LineListRow {
  row: number;
  lineNumber: string;
  from: string;
  to: string;
  size: string;
  service: string;
  spec: string;
  insulation: string;
}

export interface LineListDataset {
  fileName: string;
  rowCount: number;
  rows: LineListRow[];
  warnings: string[];
  delimiter: string;
}

export interface LineListQueryResult {
  tag: string;
  matchedRows: LineListRow[];
  distinctLineCount: number;
  sizes: string[];
  warnings: string[];
}

const HEADER_ALIASES: Record<keyof Omit<LineListRow, "row">, string[]> = {
  lineNumber: ["line", "linenumber", "lineno", "line_no", "linenum", "pipeline", "pipelines", "pipeno", "pipe_no", "ligne", "noligne", "no_ligne", "numeroligne", "numero_ligne", "isometric", "iso", "isono", "iso_no", "drawingline"],
  from: ["from", "fromequipment", "from_equipment", "fromtag", "from_tag", "source", "origin", "start", "de", "depart", "départ", "origine", "amont"],
  to: ["to", "toequipment", "to_equipment", "totag", "to_tag", "destination", "dest", "end", "vers", "arrivee", "arrivée", "aval"],
  size: ["size", "pipesize", "pipe_size", "nominalsize", "nominal_size", "dn", "nps", "diameter", "diametre", "diamètre", "diam", "taille", "dimension"],
  service: ["service", "fluid", "process", "medium", "fluide", "servicefluid"],
  spec: ["spec", "pipingclass", "piping_class", "class", "specification", "classe", "classe_tuyauterie"],
  insulation: ["insulation", "insul", "insulationtype", "insulation_type", "calorifuge", "calorifugeage", "calorifugeage_type"],
};

function normalizeHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const delimiter of candidates) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) { best = delimiter; bestCount = count; }
  }
  return best;
}

export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseLineListCsv(text: string, fileName: string, maxRows = 1000): LineListDataset {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rawRows = parseCsvRows(clean, delimiter);
  if (rawRows.length < 2) throw new Error("CSV must contain a header row and at least one data row.");
  const headers = rawRows[0].map(normalizeHeader);
  const column = (key: keyof Omit<LineListRow, "row">) => headers.findIndex((header) => HEADER_ALIASES[key].includes(header));
  const indexes = {
    lineNumber: column("lineNumber"), from: column("from"), to: column("to"), size: column("size"),
    service: column("service"), spec: column("spec"), insulation: column("insulation"),
  };
  const warnings: string[] = [];
  if (indexes.lineNumber < 0) warnings.push("No line-number column was recognized; rows cannot be deduplicated by line number.");
  if (indexes.from < 0 && indexes.to < 0) warnings.push("No from/to equipment columns were recognized; connection queries will not match.");
  if (indexes.size < 0) warnings.push("No pipe-size column was recognized.");
  const equipmentColumn = headers.findIndex((header) => ["equipment", "equipmenttag", "tag", "connectedto", "connected_to", "equipement", "repere", "repère"].includes(header));
  const rows = rawRows.slice(1, maxRows + 1).map((cells, index) => {
    const get = (position: number) => position >= 0 ? (cells[position] ?? "").trim() : "";
    const from = get(indexes.from);
    const to = get(indexes.to);
    const equipment = get(equipmentColumn);
    return {
      row: index + 2,
      lineNumber: get(indexes.lineNumber),
      from: from || equipment,
      to: to || (from ? equipment : ""),
      size: get(indexes.size),
      service: get(indexes.service),
      spec: get(indexes.spec),
      insulation: get(indexes.insulation),
    };
  });
  if (rawRows.length - 1 > maxRows) warnings.push(`Only the first ${maxRows} data rows were loaded.`);
  return { fileName, rowCount: rows.length, rows, warnings, delimiter };
}

export function normalizePipeSize(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const dn = text.match(/\bDN\s*(\d+)/i);
  if (dn) return `DN ${dn[1]}`;
  const nps = text.match(/\bNPS\s*(\d+(?:[./]\d+)?)/i);
  if (nps) return `NPS ${nps[1]}`;
  const inch = text.match(/(\d+(?:[./]\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|pouces?)/i);
  if (inch) return `${inch[1]}"`;
  return text;
}

function splitTags(value: string): string[] {
  return value.split(/[;,|]/).map((part) => part.trim()).filter(Boolean);
}

export function queryLineList(
  dataset: LineListDataset,
  tag: string,
  resolvesToTag: (candidate: string) => boolean,
): LineListQueryResult {
  const matchedRows = dataset.rows.filter((row) => [...splitTags(row.from), ...splitTags(row.to)].some((candidate) => resolvesToTag(candidate)));
  const lineNumbers = new Set<string>();
  const sizes = new Set<string>();
  let missingLineNumber = 0;
  for (const row of matchedRows) {
    if (row.lineNumber) lineNumbers.add(row.lineNumber.toUpperCase());
    else missingLineNumber++;
    const size = normalizePipeSize(row.size);
    if (size) sizes.add(size);
  }
  const warnings = [...dataset.warnings];
  if (missingLineNumber) warnings.push(`${missingLineNumber} matched row(s) have no line number and are counted as separate rows.`);
  return {
    tag,
    matchedRows,
    distinctLineCount: lineNumbers.size + missingLineNumber,
    sizes: [...sizes].sort(),
    warnings,
  };
}

export function lineListEvidence(result: LineListQueryResult, dataset: LineListDataset, maxRows = 50) {
  return {
    fileName: dataset.fileName,
    tag: result.tag,
    distinctLineCount: result.distinctLineCount,
    sizes: result.sizes,
    warnings: result.warnings,
    rows: result.matchedRows.slice(0, maxRows).map((row) => ({ ...row })),
    truncated: result.matchedRows.length > maxRows,
  };
}
