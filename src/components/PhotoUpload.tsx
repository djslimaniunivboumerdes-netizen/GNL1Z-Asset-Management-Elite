import { useRef, useState } from "react";
import { Camera, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { compressToWebP } from "@/lib/imageCompress";
import { idb } from "@/lib/db";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/I18nContext";

export function PhotoUpload({ tag, onUploaded }: { tag: string; onUploaded?: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressToWebP(file);
      const fileName = file.name.replace(/\.[^.]+$/, "") + ".webp";

      if (!navigator.onLine || !user) {
        await idb.pendingUploads.add({
          tag, file_name: fileName, mime_type: "image/webp",
          blob, uploaded_by: user?.id ?? null, created_at: new Date().toISOString(),
        });
        toast({ title: lang === "en" ? "Queued offline" : "Mise en file d'attente hors-ligne", description: lang === "en" ? "Photo will upload when online." : "La photo sera synchronisée une fois en ligne." });
      } else {
        const path = `${tag}/${Date.now()}-${fileName}`;
        const { error: upErr } = await supabase.storage.from("equipment-photos").upload(path, blob, {
          contentType: "image/webp",
        });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("equipment_images").insert({
          tag, file_path: path, file_name: fileName,
          mime_type: "image/webp", size_bytes: blob.size, uploaded_by: user.id,
        });
        if (insErr) throw insErr;
        toast({ title: lang === "en" ? "Photo uploaded" : "Photo importée avec succès" });
        onUploaded?.();
      }
    } catch (err) {
      toast({ title: lang === "en" ? "Upload failed" : "Échec de l'import", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* CAMERA INPUT (capture="environment") */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handle}
        className="hidden"
      />
      {/* GALLERY INPUT (NO capture) */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handle}
        className="hidden"
      />

      <Button size="sm" variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()} className="gap-2 bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl px-4 py-4 font-mono text-xs shadow-md">
        {busy ? <Upload className="h-4 w-4 animate-pulse text-cyan-400" /> : <Camera className="h-4 w-4 text-cyan-500" />}
        {busy ? (lang === "en" ? "Uploading…" : "Envoi…") : (lang === "en" ? "Take Photo (Camera)" : "Prendre Photo (Caméra)")}
      </Button>

      <Button size="sm" variant="outline" disabled={busy} onClick={() => galleryRef.current?.click()} className="gap-2 bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl px-4 py-4 font-mono text-xs shadow-md">
        <ImageIcon className="h-4 w-4 text-amber-500" />
        {lang === "en" ? "Upload from Gallery" : "Importer de la Galerie"}
      </Button>
    </div>
  );
}
