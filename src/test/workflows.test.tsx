import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import EquipmentList from "@/pages/EquipmentList";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MarkdownText } from "@/components/MarkdownText";
import { ScheduleStatusBadge } from "@/components/ScheduleStatusBadge";

function Location() { const location = useLocation(); return <output aria-label="Current URL">{location.pathname}{location.search}</output>; }
function wrap(ui: React.ReactNode, route = "/equipment") {
  return render(<I18nProvider><MemoryRouter initialEntries={[route]}>{ui}<Location /></MemoryRouter></I18nProvider>);
}

describe("shareable equipment workflow", () => {
  it("restores a tag filter from the URL and updates it when searching", async () => {
    const user = userEvent.setup();
    wrap(<EquipmentList />, "/equipment?q=X01-E-501");
    expect(screen.getAllByRole("link", { name: "X01-E-501" })[0]).toBeInTheDocument();
    expect(screen.getByLabelText("Current URL")).toHaveTextContent("?q=X01-E-501");
    await user.clear(screen.getByRole("searchbox", { name: /Search by tag/i }));
    await user.type(screen.getByRole("searchbox", { name: /Search by tag/i }), "no-such-equipment-xyz");
    expect(await screen.findByText("No matching equipment")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Current URL")).toHaveTextContent("no-such-equipment-xyz"));
  });
  it("paginates instead of rendering the entire register", () => {
    wrap(<EquipmentList />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});

describe("accessible global search", () => {
  it("opens with Ctrl+K and finds equipment by a name, not only its command value", async () => {
    const user = userEvent.setup();
    wrap(<><GlobalSearch /><Routes><Route path="/equipment/:tag" element={<p>Equipment opened</p>} /></Routes></>, "/");
    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByRole("dialog", { name: "Search workspace" })).toBeInTheDocument();
    await user.type(screen.getByRole("combobox"), "Condenseur");
    const result = await screen.findByRole("option", { name: /X01-E-501/ });
    await user.click(result);
    expect(screen.getByText("Equipment opened")).toBeInTheDocument();
    expect(screen.getByLabelText("Current URL")).toHaveTextContent("/equipment/X01-E-501");
  });
});

describe("honest status and safe assistant rendering", () => {
  it("does not label an unknown schedule as up to date", () => {
    render(<I18nProvider><ScheduleStatusBadge status="UNKNOWN" /></I18nProvider>);
    expect(screen.getByText("Not scheduled")).toBeInTheDocument();
    expect(screen.queryByText("Up to date")).not.toBeInTheDocument();
  });
  it("renders model HTML as text rather than executable markup", () => {
    const { container } = render(<MarkdownText text={'### Reference\n\n**Check** `X01-E-501`\n\n<img src=x onerror="alert(1)"><script>alert(2)</script>'} />);
    expect(screen.getByText("Check")).toBeInTheDocument();
    expect(container.querySelector("img,script")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
