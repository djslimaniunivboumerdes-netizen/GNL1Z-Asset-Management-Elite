import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import SmartProcessFlow from "@/pages/SmartFlow";
import { TAGS, SECT } from "@/data/smartFlow";
import { DCS_PANELS } from "@/data/dcs_panels";
import { MANUALS } from "@/data/manuals";

/** jsdom has no layout, so the pan/zoom clamp sees a zero-sized viewport. */
function renderFlow(initialPath = "/flow") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <SmartProcessFlow />
      </I18nProvider>
    </MemoryRouter>,
  );
}

/** Overlay buttons are the only ones whose label reads "<diag> – <name>". */
const tagButtons = () => screen.getAllByRole("button")
  .filter(b => (b.getAttribute("aria-label") ?? "").includes(" – "));

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Smart process flow — diagram and filtering", () => {
  it("renders the supervisory header and every annotated tag", () => {
    renderFlow();
    expect(screen.getByRole("heading", { level: 1, name: /Smart Process Flow/ })).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED TELEMETRY/)).toBeInTheDocument();
    // One overlay button per equipment tag in the catalogue.
    expect(tagButtons()).toHaveLength(TAGS.length);
  });

  it("narrows the diagram to a single process section", async () => {
    const user = userEvent.setup();
    renderFlow();
    const propane = screen.getByRole("button", { name: "Propane" });
    expect(propane).toHaveAttribute("aria-pressed", "false");

    await user.click(propane);
    expect(propane).toHaveAttribute("aria-pressed", "true");
    expect(tagButtons()).toHaveLength(TAGS.filter(t => t.section === "propane").length);
    expect(TAGS.filter(t => t.section === "propane").length).toBeGreaterThan(0);
  });

  it("offers fly-to results when searching, and opens the match", async () => {
    const user = userEvent.setup();
    renderFlow();
    const target = TAGS.find(t => t.id === "E501") ?? TAGS[0];

    await user.type(screen.getByRole("textbox", { name: /Search equipment tags/i }), target.id);
    // Results are offered as buttons — a match off-screen is otherwise unreachable.
    const results = screen.getByRole("list");
    const match = within(results).getAllByRole("button")[0];
    expect(match.textContent).toContain(target.diag);

    await user.click(match);
    expect(screen.getByRole("heading", { level: 2, name: target.nameEn })).toBeInTheDocument();
  });

  it("does not let the zoom shortcuts swallow digits typed in the search box", async () => {
    const user = userEvent.setup();
    renderFlow();
    const input = screen.getByRole("textbox", { name: /Search equipment tags/i }) as HTMLInputElement;
    // Regression guard: "0" is also the reset-view shortcut, so the keystroke
    // used to be preventDefault()ed out of the field ("101-E501" → "101-E51").
    await user.type(input, "101-E501");
    expect(input.value).toBe("101-E501");
  });

  it("reports no matches for an unknown tag", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole("textbox", { name: /Search equipment tags/i }), "ZZZ-999");
    expect(screen.getByText(/No equipment matches this search/i)).toBeInTheDocument();
  });
});

describe("Smart process flow — inspection drawer", () => {
  const openTag = async (id: string) => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole("textbox", { name: /Search equipment tags/i }), id);
    await user.click(within(screen.getByRole("list")).getAllByRole("button")[0]);
    return user;
  };

  it("shows specs, linked DCS panels and manuals from the shared catalogues", async () => {
    const tag = TAGS.find(t => t.dcsPanels.length > 0 && t.manuals.length > 0)!;
    await openTag(tag.id);

    // DCS panels resolve through src/data/dcs_panels (no local duplicate list).
    const expectedPanels = DCS_PANELS.filter(p => tag.dcsPanels.includes(p.id));
    const expectedManuals = MANUALS.filter(m => tag.manuals.includes(m.id));
    expect(expectedPanels.length).toBeGreaterThan(0);
    expect(expectedManuals.length).toBeGreaterThan(0);

    const drawer = within(screen.getByTestId("inspection-drawer"));
    for (const panel of expectedPanels) {
      expect(drawer.getByText(panel.title_en)).toBeInTheDocument();
    }
    for (const manual of expectedManuals) {
      expect(drawer.getByText(manual.title_en)).toBeInTheDocument();
    }
  });

  it("links to the equipment master file when the tag maps to the register", async () => {
    const tag = TAGS.find(t => t.dbTag)!;
    await openTag(tag.id);
    const masterFile = screen.getByRole("link", { name: /Master File/i });
    expect(masterFile).toHaveAttribute("href", `/equipment/${tag.dbTag}`);
  });

  it("localises the section badge and DCS panel titles in French", async () => {
    localStorage.setItem("gnl1z-lang", "fr");
    const tag = TAGS.find(t => t.dcsPanels.length > 0)!;
    const panel = DCS_PANELS.find(p => tag.dcsPanels.includes(p.id))!;

    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole("textbox", { name: /Rechercher des repères/i }), tag.id);
    await user.click(within(screen.getByRole("list")).getAllByRole("button")[0]);

    expect(screen.getByText(SECT[tag.section].fr.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText(panel.title_fr)).toBeInTheDocument();
  });
});

describe("Smart process flow — simulation controls and deep links", () => {
  it("pauses and resumes the simulation", async () => {
    const user = userEvent.setup();
    renderFlow();
    const pause = screen.getByRole("button", { name: /Pause simulation/i });
    expect(pause).toHaveAttribute("aria-pressed", "false");
    await user.click(pause);
    expect(screen.getByRole("button", { name: /Resume simulation/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the asset named in the URL (?tag=…) so a view can be shared", () => {
    const tag = TAGS.find(t => t.id === "E501") ?? TAGS[0];
    renderFlow(`/flow?tag=${tag.id}`);
    expect(screen.getByRole("heading", { level: 2, name: tag.nameEn })).toBeInTheDocument();
  });

  it("opens the equipment dashboard drawer and flies to a tag", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole("button", { name: /Equipment Drawer/i }));
    const dashboard = within(screen.getByTestId("equipment-dashboard"));
    const row = dashboard.getAllByRole("button").find(b => TAGS.some(t => b.textContent?.startsWith(t.diag)));
    expect(row).toBeTruthy();
    await user.click(row!);
    // Selecting from the dashboard opens the inspection panel for that asset.
    expect(screen.getByTestId("inspection-drawer")).toBeInTheDocument();
  });
});
