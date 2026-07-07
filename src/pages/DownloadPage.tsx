import { useState, useEffect } from "react";
import {
  Smartphone, Monitor, Apple, Globe,
  Download, CheckCircle, ExternalLink,
  Shield, Zap, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

const GITHUB_REPO = "djslimaniunivboumerdes-netizen/GNL1Z_Asset_Integrity_Management";
const WEBAPP_URL  = "https://gnl1z.pages.dev";
const TESTFLIGHT  = "";
// Checksums are fetched live from the release's SHA256SUMS.txt
const APK_SHA256  = "";  // populated at runtime from release asset

interface Asset { name: string; browser_download_url: string; size: number; }
interface Release { tag_name: string; published_at: string; assets: Asset[]; }

const fmtBytes = (b: number) =>
  b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

const fmtDate = (iso: string, lang: "en" | "fr") =>
  new Intl.DateTimeFormat(lang === "fr" ? "fr-DZ" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso));

const tx = {
  en: {
    heading: "Download GNL1Z",
    sub: "Native app for every device",
    version: "Latest version",
    features: ["QR Equipment Scanner", "FR / EN Language", "Dark Mode", "Offline Cache"],
    hashLabel: "APK SHA-256 checksum",
    verifyHash: "Verify integrity",
    source: "Source Code",
    allReleases: "All Releases",
    loading: "Fetching latest release...",
    platforms: {
      android: { title: "Android", desc: "Direct APK install", btn: "Download APK", note: "Android 7.0+",
        steps: ["Tap Download APK", 'Settings → Security → Enable "Unknown sources"', "Open the APK and tap Install"] },
      windows: { title: "Windows", desc: "Desktop installer (.exe)", btn: "Download .exe", note: "Windows 10/11 x64",
        steps: ["Download the .exe installer", "Run as Administrator", "Follow the setup wizard"] },
      ios: { title: "iOS", desc: "iPhone & iPad", btn: "Open TestFlight", note: "iOS 15+",
        steps: ["Install TestFlight from the App Store", "Tap the button below to open the invite", "Accept and install GNL1Z"] },
      web: { title: "Web App (PWA)", desc: "No install needed", btn: "Open in Browser", note: "Any modern browser",
        steps: ["Open in Chrome / Edge / Safari", 'Menu → "Add to Home Screen"', "Works offline like a native app"] },
    },
  },
  fr: {
    heading: "Télécharger GNL1Z",
    sub: "Application native pour tous vos appareils",
    version: "Dernière version",
    features: ["Scanner QR Équipements", "Langue FR / EN", "Mode Sombre", "Cache Hors-ligne"],
    hashLabel: "Somme de contrôle SHA-256",
    verifyHash: "Vérifier l'intégrité",
    source: "Code Source",
    allReleases: "Toutes les versions",
    loading: "Récupération de la version...",
    platforms: {
      android: { title: "Android", desc: "Installation APK directe", btn: "Télécharger l'APK", note: "Android 7.0+",
        steps: ["Appuyer sur Télécharger l'APK", 'Paramètres → Sécurité → Activer "Sources inconnues"', "Ouvrir l'APK et installer"] },
      windows: { title: "Windows", desc: "Installateur bureau (.exe)", btn: "Télécharger .exe", note: "Windows 10/11 x64",
        steps: ["Télécharger l'installateur .exe", "Exécuter en tant qu'Administrateur", "Suivre l'assistant d'installation"] },
      ios: { title: "iOS", desc: "iPhone et iPad", btn: "Ouvrir TestFlight", note: "iOS 15 minimum",
        steps: ["Installer TestFlight depuis l'App Store", "Appuyer sur le bouton pour ouvrir l'invitation", "Accepter et installer GNL1Z"] },
      web: { title: "App Web (PWA)", desc: "Sans installation", btn: "Ouvrir dans le navigateur", note: "Tout navigateur moderne",
        steps: ["Ouvrir dans Chrome / Edge / Safari", 'Menu → "Ajouter à l\'écran d\'accueil"', "Fonctionne hors ligne comme une app native"] },
    },
  },
};

function PlatformCard({
  icon, accent, title, desc, btn, steps, note,
  url, size, external = false, available = true, badge,
}: {
  icon: React.ReactNode; accent: string; title: string; desc: string;
  btn: string; steps: string[]; note: string; url: string;
  size?: string; external?: boolean; available?: boolean; badge?: string;
}) {
  const [state,  setState]  = useState<"idle" | "loading" | "done">("idle");
  const [expand, setExpand] = useState(false);

  const handleClick = () => {
    if (!available) return;
    if (external) { window.open(url, "_blank", "noopener noreferrer"); return; }
    setState("loading");
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() ?? "gnl1z";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => { setState("done"); setTimeout(() => setState("idle"), 2500); }, 900);
  };

  return (
    <div className={`rounded-2xl border bg-card overflow-hidden transition-all duration-200 ${
      available
        ? "border-border hover:border-primary/40 hover:shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
        : "border-border/40 opacity-60"
    }`}>
      <div className={`h-0.5 w-full ${accent}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`h-11 w-11 rounded-xl ${accent} flex items-center justify-center text-white`}>
            {icon}
          </div>
          <div className="flex items-center gap-2">
            {size && available && (
              <span className="text-xs font-mono text-muted-foreground/60">{size}</span>
            )}
            {badge && (
              <span className="text-[10px] font-mono uppercase tracking-widest bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
        </div>

        <h3 className="font-display font-bold text-lg text-foreground mb-0.5">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{desc}</p>

        <button
          className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground mb-3 transition-colors"
          onClick={() => setExpand(!expand)}
        >
          {expand ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expand ? "Hide steps" : "How to install"}
        </button>
        {expand && (
          <ol className="space-y-2 mb-4">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className={`flex-shrink-0 h-5 w-5 rounded-full ${accent} flex items-center justify-center text-[10px] font-bold text-white mt-0.5`}>
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        )}

        <button
          onClick={handleClick}
          disabled={!available}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all duration-150 ${
            available
              ? `${accent} text-white hover:opacity-90 active:scale-[0.98]`
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {state === "done"    ? <><CheckCircle className="h-4 w-4" /> Done!</>
           : state === "loading" ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Downloading...</>
           : external           ? <><ExternalLink className="h-4 w-4" /> {btn}</>
           :                      <><Download className="h-4 w-4" /> {btn}</>}
        </button>

        <p className="text-center text-xs text-muted-foreground/40 mt-2.5 font-mono">{note}</p>
      </div>
    </div>
  );
}

export default function DownloadPage({ lang = "en" }: { lang?: "en" | "fr" }) {
  const T = tx[lang];
  const [release,  setRelease]  = useState<Release | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showHash, setShowHash] = useState(false);
  const [checksums, setChecksums] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then(r => r.json())
      .then((d: unknown) => {
        const data = d as unknown as Record<string, unknown>;
        if (data.tag_name) {
          setRelease(d as unknown as Release);
          // Fetch the SHA256SUMS.txt asset if present
          const sumsAsset = (data.assets as Asset[]).find((a: Asset) => a.name === "SHA256SUMS.txt");
          if (sumsAsset) {
            fetch(sumsAsset.browser_download_url)
              .then(r => r.text())
              .then(txt => {
                const map: Record<string, string> = {};
                txt.trim().split("\n").forEach(line => {
                  const [hash, name] = line.split(/\s+/);
                  if (hash && name) map[name.replace("*", "").trim()] = hash;
                });
                setChecksums(map);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const apkAsset = release?.assets.find(a => a.name.endsWith(".apk"));
  const exeAsset = release?.assets.find(a => a.name.endsWith(".exe"));
  const apkUrl   = apkAsset?.browser_download_url
    ?? `https://github.com/${GITHUB_REPO}/releases/latest/download/GNL1Z-Android.apk`;
  const exeUrl   = exeAsset?.browser_download_url ?? "";

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-gradient-to-b from-muted/40 to-background border-b border-border">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--primary)) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 py-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-mono text-primary mb-5">
            <Zap className="h-3 w-3" />
            {loading
              ? T.loading
              : release
                ? `${T.version}: ${release.tag_name}  ·  ${fmtDate(release.published_at, lang)}`
                : "No release yet — check back soon"}
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-foreground mb-3 tracking-tight">
            {T.heading}
          </h1>
          <p className="text-muted-foreground text-lg mb-7">{T.sub}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {T.features.map(f => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1 text-xs font-medium text-foreground">
                <CheckCircle className="h-3 w-3 text-primary" />{f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlatformCard
            icon={<Smartphone className="h-5 w-5" />}
            accent="bg-gradient-to-br from-green-500 to-emerald-600"
            url={apkUrl} size={apkAsset ? fmtBytes(apkAsset.size) : "5.8 MB"}
            available={true} {...T.platforms.android}
          />
          <PlatformCard
            icon={<Monitor className="h-5 w-5" />}
            accent="bg-gradient-to-br from-blue-500 to-blue-700"
            url={exeUrl} size={exeAsset ? fmtBytes(exeAsset.size) : undefined}
            available={!!exeAsset}
            badge={!exeAsset ? (lang === "fr" ? "Build en cours" : "Building...") : undefined}
            {...T.platforms.windows}
          />
          <PlatformCard
            icon={<Apple className="h-5 w-5" />}
            accent="bg-gradient-to-br from-gray-500 to-gray-800"
            url={TESTFLIGHT} external={true}
            available={!!TESTFLIGHT}
            badge={!TESTFLIGHT ? (lang === "fr" ? "Bientôt" : "Coming soon") : undefined}
            {...T.platforms.ios}
          />
          <PlatformCard
            icon={<Globe className="h-5 w-5" />}
            accent="bg-gradient-to-br from-amber-500 to-orange-600"
            url={WEBAPP_URL} external={true} available={true}
            {...T.platforms.web}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{T.hashLabel}</span>
            </div>
            <button onClick={() => setShowHash(!showHash)} className="text-xs text-primary hover:underline font-mono">
              {T.verifyHash}
            </button>
          </div>
          {showHash && (
            <div className="mt-3 rounded-lg bg-muted p-3 space-y-2">
              {Object.keys(checksums).length > 0 ? (
                Object.entries(checksums).map(([name, hash]) => (
                  <p key={name} className="text-xs font-mono text-muted-foreground break-all">
                    <span className="text-foreground">{name}:</span><br />{hash}
                  </p>
                ))
              ) : (
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {APK_SHA256 || (lang === "fr" ? "Publiez une release pour voir les checksums." : "Publish a release to see checksums.")}
                </p>
              )}
              <p className="text-xs font-mono text-muted-foreground/50 pt-1">
                {lang === "fr"
                  ? "Vérifier avec: sha256sum -c SHA256SUMS.txt"
                  : "Verify with: sha256sum -c SHA256SUMS.txt"}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mt-7 text-sm">
          <a href={`https://github.com/${GITHUB_REPO}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="h-4 w-4" />{T.source}
          </a>
          <a href={`https://github.com/${GITHUB_REPO}/releases`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-4 w-4" />{T.allReleases}
          </a>
        </div>
      </div>
    </div>
  );
}
