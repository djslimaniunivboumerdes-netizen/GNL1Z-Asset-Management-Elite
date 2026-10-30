import { Mail, Linkedin, ExternalLink, Award, Copy, Check, Smartphone, Download, ArrowUpRight, CheckCircle, RefreshCw, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { usePwaInstall, promptInstall } from "@/lib/pwaInstall";
import { Link } from "react-router-dom";
import { useState } from "react";
import type { ReactNode } from "react";
import { EQUIPMENT } from "@/data";
import { MANUALS } from "@/data/manuals";
import { DCS_PANELS } from "@/data/dcs_panels";
import SHEET_FILES from "@/data/pid_sheet_files.json";

const AUTHOR = {
  name:     "Slimani Djamel",
  email:    "dj.slimani.univ.boumerdes@gmail.com",
  orcid:    "0009-0006-9893-2800",
  linkedin: "slimani-djamel-3b15a4212",
};

// Stable app origin: VITE_APP_URL (Pages env var) or wherever the app is
// actually served from — never a hardcoded legacy host.
const appOrigin = (): string =>
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") ??
  (typeof window !== "undefined" ? window.location.origin : "");

function L<T>(lang: "en" | "fr", en: T, fr: T): T {
  return lang === "fr" ? fr : en;
}

const FOCUS = {
  en: ["Asset Integrity", "P&ID Engineering", "Process Safety", "AI Assistants", "Offline-first PWA"],
  fr: ["Intégrité des actifs", "Ingénierie P&ID", "Sécurité des procédés", "Assistants IA", "PWA hors-ligne"],
} as const;

const BIO = {
  en: "Djamel designed and maintains the GNL1Z Asset Management workspace — a bilingual, offline-first platform that unites the equipment register, P&ID library, DCS panels, operational manuals, test schedules, and an AI engineering assistant for the GNL1Z liquefaction trains.",
  fr: "Djamel a conçu et maintient l'espace de gestion d'actifs GNL1Z — une plateforme bilingue, hors-ligne, qui réunit le registre d'équipements, la bibliothèque P&ID, les panneaux DCS, les manuels opérationnels, les plannings d'essai et un assistant d'ingénierie IA pour les trains de liquéfaction GNL1Z.",
};

export default function Author() {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { installed, canInstall } = usePwaInstall();
  const origin = appOrigin();

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(AUTHOR.email);
      ok = true;
    } catch {
      // Fallback for non-secure contexts / missing clipboard permission.
      try {
        const ta = document.createElement("textarea");
        ta.value = AUTHOR.email;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const stats = [
    { value: String(EQUIPMENT.length),                en: "Equipment records",  fr: "Fiches équipements" },
    { value: String(MANUALS.length),                  en: "Operational manuals", fr: "Manuels opérationnels" },
    { value: String(DCS_PANELS.length),               en: "DCS panels",         fr: "Panneaux DCS" },
    { value: String(Object.keys(SHEET_FILES).length), en: "Local P&ID PDFs",    fr: "PDF P&ID locaux" },
    { value: "FR/EN",                                 en: "Languages",          fr: "Langues" },
  ];

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-4xl mx-auto">
      <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-1">/ {t("author")}</div>

      {/* Hero card */}
      <div className="relative overflow-hidden border border-border rounded-lg bg-gradient-industrial p-8 md:p-10 text-foreground mb-8">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 right-0 h-1 stripe-warning" />
        <div className="relative flex items-start gap-6 flex-wrap">
          <div className="h-24 w-24 rounded-full bg-gradient-accent grid place-items-center font-display font-bold text-3xl text-accent-foreground shadow-accent">
            SD
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{AUTHOR.name}</h1>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 rounded-full px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                {L(lang, "Active maintainer", "Mainteneur actif")}
              </span>
            </div>
            <p className="text-white/70 mt-2">
              {lang === "en"
                ? "Author & maintainer — GNL1Z Asset Management workspace."
                : "Auteur & mainteneur — espace de gestion d'actifs GNL1Z."}
            </p>
            <p className="text-white/50 mt-1 text-sm">
              {L(lang, "University of Boumerdes · GNL1Z project workspace", "Université de Boumerdes · espace projet GNL1Z")}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <QuickAction href={`mailto:${AUTHOR.email}`} icon={Mail} label="Email" />
              <QuickAction href={`https://orcid.org/${AUTHOR.orcid}`} icon={Award} label="ORCID" />
              <QuickAction href={`https://linkedin.com/in/${AUTHOR.linkedin}`} icon={Linkedin} label="LinkedIn" />
            </div>
          </div>
        </div>
      </div>

      {/* Contact cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <ContactCard icon={Mail} label="Email" value={AUTHOR.email} mono action={
          <>
            <span role="status" aria-live="polite" className="sr-only">{copied ? t("copied") : ""}</span>
            <Button size="sm" variant="ghost" onClick={copy} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("copied") : t("copy")}
            </Button>
          </>
        } href={`mailto:${AUTHOR.email}`} />
        <ContactCard icon={Award}    label="ORCID"    value={AUTHOR.orcid}    mono href={`https://orcid.org/${AUTHOR.orcid}`} />
        <ContactCard icon={Linkedin} label="LinkedIn" value={AUTHOR.linkedin} mono href={`https://linkedin.com/in/${AUTHOR.linkedin}`} />
      </div>

      {/* ── About the maintainer ────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-1">
          / {L(lang, "About", "À propos")}
        </div>
        <h2 className="text-2xl font-display font-bold mb-3">
          {L(lang, "Who built GNL1Z", "Qui a construit GNL1Z")}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-3xl">
          {L(lang, BIO.en, BIO.fr)}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label={L(lang, "Focus areas", "Domaines d'intervention")}>
          {FOCUS[lang].map(focus => (
            <li
              key={focus}
              className="border border-border bg-card text-foreground/80 font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full hover:border-accent/40 transition-colors"
            >
              {focus}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Workspace snapshot ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-3">
          / {L(lang, "Workspace snapshot", "Aperçu de l'espace")}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.map(stat => (
            <div key={stat.en} className="border border-border rounded-lg bg-card p-4">
              <div className="font-display text-2xl font-bold text-accent">{stat.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-1">
                {L(lang, stat.en, stat.fr)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Download & Install ───────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-1">/ {lang === "en" ? "Download App" : "Télécharger"}</div>
        <h2 className="text-2xl font-display font-bold mb-1">
          {lang === "en" ? "Install on your phone" : "Installer sur votre téléphone"}
        </h2>
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {lang === "en"
            ? "GNL1Z is a Progressive Web App. Install it directly from your browser — no app store required for internal Sonatrach use."
            : "GNL1Z est une Progressive Web App. Installez-la directement depuis votre navigateur, sans app store pour usage interne Sonatrach."}
        </p>

        {/* Install benefits */}
        <ul className="flex flex-wrap gap-2 mb-5" aria-label={L(lang, "Install benefits", "Avantages d'installation")}>
          <BenefitChip icon={Zap}>{L(lang, "Offline-ready", "Prêt hors-ligne")}</BenefitChip>
          <BenefitChip icon={RefreshCw}>{L(lang, "Auto-updates", "Mises à jour auto")}</BenefitChip>
          <BenefitChip icon={Smartphone}>{L(lang, "No app store", "Sans app store")}</BenefitChip>
        </ul>

        {/* One-tap install (Chromium fires beforeinstallprompt) */}
        {canInstall && (
          <div className="border border-accent/40 bg-accent/5 rounded-xl p-5 mb-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <div className="font-display font-bold">
                {L(lang, "One-tap install available", "Installation en un clic disponible")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {L(
                  lang,
                  "Your browser can install GNL1Z directly — no manual steps needed.",
                  "Votre navigateur peut installer GNL1Z directement — aucune étape manuelle requise.",
                )}
              </div>
            </div>
            <Button onClick={handleInstall} disabled={installing} className="gap-2">
              <Download className="h-4 w-4" />
              {installing ? L(lang, "Installing…", "Installation…") : L(lang, "Install GNL1Z", "Installer GNL1Z")}
            </Button>
          </div>
        )}

        {installed ? (
          <InstalledBanner lang={lang} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Android */}
          <div className="border border-border rounded-xl bg-card overflow-hidden hover:border-emerald-500/40 hover:shadow-lg transition-all">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-display font-bold">Android</div>
                  <div className="text-xs text-muted-foreground">Chrome · Add to Home Screen</div>
                </div>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                <li>Open <strong>Chrome</strong> on your Android phone</li>
                <li>Go to <span className="font-mono text-xs text-foreground/70 break-all">{origin}</span></li>
                <li>Tap ⋮ → <strong>Install app</strong>{lang === "en" ? " (or \"Add to Home Screen\")" : " (ou « Sur l'écran d'accueil »)"}</li>
                <li>Confirm — the Sonatrach icon appears on your home screen</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <a href={`https://www.pwabuilder.com/?url=${origin}`} target="_blank" rel="noopener noreferrer"
                   className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2.5 hover:bg-emerald-500/20 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  {lang === "en" ? "Generate APK (PWABuilder)" : "Générer APK (PWABuilder)"}
                </a>
              </div>
              <a href="https://docs.google.com/document/d/11tsfvme3ESA-VLaxgG1K7_gMIgeIi0tWxMa7zWHdX7E/edit" target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-accent transition-colors">
                <ExternalLink className="h-3 w-3" />
                {lang === "en" ? "Full installation guide (Google Drive)" : "Guide complet (Google Drive)"}
              </a>
            </div>
          </div>

          {/* iOS */}
          <div className="border border-border rounded-xl bg-card overflow-hidden hover:border-sky-500/40 hover:shadow-lg transition-all">
            <div className="h-1 bg-gradient-to-r from-sky-400 to-sky-600" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <div className="font-display font-bold">iOS — iPhone & iPad</div>
                  <div className="text-xs text-muted-foreground">Safari · Add to Home Screen</div>
                </div>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                <li>Open <strong>Safari</strong> on iPhone or iPad</li>
                <li>Go to <span className="font-mono text-xs text-foreground/70 break-all">{origin}</span></li>
                <li>Tap Share ⬆ → <strong>"Add to Home Screen"</strong> → Add</li>
                <li>Confirm — the Sonatrach icon appears on your home screen</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <a href={origin} target="_blank" rel="noopener noreferrer"
                   className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 rounded-lg px-3 py-2.5 hover:bg-sky-500/20 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  {lang === "en" ? "Open in Safari" : "Ouvrir dans Safari"}
                </a>
              </div>
              <a href="https://docs.google.com/document/d/1SqQXsQgXxVF1a8GAqIBabmQhe4wAKV2ChPaPAedVY3o/edit" target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-accent transition-colors">
                <ExternalLink className="h-3 w-3" />
                {lang === "en" ? "Full installation guide (Google Drive)" : "Guide complet (Google Drive)"}
              </a>
            </div>
          </div>
        </div>
        )}

        {/* Google Drive folder */}
        <a href="https://drive.google.com/drive/folders/1bvY4hC9Zep4lD-CI-eFyubwUWiSwpBbL" target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-3 border border-border rounded-xl bg-card p-4 hover:border-accent/40 hover:bg-secondary/20 transition-all group">
          <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm group-hover:text-accent transition-colors">
              {lang === "en" ? "Google Drive — All installation guides & APK resources" : "Google Drive — Guides d'installation & ressources APK"}
            </div>
            <div className="text-xs text-muted-foreground">drive.google.com · GNL1Z App Downloads</div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-accent transition-colors" />
        </a>

        {/* Full download page cross-link */}
        <Link
          to="/download"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold border border-accent/40 text-accent hover:bg-accent/10 rounded-lg px-4 py-2.5 transition-colors"
        >
          <ArrowUpRight className="h-4 w-4" />
          {L(lang, "All install options & releases — Download page", "Toutes les options d'installation — page Téléchargement")}
        </Link>
      </div>
    </div>
  );
}

function BenefitChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 border border-border bg-card text-foreground/70 font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full">
      <Icon className="h-3.5 w-3.5 text-accent" />
      {children}
    </li>
  );
}

function InstalledBanner({ lang }: { lang: "en" | "fr" }) {
  return (
    <div className="border border-emerald-500/40 bg-emerald-500/5 rounded-xl p-5 mb-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 grid place-items-center shrink-0">
        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0">
        <div className="font-display font-bold">
          {L(lang, "You already have GNL1Z installed", "GNL1Z est déjà installé")}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {L(
            lang,
            "You're running it as an installed app. Updates are applied automatically — close and reopen it if a version looks outdated.",
            "Vous l'exécutez en application installée. Les mises à jour s'appliquent automatiquement — fermez et rouvrez-la si une version semble obsolète.",
          )}
        </p>
        <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mt-2">
          {L(lang, "display-mode: standalone detected", "display-mode: standalone détecté")}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-1.5 border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function ContactCard({ icon: Icon, label, value, mono, href, action }: {
  icon: LucideIcon;
  label: string; value: string; mono?: boolean; href?: string; action?: ReactNode;
}) {
  const isMailto = href?.startsWith("mailto:") ?? false;
  return (
    <div className="border border-border rounded-lg bg-card p-5 hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-accent" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        {href ? (
          <a
            href={href}
            target={isMailto ? undefined : "_blank"}
            rel={isMailto ? undefined : "noreferrer"}
            className={`text-sm hover:text-accent break-all ${mono ? "font-mono" : ""}`}
          >
            {value}
          </a>
        ) : (
          <span className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</span>
        )}
        {action ?? <ExternalLink className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}
