import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { AiAgentChat } from "@/components/AiAgentChat";

vi.mock("@/data", () => ({ EQUIPMENT: [{ tag: "X01-E-501", name: "Main condenser", unit: "X01", section: "Test", type: { code: "E", name: "Exchanger" }, testing_status: "OK", technical: { pressure_bar: 8.6, weight_kg: 600, volume_m3: null, temperature_c: null }, maintenance: { last_tested: "2026-01-01", next_test_due: "2026-11-15" } }] }));
vi.mock("@/data/dcs_panels", () => ({ DCS_PANELS: [] }));
vi.mock("@/data/manuals", () => ({ MANUALS: [] }));
vi.mock("@/lib/alarmStore", () => ({ getActiveAlarms: () => [] }));

function renderChat() {
  return render(<I18nProvider><MemoryRouter><AiAgentChat /></MemoryRouter></I18nProvider>);
}
const referenceResponse = {
  response: "### Register reference\n\n**X01-E-501** — recorded pressure 8.6 bar. This is not real-time telemetry.",
  mode: "reference",
  cached: false,
  sources: [{ kind: "equipment", id: "X01-E-501", title: "X01-E-501 — Main condenser", href: "/equipment/X01-E-501" }],
};

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Expert AI GNL1 chat", () => {
  it("opens, sends a question, and renders an answer with a source link", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(referenceResponse), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Open Expert AI GNL1" }));
    const input = await screen.findByLabelText(/Ask about an equipment tag/);
    fireEvent.change(input, { target: { value: "Review X01-E-501" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText(/recorded pressure 8.6 bar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /X01-E-501 — Main condenser/ })).toHaveAttribute("href", "/equipment/X01-E-501");
    expect(screen.getByText("Static reference")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.prompt).toBe("Review X01-E-501");
    expect(body.contextData.currentEquipmentTag).toBe("X01-E-501");
  });

  it("retries a failed request without duplicating the user message", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(JSON.stringify(referenceResponse), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Open Expert AI GNL1" }));
    fireEvent.change(await screen.findByLabelText(/Ask about an equipment tag/), { target: { value: "Review X01-E-501" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/recorded pressure 8.6 bar/)).toBeInTheDocument();
    expect(screen.getAllByText("Review X01-E-501")).toHaveLength(1);
  });

  it("stops an in-flight request and allows retry", async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Open Expert AI GNL1" }));
    fireEvent.change(await screen.findByLabelText(/Ask about an equipment tag/), { target: { value: "Review X01-E-501" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop response" }));
    expect(await screen.findByText(/Request stopped/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("clears the session after confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(referenceResponse), { status: 200, headers: { "Content-Type": "application/json" } })));
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Open Expert AI GNL1" }));
    fireEvent.change(await screen.findByLabelText(/Ask about an equipment tag/), { target: { value: "Review X01-E-501" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText(/recorded pressure 8.6 bar/);
    fireEvent.click(screen.getByRole("button", { name: "Clear chat session" }));
    fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
    await waitFor(() => expect(screen.queryByText(/recorded pressure 8.6 bar/)).not.toBeInTheDocument());
    expect(sessionStorage.getItem("gnl1z.expert-ai-gnl1.v1")).toBeNull();
  });

  it("attaches a line-list CSV and sends only matching rows", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ...referenceResponse, verifiedLineList: true, intent: "line_count" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Open Expert AI GNL1" }));
    const fileInput = screen.getByLabelText(/Attach piping line list CSV/i) as HTMLInputElement;
    const csvText = "line,from,to,size\nL-1,E501,G502,DN50\nL-2,X01-E-501,P501,2 in\nL-3,F501,G501,DN25\n";
    const file = new File([csvText], "lines.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => csvText });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/lines\.csv/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Ask about an equipment tag/), { target: { value: "How many pipelines for E-501?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.lineList.fileName).toBe("lines.csv");
    expect(body.lineList.rows).toHaveLength(2);
    expect(body.lineList.rows.every((row: { from: string; to: string }) => /501/.test(row.from) || /501/.test(row.to))).toBe(true);
  });

  it("accepts an equipment-aware deep link event", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(referenceResponse), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent(window, new CustomEvent("gnl1z:ask-ai", { detail: { prompt: "Review schedule", equipmentTag: "X01-E-501" } }));
    expect(await screen.findByText(/recorded pressure 8.6 bar/)).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contextData.currentEquipmentTag).toBe("X01-E-501");
  });
});
