import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, ChevronUp, Clock, AlertTriangle, MoreVertical, Pencil, Trash2, CheckCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ScheduleItem, ScheduleStatus } from "@/types/alerts";
import { buildSchedule } from "@/lib/alertEngine";
import { differenceInDays, parseISO, format } from "date-fns";
import { useI18n } from "@/contexts/I18nContext";

interface ScheduleItemWithId extends ScheduleItem {
  id?: string;
}

export function TestScheduleWidget() {
  const [items, setItems] = useState<ScheduleItemWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNextDue, setEditNextDue] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t, lang } = useI18n();

  useEffect(() => {
    loadSchedule();
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      const schedule = await buildSchedule();
      const filtered = schedule.filter((item) => item.status !== "OK");
      setItems(filtered);
    } catch (err) {
      console.error("Failed to load schedule:", err);
    }
    setLoading(false);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "yyyy-MM-dd");
    } catch {
      return dateStr;
    }
  }

  function daysLeftText(days: number | null): string {
    if (days === null) return "";
    if (days < 0) return lang === "en" ? `(${Math.abs(days)}d overdue)` : `(${Math.abs(days)}j en retard)`;
    return lang === "en" ? `(${days}d)` : `(${days}j)`;
  }

  async function deleteTest(id: string, tag: string) {
    if (!confirm(lang === "en" ? `Delete test record for ${tag}?` : `Supprimer le dossier d'essai pour ${tag} ?`)) return;
    const { error } = await supabase
      .from("equipment_test_dates")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: lang === "en" ? "Delete failed" : "Échec de suppression", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast({ title: lang === "en" ? "Test deleted" : "Essai supprimé" });
    setMenuOpen(null);
  }

  async function closeTest(id: string) {
    const { error } = await supabase
      .from("equipment_test_dates")
      .update({ next_test_due: null, status: "COMPLETED" })
      .eq("id", id);
    if (error) {
      toast({ title: lang === "en" ? "Close failed" : "Échec de clôture", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast({ title: lang === "en" ? "Test marked as completed" : "Essai marqué comme terminé" });
    setMenuOpen(null);
  }

  function startEdit(item: ScheduleItemWithId) {
    setEditingId(item.id ?? null);
    setEditNextDue(item.next_due ?? "");
    setMenuOpen(null);
  }

  async function saveEdit(id: string) {
    if (!editNextDue) return;
    const { error } = await supabase
      .from("equipment_test_dates")
      .update({ next_test_due: editNextDue })
      .eq("id", id);
    if (error) {
      toast({ title: lang === "en" ? "Update failed" : "Échec de mise à jour", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: lang === "en" ? "Test updated" : "Essai mis à jour" });
    setEditingId(null);
    loadSchedule();
  }

  const statusConfig: Record<ScheduleStatus, { labelEn: string; labelFr: string; color: string; icon: typeof AlertTriangle }> = {
    OVERDUE: { labelEn: "Overdue", labelFr: "En Retard", color: "bg-red-600", icon: AlertTriangle },
    "DUE_SOON": { labelEn: "Due Soon", labelFr: "Bientôt Échu", color: "bg-amber-500", icon: Clock },
    OK: { labelEn: "OK", labelFr: "OK", color: "bg-emerald-500", icon: Clock },
  };

  return (
    <Card className="border-border bg-slate-900/50 backdrop-blur-sm shadow-xl rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 pt-6">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg font-display text-white">{t("testScheduleTitle")}</CardTitle>
          {!loading && items.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300 border border-slate-700">
              {items.length} {lang === "en" ? "requiring attention" : "requièrent attention"}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((e) => !e)}
          className="gap-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? (lang === "en" ? "Hide" : "Masquer") : (lang === "en" ? "Show" : "Afficher")}
        </Button>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-4 text-slate-400 text-sm font-mono">{t("loading")}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-sm font-mono bg-slate-950/50 border border-slate-800/80 rounded-xl p-6">
            {lang === "en" ? "No overdue or upcoming tests. All equipment is up to date." : "Aucun essai en retard ou à venir. Tout l'équipement est à jour."}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 mb-3">
              <Badge className="bg-red-600/20 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-full font-mono text-xs">
                {items.filter((i) => i.status === "OVERDUE").length} {lang === "en" ? "Overdue" : "En Retard"}
              </Badge>
              <Badge className="bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-full font-mono text-xs">
                {items.filter((i) => i.status === "DUE_SOON").length} {lang === "en" ? "Due Soon" : "Bientôt Échu"}
              </Badge>
            </div>

            {expanded && (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden">
                {items.map((item) => {
                  const cfg = statusConfig[item.status];
                  const Icon = cfg.icon;
                  const isEditing = editingId === item.id;

                  return (
                    <div
                      key={item.id ?? item.tag}
                      className="flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors relative"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <Icon className={`h-5 w-5 shrink-0 ${item.status === "OVERDUE" ? "text-rose-500" : "text-amber-500"}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{item.tag}</div>

                          {isEditing ? (
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                type="date"
                                value={editNextDue}
                                onChange={(e) => setEditNextDue(e.target.value)}
                                className="h-8 rounded-lg bg-slate-900 border border-slate-700 px-2 text-xs text-white"
                              />
                              <Button size="sm" className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg" onClick={() => item.id && saveEdit(item.id)}>{lang === "en" ? "Save" : "Enregistrer"}</Button>
                              <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-400 hover:text-white" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {lang === "en" ? "Next due:" : "Prochain essai :"} {formatDate(item.next_due)}
                              {item.days_left !== null && (
                                <span className={item.status === "OVERDUE" ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>
                                  {" "}{daysLeftText(item.days_left)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className={`${item.status === "OVERDUE" ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"} border text-[10px] font-mono px-2 py-0.5 rounded-full`}>
                          {lang === "en" ? cfg.labelEn : cfg.labelFr}
                        </Badge>

                        <div className="relative" ref={menuOpen === item.id ? menuRef : undefined}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                            onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id ?? null)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>

                          {menuOpen === item.id && (
                            <div className="absolute right-0 top-full mt-2 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[150px]">
                              <button
                                className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
                                onClick={() => startEdit(item)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-cyan-400" /> {lang === "en" ? "Edit" : "Modifier"}
                              </button>
                              <button
                                className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                                onClick={() => item.id && closeTest(item.id)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> {lang === "en" ? "Close" : "Clôturer"}
                              </button>
                              <div className="border-t border-slate-800 my-1" />
                              <button
                                className="w-full text-left px-4 py-2 text-xs hover:bg-rose-500/20 flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors"
                                onClick={() => item.id && deleteTest(item.id, item.tag)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> {lang === "en" ? "Delete" : "Supprimer"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!expanded && items.length > 0 && (
              <div className="text-xs text-slate-400 text-center py-2 font-mono">
                {lang === "en" ? `Click "Show" to view ${items.length} items` : `Cliquez sur "Afficher" pour voir ${items.length} éléments`}
              </div>
            )}

            <Button asChild variant="outline" size="sm" className="w-full mt-4 bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl py-4 font-mono transition-all">
              <Link to="/test-schedule">{lang === "en" ? "View Full Schedule →" : "Voir Tout le Calendrier →"}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
