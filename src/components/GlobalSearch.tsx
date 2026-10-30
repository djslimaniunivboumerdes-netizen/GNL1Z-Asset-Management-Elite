import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Database, CalendarClock, ShieldAlert, Cpu, BookOpen, FileText, Gauge } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { EQUIPMENT } from "@/data";
import { searchInstruments } from "@/lib/instrumentIndex";
import { describeInstrument } from "@/lib/instrumentTags";
import { useI18n } from "@/contexts/I18nContext";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const results = useMemo(() => {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return EQUIPMENT.filter((eq) => {
      const text = `${eq.tag} ${eq.name} ${eq.name_en ?? ""} ${eq.name_fr ?? ""} ${eq.unit} ${eq.section}`.toLocaleLowerCase();
      return words.every((word) => text.includes(word));
    }).slice(0, 10);
  }, [query]);
  // Operators recognise a tag on a screen long before they know the equipment —
  // let the palette resolve the tag itself.
  const instrumentHits = useMemo(() => {
    const needle = query.trim();
    if (needle.length < 2) return [];
    // A bare equipment tag is already covered by the equipment group.
    if (/^[a-z]{1,2}-?\d{3}(-[a-z]+)?$/i.test(needle)) return [];
    return searchInstruments({ q: needle, limit: 6 });
  }, [query]);
  const go = (path: string) => { setOpen(false); setQuery(""); navigate(path); };
  const pages = [
    { key: "equipment", path: "/equipment", icon: Database },
    { key: "testSchedule", path: "/test-schedule", icon: CalendarClock },
    { key: "fastAlerts", path: "/alerts", icon: ShieldAlert },
    { key: "dcs", path: "/dcs", icon: Cpu },
    { key: "pidLibrary", path: "/pids", icon: FileText },
    { key: "instruments", path: "/instruments", icon: Gauge },
    { key: "manuals", path: "/manuals", icon: BookOpen },
  ];
  const visiblePages = pages.filter((page) => `${t(page.key)} ${page.key} ${page.path}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <Button variant="outline" onClick={() => setOpen(true)} aria-label={L("Search equipment and pages", "Rechercher équipements et pages")} title="Ctrl / ⌘ K" className="h-9 w-9 shrink-0 rounded-lg px-0 lg:w-44 lg:justify-start lg:px-3"><Search className="h-4 w-4" /><span className="hidden lg:inline text-xs font-normal text-muted-foreground">{t("search")}</span><kbd className="ml-auto hidden text-[10px] text-muted-foreground lg:inline">⌘ K</kbd></Button>
    <CommandDialog shouldFilter={false} open={open} onOpenChange={setOpen} title={L("Search workspace", "Rechercher dans l'espace de travail")} description={L("Find equipment by tag, name or unit.", "Rechercher par tag, nom ou unité.")}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t("searchEquipment")} />
      <CommandList>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        <CommandGroup heading={t("equipment")}>
          {results.map((eq) => <CommandItem key={eq.tag} value={eq.tag} onSelect={() => go(`/equipment/${encodeURIComponent(eq.tag)}`)}><Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><div className="min-w-0"><span className="font-mono text-xs font-semibold">{eq.tag}</span><span className="ml-2 text-xs text-muted-foreground">{eq.name}</span></div><span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{eq.unit}</span></CommandItem>)}
        </CommandGroup>
        {instrumentHits.length > 0 && (
          <CommandGroup heading={t("instruments")}>
            {instrumentHits.map((hit) => <CommandItem key={hit.tag} value={`instr-${hit.tag}`} onSelect={() => go(`/instruments?q=${encodeURIComponent(hit.tag)}`)}><Gauge className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><div className="min-w-0"><span className="font-mono text-xs font-semibold">{hit.tag}</span><span className="ml-2 text-xs text-muted-foreground">{describeInstrument(hit.parsed, lang)}</span></div><span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{hit.unit?.en ?? hit.parsed.unitCode ?? ""}</span></CommandItem>)}
          </CommandGroup>
        )}
        <CommandGroup heading={t("modules")}>{visiblePages.map((page) => <CommandItem key={page.key} value={`page-${page.key}`} onSelect={() => go(page.path)}><page.icon className="h-4 w-4" />{t(page.key)}</CommandItem>)}</CommandGroup>
      </CommandList>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{L("Enter to open · Escape to close", "Entrée pour ouvrir · Échap pour fermer")}</div>
    </CommandDialog>
  </>;
}
