// Provenance must travel with the drawing: an instrument suggests a drawing, the
// P&ID viewer opens it, and both carry the same source facts — including the ones
// the source data does not have, which are shown as gaps instead of invented.

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import Instruments from "@/pages/Instruments";
import PIDViewer from "@/pages/PIDViewer";
import { buildInstrumentIndex } from "@/lib/instrumentIndex";
import { instrumentPlacements, placementGroups, sheetProvenance } from "@/lib/instrumentLocation";
import { PID_INDEX } from "@/lib/pidIndex";
import localSheetFiles from "@/data/pid_sheet_files.json";

const index = buildInstrumentIndex();

function renderFinder(path = "/instruments") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <Instruments />
      </I18nProvider>
    </MemoryRouter>,
  );
}

function renderViewer(file: string) {
  return render(
    <MemoryRouter initialEntries={[`/pids?file=${encodeURIComponent(file)}`]}>
      <I18nProvider>
        <PIDViewer />
      </I18nProvider>
    </MemoryRouter>,
  );
}

/** A tag whose drawings include one numbered for another unit. */
function entryWithRenumberedDrawing() {
  const found = index.find((entry) =>
    instrumentPlacements(entry).some(
      (p) => p.unit !== null && p.unit !== p.matchedUnit && p.matchedEquipment.length > 0,
    ),
  );
  if (!found) throw new Error("no drawing numbered for another unit in the corpus");
  return found;
}

/** A tag whose drawings include one with no drawing number on the title block. */
function entryWithUnnumberedDrawing() {
  const found = index.find((entry) =>
    instrumentPlacements(entry).some((p) => !p.drawing && p.matchedEquipment.length > 0),
  );
  if (!found) throw new Error("no unnumbered drawing in the corpus");
  return found;
}

describe("provenance follows the instrument", () => {
  it("shows where each suggested drawing came from", async () => {
    const user = userEvent.setup();
    renderFinder("/instruments?q=LIC101204");
    await user.click(within(screen.getAllByTestId("instrument-card")[0]).getByRole("button", { name: /Locate/ }));

    const dialog = await screen.findByTestId("instrument-locator");
    const provenance = within(dialog).getAllByTestId("drawing-provenance");
    expect(provenance.length).toBeGreaterThan(0);

    // Every drawing states where it came from, including what is missing.
    for (const row of provenance) {
      expect(row).toHaveTextContent(/Revision not recorded/); // not invented
      expect(row).toHaveTextContent(/checksum [0-9a-f]{12}…/);
      expect(row).toHaveTextContent(/ocr-rapidocr/);          // extraction method
      expect(row).toHaveTextContent(/not verified/);          // no human sign-off
    }
    // At least one carries a citable drawing number.
    expect(provenance.some((row) => /85-X01/.test(row.textContent ?? ""))).toBe(true);
  });

  it("explains a drawing numbered for another unit", async () => {
    const user = userEvent.setup();
    const entry = entryWithRenumberedDrawing();
    renderFinder(`/instruments?q=${entry.tag}`);
    await user.click(within(screen.getAllByTestId("instrument-card")[0]).getByRole("button", { name: /Locate/ }));

    const dialog = await screen.findByTestId("instrument-locator");
    expect(dialog).toHaveTextContent(/Numbered for unit \d\d — listed because it shows/);
  });

  it("explains a drawing with no number on its title block", async () => {
    const user = userEvent.setup();
    const entry = entryWithUnnumberedDrawing();
    renderFinder(`/instruments?q=${entry.tag}`);
    await user.click(within(screen.getAllByTestId("instrument-card")[0]).getByRole("button", { name: /Locate/ }));

    const dialog = await screen.findByTestId("instrument-locator");
    expect(dialog).toHaveTextContent(/No drawing number on the title block — listed because it shows/);
  });

  it("lists one chip per drawing number even when two files share it", () => {
    // 85-X02-10.3, 85-X10-10.2 and 85-X07-10 each exist as more than one file.
    // Only the first three drawings become chips, so pick a tag whose shared
    // number is among them.
    const owner = index.find((entry) =>
      placementGroups(instrumentPlacements(entry))
        .slice(0, 3)
        .some((group) => group.placements.length > 1),
    );
    expect(owner, "no instrument with a shared drawing number in the first three").toBeTruthy();

    renderFinder(`/instruments?q=${owner!.tag}`);
    const chips = within(screen.getAllByTestId("instrument-card")[0])
      .getByTestId("instrument-drawings")
      .querySelectorAll("a");
    const labels = [...chips].map((chip) => chip.textContent ?? "");
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.some((label) => /×\d/.test(label))).toBe(true);
  });

  it("says the same thing in French", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("gnl1z-lang", "fr");
    renderFinder("/instruments?q=LIC101204");
    await user.click(within(screen.getAllByTestId("instrument-card")[0]).getByRole("button", { name: /Localiser/ }));

    const dialog = await screen.findByTestId("instrument-locator");
    const provenance = within(dialog).getAllByTestId("drawing-provenance")[0];
    expect(provenance).toHaveTextContent(/Révision non enregistrée/);
    expect(provenance).toHaveTextContent(/empreinte/);
    window.localStorage.clear();
  });
});

describe("provenance follows the drawing", () => {
  it("is shown in the P&ID viewer with the gaps named", () => {
    // Only the sheets with a local vector copy expose provenance there.
    const local = new Set(Object.values(localSheetFiles as Record<string, string>));
    const sheet = PID_INDEX.sheets.find((candidate) => local.has(candidate.file) && candidate.drawing)!;
    renderViewer(sheet.file);

    const block = screen.getByTestId("pid-provenance");
    expect(block).toHaveTextContent(/Revision not recorded/);
    expect(block).toHaveTextContent(sheet.drawing!);
    // The checksum is shortened for display but the full value stays available.
    expect(block).toHaveTextContent(new RegExp(sheet.sha256.slice(0, 12)));
    expect(block).toHaveTextContent(/Not verified/);
    expect(block).toHaveTextContent(/no verifier recorded/);
    // Train is not recorded on any drawing, and is not guessed.
    expect(block).toHaveTextContent(/not recorded/);
  });

  it("is the same object whichever way the drawing is reached", () => {
    const sheet = PID_INDEX.sheets.find((candidate) => candidate.drawing)!;
    const fromViewer = sheetProvenance(sheet.file)!;
    const placement = index
      .flatMap((entry) => instrumentPlacements(entry))
      .find((candidate) => candidate.file === sheet.file);
    expect(placement).toBeTruthy();
    expect(placement!.provenance).toEqual(fromViewer);
    expect(fromViewer.revision).toBeNull();
    expect(fromViewer.train).toBeNull();
    expect(fromViewer.verifiedBy).toBeNull();
  });
});
