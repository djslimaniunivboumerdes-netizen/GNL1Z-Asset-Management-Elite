import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Fuse from "fuse.js";
import { Search, Download, ArrowRight, Filter, Box } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EQUIPMENT, UNITS, STATUSES, type Equipment } from "@/data";
import { exportToCsv } from "@/lib/industrial";
import { useI18n } from "@/contexts/I18nContext";

const PAGE_SIZE = 50;

export default function EquipmentList() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Expanded Fuse setup to look deep inside spare parts, materials, and specs
  const fuse = useMemo(
    () => new Fuse(EQUIPMENT, {
      threshold: 0.35,
      keys: [
        "tag", 
        "name", 
        "name_en", 
        "name_fr", 
        "unit", 
        "section", 
        "area", 
        "type.name", 
        "notes",
        "technical.serial_no", 
        "technical.pressure_bar", 
        "technical.weight_kg", 
        "technical.volume_m3",
        "spare_parts.items.code", 
        "spare_parts.items.description", 
        "spare_parts.items.reference", 
        "spare_parts.items.category", 
        "spare_parts.items.material", 
        "spare_parts.items.size_nominal", 
        "spare_parts.items.stock_location"
      ],
    }),
    []
  );

  const filtered = useMemo(() => {
    let list: Equipment[] = EQUIPMENT;
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      // Combine Fuse search results with deep JSON string matching for perfect recall
      const fuseResults = fuse.search(q).map((r) => r.item);
      const deepResults = EQUIPMENT.filter(e => JSON.stringify(e).toLowerCase().includes(q));
      list = [...new Set([...fuseResults, ...deepResults])];
    }
    if (unit !== "all") list = list.filter((e) => e.unit === unit);
    if (status !== "all") list = list.filter((e) => e.testing_status === status);
    return list;
  }, [query, unit, status, fuse]);

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const handleExport = () => {
    exportToCsv("gnl1z_equipment.csv", filtered.map((e) => ({
      tag: e.tag, name: e.name, type: e.type.name, unit: e.unit, section: e.section,
      status: e.testing_status, weight_kg: e.technical.weight_kg, pressure_bar: e.technical.pressure_bar,
      volume_m3: e.technical.volume_m3, serial_no: e.technical.serial_no,
      parts_count: e.spare_parts.count, notes: e.notes ?? "",
    })));
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-mono mb-1">/ {t("equipment")}</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">{t("equipment")}</h1>
          <p className="text-sm text-slate-400 mt-1 font-light">
            {filtered.length} / {EQUIPMENT.length} {lang === "en" ? "equipment items" : "équipements"}
          </p>
        </div>
        <Button onClick={handleExport} className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 self-start rounded-xl py-5 shadow-lg shadow-cyan-600/20 font-mono text-xs">
          <Download className="h-4 w-4" /> {t("exportCsv")}
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 bg-slate-900/20 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("searchEquipment")}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            className="pl-10 h-11 bg-slate-950 border-slate-800 text-white rounded-xl font-mono text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <Select value={unit} onValueChange={(v) => { setUnit(v); setPage(0); }}>
          <SelectTrigger className="h-11 md:w-44 bg-slate-950 border-slate-800 text-white rounded-xl font-mono text-xs"><Filter className="h-4 w-4 mr-1.5 text-cyan-500" /><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl font-mono text-xs">
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="h-11 md:w-48 bg-slate-950 border-slate-800 text-white rounded-xl font-mono text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl font-mono text-xs">
            <SelectItem value="all">{t("filterStatus")}</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table - desktop */}
      <div className="hidden md:block border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50 shadow-2xl backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
            <tr>
              <th className="text-left px-6 py-4 font-bold">{t("tag")}</th>
              <th className="text-left px-6 py-4 font-bold">{t("name")}</th>
              <th className="text-left px-6 py-4 font-bold">{t("type")}</th>
              <th className="text-left px-6 py-4 font-bold">{t("unit")}</th>
              <th className="text-left px-6 py-4 font-bold">{t("section")}</th>
              <th className="text-left px-6 py-4 font-bold">{t("status")}</th>
              <th className="text-right px-6 py-4 font-bold">{t("parts")}</th>
              <th className="px-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/20">
            {pageItems.map((e) => {
              // Highlight if query matched deep inside a spare part
              const matchedPart = query.trim() && e.spare_parts?.items?.some(p => JSON.stringify(p).toLowerCase().includes(query.toLowerCase().trim()));

              return (
                <tr key={e.tag} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-cyan-400">{e.tag}</td>
                  <td className="px-6 py-4 max-w-[320px]">
                    <div className="text-white font-medium truncate">{e.name}</div>
                    {matchedPart && (
                      <span className="inline-flex items-center gap-1 mt-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-mono animate-pulse">
                        <Box className="h-3 w-3" /> {lang === "en" ? "Matching Component" : "Pièce Correspondante"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-light">{e.type.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-300">{e.unit}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-mono">{e.section}</td>
                  <td className="px-6 py-4"><StatusChip status={e.testing_status} /></td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-300">{e.spare_parts.count}</td>
                  <td className="px-4 py-4">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl">
                      <Link to={`/equipment/${encodeURIComponent(e.tag)}`}><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-400 font-mono text-sm">{lang === "en" ? "No equipment found matching your filters." : "Aucun équipement trouvé pour ces filtres."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards - mobile */}
      <div className="md:hidden space-y-4">
        {pageItems.map((e) => {
          const matchedPart = query.trim() && e.spare_parts?.items?.some(p => JSON.stringify(p).toLowerCase().includes(query.toLowerCase().trim()));

          return (
            <Link key={e.tag} to={`/equipment/${encodeURIComponent(e.tag)}`}
              className="block border border-slate-800 rounded-2xl bg-slate-900/50 p-5 backdrop-blur-sm shadow-xl active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-sm font-bold text-cyan-400">{e.tag}</div>
                <StatusChip status={e.testing_status} />
              </div>
              <div className="text-sm font-bold text-white mt-2 line-clamp-2">{e.name}</div>
              {matchedPart && (
                <span className="inline-flex items-center gap-1 mt-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-0.5 rounded-full text-[10px] font-mono">
                  <Box className="h-3 w-3" /> {lang === "en" ? "Matching Component" : "Pièce Correspondante"}
                </span>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-3 font-mono">
                <span>{e.unit}</span>
                <span>·</span>
                <span>{e.section}</span>
                <span className="ml-auto font-bold text-slate-200">{e.spare_parts.count} {lang === "en" ? "parts" : "pièces"}</span>
              </div>
            </Link>
          );
        })}
        {pageItems.length === 0 && <div className="text-center text-slate-400 py-12 font-mono text-sm">{lang === "en" ? "No equipment found matching your filters." : "Aucun équipement trouvé pour ces filtres."}</div>}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm font-mono text-slate-400">
          <span>Page {page + 1} / {pageCount}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white rounded-xl px-4">{lang === "en" ? "Prev" : "Précédent"}</Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white rounded-xl px-4">{lang === "en" ? "Next" : "Suivant"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const variant = status === "DEROGATION" ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
    : status === "PREVENTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return <Badge variant="outline" className={`font-mono text-[10px] px-2.5 py-1 rounded-full ${variant}`}>{status}</Badge>;
}
