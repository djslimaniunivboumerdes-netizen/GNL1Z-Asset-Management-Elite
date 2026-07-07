import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhotoUpload } from "./PhotoUpload";
import { toast } from "@/hooks/use-toast";

interface ImageRow {
  id: string;
  file_path: string;
  file_name: string | null;
}

const BUCKET = "equipment-photos";

export function ImageGallery({ tag }: { tag: string }) {
  const [imgs, setImgs] = useState<ImageRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("equipment_images")
      .select("id, file_path, file_name")
      .eq("tag", tag)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setImgs((data as ImageRow[]) ?? []);
  }, [tag]);

  useEffect(() => {
    void load();
  }, [load]);

  const urlOf = (path: string) =>
    supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const deleteImage = async (image: ImageRow) => {
    if (!confirm("Delete this image?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([image.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("equipment_images")
        .delete()
        .eq("id", image.id);

      if (dbError) throw dbError;

      await load();

      toast({
        title: "Image deleted",
      });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card p-5">

      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="h-4 w-4 text-accent" />
        <h3 className="font-display font-semibold">
          Photos & Diagrams
        </h3>

        <div className="ml-auto">
          <PhotoUpload tag={tag} onUploaded={load} />
        </div>
      </div>

      {imgs.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded">
          No photos yet — upload one from your phone camera.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {imgs.map((i) => (
            <div
              key={i.id}
              className="relative group"
            >
              <button
                onClick={() => setOpen(urlOf(i.file_path))}
                className="aspect-square rounded overflow-hidden border border-border bg-secondary hover:ring-2 hover:ring-accent transition w-full"
              >
                <img
                  src={urlOf(i.file_path)}
                  alt={i.file_name ?? ""}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteImage(i);
                }}
                className="absolute top-1 right-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <button
            className="absolute top-4 right-4 text-white"
            onClick={() => setOpen(null)}
          >
            <X className="h-6 w-6" />
          </button>

          <img
            src={open}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
