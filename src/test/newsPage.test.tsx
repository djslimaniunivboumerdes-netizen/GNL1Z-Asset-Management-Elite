import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/contexts/I18nContext";
import News from "@/pages/News";

const renderNews = () => render(
  <I18nProvider>
    <News />
  </I18nProvider>,
);

const headings = () => screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent);

describe("News page", () => {
  it("renders the hero, reference-snapshot disclaimer, and the full dispatch list", () => {
    renderNews();
    expect(screen.getByRole("heading", { level: 1, name: /LNG Market Hub/ })).toBeInTheDocument();
    expect(screen.getByText(/Reference snapshot — curated values, not live market data/i)).toBeInTheDocument();
    expect(screen.getByText(/18 industry dispatches/i)).toBeInTheDocument();
    // 18 dispatches → 1 featured heading + 17 grid headings.
    expect(headings()).toHaveLength(18);
  });

  it("filters by category with aria-pressed state", async () => {
    const user = userEvent.setup();
    renderNews();
    const market = screen.getByRole("button", { name: "Market" });
    expect(market).toHaveAttribute("aria-pressed", "false");
    await user.click(market);
    expect(market).toHaveAttribute("aria-pressed", "true");
    // The featured Operations card is filtered out; five Market cards remain.
    expect(headings()).toHaveLength(5);
  });

  it("searches titles and summaries and can be cleared", async () => {
    const user = userEvent.setup();
    renderNews();
    const input = screen.getByRole("textbox", { name: /Search dispatches/i });
    await user.type(input, "Timimoun");
    expect(headings()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Clear search/i }));
    expect(headings()).toHaveLength(18);
  });

  it("renders dispatches without a public link as non-clickable articles, never href='#'", () => {
    const { container } = renderNews();
    expect(container.querySelector('a[href="#"]')).toBeNull();
    // 11 of 18 dispatches are internal (link "#"): featured + 10 grid cards.
    expect(screen.getAllByTestId("internal-dispatch")).toHaveLength(10);
    const featuredTitle = screen.getByRole("heading", {
      level: 3,
      name: /GNL1Z Digital Twin Deployment Complete/,
    });
    expect(featuredTitle.closest("a")).toBeNull();
    expect(featuredTitle.closest("article")).not.toBeNull();
    expect(screen.getByText("Internal dispatch")).toBeInTheDocument();
  });

  it("switches to French content, labels, and localized dates", () => {
    localStorage.setItem("gnl1z-lang", "fr");
    renderNews();
    expect(screen.getByRole("heading", { level: 1, name: /Hub Marché GNL/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tous" })).toBeInTheDocument();
    expect(screen.getByText(/Jumelle numérique du GNL1Z déployée/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot de référence/)).toBeInTheDocument();
    // Featured article date (2026-06-02) rendered in French, with source.
    expect(screen.getByText(/02 juin 2026 · GNL1Z Operations/)).toBeInTheDocument();
    // Hero freshness line also uses the localized curated date.
    expect(screen.getByText(/compilé le 02 juin 2026/)).toBeInTheDocument();
  });

  it("toggles sort order between newest and oldest", async () => {
    const user = userEvent.setup();
    renderNews();
    // Newest: featured first in DOM, then the 2026-06-02 Medgaz dispatch.
    expect(headings()[1]).toMatch(/Medgaz Pipeline Throughput/);
    await user.click(screen.getByRole("button", { name: /Sort: newest/i }));
    // Oldest: first grid item becomes the 2026-05-05 MCHE protocol dispatch.
    expect(headings()[1]).toMatch(/Warm-End Efficiency Protocol/);
  });
});
