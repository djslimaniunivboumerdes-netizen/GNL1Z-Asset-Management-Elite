import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PidConnections } from "@/components/PidConnections";

function renderConnections(tag: string) {
  return render(
    <MemoryRouter>
      <PidConnections tag={tag} lang="en" />
    </MemoryRouter>,
  );
}

describe("P&ID connections panel", () => {
  it("shows what the drawings say is connected, and where it was read", () => {
    renderConnections("E-520");
    const panel = screen.getByTestId("pid-connections");

    // The drawing, its number, and the sizes read on it.
    expect(within(panel).getByText(/E520 R792 R793/)).toBeInTheDocument();
    expect(within(panel).getByText(/85-X06-10\.1/)).toBeInTheDocument();
    expect(within(panel).getByText(/Distinct sizes read/)).toBeInTheDocument();
    expect(within(panel).getAllByText('6"').length).toBeGreaterThan(0);
    // Every card links to the drawing it came from.
    expect(within(panel).getAllByRole("link", { name: /Open drawing/ })[0]).toHaveAttribute(
      "href",
      "/pids?file=%2Fpids%2FE520%20R792%20R793.pdf",
    );
  });

  it("never lets an OCR reading look like a verified value", () => {
    renderConnections("E-520");
    expect(screen.getByText(/OCR reading — not verified/)).toBeInTheDocument();
    expect(screen.getByText(/no engineer has signed them off/)).toBeInTheDocument();
  });

  it("says plainly when a tag is on no indexed drawing", () => {
    renderConnections("X02-P-03.12B");
    expect(screen.getByText(/not on any indexed drawing/i)).toBeInTheDocument();
    expect(screen.queryByTestId("pid-connections")).not.toBeInTheDocument();
  });

  it("finds which drawings mention a string", async () => {
    const user = userEvent.setup();
    renderConnections("E-520");
    await user.type(screen.getByRole("textbox", { name: /Search the drawing text/i }), "NOTES");

    const hits = await screen.findByTestId("pid-text-hits");
    expect(within(hits).getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
