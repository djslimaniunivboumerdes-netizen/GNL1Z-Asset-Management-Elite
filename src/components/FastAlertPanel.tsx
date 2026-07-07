import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { EQUIPMENT } from "@/data";

type Priority = 1 | 2 | 3;

interface FastAlertRow {
  id: string;
  priority: Priority;
  train: string;
  other_place: string | null;
  equipment_tag: string;
  description: string;
  created_at: string;
}

interface FastAlertPhotoRow {
  id: string;
  alert_id: string;
  file_path: string;
  file_name: string | null;
  created_at: string;
}

const TRAIN_OPTIONS = ["T100", "T200", "T300", "T400", "T500", "T600", "Other"] as const;
const BUCKET = "fast-alert-photos";

function priorityStyle(priority: Priority) {
  if (priority === 1) {
    return "border-red-500/60 bg-red-500/10 shadow-[0_0_18px_rgba(239,68,68,0.35)]";
  }
  if (priority === 2) {
    return "border-orange-500/60 bg-orange-500/10 shadow-[0_0_18px_rgba(249,115,22,0.28)]";
  }
  return "border-yellow-500/60 bg-yellow-500/10 shadow-[0_0_18px_rgba(234,179,8,0.22)]";
}

function priorityLabel(priority: Priority) {
  if (priority === 1) return "Priority 01";
  if (priority === 2) return "Priority 02";
  return "Priority 03";
}

export function FastAlertPanel() {
  const [alerts, setAlerts] = useState<FastAlertRow[]>([]);
  const [photos, setPhotos] = useState<FastAlertPhotoRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [priority, setPriority] = useState<Priority>(1);
  const [train, setTrain] = useState("T100");
  const [otherPlace, setOtherPlace] = useState("");
  const [equipmentTag, setEquipmentTag] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const load = async () => {
    const [{ data: alertsData, error: alertsError }, { data: photosData, error: photosError }] =
      await Promise.all([
        supabase
          .from("fast_alerts")
          .select("id, priority, train, other_place, equipment_tag, description, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("fast_alert_photos")
          .select("id, alert_id, file_path, file_name, created_at")
          .order("created_at", { ascending: false }),
      ]);

    if (alertsError) {
      console.error(alertsError.message);
      return;
    }

    if (photosError) {
      console.error(photosError.message);
      return;
    }

    setAlerts((alertsData as FastAlertRow[]) ?? []);
    setPhotos((photosData as FastAlertPhotoRow[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const photosByAlert = useMemo(() => {
    const map: Record<string, FastAlertPhotoRow[]> = {};
    for (const p of photos) {
      if (!map[p.alert_id]) map[p.alert_id] = [];
      map[p.alert_id].push(p);
    }
    return map;
  }, [photos]);

  const submit = async () => {
    if (!description.trim()) {
      toast({
        title: "Missing description",
        description: "Please add a short description.",
        variant: "destructive",
      });
      return;
    }

    if (!equipmentTag.trim()) {
      toast({
        title: "Missing equipment",
        description: "Please select or enter the equipment tag.",
        variant: "destructive",
      });
      return;
    }

    if (train === "Other" && !otherPlace.trim()) {
      toast({
        title: "Missing place",
        description: "Please describe the other place.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { data: alertRow, error: alertError } = await supabase
        .from("fast_alerts")
        .insert({
          priority,
          train,
          other_place: train === "Other" ? otherPlace.trim() : null,
          equipment_tag: equipmentTag.trim(),
          description: description.trim(),
        })
        .select("id")
        .single();

      if (alertError) throw alertError;

      if (files.length > 0) {
        const photoRows: Array<{
          alert_id: string;
          file_path: string;
          file_name: string;
        }> = [];

        for (const file of files) {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const filePath = `${alertRow.id}/${Date.now()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          photoRows.push({
            alert_id: alertRow.id,
            file_path: filePath,
            file_name: file.name,
          });
        }

        const { error: photoInsertError } = await supabase
          .from("fast_alert_photos")
          .insert(photoRows);

        if (photoInsertError) throw photoInsertError;
      }

      setPriority(1);
      setTrain("T100");
      setOtherPlace("");
      setEquipmentTag("");
      setDescription("");
      setFiles([]);

      toast({ title: "Alert submitted" });
      await load();
    } catch (err: any) {
      toast({
        title: "Submit failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="px-4 md:px-10 pb-4 max-w-7xl mx-auto">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="border border-border rounded-lg bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <h2 className="text-sm uppercase tracking-widest font-mono text-muted-foreground">
              Fast alert / accident or near miss
            </h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  onClick={() => setPriority(p as Priority)}
                  className={`justify-center border-2 ${
                    priority === p
                      ? p === 1
                        ? "border-red-500 text-red-500"
                        : p === 2
                        ? "border-orange-500 text-orange-500"
                        : "border-yellow-500 text-yellow-600"
                      : ""
                  }`}
                >
                  {priorityLabel(p as Priority)}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                  Train
                </div>
                <select
                  value={train}
                  onChange={(e) => setTrain(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TRAIN_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                  Equipment
                </div>
                <Input
                  list="equipment-tags"
                  value={equipmentTag}
                  onChange={(e) => setEquipmentTag(e.target.value)}
                  placeholder="Equipment tag"
                />
                <datalist id="equipment-tags">
                  {EQUIPMENT.map((eq) => (
                    <option key={eq.tag} value={eq.tag} />
                  ))}
                </datalist>
              </div>
            </div>

            {train === "Other" && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                  Other place
                </div>
                <Input
                  value={otherPlace}
                  onChange={(e) => setOtherPlace(e.target.value)}
                  placeholder="Describe the location"
                />
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Description
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the abnormal condition, danger, or near miss..."
                className="min-h-[110px]"
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-2">
                <Camera className="h-3.5 w-3.5" />
                Photos
              </div>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {files.length} photo(s) selected
                </div>
              )}
            </div>

            <div className="pt-1">
              <Button
                onClick={submit}
                disabled={saving}
                className={`w-full gap-2 ${
                  priority === 1
                    ? "bg-red-600 hover:bg-red-700"
                    : priority === 2
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-yellow-500 hover:bg-yellow-600 text-black"
                }`}
              >
                <Plus className="h-4 w-4" />
                {saving ? "Submitting..." : "Submit fast alert"}
              </Button>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm uppercase tracking-widest font-mono text-muted-foreground">
              Recent alerts
            </h3>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">
                No alerts yet.
              </div>
            ) : (
              alerts.map((a) => {
                const alertPhotos = photosByAlert[a.id] ?? [];
                const glow = priorityStyle(a.priority);

                return (
                  <div
                    key={a.id}
                    className={`border rounded-lg p-4 transition ${glow}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={
                              a.priority === 1
                                ? "bg-red-600 text-white"
                                : a.priority === 2
                                ? "bg-orange-500 text-white"
                                : "bg-yellow-400 text-black"
                            }
                          >
                            {priorityLabel(a.priority)}
                          </Badge>

                          <Badge variant="outline" className="font-mono">
                            {a.train}
                          </Badge>

                          {a.other_place && (
                            <Badge variant="outline">{a.other_place}</Badge>
                          )}
                        </div>

                        <div className="mt-2">
                          <Link
                            to={`/equipment/${encodeURIComponent(a.equipment_tag)}`}
                            className="font-mono font-semibold text-accent hover:underline"
                          >
                            {a.equipment_tag}
                          </Link>
                        </div>

                        <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">
                          {a.description}
                        </p>

                        <div className="mt-2 text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {alertPhotos.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {alertPhotos.slice(0, 3).map((p) => (
                          <a
                            key={p.id}
                            href={supabase.storage.from(BUCKET).getPublicUrl(p.file_path).data.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square overflow-hidden rounded border border-border bg-secondary"
                          >
                            <img
                              src={supabase.storage.from(BUCKET).getPublicUrl(p.file_path).data.publicUrl}
                              alt={p.file_name ?? ""}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
