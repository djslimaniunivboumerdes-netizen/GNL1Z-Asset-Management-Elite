// src/pages/Auth.tsx
import { useState, type FormEvent } from "react";
import type { KeyboardEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  LogIn, ArrowLeft, ArrowRight, Loader2, Mail, KeyRound,
  User, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import sonatrachLogo from "@/assets/sonatrach-logo.png";
import newsHero from "@/assets/news-hero.jpg";

// ─── Password strength ───────────────────────────────────────────────────────

function getStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)            s++;
  if (pw.length >= 12)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
const STRENGTH_COLOR = [
  "", "bg-destructive", "bg-yellow-500", "bg-yellow-500", "bg-green-500", "bg-green-500",
];

function PasswordStrength({ password }: { password: string }) {
  const score = getStrength(password);
  if (!password) return null;
  return (
    <div className="space-y-1 mt-1.5" aria-live="polite">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < score ? STRENGTH_COLOR[score] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground">{STRENGTH_LABEL[score]}</p>
    </div>
  );
}

// ─── Field with icon + password toggle ──────────────────────────────────────

function Field({
  label, value, onChange, type = "text", icon: Icon,
  onKey, autoComplete, error, hint, id,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; icon?: React.ComponentType<{ className?: string }>;
  onKey?: (e: KeyboardEvent<HTMLInputElement>) => void;
  autoComplete?: string; error?: string; hint?: string; id?: string;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs">{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          type={isPw ? (show ? "text" : "password") : type}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
          className={[
            Icon ? "pl-9" : "", isPw ? "pr-9" : "",
            error ? "border-destructive focus-visible:ring-destructive" : "",
          ].join(" ")}
        />
        {isPw && (
          <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p id={`${inputId}-err`} role="alert" className="text-[10px] text-destructive font-mono">{error}</p>}
      {hint && !error && <p id={`${inputId}-hint`} className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── 4-colour Google logo ────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10 overflow-hidden">
      <img src={newsHero} alt="" aria-hidden
        className="absolute inset-0 w-full h-full object-cover opacity-25" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
      <div className="relative w-full max-w-sm">
        <Link to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent mb-3 font-mono uppercase tracking-wider transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        {children}
      </div>
    </div>
  );
}

// ─── Validation ──────────────────────────────────────────────────────────────

const validateEmail    = (v: string) =>
  !v ? "Email is required" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Enter a valid email" : "";
const validatePassword = (v: string) =>
  !v ? "Password is required" : v.length < 8 ? "Minimum 8 characters" : "";
const validateConfirm  = (pw: string, c: string) =>
  !c ? "Please confirm your password" : pw !== c ? "Passwords do not match" : "";

// ─── Classify Supabase error messages ────────────────────────────────────────

type ErrKind = "invalid_credentials" | "not_confirmed" | "rate_limit" | "other";

function classifyError(msg: string): ErrKind {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("wrong")) return "invalid_credentials";
  if (m.includes("not confirmed") || m.includes("email_not_confirmed")) return "not_confirmed";
  if (m.includes("rate limit") || m.includes("too many")) return "rate_limit";
  return "other";
}

// ════════════════════════════════════════════════════════════════════════════
// Auth page
// ════════════════════════════════════════════════════════════════════════════

export default function Auth() {
  const { user, loading, signIn, signUp, signInWithGoogle, resendConfirmation } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode]           = useState<"auth" | "forgot">("auth");
  const [tab, setTab]             = useState<"signin" | "signup">("signin");

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [fullName, setFullName]   = useState("");

  const [emailErr, setEmailErr]       = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [confirmErr, setConfirmErr]   = useState("");

  // shown after "email not confirmed" error so user can resend
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending]   = useState(false);

  const [busy, setBusy]           = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── If already authenticated, bounce to dashboard ──
  if (!loading && user) return <Navigate to="/" replace />;

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchTab = (v: string) => {
    if (busy) return;
    setTab(v as "signin" | "signup");
    setPassword(""); setConfirmPw(""); setFullName("");
    setEmailErr(""); setPasswordErr(""); setConfirmErr("");
    setShowResend(false);
  };

  // ── Sign in ───────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailErr(eErr); setPasswordErr(pErr);
    if (eErr || pErr) return;

    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);

    if (error) {
      const kind = classifyError(error.message ?? "");
      if (kind === "invalid_credentials") {
        setPasswordErr("Incorrect email or password");
      } else if (kind === "not_confirmed") {
        setEmailErr("Email not confirmed — check your inbox");
        setShowResend(true);
      } else if (kind === "rate_limit") {
        toast({ title: "Too many attempts", description: "Please wait a moment and try again.", variant: "destructive" });
      } else {
        toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
      }
      return;
    }

    // Success — onAuthStateChange will update user state and trigger <Navigate>
    toast({ title: "Welcome back!", description: `Signed in as ${email}` });
    navigate("/", { replace: true });
  };

  // ── Resend confirmation email ─────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true);
    const { error } = await resendConfirmation(email);
    setResending(false);
    if (error) {
      toast({ title: "Failed to resend", description: error.message, variant: "destructive" });
    } else {
      setShowResend(false);
      setEmailErr("");
      toast({ title: "Confirmation email sent", description: "Check your inbox and click the link." });
    }
  };

  // ── Sign up ───────────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validateConfirm(password, confirmPw);
    setEmailErr(eErr); setPasswordErr(pErr); setConfirmErr(cErr);
    if (eErr || pErr || cErr) return;

    setBusy(true);
    const { error } = await signUp(email, password, fullName);
    setBusy(false);

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setEmailErr("An account with this email already exists");
        setTab("signin");
      } else {
        toast({ title: "Sign-up failed", description: error.message, variant: "destructive" });
      }
      return;
    }

    toast({
      title: "Account created!",
      description: "Check your email inbox and click the confirmation link before signing in.",
    });
    // Switch to sign-in tab so user can sign in after confirming
    setTab("signin");
    setPassword(""); setConfirmPw(""); setFullName("");
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    // Page will navigate away; only reaches here if signInWithOAuth itself fails
    setBusy(false);
    if (error) {
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
    }
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    const eErr = validateEmail(email);
    setEmailErr(eErr);
    if (eErr) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    setResetSent(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === "signin") void handleSignIn();
    else void handleSignUp();
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>, fn: () => void) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  };

  // ════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD VIEW
  // ════════════════════════════════════════════════════════════════════════
  if (mode === "forgot") {
    return (
      <PageShell>
        <div className="border border-border rounded-xl bg-card/95 backdrop-blur p-6 shadow-industrial">
          <div className="flex flex-col items-center text-center mb-5">
            <img src={sonatrachLogo} alt="Sonatrach" className="h-10 w-auto mb-3 opacity-90" />
            <h1 className="text-xl font-display font-bold">Reset Password</h1>
            <p className="text-xs text-muted-foreground mt-1">We'll send a reset link to your email</p>
          </div>

          {resetSent ? (
            <div className="text-center space-y-3 py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-sm font-medium font-display">Check your inbox</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A reset link was sent to{" "}
                <span className="font-mono text-foreground">{email}</span>.
              </p>
              <Button variant="outline" className="w-full mt-2"
                onClick={() => { setMode("auth"); setResetSent(false); }}>
                ← Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void handleForgotPassword(); }} className="space-y-4">
              <Field id="forgot-email" icon={Mail} label="Email address"
                value={email} onChange={(v) => { setEmail(v); setEmailErr(""); }}
                type="email" autoComplete="email" error={emailErr}
                onKey={(e) => onEnter(e, handleForgotPassword)} />
              <Button type="submit" disabled={busy}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><ArrowRight className="h-4 w-4 mr-1.5" />Send reset link</>}
              </Button>
              <button type="button" onClick={() => { setMode("auth"); setEmailErr(""); }}
                className="w-full text-xs text-muted-foreground hover:text-accent transition-colors text-center">
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </PageShell>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // MAIN AUTH VIEW
  // ════════════════════════════════════════════════════════════════════════
  return (
    <PageShell>
      <div className="border border-border rounded-xl bg-card/95 backdrop-blur p-6 shadow-industrial">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <img src={sonatrachLogo} alt="Sonatrach" className="h-10 w-auto mb-3 opacity-90" />
          <div className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-display font-bold">GNL1Z Access</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to log tests or upload photos
          </p>
        </div>

        <Tabs value={tab} onValueChange={switchTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin" disabled={busy}>Sign in</TabsTrigger>
            <TabsTrigger value="signup" disabled={busy}>Sign up</TabsTrigger>
          </TabsList>

          <form onSubmit={onSubmit} noValidate>

            {/* ── SIGN IN ── */}
            <TabsContent value="signin" className="space-y-3 pt-4">
              <Field id="signin-email" icon={Mail} label="Email"
                value={email} onChange={(v) => { setEmail(v); setEmailErr(""); setShowResend(false); }}
                type="email" autoComplete="email" error={emailErr} />

              {/* Resend confirmation banner */}
              {showResend && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2.5 flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground font-medium">Email not confirmed</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Check your inbox for a confirmation link.
                    </p>
                    <button type="button" disabled={resending} onClick={handleResend}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 font-mono disabled:opacity-50 transition-colors">
                      {resending
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</>
                        : <><RefreshCw className="h-3 w-3" /> Resend confirmation email</>}
                    </button>
                  </div>
                </div>
              )}

              <Field id="signin-password" icon={KeyRound} label="Password"
                value={password} onChange={(v) => { setPassword(v); setPasswordErr(""); }}
                type="password" autoComplete="current-password" error={passwordErr}
                onKey={(e) => onEnter(e, handleSignIn)} />

              <div className="flex justify-end -mt-1">
                <button type="button"
                  onClick={() => { setMode("forgot"); setEmailErr(""); setPasswordErr(""); setShowResend(false); }}
                  className="text-[11px] text-muted-foreground hover:text-accent transition-colors font-mono">
                  Forgot password?
                </button>
              </div>

              <Button type="submit" disabled={busy}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </TabsContent>

            {/* ── SIGN UP ── */}
            <TabsContent value="signup" className="space-y-3 pt-4">
              <Field id="signup-name" icon={User} label="Full name"
                value={fullName} onChange={setFullName}
                autoComplete="name" hint="Optional" />
              <Field id="signup-email" icon={Mail} label="Email"
                value={email} onChange={(v) => { setEmail(v); setEmailErr(""); }}
                type="email" autoComplete="email" error={emailErr} />
              <div>
                <Field id="signup-password" icon={KeyRound} label="Password"
                  value={password} onChange={(v) => { setPassword(v); setPasswordErr(""); }}
                  type="password" autoComplete="new-password" error={passwordErr}
                  hint={!passwordErr ? "Minimum 8 characters" : undefined} />
                <PasswordStrength password={password} />
              </div>
              <Field id="signup-confirm" icon={KeyRound} label="Confirm password"
                value={confirmPw} onChange={(v) => { setConfirmPw(v); setConfirmErr(""); }}
                type="password" autoComplete="new-password" error={confirmErr}
                onKey={(e) => onEnter(e, handleSignUp)} />

              <Button type="submit" disabled={busy}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </TabsContent>

          </form>
        </Tabs>

        {/* Divider */}
        <div className="my-5 flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google */}
        <Button variant="outline" onClick={handleGoogle} disabled={busy} className="w-full gap-2">
          <GoogleIcon />
          Continue with Google
        </Button>

        <p className="mt-5 text-[11px] text-muted-foreground text-center leading-relaxed">
          Browsing equipment is public. Sign in only to log tests or upload photos.
        </p>
      </div>
    </PageShell>
  );
                }
