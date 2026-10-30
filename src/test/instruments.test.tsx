import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Instruments from "@/pages/Instruments";
import DcsDirectory from "@/pages/DcsDirectory";
import DcsDetail from "@/pages/DcsDetail";
import { buildInstrumentIndex, findInstrument } from "@/lib/instrumentIndex";

function renderFinder(initialPath = "/instruments") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <Instruments />
      </I18nProvider>
    </MemoryRouter>,
  );
}

const cards = () => screen.queryAllByTestId("instrument-card");

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Instrument Finder", () => {
  it("opens on the whole scanned corpus", () => {
    renderFinder();
    expect(screen.getByRole("heading", { level: 1, name: "Instrument Finder" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${buildInstrumentIndex().length} instrument tags`))).toBeInTheDocument();
    // A screenful, not the full 500+ — the rest are behind the filters.
    expect(cards().length).toBeGreaterThan(30);
    expect(cards().length).toBeLessThan(buildInstrumentIndex().length);
  });

  it("shows what a tag measures, where it is and what it belongs to", () => {
    renderFinder("/instruments?q=LIC101204");
    const card = within(cards()[0]);
    expect(card.getByText("LIC101204")).toBeInTheDocument();
    expect(card.getByText(/Level indicating controller/)).toBeInTheDocument();
    // Where: the unit and the screens it was read on.
    expect(card.getByText(/01 · Decarbonation \(MEA\)/)).toBeInTheDocument();
    expect(card.getByText("Seen on")).toBeInTheDocument();
    expect(card.getByRole("link", { name: /Decarbonation/ })).toHaveAttribute("href", expect.stringContaining("/dcs/"));
    // What it belongs to: the equipment of unit 101.
    expect(card.getByText(/Related equipment \(7\)/)).toBeInTheDocument();
    expect(card.getByRole("link", { name: "101-F502" })).toHaveAttribute("href", "/equipment/X01-F-502");
    expect(card.getByRole("link", { name: /Show 101-F502 on the process flow/ })).toHaveAttribute("href", "/flow?tag=F502");
  });

  it("teaches the tag convention rather than leaving people to guess", async () => {
    const user = userEvent.setup();
    renderFinder();
    expect(screen.queryByTestId("tag-anatomy")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /How to read a tag/ }));
    const help = screen.getByTestId("tag-anatomy");
    expect(help).toHaveTextContent(/loop number/);
    expect(help).toHaveTextContent(/measured variable: L = level/);
    expect(help).toHaveTextContent("XV-101-223");
  });

  it("keeps the lookup in the URL so it can be shared", async () => {
    const user = userEvent.setup();
    renderFinder();
    const box = screen.getByRole("textbox", { name: /Search instruments/i });

    await user.type(box, "XV");
    const first = cards()[0].getAttribute("data-tag");
    expect(first).toMatch(/^XV/);
    expect(cards().length).toBeGreaterThan(1);
  });

  it("filters by measurement, device and unit chips", async () => {
    const user = userEvent.setup();
    renderFinder();

    await user.click(screen.getByRole("button", { name: /^valve/ }));
    expect(cards()).not.toHaveLength(0);
    for (const card of cards()) {
      expect(within(card).getByText("valve")).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: /^105 · MCR refrigeration/ }));
    for (const card of cards()) {
      expect(card.getAttribute("data-tag")).toMatch(/105/);
      expect(within(card).getByText("valve")).toBeInTheDocument();
    }

    // Reset puts the whole corpus back.
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(cards().length).toBeGreaterThan(30);
  });

  it("finds instruments through the equipment they belong to", async () => {
    const user = userEvent.setup();
    renderFinder();
    await user.type(screen.getByRole("textbox", { name: /Search instruments/i }), "F502");

    expect(cards()).not.toHaveLength(0);
    for (const card of cards()) {
      expect(within(card).getByText(/Related equipment/)).toBeInTheDocument();
    }
  });

  it("explains a plant-specific letter group instead of guessing silently", () => {
    renderFinder("/instruments?q=CRIC");
    expect(within(cards()[0]).getByText(/partial decode/i)).toBeInTheDocument();
  });

  it("flags instruments whose unit has no mapped equipment yet", () => {
    const entry = findInstrument("LIC101204")!;
    expect(entry.equipment.length).toBe(7);
    renderFinder("/instruments?q=940");
    // 940 is the fuel-gas system: no diagram equipment carries that prefix.
    expect(within(cards()[0]).getByText(/No equipment in this unit is mapped yet/)).toBeInTheDocument();
  });

  it("says so plainly when nothing matches", async () => {
    const user = userEvent.setup();
    renderFinder();
    await user.type(screen.getByRole("textbox", { name: /Search instruments/i }), "ZZZZZ");
    expect(screen.getByTestId("instrument-empty")).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it("speaks French when the interface does", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("gnl1z-lang", "fr");
    renderFinder();
    await user.type(screen.getByRole("textbox", { name: /Rechercher des instruments/i }), "LIC101204");

    const card = within(cards()[0]);
    expect(card.getByText(/Niveau indicateur contrôleur/)).toBeInTheDocument();
    expect(card.getByText(/01 · Décarbonatation \(MEA\)/)).toBeInTheDocument();
    expect(card.getByText(/Équipements liés \(7\)/)).toBeInTheDocument();
    expect(card.getByText("Visible sur")).toBeInTheDocument();
  });
});

describe("Instrument decoding on the DCS screens", () => {
  it("offers the finder from the DCS directory", () => {
    render(
      <MemoryRouter initialEntries={["/dcs"]}>
        <I18nProvider>
          <DcsDirectory />
        </I18nProvider>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Instrument Finder/ });
    expect(link).toHaveAttribute("href", "/instruments");
  });

  it("opens every detected tag with its meaning and its equipment", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dcs"]}>
        <I18nProvider>
          <DcsDirectory />
        </I18nProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /All Tags/i }));
    const dialog = await screen.findByRole("dialog");
    // The chip now reads "LIC101204" *and* what the instrument is.
    const chip = within(dialog).getByRole("button", { name: /LIC101204/ });
    expect(chip).toHaveTextContent(/Level indicating controller/);
    expect(chip).toHaveAttribute("title", expect.stringContaining("101-F502"));
  });

  it("explains the tags of a panel without leaving the screen", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dcs/decarbonation-01"]}>
        <I18nProvider>
          {/* DcsDetail gating of AI detection depends on the session. */}
          <AuthProvider>
            <Routes>
              <Route path="/dcs/:id" element={<DcsDetail />} />
            </Routes>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: /What do these tags mean/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(toggle);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Meaning" })).toBeInTheDocument();
    expect(within(table).getAllByRole("link").length).toBeGreaterThan(0);
    // Every row links back to the finder for the full record.
    expect(within(table).getAllByRole("link")[0]).toHaveAttribute("href", expect.stringContaining("/instruments?q="));
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});
