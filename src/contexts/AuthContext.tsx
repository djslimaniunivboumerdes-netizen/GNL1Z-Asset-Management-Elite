// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // legacy aliases used by older code
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Stable app URL: use VITE_APP_URL in production, fall back to current origin.
// Set VITE_APP_URL=https://gnl1z.pages.dev in Cloudflare Pages env vars.
const appUrl = (): string =>
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") ??
  window.location.origin;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe FIRST so we never miss a SIGNED_IN event from an OAuth callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);        // ← also resolve loading on any auth state change
    });

    // 2. Hydrate the existing session (covers page refresh, localStorage restore)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Email + password sign-in ──────────────────────────────────────────────
  const signIn: AuthContextType["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  };

  // ── Email sign-up ─────────────────────────────────────────────────────────
  const signUp: AuthContextType["signUp"] = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${appUrl()}/auth/callback`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return { error };
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  // Redirects to /auth/callback so we can show a proper loading screen and
  // welcome toast instead of landing silently on the dashboard.
  const signInWithGoogle: AuthContextType["signInWithGoogle"] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl()}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    return { error };
  };

  // ── Resend confirmation email ─────────────────────────────────────────────
  const resendConfirmation: AuthContextType["resendConfirmation"] = async (email) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${appUrl()}/auth/callback` },
    });
    return { error };
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        resendConfirmation,
        signOut,
        login: () => {},
        logout: signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
