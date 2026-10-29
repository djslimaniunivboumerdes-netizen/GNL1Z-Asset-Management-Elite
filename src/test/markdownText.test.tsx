import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "@/components/MarkdownText";

describe("MarkdownText", () => {
  it("renders headings, lists, bold, and code without injecting HTML", () => {
    const { container } = render(<MarkdownText text={"### Title\n\n- **bold** item\n- `code` item\n\n1. first\n2. second\n\n<script>alert(1)</script>"} />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  });

  it("renders a heading followed by a mixed paragraph/list block", () => {
    const { container } = render(<MarkdownText text={"### X01-E-501\n\n**X01-E-501 — Condenser**\n- Type: Exchanger\n- Pressure: 8.6 bar\n\nNext due: 2026-11-15"} />);
    expect(screen.getByRole("heading", { name: "X01-E-501" })).toBeInTheDocument();
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(screen.getByText(/Next due: 2026-11-15/)).toBeInTheDocument();
  });

  it("allows internal links but keeps external URLs as text", () => {
    render(<MarkdownText text={"[Equipment](/equipment/X01-E-501) and [Evil](https://evil.example) and [Protocol](//evil.example)"} />);
    expect(screen.getByRole("link", { name: "Equipment" })).toHaveAttribute("href", "/equipment/X01-E-501");
    expect(screen.queryByRole("link", { name: "Evil" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Protocol" })).toBeNull();
    expect(screen.getByText(/https:\/\/evil.example/)).toBeInTheDocument();
  });
});
