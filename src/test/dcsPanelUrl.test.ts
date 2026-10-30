// The DCS panel module is reached from vite.config.ts as well as from the app,
// so it must import cleanly with and without Vite's `import.meta.env`. Loading
// it here is the regression test for that: it used to throw during `vite build`.

import { describe, expect, it } from "vitest";
import { dcsImageUrl } from "@/data/dcs_panels";

describe("DCS panel image URLs", () => {
  it("builds a public storage URL without throwing", () => {
    const url = dcsImageUrl("dcs/general train.jpg");
    expect(url).toMatch(/^https:\/\/.+\/storage\/v1\/object\/public\/equipment-images\//);
    expect(url).toContain(encodeURIComponent("dcs/general train.jpg").replace(/%2F/g, "/"));
  });

  it("falls back to the known project when no environment URL is configured", () => {
    // No VITE_SUPABASE_URL in this environment, so the documented default is used.
    expect(dcsImageUrl("a.png")).toContain("gdkqetzkhgllwbpmqmux.supabase.co");
  });
});
