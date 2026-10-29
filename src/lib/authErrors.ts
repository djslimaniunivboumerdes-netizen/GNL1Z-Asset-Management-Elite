// src/lib/authErrors.ts
//
// Maps raw Supabase/GoTrue/client failures to actionable, honest copy.
// The goal: an operator should learn WHAT to fix (paused project, missing
// provider, bad redirect, missing env) instead of seeing "Failed to fetch".

export type AuthScope = "google" | "signin" | "signup" | "callback" | "reset";

export interface AuthFailure {
  title: string;
  description: string;
}

const NOT_CONFIGURED =
  "Application backend is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env for local runs, or in Cloudflare Pages → Settings → Environment variables for production.";
const PROJECT_DOWN =
  "The Supabase project is unreachable — it is usually paused. Restore it in the Supabase dashboard (Project → Settings → General → Restore), then retry.";
const PROVIDER_OFF =
  "Google sign-in is disabled on the Supabase project. Enable it under Authentication → Providers → Google (Google Cloud OAuth client ID + secret).";
const BAD_CREDENTIALS =
  "Supabase rejected the app credentials. Check that VITE_SUPABASE_PUBLISHABLE_KEY matches this project and the project is active.";
const REDIRECT_BLOCKED =
  "This origin is not in the Supabase redirect allow-list. Add it under Authentication → URL Configuration → Redirect URLs (including /auth/callback).";

export function describeAuthFailure(scope: AuthScope, raw: string | undefined): AuthFailure {
  const msg = (raw ?? "").trim();
  const lower = msg.toLowerCase();

  const generic: AuthFailure = {
    title:
      scope === "google" ? "Google sign-in failed"
      : scope === "signup" ? "Sign-up failed"
      : scope === "reset" ? "Reset failed"
      : scope === "callback" ? "Sign-in failed"
      : "Sign-in failed",
    description: msg || "Unknown error — check the browser console and try again.",
  };

  if (!msg) return generic;
  if (/not configured|placeholder\.supabase/i.test(lower)) return { ...generic, description: NOT_CONFIGURED };
  if (/failed to fetch|fetch failed|networkerror|load failed|econnrefused|etimedout|project is paused|no active services|service unavailable|\b50[234]\b/i.test(lower)) {
    return { ...generic, description: PROJECT_DOWN };
  }
  if (/provider[^\n]*not enabled|not enabled[^\n]*provider|oauth provider.*(not found|unsupported)|identity_provider/i.test(lower)) {
    return { ...generic, description: PROVIDER_OFF };
  }
  if (/redirect|not in the list|allow[ -]?list|unsafe redirect|redirect_uri/i.test(lower)) return { ...generic, description: REDIRECT_BLOCKED };
  if (/api key|apikey|invalid api|jwt|401|unauthorized/i.test(lower)) return { ...generic, description: BAD_CREDENTIALS };
  if (/already registered|user already exists/i.test(lower)) return { title: "Account exists", description: "An account with this email already exists — sign in instead." };
  if (/invalid login credentials/i.test(lower)) return { ...generic, description: "Incorrect email or password." };
  if (/email not confirmed/i.test(lower)) return { ...generic, description: "Email not confirmed — open the confirmation link in your inbox first." };
  if (/rate limit|too many|429/i.test(lower)) return { ...generic, description: "Too many attempts — wait a moment, then retry." };

  return generic;
}
