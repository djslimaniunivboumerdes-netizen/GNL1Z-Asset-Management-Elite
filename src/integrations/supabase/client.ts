import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
export const isSupabaseConfigured = Boolean(
  url && key && !url.includes("placeholder") && key !== "placeholder",
);

// A syntactically valid local-only client keeps the equipment register usable
// without credentials. Callers guard backend operations with the flag above.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : "https://placeholder.supabase.co",
  isSupabaseConfigured ? key : "public-anonymous-key",
  {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
      flowType: "pkce",
    },
  },
);
