import type { Equipment } from "@/data";
import type { DCSPanel } from "@/data/dcs_panels";
import type { Manual } from "@/data/manuals";
import type { SimulatedAlarm } from "@/lib/alarmStore";

export const ASSISTANT_NAME = "Expert AI GNL1";
export const ASSISTANT_MAX_PROMPT = 2000;
export const ASSISTANT_MAX_MESSAGES = 40;
const SESSION_KEY = "gnl1z.expert-ai-gnl1.v1";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type AssistantMode = "reference" | "ai" | "cache";
export type AssistantMessageStatus = "complete" | "loading" | "error" | "cancelled";

export interface AssistantSource {
  kind: "equipment" | "dcs" | "manual" | "simulation";
  id: string;
  title: string;
  href?: string;
  detail?: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  status: AssistantMessageStatus;
  prompt?: string;
  mode?: AssistantMode;
  sources?: AssistantSource[];
  cached?: boolean;
  latencyMs?: number;
}

export interface AssistantContext {
  facility: string;
  process: string;
  contextKind: "static-master-data-and-simulated-alarms";
  currentEquipmentTag: string | null;
  masterEquipmentCatalog: Array<Pick<Equipment, "tag" | "name" | "unit" | "section" | "type" | "testing_status"> & {
    technical: Pick<Equipment["technical"], "pressure_bar" | "weight_kg" | "volume_m3" | "temperature_c">;
    maintenance: Pick<Equipment["maintenance"], "last_tested" | "next_test_due">;
  }>;
  dcsPanelsList: Array<Pick<DCSPanel, "id" | "section" | "tags"> & { title: string }>;
  operationalManualsList: Array<Pick<Manual, "id" | "category"> & { title: string }>;
  simulatedSafetyAlarms: Array<{ tag: string; name: string; unit: string; severity: string; description: string; simulated: true }>;
}

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export function scoreEquipmentMatch(prompt: string, eq: Pick<Equipment, "tag" | "name" | "unit" | "type">, currentTag?: string | null): number {
  const q = normalize(prompt);
  if (!q) return 0;
  let score = 0;
  const tag = normalize(eq.tag);
  if (tag && q.includes(tag)) score += 100;
  if (currentTag && normalize(currentTag) === tag) score += 40;
  const name = normalize(eq.name);
  if (name.length > 3 && q.includes(name)) score += 60;
  const words = eq.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).filter((word) => word.length >= 4);
  for (const word of words) if (q.includes(word)) score += 8;
  if (normalize(eq.unit) && q.includes(normalize(eq.unit))) score += 12;
  const type = normalize(eq.type.name);
  if (type.length > 3 && q.includes(type)) score += 6;
  return score;
}

export function selectRelevantEquipment(prompt: string, equipment: Equipment[], currentTag?: string | null, limit = 5): Equipment[] {
  const current = currentTag ? equipment.find((eq) => normalize(eq.tag) === normalize(currentTag)) : undefined;
  const ranked = equipment
    .map((eq) => ({ eq, score: scoreEquipmentMatch(prompt, eq, currentTag) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.eq.tag.localeCompare(b.eq.tag));
  // An explicit tag in the question wins over generic unit/name matches so the
  // assistant does not answer for neighboring equipment in the same train.
  const explicit = ranked.filter((item) => item.score >= 100);
  const selected = (explicit.length ? explicit : ranked).slice(0, limit).map((item) => item.eq);
  if (!explicit.length && current && !selected.some((eq) => eq.tag === current.tag)) selected.unshift(current);
  return selected.slice(0, limit);
}

export function buildAssistantContext(options: {
  prompt: string;
  lang: "en" | "fr";
  equipment: Equipment[];
  panels: DCSPanel[];
  manuals: Manual[];
  alarms: SimulatedAlarm[];
  currentTag?: string | null;
}): AssistantContext {
  const { prompt, lang, equipment, panels, manuals, alarms, currentTag } = options;
  const relevant = selectRelevantEquipment(prompt, equipment, currentTag);
  const compact = (eq: Equipment) => ({
    tag: eq.tag, name: eq.name, unit: eq.unit, section: eq.section, type: eq.type, testing_status: eq.testing_status,
    technical: { pressure_bar: eq.technical.pressure_bar, weight_kg: eq.technical.weight_kg, volume_m3: eq.technical.volume_m3, temperature_c: eq.technical.temperature_c },
    maintenance: { last_tested: eq.maintenance.last_tested, next_test_due: eq.maintenance.next_test_due },
  });
  const q = normalize(prompt);
  const relevantPanels = panels.filter((panel) => {
    const title = normalize(lang === "fr" ? panel.title_fr : panel.title_en);
    return (title.length > 3 && q.includes(title)) || panel.tags.some((tag) => q.includes(normalize(tag))) || (currentTag && panel.related_tags?.some((tag) => normalize(tag) === normalize(currentTag)));
  }).slice(0, 5);
  const relevantManuals = manuals.filter((manual) => {
    const title = normalize(lang === "fr" ? manual.title_fr : manual.title_en);
    return q.includes(normalize(manual.id)) || (title.length > 3 && q.includes(title)) || q.includes(normalize(manual.category));
  }).slice(0, 5);
  return {
    facility: "Sonatrach GL1/Z Arzew LNG Complex",
    process: "AP-C3MR Liquefaction",
    contextKind: "static-master-data-and-simulated-alarms",
    currentEquipmentTag: currentTag ?? null,
    masterEquipmentCatalog: (relevant.length ? relevant : equipment).map(compact),
    dcsPanelsList: (relevantPanels.length ? relevantPanels : panels.slice(0, 20)).map((panel) => ({ id: panel.id, title: lang === "fr" ? panel.title_fr : panel.title_en, section: panel.section, tags: panel.tags })),
    operationalManualsList: (relevantManuals.length ? relevantManuals : manuals).map((manual) => ({ id: manual.id, title: lang === "fr" ? manual.title_fr : manual.title_en, category: manual.category })),
    simulatedSafetyAlarms: alarms.map((alarm) => ({
      tag: alarm.dbTag || alarm.tag,
      name: lang === "fr" ? alarm.nameFr : alarm.nameEn,
      unit: alarm.unit,
      severity: alarm.severity,
      description: lang === "fr" ? alarm.descriptionFr : alarm.descriptionEn,
      simulated: true,
    })),
  };
}

export function assistantHistory(messages: AssistantMessage[], limit = 6): Array<{ role: "user" | "assistant"; text: string }> {
  return messages
    .filter((message) => message.status === "complete" && message.text.trim())
    .slice(-limit)
    .map((message) => ({ role: message.role, text: message.text.slice(0, 1200) }));
}

export function loadAssistantSession(now = Date.now()): AssistantMessage[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: number; expiresAt?: number; messages?: unknown };
    if (parsed.version !== 1 || typeof parsed.expiresAt !== "number" || parsed.expiresAt < now || !Array.isArray(parsed.messages)) {
      sessionStorage.removeItem(SESSION_KEY);
      return [];
    }
    return parsed.messages.slice(-ASSISTANT_MAX_MESSAGES).flatMap((item): AssistantMessage[] => {
      if (!item || typeof item !== "object") return [];
      const message = item as Record<string, unknown>;
      if ((message.role !== "user" && message.role !== "assistant") || typeof message.text !== "string" || typeof message.id !== "string") return [];
      const status = message.status === "error" || message.status === "cancelled" ? message.status : "complete";
      return [{
        id: message.id.slice(0, 80),
        role: message.role,
        text: message.text.slice(0, 8000),
        createdAt: typeof message.createdAt === "string" ? message.createdAt : new Date(now).toISOString(),
        status,
        prompt: typeof message.prompt === "string" ? message.prompt.slice(0, ASSISTANT_MAX_PROMPT) : undefined,
        mode: message.mode === "ai" || message.mode === "cache" || message.mode === "reference" ? message.mode : undefined,
        cached: message.cached === true,
        sources: Array.isArray(message.sources) ? message.sources.slice(0, 6).flatMap((source): AssistantSource[] => {
          if (!source || typeof source !== "object") return [];
          const value = source as Record<string, unknown>;
          if (typeof value.id !== "string" || typeof value.title !== "string") return [];
          const kind = value.kind === "dcs" || value.kind === "manual" || value.kind === "simulation" ? value.kind : "equipment";
          const href = typeof value.href === "string" && value.href.startsWith("/") && !value.href.startsWith("//") ? value.href.slice(0, 300) : undefined;
          return [{ kind, id: String(value.id).slice(0, 80), title: value.title.slice(0, 160), href, detail: typeof value.detail === "string" ? value.detail.slice(0, 160) : undefined }];
        }) : undefined,
      }];
    });
  } catch {
    return [];
  }
}

export function saveAssistantSession(messages: AssistantMessage[], now = Date.now()): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const persistable = messages.filter((message) => message.status !== "loading").slice(-ASSISTANT_MAX_MESSAGES);
    if (!persistable.length) { sessionStorage.removeItem(SESSION_KEY); return; }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, expiresAt: now + SESSION_TTL_MS, messages: persistable }));
  } catch {
    // Chat remains usable when browser storage is unavailable or full.
  }
}

export function clearAssistantSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function followUpPrompts(message: AssistantMessage, lang: "en" | "fr"): string[] {
  const tag = message.sources?.find((source) => source.kind === "equipment")?.id;
  if (lang === "fr") {
    return tag
      ? [`Quelle est l'échéance de ${tag} ?`, `Quelles données manquent pour ${tag} ?`, `Quels manuels se rapportent à ${tag} ?`]
      : ["Afficher les alarmes simulées", "Quels manuels sont disponibles ?", "Comment citer un repère équipement ?"];
  }
  return tag
    ? [`What is the schedule for ${tag}?`, `What data is missing for ${tag}?`, `Which manuals relate to ${tag}?`]
    : ["Show simulated alarms", "Which manuals are available?", "How do I reference an equipment tag?"];
}
