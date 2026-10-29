// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestOptions, onRequestPost } from "../../functions/api/ai-agent";

const url = "https://app.example.test/api/ai-agent";
function request(body: unknown, origin = "https://app.example.test") {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
}
const context = {
  facility: "Test plant",
  masterEquipmentCatalog: [{ tag: "X01-E-501", name: "Condenser", unit: "X01", technical: { pressure_bar: 8.6, weight_kg: 600 }, maintenance: { next_test_due: "2026-11-15" }, spare_parts: { secret: "do-not-send" } }],
  operationalManualsList: [{ id: "S01", title: "Manual", driveId: "private-drive-id" }],
  secret: "do-not-send",
};

afterEach(() => vi.unstubAllGlobals());

describe("bounded assistant endpoint", () => {
  it("rejects cross-origin requests", async () => {
    const response = await onRequestPost({ request: request({ prompt: "hello" }, "https://evil.example.test"), env: {} });
    expect(response.status).toBe(403);
  });
  it("rejects oversized prompts", async () => {
    const response = await onRequestPost({ request: request({ prompt: "x".repeat(2001) }), env: {} });
    expect(response.status).toBe(400);
  });
  it("returns a static reference without a provider key and without claiming telemetry", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await onRequestPost({ request: request({ prompt: "Review X01-E-501", contextData: context }), env: {} });
    const data = await response.json();
    expect(response.status).toBe(200); expect(fetchMock).not.toHaveBeenCalled();
    expect(data.mode).toBe("reference"); expect(data.response).toContain("X01-E-501");
    expect(data.response).toContain("not real-time telemetry");
    expect(JSON.stringify(data)).not.toContain("do-not-send");
  });
  it("minimizes provider context, keeps the key out of the URL, and caches by context", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Reference answer" }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const env = { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" };
    const body = { prompt: "Review X01-E-501", contextData: context };
    const first = await onRequestPost({ request: request(body), env });
    expect(first.status).toBe(200); expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).not.toContain("test-key");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("test-key");
    expect(String(init.body)).not.toContain("private-drive-id");
    expect(String(init.body)).not.toContain("do-not-send");
    const second = await onRequestPost({ request: request(body), env });
    expect((await second.json()).cached).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns unavailable instead of inventing an answer when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const response = await onRequestPost({ request: request({ prompt: "Review X01-E-501 provider failure", contextData: context }), env: { GEMINI_API_KEY: "test-key" } });
    expect(response.status).toBe(503);
  });
  it("returns source cards for equipment, manuals, DCS panels, and simulated alarms", async () => {
    const richContext = {
      ...context,
      dcsPanelsList: [{ id: "P01", title: "Condenser panel", section: "X01", tags: ["X01-E-501"] }],
      simulatedSafetyAlarms: [{ tag: "X01-E-501", name: "High pressure", unit: "X01", severity: "HIGH", description: "Simulated", simulated: true }],
    };
    const response = await onRequestPost({ request: request({ prompt: "Review X01-E-501 alarms, S01 manual and P01 DCS panel", contextData: richContext }), env: {} });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.sources.some((source: { kind: string }) => source.kind === "equipment")).toBe(true);
    expect(data.sources.some((source: { kind: string }) => source.kind === "manual")).toBe(true);
    expect(data.sources.some((source: { kind: string }) => source.kind === "dcs")).toBe(true);
    expect(data.sources.some((source: { kind: string }) => source.kind === "simulation")).toBe(true);
    expect(data.response).toContain("Simulated alarms");
  });
  it("does not include neighboring equipment when the prompt names one tag", async () => {
    const neighbors = {
      masterEquipmentCatalog: [
        { tag: "X01-E-501", name: "Condenser", unit: "X01", technical: {}, maintenance: {} },
        { tag: "X01-E-502", name: "Reboiler", unit: "X01", technical: {}, maintenance: {} },
      ],
    };
    const response = await onRequestPost({ request: request({ prompt: "Review X01-E-501", contextData: neighbors }), env: {} });
    const data = await response.json();
    expect(data.sources.filter((source: { kind: string }) => source.kind === "equipment")).toHaveLength(1);
    expect(data.response).toContain("X01-E-501");
    expect(data.response).not.toContain("X01-E-502");
  });
  it("answers in French and flags missing register fields", async () => {
    const response = await onRequestPost({ request: request({ prompt: "Consulter X01-E-501", lang: "fr", contextData: context }), env: {} });
    const data = await response.json();
    expect(data.response).toContain("Données manquantes");
    expect(data.response).toContain("télémétrie temps réel");
  });
  it("uses currentEquipmentTag when the prompt has no explicit tag", async () => {
    const response = await onRequestPost({ request: request({ prompt: "What is the schedule?", contextData: { ...context, currentEquipmentTag: "X01-E-501" } }), env: {} });
    const data = await response.json();
    expect(data.response).toContain("X01-E-501");
    expect(data.sources[0].id).toBe("X01-E-501");
  });
  it("bounds provider history to six messages and keeps the key out of history", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const history = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: `message ${index}` }));
    const response = await onRequestPost({ request: request({ prompt: "Review X01-E-501 history", contextData: context, history }), env: { GEMINI_API_KEY: "test-key" } });
    expect(response.status).toBe(200);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const payload = JSON.parse(String(init.body));
    expect(payload.contents).toHaveLength(7);
    expect(payload.contents[0].role).toBe("user");
    expect(payload.contents[0].parts[0].text).toBe("message 4");
    expect(String(init.body)).not.toContain("private-drive-id");
  });
  it("rate limits per IP and returns Retry-After", async () => {
    const make = () => new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://app.example.test", "cf-connecting-ip": "203.0.113.9" }, body: JSON.stringify({ prompt: "hello" }) });
    const env = { ASSISTANT_RATE_LIMIT_PER_MIN: "1" };
    expect((await onRequestPost({ request: make(), env })).status).toBe(200);
    const limited = await onRequestPost({ request: make(), env });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("handles same-origin and cross-origin preflight", async () => {
    const ok = await onRequestOptions({ request: new Request(url, { method: "OPTIONS", headers: { Origin: "https://app.example.test" } }) });
    expect(ok.status).toBe(204);
    const denied = await onRequestOptions({ request: new Request(url, { method: "OPTIONS", headers: { Origin: "https://evil.example.test" } }) });
    expect(denied.status).toBe(403);
  });
  it("rejects oversized bodies and empty prompts", async () => {
    const big = new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://app.example.test" }, body: JSON.stringify({ prompt: "x".repeat(600 * 1024) }) });
    expect((await onRequestPost({ request: big, env: {} })).status).toBe(413);
    expect((await onRequestPost({ request: request({ prompt: "   " }), env: {} })).status).toBe(400);
  });
  it("returns 503 when the provider returns an empty answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "  " }] } }] }), { status: 200 })));
    const response = await onRequestPost({ request: request({ prompt: "Review X01-E-501 empty answer", contextData: context }), env: { GEMINI_API_KEY: "test-key" } });
    expect(response.status).toBe(503);
  });
  it("returns a coverage gap, not an invented count, for E520 pipeline questions", async () => {
    const response = await onRequestPost({ request: request({ prompt: "How many pipelines associated with E-520?" }), env: {} });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.mode).toBe("reference");
    expect(data.verifiedLineList).toBe(false);
    expect(data.response).toContain("Piping answer not yet verified");
    expect(data.sources.some((source: { kind: string }) => source.kind === "pid")).toBe(true);
  });
  it("answers line-size questions from supplied CSV rows even when a provider key exists", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await onRequestPost({ request: request({
      prompt: "What piping sizes are connected to E-501?",
      lineList: { fileName: "lines.csv", rows: [
        { row: 2, lineNumber: "L-1", from: "E501", to: "G502", size: "DN 80" },
        { row: 3, lineNumber: "L-2", from: "P501", to: "X01-E-501", size: "3 inch" },
      ] },
    }), env: { GEMINI_API_KEY: "test-key" } });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.verifiedLineList).toBe(true);
    expect(data.response).toContain("DN 80");
    expect(data.response).toContain('3"');
  });
});
