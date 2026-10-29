// @vitest-environment node
// Guards the Cloudflare Pages `_headers` rules that the P&ID Library depends on:
// the viewer frames locally served vector PDFs (same-origin) and Google Drive
// previews. Dropping 'self' from frame-src silently breaks every local sheet
// with Chrome's "This content is blocked" error.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const headers = readFileSync("public/_headers", "utf8");

describe("public/_headers security policy", () => {
  const cspLine = headers.split("\n").find((line) => line.includes("Content-Security-Policy:"));
  const csp = cspLine?.slice(cspLine.indexOf(":") + 1).trim() ?? "";
  const directive = (name: string) =>
    csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? "";

  it("keeps 'self' in frame-src so local P&ID PDFs can be framed", () => {
    expect(csp).not.toBe("");
    const frameSrc = directive("frame-src");
    expect(frameSrc).toContain("'self'");
    expect(frameSrc).toContain("https://drive.google.com");
  });

  it("keeps frame-ancestors locked and X-Frame-Options same-origin", () => {
    expect(directive("frame-ancestors")).toContain("'none'");
    expect(headers).toMatch(/^\s*X-Frame-Options:\s*SAMEORIGIN\s*$/m);
  });

  it("never allows inline scripts or remote script hosts", () => {
    const scriptSrc = directive("script-src");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toMatch(/https?:\/\//);
  });
});
