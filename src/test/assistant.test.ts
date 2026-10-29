import { beforeEach, describe, expect, it } from "vitest";
import type { Equipment } from "@/data";
import type { DCSPanel } from "@/data/dcs_panels";
import type { Manual } from "@/data/manuals";
import type { SimulatedAlarm } from "@/lib/alarmStore";
import {
  ASSISTANT_MAX_MESSAGES,
  assistantHistory,
  buildAssistantContext,
  clearAssistantSession,
  followUpPrompts,
  loadAssistantSession,
  saveAssistantSession,
  scoreEquipmentMatch,
  selectRelevantEquipment,
  type AssistantMessage,
} from "@/lib/assistant";

const eq = (tag: string, name: string, unit = "X01"): Equipment => ({
  tag, name, unit, section: "Test", type: { code: "E", name: "Exchanger" }, testing_status: "OK",
  technical: { pressure_bar: 8.6, weight_kg: 600, volume_m3: null, temperature_c: null },
  maintenance: { last_tested: "2026-01-01", next_test_due: "2026-11-15" },
  spare_parts: { secret: "do-not-send" },
} as unknown as Equipment);

const panel = { id: "P01", title_en: "Condenser panel", title_fr: "Panneau condenseur", section: "X01", tags: ["X01-E-501"], related_tags: ["X01-E-501"] } as unknown as DCSPanel;
const manual = { id: "S01", title_en: "Exchanger manual", title_fr: "Manuel échangeur", category: "Exchangers", drive_id: "private-drive-id" } as unknown as Manual;
const alarm = { tag: "X01-E-501", dbTag: "X01-E-501", nameEn: "High pressure", nameFr: "Pression haute", unit: "X01", severity: "HIGH", descriptionEn: "Simulated", descriptionFr: "Simulée" } as unknown as SimulatedAlarm;

beforeEach(() => sessionStorage.clear());

describe("assistant context selection", () => {
  it("scores tags, names, units, and current equipment", () => {
    const item = eq("X01-E-501", "Main condenser");
    expect(scoreEquipmentMatch("Review X01-E-501", item)).toBeGreaterThanOrEqual(100);
    expect(scoreEquipmentMatch("main condenser", item)).toBeGreaterThan(0);
    expect(scoreEquipmentMatch("X01", item)).toBeGreaterThan(0);
    expect(scoreEquipmentMatch("anything", item, "X01-E-501")).toBeGreaterThan(0);
    expect(scoreEquipmentMatch("unrelated", eq("X02-P-100", "Pump", "X02"))).toBe(0);
  });

  it("keeps current equipment and bounds the result", () => {
    const list = [eq("X01-E-501", "Condenser"), eq("X01-E-502", "Condenser"), eq("X02-P-100", "Pump", "X02")];
    const selected = selectRelevantEquipment("condenser", list, "X02-P-100", 2);
    expect(selected).toHaveLength(2);
    expect(selected.some((item) => item.tag === "X02-P-100")).toBe(true);
  });

  it("prefers an explicit tag over neighboring unit matches", () => {
    const list = [eq("X01-E-501", "Condenser"), eq("X01-E-502", "Reboiler"), eq("X01-E-503", "Exchanger")];
    const selected = selectRelevantEquipment("Review X01-E-501 schedule", list, null, 5);
    expect(selected.map((item) => item.tag)).toEqual(["X01-E-501"]);
  });

  it("builds a minimized context without drive IDs or spare parts", () => {
    const context = buildAssistantContext({ prompt: "Review X01-E-501 and S01", lang: "en", equipment: [eq("X01-E-501", "Condenser")], panels: [panel], manuals: [manual], alarms: [alarm], currentTag: "X01-E-501" });
    const json = JSON.stringify(context);
    expect(context.currentEquipmentTag).toBe("X01-E-501");
    expect(context.masterEquipmentCatalog[0].technical.pressure_bar).toBe(8.6);
    expect(context.simulatedSafetyAlarms[0].simulated).toBe(true);
    expect(json).not.toContain("private-drive-id");
    expect(json).not.toContain("do-not-send");
  });
});

describe("assistant history and session storage", () => {
  const message = (overrides: Partial<AssistantMessage> = {}): AssistantMessage => ({ id: "1", role: "user", text: "hello", createdAt: "2026-10-29T10:00:00.000Z", status: "complete", ...overrides });

  it("sends only complete messages and bounds history", () => {
    const messages = [message({ id: "1" }), message({ id: "2", role: "assistant", text: "answer" }), message({ id: "3", status: "loading" }), message({ id: "4", status: "error", text: "failed" }), message({ id: "5", text: "x".repeat(2000) })];
    const history = assistantHistory(messages, 2);
    expect(history).toHaveLength(2);
    expect(history.every((item) => item.text.length <= 1200)).toBe(true);
    expect(history.some((item) => item.text === "failed")).toBe(false);
  });

  it("round-trips a session and expires old sessions", () => {
    const now = Date.now();
    saveAssistantSession([message(), message({ id: "2", role: "assistant", text: "answer", mode: "reference", sources: [{ kind: "equipment", id: "X01-E-501", title: "Condenser", href: "/equipment/X01-E-501" }] })], now);
    const loaded = loadAssistantSession(now);
    expect(loaded).toHaveLength(2);
    expect(loaded[1].sources?.[0].href).toBe("/equipment/X01-E-501");
    expect(loadAssistantSession(now + 9 * 60 * 60 * 1000)).toHaveLength(0);
  });

  it("drops loading messages, invalid payloads, and external links", () => {
    saveAssistantSession([message({ status: "loading" }), message({ id: "2" })]);
    expect(loadAssistantSession()).toHaveLength(1);
    sessionStorage.setItem("gnl1z.expert-ai-gnl1.v1", JSON.stringify({ version: 1, expiresAt: Date.now() + 1000, messages: [{ id: "x", role: "assistant", text: "hi", status: "complete", sources: [{ kind: "equipment", id: "x", title: "x", href: "https://evil.example" }] }] }));
    expect(loadAssistantSession()[0].sources?.[0].href).toBeUndefined();
    sessionStorage.setItem("gnl1z.expert-ai-gnl1.v1", "not-json");
    expect(loadAssistantSession()).toHaveLength(0);
  });

  it("caps stored messages and clears the session", () => {
    saveAssistantSession(Array.from({ length: ASSISTANT_MAX_MESSAGES + 10 }, (_, index) => message({ id: String(index) })));
    expect(loadAssistantSession()).toHaveLength(ASSISTANT_MAX_MESSAGES);
    clearAssistantSession();
    expect(loadAssistantSession()).toHaveLength(0);
  });

  it("suggests tag-aware follow-ups", () => {
    const withTag = followUpPrompts(message({ role: "assistant", sources: [{ kind: "equipment", id: "X01-E-501", title: "Condenser" }] }), "en");
    expect(withTag[0]).toContain("X01-E-501");
    expect(followUpPrompts(message({ role: "assistant" }), "fr")[0]).toContain("alarmes simulées");
  });
});
