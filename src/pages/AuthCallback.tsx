// src/pages/AuthCallback.tsx
//
// Landing page for all OAuth + email-confirmation redirects.
// Supabase exchanges the ?code= param here (PKCE flow), then we
// redirect the user to the dashboard once the session is resolved.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import sonatrachLogo from "@/assets/sonatrach-logo.png";

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate           = useNavigate();
  const toasted            = useRef(false); // prevent double-toast in StrictMode

  useEffect(() => {
    if (loading) return; // still exchanging the code — wait

    if (!toasted.current) {
      toasted.current = true;

      if (user) {
        const name =
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "there";
        toast({
          title: `Welcome, ${name}!`,
          description: `Signed in as ${user.email}`,
        });
        navigate("/", { replace: true });
      } else {
        toast({
          title: "Sign-in failed",
          description:
            "Could not complete sign-in. Please try again or use email + password.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // ── UI: shown while the PKCE code exchange is in flight ──────────────────
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-6 px-4">
      <img src={sonatrachLogo} alt="Sonatrach" className="h-12 w-auto opacity-80" />

      {loading ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <div className="text-center space-y-1">
            <p className="text-sm font-display font-semibold">Signing you in…</p>
            <p className="text-xs text-muted-foreground font-mono">
              Verifying your credentials with Supabase
            </p>
          </div>
        </>
      ) : user ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="text-sm font-display font-semibold">Signed in — redirecting…</p>
        </>
      ) : (
        <>
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-display font-semibold">Sign-in failed — redirecting…</p>
        </>
      )}
    </div>
  );
}
