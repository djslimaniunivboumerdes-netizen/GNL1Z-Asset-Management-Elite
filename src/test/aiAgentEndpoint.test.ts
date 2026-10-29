// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../../functions/api/ai-agent";

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
    const response = await onRequestPost({ request: request({ prompt: "unique provider failure question", contextData: context }), env: { GEMINI_API_KEY: "test-key" } });
    expect(response.status).toBe(503);
  });
});
