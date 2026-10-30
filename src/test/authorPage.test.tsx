import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import Author from "@/pages/Author";

const renderAuthor = () => render(
  <I18nProvider>
    <MemoryRouter>
      <Author />
    </MemoryRouter>
  </I18nProvider>,
);

describe("Author profile page", () => {
  it("renders identity, contact links, and keeps mailto without target=_blank", () => {
    renderAuthor();
    expect(screen.getByRole("heading", { level: 1, name: "Slimani Djamel" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /orcid.org\/0009-0006-9893-2800|0009-0006-9893-2800/ }))
      .toHaveAttribute("href", "https://orcid.org/0009-0006-9893-2800");
    const mail = screen.getAllByRole("link", { name: /dj.slimani.univ.boumerdes@gmail.com/ })[0];
    expect(mail).toHaveAttribute("href", "mailto:dj.slimani.univ.boumerdes@gmail.com");
    expect(mail).not.toHaveAttribute("target");
  });

  it("derives install URLs from the current origin — no stale workers.dev host", () => {
    renderAuthor();
    expect(document.body.innerHTML).not.toContain("workers.dev");
    expect(document.body.textContent).toContain(window.location.origin);
    const pwa = document.querySelector('a[href*="pwabuilder.com"]') as HTMLAnchorElement | null;
    expect(pwa?.getAttribute("href")).toContain(`?url=${window.location.origin}`);
  });

  it("copies the email with a status announcement", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    renderAuthor();
    const btn = screen.getByRole("button", { name: "Copy" });
    await user.click(btn);
    expect(screen.getByRole("status")).toHaveTextContent("Copied!");
    expect(btn).toHaveTextContent("Copied!");
  });

  it("shows focus areas and live workspace snapshot counts", () => {
    renderAuthor();
    expect(screen.getByText("Asset Integrity")).toBeInTheDocument();
    expect(screen.getByText("Offline-first PWA")).toBeInTheDocument();
    expect(screen.getByText("Equipment records")).toBeInTheDocument();
    // Dynamic counts: gnl1z_database.json has 77 equipment records.
    expect(screen.getByText("77")).toBeInTheDocument();
    // manuals.ts (23) and dcs_panels.ts both feed the snapshot.
    expect(screen.getAllByText("23")).toHaveLength(2);
    // pid_sheet_files.json currently maps 28 local PDFs.
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("cross-links to the download page", () => {
    renderAuthor();
    const link = screen.getByRole("link", { name: /install options/i });
    expect(link).toHaveAttribute("href", "/download");
  });

  it("localizes hero, about, focus chips, and install sections in French", () => {
    localStorage.setItem("gnl1z-lang", "fr");
    renderAuthor();
    expect(screen.getByText(/Auteur & mainteneur/)).toBeInTheDocument();
    expect(screen.getByText("Mainteneur actif")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Qui a construit GNL1Z" })).toBeInTheDocument();
    expect(screen.getByText("Intégrité des actifs")).toBeInTheDocument();
    expect(screen.getByText("Fiches équipements")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /options d'installation/i })).toBeInTheDocument();
  });
});
