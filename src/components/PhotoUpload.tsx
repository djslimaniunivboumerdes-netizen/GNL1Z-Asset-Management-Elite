import { useRef, useState } from "react";
import { Camera, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { compressToWebP } from "@/lib/imageCompress";
import { idb, type PendingUpload } from "@/lib/db";
import { flushQueue } from "@/lib/sync";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/I18nContext";

export function PhotoUpload({ tag, onUploaded }: { tag: string; onUploaded?: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      if (!user) throw new Error(L("Sign in before uploading a photo.", "Connectez-vous avant d'envoyer une photo."));
      const blob = await compressToWebP(file);
      const clientId = crypto.randomUUID();
      const upload: PendingUpload = {
        // The path carries the owner id: Storage policies grant write access to
        // <tag>/<user_id>/*, so a user cannot write into someone else's folder.
        client_id: clientId, upload_path: `${tag}/${user.id}/${clientId}.webp`, tag,
        file_name: file.name.replace(/\.[^.]+$/, "") + ".webp", mime_type: "image/webp",
        blob, uploaded_by: user.id, created_at: new Date().toISOString(),
      };
      // Persist first. If the browser closes during upload, the same ID/path can
      // be retried without creating a second image or losing the selected file.
      const localId = await idb.pendingUploads.add(upload);
      if (!navigator.onLine) {
        toast({ title: L("Photo queued on this device", "Photo enregistrée sur cet appareil"), description: L("It will upload after you reconnect and sign in.", "Elle sera envoyée après reconnexion et authentification.") });
        return;
      }
      await flushQueue();
      if (await idb.pendingUploads.get(localId)) throw new Error(L("Upload not confirmed. The photo is kept in the retry queue; use the sync indicator to retry.", "Envoi non confirmé. La photo reste en attente ; utilisez l'indicateur de synchronisation."));
      toast({ title: L("Photo uploaded", "Photo envoyée") });
      onUploaded?.();
    } catch (cause) {
      toast({ title: L("Photo not uploaded", "Photo non envoyée"), description: cause instanceof Error ? cause.message : L("Try again with a supported image.", "Réessayez avec une image compatible."), variant: "destructive" });
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  return <div className="flex flex-wrap gap-2">
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" aria-label={L("Take equipment photo", "Prendre une photo de l'équipement")} />
    <input ref={galleryRef} type="file" accept="image/*" onChange={handle} className="hidden" aria-label={L("Choose equipment photo", "Choisir une photo de l'équipement")} />
    <Button type="button" size="sm" variant="outline" disabled={busy || !user} onClick={() => cameraRef.current?.click()} title={!user ? L("Sign in to upload", "Connectez-vous pour envoyer") : undefined} className="min-h-10 gap-2 text-xs">
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Camera className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
      {busy ? L("Processing…", "Traitement…") : L("Take photo", "Prendre une photo")}
    </Button>
    <Button type="button" size="sm" variant="outline" disabled={busy || !user} onClick={() => galleryRef.current?.click()} className="min-h-10 gap-2 text-xs">
      {busy ? <Upload className="h-4 w-4" /> : <ImageIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />}{L("Choose photo", "Choisir une photo")}
    </Button>
    {!user && <p className="w-full text-xs text-muted-foreground">{L("Sign in to attach equipment photos.", "Connectez-vous pour joindre des photos.")}</p>}
  </div>;
}
