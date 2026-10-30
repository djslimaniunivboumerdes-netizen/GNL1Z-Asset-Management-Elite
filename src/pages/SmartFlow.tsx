import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import { getCoordinate } from "@/utils/processFlowCoordinates";
import { DCS_PANELS, dcsImageUrl } from "@/data/dcs_panels";
import { MANUALS, driveDocViewUrl } from "@/data/manuals";
import {
  SECT, TAGS, INSTR, PFD_WIDTH, PFD_HEIGHT,
  type Section, type TagDef,
} from "@/data/smartFlow";
import {
  ZoomIn, ZoomOut, RotateCcw, X, Search,
  Layers, ExternalLink, BookOpen, Menu, Zap,
  Activity, Gauge, Thermometer, Database, Cpu, AlertTriangle, CheckCircle2, Sliders,
  Bell, BellRing, Sparkles, ShieldCheck, Play, Pause
} from "lucide-react";
import {
  pushAlarm, acknowledgeAlarm, subscribeAlarms, getActiveAlarms,
  type SimulatedAlarm
} from "@/lib/alarmStore";

/* ─── DEBUG MODE TOGGLE ─────────────────────────────────────────────────── */
const DEBUG_COORDINATES = false;

/** Zoom level used when the view is centred on a tag (search, alarm jump, deep link). */
const FOCUS_SCALE = 1.8;

/** True when a key press belongs to a text field rather than to the diagram. */
function isEditable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node || !node.tagName) return false;
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT" || node.isContentEditable;
}

export default function SmartProcessFlow() {
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  // ?tag=E501 — a supervisor can share a deep link straight to an asset.
  const [params, setParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selected,  setSelected]  = useState<TagDef | null>(null);
  const [filter,    setFilter]    = useState<Section | "all">("all");
  const [search,    setSearch]    = useState("");
  const [hovered,   setHovered]   = useState<string | null>(null);
  const [lightbox,  setLightbox]  = useState<{ url: string; title: string } | null>(null);
  const [scale,     setScale]     = useState(1);
  const [offset,    setOffset]    = useState({ x: 0, y: 0 });
  const [isMobile,  setIsMobile]  = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dashOpen,  setDashOpen]  = useState(false);
  const [simLoad,   setSimLoad]   = useState(100); // Process load %

  // Simulation master switch — freezes both the telemetry ticker and the
  // alarm generator so a trainer can hold a steady picture while explaining.
  const [simPaused, setSimPaused] = useState(false);

  // ── SIMULATED SAFETY ALARM ENGINE ─────────────────────────────────────────
  const [activeAlarms, setActiveAlarms] = useState<SimulatedAlarm[]>(getActiveAlarms());
  const [alarmPanelOpen, setAlarmPanelOpen] = useState(false);

  useEffect(() => subscribeAlarms(() => setActiveAlarms(getActiveAlarms())), []);

  // Higher process load + assets under DEROGATION status raise alarm probability —
  // ties the "what if" simLoad slider to a believable safety-instrumented-system feed.
  useEffect(() => {
    const alarmTemplates: { kind: string; kindFr: string; sev: "P1" | "P2" | "P3"; en: string; fr: string; actEn: string; actFr: string }[] = [
      { kind: "High Pressure", kindFr: "Haute Pression", sev: "P2",
        en: "Header pressure trending above the normal operating band.", fr: "Pression du collecteur au-dessus de la plage normale de marche.",
        actEn: "Verify PIC setpoint and check downstream relief/PSV status.", actFr: "Vérifier la consigne PIC et l'état de la soupape de sécurité en aval." },
      { kind: "High Temperature", kindFr: "Haute Température", sev: "P2",
        en: "Process temperature approaching the design ceiling.", fr: "Température de procédé proche de la limite de conception.",
        actEn: "Check cooling medium flow and verify TIC control loop response.", actFr: "Contrôler le débit du fluide de refroidissement et la boucle TIC." },
      { kind: "Level Deviation", kindFr: "Déviation de Niveau", sev: "P3",
        en: "Vessel level drifting outside the normal control band.", fr: "Niveau du ballon en dérive hors de la bande de contrôle normale.",
        actEn: "Inspect LIC transmitter calibration and downstream letdown valve.", actFr: "Inspecter l'étalonnage du transmetteur LIC et la vanne de détente aval." },
      { kind: "Vibration Alarm", sev: "P1", kindFr: "Alarme Vibration",
        en: "Elevated bearing vibration signature detected on rotating equipment.", fr: "Signature de vibration élevée détectée sur l'équipement tournant.",
        actEn: "Reduce load immediately and dispatch rotating-equipment specialist for inspection.", actFr: "Réduire immédiatement la charge et envoyer un spécialiste machines tournantes." },
      { kind: "DEROGATION Status", kindFr: "Statut DEROGATION", sev: "P3",
        en: "Asset operating under an active inspection derogation — monitor closely.", fr: "Équipement en fonctionnement sous dérogation d'inspection active — à surveiller.",
        actEn: "Confirm derogation expiry date and schedule the outstanding NDT/hydrotest.", actFr: "Vérifier la date d'échéance de la dérogation et planifier le CND/épreuve en attente." },
    ];

    const derogationTags = TAGS.filter(t => t.specs.Status === "DEROGATION");
    if (simPaused) return;

    const timer = setInterval(() => {
      // Base probability scales with process load; DEROGATION assets are 2x more likely to fire.
      const loadFactor = Math.max(0, (simLoad - 70) / 30); // 0 at 70%, 1 at 100%
      const chance = 0.12 + loadFactor * 0.35;
      if (Math.random() > chance) return;

      const useDerogation = derogationTags.length > 0 && Math.random() < 0.55;
      const pool = useDerogation ? derogationTags : TAGS;
      const tag = pool[Math.floor(Math.random() * pool.length)];
      const tpl = useDerogation
        ? alarmTemplates[4]
        : alarmTemplates[Math.floor(Math.random() * 4)];

      pushAlarm({
        id: `${tag.id}-${tpl.kind}-${Date.now()}`,
        tag: tag.id,
        dbTag: tag.dbTag,
        nameEn: tag.nameEn,
        nameFr: tag.nameFr,
        unit: tag.dbTag ? tag.dbTag.split("-")[0] : tag.section,
        instrument: `${tpl.kind.includes("Pressure") ? "PAH" : tpl.kind.includes("Temp") ? "TAH" : tpl.kind.includes("Level") ? "LAL" : tpl.kind.includes("Vibration") ? "VAH" : "STATUS"}-${tag.diag.replace(/[^0-9]/g, "").slice(0, 6) || "000"}`,
        kind: tpl.kind,
        kindFr: tpl.kindFr,
        severity: tpl.sev,
        descriptionEn: tpl.en,
        descriptionFr: tpl.fr,
        actionEn: tpl.actEn,
        actionFr: tpl.actFr,
        triggeredAt: Date.now(),
        acknowledged: false,
      });
    }, 9000);

    return () => clearInterval(timer);
  }, [simLoad, simPaused]);

  const dragStart  = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setViewportSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyZoom = useCallback((delta: number) => {
    setScale(s => Math.min(6, Math.max(0.3, s + delta)));
  }, []);
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(6, Math.max(0.3, s - e.deltaY * 0.001)));
  }, []);
  
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const clampOffset = useCallback((newOffset: { x: number; y: number }) => {
    const imgW = PFD_WIDTH;
    const imgH = PFD_HEIGHT;
    const containerW = viewportSize.w;
    const containerH = viewportSize.h;
    if (containerW === 0 || containerH === 0) return newOffset;

    const displayedW = imgW * scale;
    const displayedH = imgH * scale;
    const minVisible = 0.1;

    const maxX = (displayedW - containerW) * (1 - minVisible) + containerW * minVisible;
    const maxY = (displayedH - containerH) * (1 - minVisible) + containerH * minVisible;

    return {
      x: Math.max(-maxX, Math.min(maxX, newOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, newOffset.y)),
    };
  }, [scale, viewportSize]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(false);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const threshold = isMobile ? 12 : 4;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      setIsDragging(true);
    }
    setOffset(clampOffset({
      x: dragStart.current.ox + dx,
      y: dragStart.current.oy + dy,
    }));
  };
  
  const onPointerUp = () => {
    dragStart.current = null;
    setTimeout(() => setIsDragging(false), 0);
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      // Escape works everywhere, including from inside the search field.
      if (e.key === "Escape") { setSelected(null); setLightbox(null); return; }
      // Never hijack browser/OS combinations…
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // …and never steal a keystroke from the search box: the "0" shortcut used
      // to swallow the zeros of "101-E501", making tags unsearchable.
      if (isEditable(e.target)) return;

      if (e.key === "+" || e.key === "=") { e.preventDefault(); applyZoom(0.2); }
      if (e.key === "-") { e.preventDefault(); applyZoom(-0.2); }
      if (e.key === "0" || e.key === "f") { e.preventDefault(); resetView(); }
      if (e.key === "/") { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [applyZoom]);

  const sc = selected ? SECT[selected.section] : null;

  const visibleTags = useMemo(() => {
    return TAGS.filter(t => {
      const matchSection = filter === "all" || t.section === filter;
      const query = search.toLowerCase().trim();
      const matchSearch = !query || 
        t.diag.toLowerCase().includes(query) || 
        t.id.toLowerCase().includes(query) ||
        t.nameEn.toLowerCase().includes(query) ||
        t.nameFr.toLowerCase().includes(query);
      return matchSection && matchSearch;
    });
  }, [filter, search]);

  const coordMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    TAGS.forEach(t => {
      const coord = getCoordinate(t.diag) ?? { x: t.x, y: t.y };
      map.set(t.id, coord);
    });
    return map;
  }, []);

  /** Pan/zoom so a tag sits in the middle of the viewport — the missing half of
   *  search: without it a match can be sitting off-screen with no way to reach it. */
  const centerOn = useCallback((tag: TagDef) => {
    const coord = coordMap.get(tag.id) ?? { x: tag.x, y: tag.y };
    setScale(FOCUS_SCALE);
    setOffset(clampOffset({
      x: (50 - coord.x) / 100 * PFD_WIDTH * FOCUS_SCALE,
      y: (50 - coord.y) / 100 * PFD_HEIGHT * FOCUS_SCALE,
    }));
  }, [clampOffset, coordMap]);

  const selectTag = useCallback((tag: TagDef, options?: { center?: boolean }) => {
    setSelected(tag);
    if (options?.center) centerOn(tag);
  }, [centerOn]);

  // Deep link in: /flow?tag=E501 opens (and centres) that asset on load.
  useEffect(() => {
    const requested = params.get("tag");
    if (!requested || selected) return;
    const tag = TAGS.find(t => t.id.toLowerCase() === requested.toLowerCase()
      || t.diag.toLowerCase() === requested.toLowerCase());
    if (tag) selectTag(tag, { center: true });
  }, [params, selected, selectTag]);

  // Deep link out: keep the URL shareable as the operator moves around.
  useEffect(() => {
    const current = params.get("tag");
    const wanted = selected?.id ?? null;
    if (current === wanted) return;
    const next = new URLSearchParams(params);
    if (wanted) next.set("tag", wanted); else next.delete("tag");
    setParams(next, { replace: true });
  }, [selected, params, setParams]);

  const [dashSearch, setDashSearch] = useState("");
  const dashboardTags = useMemo(() => {
    if (!dashSearch.trim()) return TAGS;
    const q = dashSearch.toLowerCase();
    return TAGS.filter(t =>
      t.diag.toLowerCase().includes(q) ||
      t.nameEn.toLowerCase().includes(q) ||
      t.nameFr.toLowerCase().includes(q) ||
      t.section.toLowerCase().includes(q)
    );
  }, [dashSearch]);

  const jumpToAlarmTag = (alarmTag: string) => {
    const tag = TAGS.find(t => t.id === alarmTag);
    if (tag) {
      // Select AND bring it into view — otherwise the drawer opens on an asset
      // the operator still has to hunt for on a 1218 px diagram.
      selectTag(tag, { center: true });
      setAlarmPanelOpen(false);
      setDashOpen(false);
    }
  };

  // Top-bar search results: the overlays alone are not enough feedback — a hit
  // can be off-screen, so every match is also offered as a fly-to button.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    return TAGS.filter(t =>
      t.diag.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.nameEn.toLowerCase().includes(q) ||
      t.nameFr.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [search]);

  const sevStyle = (sev: SimulatedAlarm["severity"]) =>
    sev === "P1"
      ? { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/40" }
      : sev === "P2"
      ? { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" }
      : { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/40" };

  return (
    <div className="dark relative flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-white font-sans overflow-hidden select-none">
      
      {/* PREMIUM TOP SUPERVISORY BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 md:px-8 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl z-30 shadow-2xl">
        
        {/* Left Side: Navigation & Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => setDashOpen(prev => !prev)}
            className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              dashOpen ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/20" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-500/50"
            }`}
            aria-label={L("Equipment Drawer", "Tiroir des Équipements")}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Sliders className="h-5 w-5" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                {L("Smart Process Flow", "Schéma Intelligent")}
                <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono animate-pulse">
                  {L("SIMULATED TELEMETRY", "TÉLÉMESURE SIMULÉE")}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">AP-C3MR™ Liquefaction Diagram • Arzew LNG Complex</p>
            </div>
          </div>
        </div>

        <TelemetryBar simLoad={simLoad} paused={simPaused} lang={lang} />

        {/* Right Side: Simulation Ramping & Search */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-1.5 shadow-inner">
            <span className="text-[11px] font-mono text-slate-400">{L("Process Load:", "Charge Procédé:")}</span>
            <input
              type="range"
              min="50" max="100" value={simLoad}
              onChange={e => setSimLoad(Number(e.target.value))}
              aria-label={L("Process load percentage", "Pourcentage de charge procédé")}
              className="w-24 accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-cyan-400">{simLoad}%</span>
          </div>
          <div className="flex items-center gap-2">
          </div>

          <button
            onClick={() => setSimPaused(p => !p)}
            aria-pressed={simPaused}
            title={L(simPaused ? "Resume simulation" : "Pause simulation", simPaused ? "Reprendre la simulation" : "Mettre la simulation en pause")}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              simPaused ? "bg-amber-500/15 border-amber-500/50 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
            aria-label={L(simPaused ? "Resume simulation" : "Pause simulation", simPaused ? "Reprendre la simulation" : "Mettre la simulation en pause")}
          >
            {simPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          {/* SAFETY ALARM BELL — SIMULATED SIS FEED */}
          <button
            onClick={() => setAlarmPanelOpen(prev => !prev)}
            className={`relative p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              activeAlarms.length > 0
                ? "bg-rose-500/15 border-rose-500/60 text-rose-400 shadow-lg shadow-rose-500/20"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
            aria-label={L("Active Alarms", "Alarmes Actives")}
          >
            <span className="sr-only" role="status">
              {activeAlarms.length === 0
                ? L("No active alarms", "Aucune alarme active")
                : L(`${activeAlarms.length} active alarms`, `${activeAlarms.length} alarmes actives`)}
            </span>
            {activeAlarms.length > 0 ? <BellRing className="h-4 w-4 animate-pulse" /> : <Bell className="h-4 w-4" />}
            {activeAlarms.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-mono font-bold text-white border border-slate-900 shadow-md">
                {activeAlarms.length}
              </span>
            )}
          </button>

          <div className="relative w-48 md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label={L("Search equipment tags", "Rechercher des repères")}
              placeholder={L("Search tags, names...", "Rechercher repères...")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors font-mono"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label={L("Clear search", "Effacer la recherche")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Fly-to results: a match on a 1218 px diagram is useless if the
                operator has to pan around to find the highlighted overlay. */}
            {search.trim().length > 0 && (
              <div className="absolute top-full mt-2 right-0 w-72 bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden z-50">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] font-mono text-slate-500">
                    {L("No equipment matches this search.", "Aucun équipement ne correspond.")}
                  </p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {searchResults.map(t => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => { selectTag(t, { center: true }); setSearch(""); }}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-800/70 transition-colors"
                        >
                          <span className="font-mono text-[11px] font-bold" style={{ color: SECT[t.section].color }}>{t.diag}</span>
                          <span className="text-[11px] text-slate-300 truncate">{L(t.nameEn, t.nameFr)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIMULATED ALARM DROPDOWN PANEL */}
      {alarmPanelOpen && (
        <div className="absolute top-16 right-4 md:right-8 w-[340px] max-h-[420px] bg-slate-900/95 border border-slate-800 backdrop-blur-2xl rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-400" /> {L("Live Safety Alarms", "Alarmes Sécurité en Direct")}
            </span>
            <button onClick={() => setAlarmPanelOpen(false)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeAlarms.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                {L("No active alarms — plant nominal.", "Aucune alarme active — usine nominale.")}
              </div>
            ) : (
              activeAlarms.map(a => {
                const s = sevStyle(a.severity);
                return (
                  <div key={a.id} className={`p-3 rounded-xl border ${s.bg} ${s.border} space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text} border ${s.border}`}>{a.severity}</span>
                      <span className="text-[10px] font-mono text-slate-500">{new Date(a.triggeredAt).toLocaleTimeString()}</span>
                    </div>
                    <button onClick={() => jumpToAlarmTag(a.tag)} className={`text-xs font-mono font-bold ${s.text} hover:underline cursor-pointer`}>
                      {a.dbTag || a.tag} — {L(a.nameEn, a.nameFr)}
                    </button>
                    <p className="text-[11px] text-slate-300 font-light">{L(a.kind, a.kindFr)}: {L(a.descriptionEn, a.descriptionFr)}</p>
                    <p className="text-[10px] text-slate-400 italic">{L(a.actionEn, a.actionFr)}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-slate-500">{a.instrument}</span>
                      <button
                        onClick={() => acknowledgeAlarm(a.id)}
                        className="text-[10px] font-mono font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 cursor-pointer transition-all"
                      >
                        {L("ACKNOWLEDGE", "ACQUITTER")}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {activeAlarms.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60">
              <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-cyan-500" />
                {L("Ask the AI Expert: \"any active alarms?\"", "Demandez à l'Expert IA : « des alarmes actives ? »")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-HEADER: SECTION FILTERS & ZOOM CONTROLS */}
      <div className="flex items-center justify-between px-4 md:px-8 py-2 bg-slate-900/40 border-b border-slate-800 backdrop-blur-md z-20 shadow-lg text-xs font-mono">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {(["all", ...Object.keys(SECT)] as (Section | "all")[]).map(s => {
            const active = filter === s;
            const color  = s === "all" ? "#fff"         : SECT[s as Section].color;
            const bg     = s === "all" ? "rgba(255,255,255,0.1)" : SECT[s as Section].bg;
            const bord   = s === "all" ? "rgba(255,255,255,0.2)" : SECT[s as Section].border;
            const lbl    = s === "all" ? L("ALL UNITS", "TOUTES UNITÉS") : L(SECT[s as Section].en, SECT[s as Section].fr);
            return (
              <button key={s} onClick={() => setFilter(s)} aria-pressed={active}
                style={{
                  border: `1px solid ${active ? bord : "rgba(255,255,255,0.1)"}`,
                  background: active ? bg : "transparent",
                  color: active ? color : "rgba(255,255,255,0.4)",
                }}
                className="px-3.5 py-1.5 rounded-xl font-bold tracking-wider hover:border-slate-600 transition-all shrink-0 cursor-pointer shadow-sm"
              >
                {lbl}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button onClick={() => applyZoom(0.25)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => applyZoom(-0.25)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={resetView} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all shadow-sm">
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className="hidden sm:inline-block font-mono font-bold text-cyan-400 w-12 text-right">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* INTERACTIVE PROCESS VIEWPORT CANVAS */}
      <div className="flex-1 flex min-h-0 relative bg-slate-950 overflow-hidden" ref={viewportRef}>
        
        <div
          ref={wrapRef}
          className={`flex-1 relative overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-crosshair"} select-none`}
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => { if (!isDragging) setSelected(null); }}
        >
          <div style={{
            position:"absolute", inset:0,
            transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`,
            transformOrigin:"center center",
            transition: isDragging ? "none" : "transform 0.08s ease-out",
            display: "grid",
            placeItems: "center"
          }}>
            
            <div
              className="relative w-full aspect-[1218/934] shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-slate-800/80 rounded-3xl overflow-hidden bg-slate-900/40 backdrop-blur-sm"
              style={{ maxWidth: PFD_WIDTH }}
            >
              <img
                src="/pfd/gnl1z-pfd-labeled.png"
                alt="GNL1Z Labeled Process Flow Diagram"
                draggable={false}
                onError={e => {
                  if ((e.target as HTMLImageElement).src !== "/pfd/gnl1z-pfd.jpg") {
                    (e.target as HTMLImageElement).src = "/pfd/gnl1z-pfd.jpg";
                  }
                }}
                className="w-full h-full block filter brightness-90 contrast-110 object-contain pointer-events-none"
              />

              {/* VECTOR TAG OVERLAYS */}
              {visibleTags.map(t => {
                const isActive = selected?.id === t.id;
                const isHov    = hovered === t.id;
                const c        = SECT[t.section];
                const coord    = coordMap.get(t.id);
                if (!coord || coord.x === undefined || coord.y === undefined) return null;

                return (
                  <div 
                    key={t.id}
                    style={{
                      position: "absolute",
                      left: `${coord.x}%`,
                      top: `${coord.y}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: isActive ? 25 : isHov ? 20 : 10,
                    }}
                  >
                    <button
                      onMouseEnter={() => setHovered(t.id)}
                      onMouseLeave={() => setHovered(null)}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        setSelected(isActive ? null : t);
                      }}
                      aria-pressed={isActive}
                      aria-label={t.diag + ' – ' + L(t.nameEn, t.nameFr)}
                      style={{
                        border: `1px solid ${isActive || isHov ? c.border : "rgba(0,200,255,0.3)"}`,
                        background: isActive ? c.bg : isHov ? "rgba(0,200,255,0.12)" : "rgba(3,11,18,0.9)",
                        color: isActive || isHov ? c.color : "rgba(255,255,255,0.8)",
                        boxShadow: isActive ? `0 0 20px ${c.border}` : isHov ? "0 0 12px rgba(0,200,255,0.3)" : "none",
                        transform: `scale(${isActive ? 1.15 : isHov ? 1.08 : 1})`,
                      }}
                      className="font-mono text-[10px] md:text-xs font-bold whitespace-nowrap px-2.5 py-1 rounded-xl backdrop-blur-md transition-all duration-150 cursor-pointer shadow-lg"
                    >
                      {t.diag}
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* DESKTOP EQUIPMENT INSPECTION DRAWER */}
        {!isMobile && selected && sc && (
          <div data-testid="inspection-drawer" className="w-[420px] bg-slate-900/90 border-l border-slate-800 backdrop-blur-2xl flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/40">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold border" style={{ color: sc.color, borderColor: sc.border, backgroundColor: sc.bg }}>
                    {L(sc.en, sc.fr).toUpperCase()}
                  </span>
                  {selected.dbTag && (
                    <Link to={`/equipment/${selected.dbTag}`} className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-slate-800 border border-slate-700 text-cyan-400 hover:bg-slate-700 transition-colors flex items-center gap-1">
                      <Database className="h-3 w-3" /> {L("Master File", "Dossier")}
                    </Link>
                  )}
                </div>
                <span className="font-mono text-xs text-slate-400">{selected.diag}</span>
                <h2 className="text-2xl font-bold text-white tracking-tight mt-1">{L(selected.nameEn, selected.nameFr)}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <PanelContent tag={selected} lang={lang} onPreviewDcs={(title, url) => setLightbox({ url, title })} />
            </div>
          </div>
        )}

        {/* MOBILE BOTTOM SHEET */}
        {isMobile && selected && sc && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-2xl rounded-t-3xl z-40 max-h-[70vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-700"></div>
            </div>
            <div className="px-6 pb-4 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold">{selected.diag}</span>
                <h2 className="text-xl font-bold text-white tracking-tight">{L(selected.nameEn, selected.nameFr)}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <PanelContent tag={selected} lang={lang} onPreviewDcs={(title, url) => setLightbox({ url, title })} />
            </div>
          </div>
        )}
      </div>

      {/* DASHBOARD EQUIPMENT DRAWER */}
      {dashOpen && (
        <div data-testid="equipment-dashboard" className={`absolute top-0 left-0 bottom-0 ${isMobile ? "w-full" : "w-[360px]"} bg-slate-900/95 border-r border-slate-800 backdrop-blur-2xl z-50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200`}>
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Database className="h-5 w-5" />
              </div>
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                {L("Equipment Dashboard", "Tableau de Bord")}
              </span>
            </div>
            <button onClick={() => setDashOpen(false)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 border-b border-slate-800 bg-slate-950/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={dashSearch}
                onChange={e => setDashSearch(e.target.value)}
                placeholder={L("Search all equipment...", "Rechercher un équipement...")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(["treatment","dehydration","propane","liquefaction","fractionation","compressor"] as Section[]).map(section => {
              const tags = dashboardTags.filter(t => t.section === section);
              if (tags.length === 0) return null;
              const secColor = SECT[section].color;
              return (
                <div key={section} className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider pb-1 border-b border-slate-800" style={{ color: secColor }}>
                    {L(SECT[section].en, SECT[section].fr)}
                  </div>
                  <div className="space-y-1.5">
                    {tags.map(t => {
                      const isSelected = selected?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { selectTag(t, { center: true }); setDashOpen(false); }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-inner" : "bg-slate-950/40 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white"
                          }`}
                          onMouseEnter={() => setHovered(t.id)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          <span className="font-mono font-bold text-xs">{t.diag}</span>
                          <span className="text-xs font-light text-slate-400 truncate max-w-[60%]">
                            {L(t.nameEn, t.nameFr)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIGHTBOX FOR DCS SCREENSHOTS */}
      {lightbox && (
        <div 
          onClick={() => setLightbox(null)}
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-150"
        >
          <div className="relative max-w-[95vw] max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 md:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
              <span className="font-mono text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Cpu className="h-4 w-4" /> {lightbox.title}
              </span>
              <button onClick={() => setLightbox(null)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={lightbox.url} alt="DCS Console Screen" className="w-full max-h-[75vh] object-contain rounded-xl border border-slate-800" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Baseline plant values the simulator jitters around at 100 % load. */
const TELEMETRY_BASE = { feedFlow: 850, powerMCR: 42.3, powerC3: 28.5, mcheTemp: -162.4, c3Suction: 1.15, efficiency: 97.8 };

const TelemetryBar = memo(function TelemetryBar({ simLoad, paused, lang }: { simLoad: number; paused: boolean; lang: "en" | "fr" }) {
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [values, setValues] = useState(TELEMETRY_BASE);

  useEffect(() => {
    if (paused) return;
    const jitter = (base: number, spread: number, decimals: number) =>
      Number(((base * (simLoad / 100)) + (Math.random() * spread - spread / 2)).toFixed(decimals));
    const tick = () => setValues({
      feedFlow: Math.round((TELEMETRY_BASE.feedFlow * (simLoad / 100)) + (Math.random() * 10 - 5)),
      powerMCR: jitter(TELEMETRY_BASE.powerMCR, 0.6, 1),
      powerC3: jitter(TELEMETRY_BASE.powerC3, 0.4, 1),
      mcheTemp: Number((TELEMETRY_BASE.mcheTemp + (Math.random() * 0.2 - 0.1)).toFixed(1)),
      c3Suction: jitter(TELEMETRY_BASE.c3Suction, 0.04, 2),
      efficiency: jitter(TELEMETRY_BASE.efficiency, 0.4, 1),
    });
    tick();
    const timer = setInterval(tick, 2500);
    return () => clearInterval(timer);
  }, [simLoad, paused]);

  return (
    <div className="hidden lg:flex items-center gap-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl px-6 py-2 shadow-inner font-mono text-xs">
      <div className="flex items-center gap-2">
        <Activity className={`h-4 w-4 text-emerald-400 ${paused ? "" : "animate-pulse"}`} />
        <span className="text-slate-400">{L("Feed Flow:", "Alim:")}</span>
        <span className="text-emerald-400 font-bold">{values.feedFlow} MMSCFD</span>
      </div>
      <div className="w-px h-4 bg-slate-800" />
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-cyan-400" />
        <span className="text-slate-400">{L("MCR Power:", "MCR Puiss:")}</span>
        <span className="text-cyan-400 font-bold">{values.powerMCR} MW</span>
      </div>
      <div className="w-px h-4 bg-slate-800" />
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-amber-400" />
        <span className="text-slate-400">{L("C3 Power:", "C3 Puiss:")}</span>
        <span className="text-amber-400 font-bold">{values.powerC3} MW</span>
      </div>
      <div className="w-px h-4 bg-slate-800" />
      <div className="flex items-center gap-2">
        <Thermometer className="h-4 w-4 text-blue-400" />
        <span className="text-slate-400">{L("MCHE Cold End:", "MCHE Extrémité:")}</span>
        <span className="text-blue-400 font-bold">{values.mcheTemp} °C</span>
      </div>
    </div>
  );
});

function PanelContent({ tag, lang, onPreviewDcs }: { tag: TagDef; lang: "en" | "fr"; onPreviewDcs: (title: string, url: string) => void }) {
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;

  // Resolved from the shared catalogues (src/data/dcs_panels, src/data/manuals)
  // so a renamed panel or a rotated drive link is fixed in exactly one place.
  const filteredDcs = useMemo(
    () => DCS_PANELS.filter(d => tag.dcsPanels.includes(d.id)),
    [tag.dcsPanels],
  );
  const filteredManuals = useMemo(
    () => MANUALS.filter(m => tag.manuals.includes(m.id)),
    [tag.manuals],
  );
  const linkedInstruments = useMemo(() => {
    return [...new Set(tag.dcsPanels.flatMap(pid => INSTR[pid] ?? []))].slice(0, 24);
  }, [tag.dcsPanels]);

  const askAiExpert = () => {
    const prompt = lang === "fr"
      ? `Donne-moi l'analyse QA/QC, les tuyauteries/brides et l'état d'inspection de ${tag.dbTag ?? tag.diag} (${tag.nameFr}).`
      : `Give me the QA/QC analysis, piping/flange specs, and inspection status for ${tag.dbTag ?? tag.diag} (${tag.nameEn}).`;
    window.dispatchEvent(new CustomEvent("gnl1z:ask-ai", { detail: { prompt, equipmentTag: tag.dbTag ?? tag.diag } }));
  };

  return (
    <div className="space-y-6">
      {/* Ask AI Expert deep-link */}
      <button
        onClick={askAiExpert}
        className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 hover:from-cyan-600/30 hover:to-blue-600/30 hover:border-cyan-400/60 transition-all cursor-pointer shadow-inner font-mono text-xs font-bold"
      >
        <Sparkles className="h-4 w-4 text-cyan-400" />
        {L(`Ask AI Expert about ${tag.diag}`, `Demander à l'Expert IA sur ${tag.diag}`)}
      </button>

      {/* Description */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" /> {L("Equipment Description", "Description de l'Équipement")}
        </h4>
        <p className="text-sm leading-relaxed text-slate-200 font-light">{tag.descEn}</p>
      </div>

      {/* Simulated Dynamic Equipment Health / Telemetry */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner space-y-4">
        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400 animate-pulse" /> {L("Live Telemetry & Status", "Télémesure & Statut en Direct")}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-slate-400">{L("OPERATING FLUID", "FLUIDE OPÉRATOIRE")}</span>
            <span className="text-xs font-mono font-bold text-cyan-400 mt-1 truncate">
              {tag.section === "treatment" ? "Lean MEA / Gas" : tag.section === "dehydration" ? "Dry Gas" : tag.section === "propane" ? "Pure Propane" : "Mixed Refrig"}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-slate-400">{L("SYSTEM HEALTH", "SANTÉ DU SYSTÈME")}</span>
            <span className="text-xs font-mono font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% OPTIMAL
            </span>
          </div>
        </div>
      </div>

      {/* Specs table */}
      {Object.keys(tag.specs).length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" /> {L("Technical Details", "Détails Techniques")}
          </h4>
          <div className="divide-y divide-slate-800">
            {Object.entries(tag.specs).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center py-2 text-xs font-mono">
                <span className="text-slate-400">{key}</span>
                <span className={`font-bold ${key === "Status" && val === "DEROGATION" ? "text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full" : "text-white"}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DCS panels */}
      {filteredDcs.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" /> {L("Linked DCS Panels", "Écrans DCS Associés")} ({filteredDcs.length})
          </h4>
          <div className="grid grid-cols-1 gap-2.5">
            {filteredDcs.map(d => (
              <button
                key={d.id}
                onClick={() => onPreviewDcs(L(d.title_en, d.title_fr), dcsImageUrl(d.storage_path))}
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all flex items-center justify-between cursor-pointer group shadow-sm"
              >
                <span className="font-mono font-bold text-xs truncate mr-4 group-hover:text-white transition-colors">{L(d.title_en, d.title_fr)}</span>
                <ExternalLink className="h-4 w-4 text-cyan-500 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Telemetry tags */}
      {linkedInstruments.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" /> {L("Telemetry Tags", "Instruments de Télémesure")}
          </h4>
          <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-2">
            {linkedInstruments.map(ins => (
              <span key={ins} className="font-mono text-xs bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-xl shadow-inner hover:border-purple-500/60 transition-colors cursor-default">
                {ins}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manuals */}
      {filteredManuals.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" /> {L("Operational Manuals", "Manuels Opérationnels")}
          </h4>
          <div className="space-y-2.5">
            {filteredManuals.map(m => (
              <a
                key={m.id}
                href={driveDocViewUrl(m.drive_id)}
                target="_blank" rel="noopener noreferrer"
                className="w-full p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/20 transition-all flex items-center justify-between cursor-pointer group shadow-sm text-xs font-mono font-bold"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="truncate group-hover:text-white transition-colors">{L(m.title_en, m.title_fr)}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-amber-500 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
