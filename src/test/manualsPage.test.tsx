import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/contexts/I18nContext";
import Manuals from "@/pages/Manuals";
import { MANUALS } from "@/data/manuals";

const renderManuals = () => render(
  <I18nProvider>
    <Manuals />
  </I18nProvider>,
);

afterEach(() => vi.unstubAllGlobals());

const okJson = (payload: unknown) => ({ ok: true, json: async () => payload });

describe("Manuals page — operational manual section", () => {
  it("lists every manual with Open and scoped Search inside actions", () => {
    renderManuals();
    expect(screen.getAllByRole("button", { name: /^Search inside S/ })).toHaveLength(MANUALS.length);
    expect(screen.getAllByRole("link", { name: /^Open$/ })).toHaveLength(MANUALS.length);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("scopes an in-document search to the selected manual", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => okJson({
      results: [],
      meta: { total: 1, matched: 0, failed: 0, cached: 0, elapsedMs: 5 },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderManuals();

    await user.click(screen.getByRole("button", { name: `Search inside ${MANUALS[0].id}` }));
    expect(screen.getByText(/Searching in/)).toHaveTextContent(MANUALS[0].id);

    await user.type(screen.getByRole("textbox"), "condenser");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/0 of 1 documents matched/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as { body: string };
    const sent = JSON.parse(init.body) as { manuals: Array<{ id: string }> };
    expect(sent.manuals).toHaveLength(1);
    expect(sent.manuals[0].id).toBe(MANUALS[0].id);
  });

  it("highlights every occurrence deterministically, including tag variants", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => okJson({
      results: [{
        id: MANUALS[0].id,
        title: MANUALS[0].title_en,
        driveId: MANUALS[0].drive_id,
        count: 2,
        snippets: ["Weekly E-501 condenser inspection. E-501 restart after trip."],
        terms: ["E-501", "E501", "E 501"],
      }],
      meta: { total: 1, matched: 1, failed: 0, cached: 0, elapsedMs: 12 },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderManuals();

    await user.click(screen.getByRole("button", { name: /search inside documents/i }));
    // Example query chips are offered in the idle state.
    expect(screen.getByRole("button", { name: "E-501" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "e-501");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/1 of 1 documents matched/);

    const marks = document.querySelectorAll("mark");
    // Both occurrences must be highlighted (the old lastIndex bug marked every other match).
    expect(marks).toHaveLength(2);
    expect([...marks].every(m => /e-501/i.test(m.textContent ?? ""))).toBe(true);
    // Diagnostics line rendered from meta.
    expect(screen.getByText(/1 of 1 documents matched · 0\.0s/)).toBeInTheDocument();
  });

  it("remembers recent queries in localStorage and offers them for one-click re-run", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => okJson({
      results: [{
        id: MANUALS[0].id,
        title: MANUALS[0].title_en,
        driveId: MANUALS[0].drive_id,
        count: 1,
        snippets: ["MEA circulation pump E-501 alignment check."],
        terms: ["E-501"],
      }],
      meta: { total: MANUALS.length, matched: 1, failed: 0, cached: 0, elapsedMs: 4000 },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderManuals();

    await user.click(screen.getByRole("button", { name: /search inside documents/i }));
    await user.type(screen.getByRole("textbox"), "gaz");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/1 of 23 documents matched/);

    // Persisted for the next visit…
    expect(JSON.parse(localStorage.getItem("gnl1z-manual-searches") ?? "[]")).toEqual(["gaz"]);

    // …and re-running it hits the endpoint again with the same term.
    await user.click(screen.getByRole("button", { name: "gaz" }));
    await screen.findByText(/1 of 23 documents matched/);
    const second = (fetchMock.mock.calls[1] as unknown[])[1] as { body: string };
    expect(JSON.parse(second.body).query).toBe("gaz");

    await user.click(screen.getByRole("button", { name: /clear recent searches/i }));
    expect(screen.queryByRole("button", { name: "gaz" })).toBeNull();
    expect(localStorage.getItem("gnl1z-manual-searches")).toBe("[]");
  });

  it("copies the excerpts of a hit to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_value: string) => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => okJson({
      results: [{
        id: MANUALS[1].id,
        title: MANUALS[1].title_en,
        driveId: MANUALS[1].drive_id,
        count: 1,
        snippets: ["Dehydration bed switch-over every 8 hours."],
        terms: ["bed"],
      }],
      meta: { total: MANUALS.length, matched: 1, failed: 0, cached: 0, elapsedMs: 800 },
    })));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderManuals();

    await user.click(screen.getByRole("button", { name: /search inside documents/i }));
    await user.type(screen.getByRole("textbox"), "bed");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/1 of 23 documents matched/);

    await user.click(screen.getByRole("button", { name: `Copy excerpts from ${MANUALS[1].id}` }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).toContain(MANUALS[1].id);
    expect(copied).toContain("Dehydration bed switch-over every 8 hours.");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("clears the query on Escape", async () => {
    const user = userEvent.setup();
    renderManuals();
    await user.click(screen.getByRole("button", { name: /search inside documents/i }));
    const input = screen.getByRole("textbox");
    await user.type(input, "propane");
    await user.type(input, "{Escape}");
    expect(input).toHaveValue("");
  });

  it("offers a title-search fallback when full-text finds nothing", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => okJson({
      results: [],
      meta: { total: MANUALS.length, matched: 0, failed: 2, cached: 21, elapsedMs: 900 },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderManuals();

    await user.click(screen.getByRole("button", { name: /search inside documents/i }));
    await user.type(screen.getByRole("textbox"), "shutdown");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/No matches found/);
    expect(screen.getByText(/2 unreachable/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /search titles & categories instead/i }));
    // Back in title mode with the term carried over (filtered to matching titles).
    expect(screen.getByDisplayValue("shutdown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Search inside S/ })).toBeInTheDocument();
  });
});
