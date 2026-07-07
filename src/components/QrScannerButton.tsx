import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { ScanLine, X, Search, AlertTriangle } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Fuse from "fuse.js";
import { getAllEquipmentTags } from "@/data";

interface QrScannerButtonProps {
  onScan: (value: string) => void;
}

export function QrScannerButton({ onScan }: QrScannerButtonProps) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [manualInput, setManualInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [camError, setCamError] = useState<string | null>(null);

  const fuse = useMemo(() => {
    const tags = getAllEquipmentTags();
    return new Fuse(tags, { threshold: 0.35, distance: 100, includeScore: false });
  }, []);

  const handleInputChange = (value: string) => {
    setManualInput(value);
    if (value.trim().length >= 2) {
      const results = fuse.search(value, { limit: 8 });
      setSuggestions(results.map((r) => r.item));
    } else {
      setSuggestions([]);
    }
  };

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Extract a usable tag from arbitrary QR payloads (plain text, URL, query).
  const extractTag = (raw: string): string => {
    const trimmed = raw.trim();
    const m = trimmed.match(/\/equipment\/([^/?#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    try {
      const u = new URL(trimmed);
      const t = u.searchParams.get("tag") || u.searchParams.get("id");
      if (t) return t;
    } catch { /* not a URL */ }
    return trimmed;
  };

  const handleClose = useCallback(() => {
    stopCamera();
    setOpen(false);
    setManualInput("");
    setSuggestions([]);
    setCamError(null);
  }, [stopCamera]);

  const handleSelect = (tag: string) => {
    onScan(tag);
    handleClose();
  };

  const startScan = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const tick = () => {
        if (!streamRef.current || !video) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const w = video.videoWidth, h = video.videoHeight;
          if (w && h) {
            canvas.width = w; canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) {
              const tag = extractTag(code.data);
              stopCamera();
              setOpen(false);
              onScan(tag);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setCamError(e instanceof Error ? e.message : "Camera unavailable");
    }
  }, [onScan, stopCamera]);

  const handleOpen = () => {
    setOpen(true);
    setSuggestions([]);
    setCamError(null);
    setTimeout(startScan, 300);
  };

  useEffect(() => () => stopCamera(), [stopCamera]);


  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        aria-label="Scan QR"
        title="Scan QR"
      >
        <ScanLine className="h-4 w-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Scan Equipment QR</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative aspect-square bg-black rounded-lg overflow-hidden border border-border">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 border-2 border-accent/70 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              {camError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 bg-black/70 text-white/80 text-xs p-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <div className="font-mono">{camError}</div>
                  <div className="text-white/50">Type the tag manually below.</div>
                </div>
              )}
            </div>

            {/* Fuzzy search with suggestions */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    value={manualInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Or type tag / ID…"
                    className="flex-1 h-9 w-full rounded-md border border-input bg-background px-3 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && manualInput) {
                        onScan(manualInput);
                        handleClose();
                      }
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (manualInput) {
                      onScan(manualInput);
                      handleClose();
                    }
                  }}
                >
                  Go
                </Button>
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                  {suggestions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleSelect(tag)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <span className="font-mono text-xs text-accent">{tag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={handleClose}
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
        }
