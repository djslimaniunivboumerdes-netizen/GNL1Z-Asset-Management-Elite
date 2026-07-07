import { Mail, Linkedin, ExternalLink, Award, Copy, Check, Smartphone, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { useState } from "react";
import type { ReactNode } from "react";

const AUTHOR = {
  name:     "Slimani Djamel",
  email:    "dj.slimani.univ.boumerdes@gmail.com",
  orcid:    "0009-0006-9893-2800",
  linkedin: "slimani-djamel-3b15a4212",
};

export default function Author() {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(AUTHOR.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-4xl mx-auto">
      <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-1">/ {t("author")}</div>

      {/* Hero card */}
      <div className="relative overflow-hidden border border-border rounded-lg bg-gradient-industrial p-8 md:p-10 text-white mb-8">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 right-0 h-1 stripe-warning" />
        <div className="relative flex items-start gap-6 flex-wrap">
          <div className="h-24 w-24 rounded-full bg-gradient-accent grid place-items-center font-display font-bold text-3xl text-accent-foreground shadow-accent">
            SD
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{AUTHOR.name}</h1>
            <p className="text-white/70 mt-2">
              {lang === "en"
                ? "Author & maintainer — GNL1Z Asset Management workspace."
                : "Auteur & mainteneur — espace de gestion d'actifs GNL1Z."}
            </p>
          </div>
        </div>
      </div>

      {/* Contact cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <ContactCard icon={Mail} label="Email" value={AUTHOR.email} mono action={
          <Button size="sm" variant="ghost" onClick={copy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("copied") : t("copy")}
          </Button>
        } href={`mailto:${AUTHOR.email}`} />
        <ContactCard icon={Award}    label="ORCID"    value={AUTHOR.orcid}    mono href={`https://orcid.org/${AUTHOR.orcid}`} />
        <ContactCard icon={Linkedin} label="LinkedIn" value={AUTHOR.linkedin} mono href={`https://linkedin.com/in/${AUTHOR.linkedin}`} />
      </div>

      {/* ── Download & Install ───────────────────────────────────────────────── */}
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-1">/ {lang === "en" ? "Download App" : "Télécharger"}</div>
        <h2 className="text-2xl font-display font-bold mb-1">
          {lang === "en" ? "Install on your phone" : "Installer sur votre téléphone"}
        </h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {lang === "en"
            ? "GNL1Z is a Progressive Web App. Install it directly from your browser — no app store required for internal Sonatrach use."
            : "GNL1Z est une Progressive Web App. Installez-la directement depuis votre navigateur, sans app store pour usage interne Sonatrach."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Android */}
          <div className="border border-border rounded-xl bg-card overflow-hidden hover:border-emerald-500/40 hover:shadow-lg transition-all">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="font-display font-bold">Android</div>
                  <div className="text-xs text-muted-foreground">Chrome · Add to Home Screen</div>
                </div>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1 pl-1 leading-relaxed">
                <li>1. Open <strong>Chrome</strong> on your Android phone</li>
                <li>2. Go to <span className="font-mono text-xs text-foreground/70 break-all">https://gnl1z.dj-slimani-univ-boumerdes.workers.dev</span></li>
                <li>3. Tap ⋮ → <strong>"Add to Home Screen"</strong> → Add</li>
                <li>4. Or generate a signed APK with PWABuilder ↓</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <a href="https://www.pwabuilder.com/?url=https://gnl1z.dj-slimani-univ-boumerdes.workers.dev" target="_blank" rel="noopener noreferrer"
                   className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2.5 hover:bg-emerald-500/20 transition-colors">
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
              <ol className="text-xs text-muted-foreground space-y-1 pl-1 leading-relaxed">
                <li>1. Open <strong>Safari</strong> on iPhone or iPad</li>
                <li>2. Go to <span className="font-mono text-xs text-foreground/70 break-all">https://gnl1z.dj-slimani-univ-boumerdes.workers.dev</span></li>
                <li>3. Tap Share ⬆ → <strong>"Add to Home Screen"</strong> → Add</li>
                <li>4. The Sonatrach icon appears on your home screen</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <a href="https://gnl1z.dj-slimani-univ-boumerdes.workers.dev" target="_blank" rel="noopener noreferrer"
                   className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-lg px-3 py-2.5 hover:bg-sky-500/20 transition-colors">
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
      </div>
    </div>
  );
}

function ContactCard({ icon: Icon, label, value, mono, href, action }: {
  icon: LucideIcon;
  label: string; value: string; mono?: boolean; href?: string; action?: ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-5 hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-accent" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className={`text-sm hover:text-accent break-all ${mono ? "font-mono" : ""}`}>
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
