import { useState, useEffect, type ImgHTMLAttributes } from "react";
import { Cpu } from "lucide-react";

interface StorageImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  storagePath: string;
  alt: string;
  fallbackClassName?: string;
}

/**
 * Resilient image loader.
 * 1. Try Supabase Storage public URL (bucket: equipment-images) from dynamic VITE_SUPABASE_URL
 * 2. Fall back to /images/<basename> in the public folder
 * 3. Show a Cpu icon if both fail
 */
const STORAGE_PROJECT = import.meta.env.VITE_SUPABASE_URL || "https://gdkqetzkhgllwbpmqmux.supabase.co";
const BUCKET = "equipment-images";

const encodePath = (p: string) =>
  p.split("/").map(encodeURIComponent).join("/");

export function StorageImg({
  storagePath,
  alt,
  fallbackClassName,
  className,
  ...rest
}: StorageImgProps) {
  const primary = `${STORAGE_PROJECT}/storage/v1/object/public/${BUCKET}/${encodePath(storagePath)}`;
  const basename = storagePath.split("/").pop() ?? storagePath;
  const fallback = `/images/${encodeURIComponent(basename)}`;

  const [src, setSrc] = useState(primary);
  const [stage, setStage] = useState<"primary" | "fallback" | "failed">("primary");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSrc(primary);
    setStage("primary");
    setLoaded(false);
  }, [primary]);

  const handleError = () => {
    if (stage === "primary") {
      setSrc(fallback);
      setStage("fallback");
    } else {
      setStage("failed");
    }
  };

  if (stage === "failed") {
    return (
      <div
        className={
          fallbackClassName ??
          `flex flex-col items-center justify-center gap-2 text-white/30 bg-slate-900 border border-slate-800 rounded-xl p-6 ${className ?? ""}`
        }
      >
        <Cpu className="h-8 w-8 text-rose-500/70 animate-pulse" />
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">DCS Screen</span>
        <span className="text-[10px] text-slate-500">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
          <Cpu className="h-6 w-6 text-cyan-500 animate-pulse" />
        </div>
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-all duration-300 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"} ${className ?? ""}`}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        {...rest}
      />
    </div>
  );
}
