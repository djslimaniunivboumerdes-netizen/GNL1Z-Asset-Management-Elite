import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Trash2, RefreshCw } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { PhotoUpload } from "./PhotoUpload";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ImageRow { id: string; file_path: string; file_name: string | null; uploaded_by: string | null }
const BUCKET = "equipment-photos";

export function ImageGallery({ tag }: { tag: string }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<ImageRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImageRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); setError("not-configured"); return; }
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("equipment_images")
        .select("id, file_path, file_name, uploaded_by").eq("tag", tag).order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setImages(data ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load photos."); }
    finally { setLoading(false); }
  }, [tag]);
  useEffect(() => { void load(); }, [load]);
  const urlOf = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const deleteImage = async () => {
    if (!deleteTarget || deleting || deleteTarget.uploaded_by !== user?.id) return;
    setDeleting(true);
    try {
      // Remove the reference first: a storage cleanup failure must not leave a
      // broken image in the register. Report partial cleanup honestly.
      const { error: metadataError } = await supabase.from("equipment_images").delete().eq("id", deleteTarget.id);
      if (metadataError) throw metadataError;
      setImages((previous) => previous.filter((image) => image.id !== deleteTarget.id));
      setDeleteTarget(null);
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([deleteTarget.file_path]);
      toast(storageError
        ? { title: L("Photo removed; storage cleanup pending", "Photo retirée ; nettoyage du stockage en attente"), description: storageError.message }
        : { title: L("Photo deleted", "Photo supprimée") });
    } catch (cause) {
      toast({ title: L("Delete failed", "Échec de suppression"), description: cause instanceof Error ? cause.message : L("The photo was not deleted.", "La photo n'a pas été supprimée."), variant: "destructive" });
    } finally { setDeleting(false); }
  };

  return <section className="rounded-xl border border-border bg-card p-5 text-card-foreground">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-display font-semibold"><ImageIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />{L("Photos & diagrams", "Photos et schémas")}</h3><PhotoUpload tag={tag} onUploaded={load} /></div>
    {loading ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">{L("Loading photos…", "Chargement des photos…")}</p>
      : error ? <div role="alert" className="rounded-lg border border-border p-5 text-center"><p className="text-sm text-muted-foreground">{L("Photos unavailable. This does not mean no photos exist.", "Photos indisponibles. Cela ne signifie pas qu'il n'y a pas de photos.")}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}><RefreshCw className="h-4 w-4" />{L("Retry", "Réessayer")}</Button></div>
      : !images.length ? <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">{L("No photos attached to this equipment.", "Aucune photo jointe à cet équipement.")}</p>
      : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{images.map((image) => <div key={image.id} className="relative">
        <button onClick={() => setOpen(image)} className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted" aria-label={`${L("Open", "Ouvrir")} ${image.file_name ?? L("photo", "photo")}`}><img src={urlOf(image.file_path)} alt={image.file_name ?? L("Equipment photo", "Photo de l'équipement")} className="h-full w-full object-cover" loading="lazy" /></button>
        {user?.id === image.uploaded_by && <Button variant="secondary" size="icon" onClick={() => setDeleteTarget(image)} aria-label={`${L("Delete", "Supprimer")} ${image.file_name ?? L("photo", "photo")}`} className="absolute right-2 top-2 h-9 w-9 border border-border shadow-sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
      </div>)}</div>}
    <Dialog open={!!open} onOpenChange={(value) => { if (!value) setOpen(null); }}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{open?.file_name ?? L("Equipment photo", "Photo de l'équipement")}</DialogTitle><DialogDescription className="sr-only">{tag}</DialogDescription></DialogHeader>{open && <img src={urlOf(open.file_path)} alt={open.file_name ?? tag} className="max-h-[75dvh] w-full object-contain" />}</DialogContent></Dialog>
    <AlertDialog open={!!deleteTarget} onOpenChange={(value) => { if (!value && !deleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{L("Delete this photo?", "Supprimer cette photo ?")}</AlertDialogTitle><AlertDialogDescription>{L("This removes the attachment from the equipment record.", "Cette action retire la pièce jointe du dossier équipement.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>{L("Cancel", "Annuler")}</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void deleteImage(); }} className="bg-destructive text-destructive-foreground">{L("Delete", "Supprimer")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
