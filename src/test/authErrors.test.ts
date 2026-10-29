import { describe, expect, it } from "vitest";
import { describeAuthFailure } from "@/lib/authErrors";

describe("describeAuthFailure", () => {
  it("explains a missing backend configuration instead of echoing a fetch error", () => {
    const failure = describeAuthFailure("google", "Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
    expect(failure.title).toBe("Google sign-in failed");
    expect(failure.description).toContain("VITE_SUPABASE_URL");
    expect(failure.description).toContain("Cloudflare Pages");
  });

  it("maps network failures to the paused-project remedy", () => {
    for (const raw of ["Failed to fetch", "TypeError: fetch failed", "project is paused", "No active services for this project", "Unexpected token < in JSON at position 0 (503)"]) {
      const failure = describeAuthFailure("google", raw);
      expect(failure.description).toContain("paused");
      expect(failure.description).toContain("Restore");
    }
  });

  it("maps a disabled provider to the Supabase provider checklist", () => {
    const failure = describeAuthFailure("google", "Identity provider provider google is not enabled");
    expect(failure.description).toContain("Authentication → Providers → Google");
  });

  it("maps redirect rejections to the URL configuration checklist", () => {
    const failure = describeAuthFailure("callback", "Redirect URL ... is not in the list of allowed redirect URLs");
    expect(failure.description).toContain("URL Configuration");
  });

  it("maps credential rejections to the publishable-key check", () => {
    const failure = describeAuthFailure("signin", "Invalid API key");
    expect(failure.description).toContain("PUBLISHABLE_KEY");
  });

  it("keeps familiar auth messages recognizable", () => {
    expect(describeAuthFailure("signin", "Invalid login credentials").description).toBe("Incorrect email or password.");
    expect(describeAuthFailure("signin", "Email not confirmed").description).toContain("confirmation link");
    expect(describeAuthFailure("signup", "User already registered").title).toBe("Account exists");
  });

  it("never returns an empty description", () => {
    for (const raw of [undefined, "", "some completely unknown failure mode"]) {
      const failure = describeAuthFailure("google", raw);
      expect(failure.description.length).toBeGreaterThan(0);
      expect(failure.title).toBe("Google sign-in failed");
    }
    // Unknown raw messages are passed through so nothing is hidden from operators.
    expect(describeAuthFailure("google", "some completely unknown failure mode").description).toBe("some completely unknown failure mode");
  });
});
