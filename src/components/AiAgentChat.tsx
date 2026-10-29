import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowDown, BookOpen, Check, Copy, Cpu, Database, ExternalLink, FileImage, FileSpreadsheet, Loader2, MessageSquare, Paperclip, RotateCcw, Send, ShieldCheck, Sparkles, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/MarkdownText";
import {
  ASSISTANT_MAX_PROMPT,
  ASSISTANT_NAME,
  assistantHistory,
  buildAssistantContext,
  clearAssistantSession,
  followUpPrompts,
  loadAssistantSession,
  saveAssistantSession,
  selectRelevantEquipment,
  type AssistantMessage,
  type AssistantMode,
  type AssistantSource,
} from "@/lib/assistant";
import { parseLineListCsv, queryLineList, type LineListDataset } from "@/lib/lineListCsv";
import { detectIntent, resolvePrompt } from "@/lib/assistantKnowledge";

const REQUEST_TIMEOUT_MS = 25_000;
const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function modeLabel(mode: AssistantMode | undefined, lang: "en" | "fr"): string {
  if (mode === "ai") return lang === "fr" ? "Assisté par IA" : "AI-assisted";
  if (mode === "cache") return lang === "fr" ? "Réponse en cache" : "Cached answer";
  return lang === "fr" ? "Référence statique" : "Static reference";
}

function SourceCards({ sources, lang, onNavigate }: { sources: AssistantSource[]; lang: "en" | "fr"; onNavigate: () => void }) {
  if (!sources.length) return null;
  const icon = (kind: AssistantSource["kind"]) => kind === "manual" ? <BookOpen className="h-3.5 w-3.5" /> : kind === "simulation" ? <AlertTriangle className="h-3.5 w-3.5" /> : kind === "dcs" ? <Cpu className="h-3.5 w-3.5" /> : kind === "pid" ? <FileImage className="h-3.5 w-3.5" /> : kind === "csv" ? <FileSpreadsheet className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{lang === "fr" ? "Références fournies" : "Supplied references"}</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const content = <>{icon(source.kind)}<span className="max-w-[220px] truncate">{source.title}</span>{source.href ? <ExternalLink className="h-3 w-3 opacity-60" /> : null}</>;
          const className = "inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2 py-1 text-[11px] font-mono text-cyan-700 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10 dark:text-cyan-300";
          const key = `${source.kind}-${source.id}`;
          const staticFile = source.href && (source.href.startsWith("/pids/") || source.href.startsWith("/data/"));
          if (source.href && staticFile) return <a key={key} href={source.href} target="_blank" rel="noopener noreferrer" className={className} title={source.detail ?? source.title}>{content}</a>;
          return source.href
            ? <Link key={key} to={source.href} onClick={onNavigate} className={className} title={source.detail ?? source.title}>{content}</Link>
            : <span key={key} className={className} title={source.detail ?? source.title}>{content}</span>;
        })}
      </div>
    </div>
  );
}

export function AiAgentChat() {
  const { lang, t } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => loadAssistantSession());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextTag, setContextTag] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [lineList, setLineList] = useState<LineListDataset | null>(null);
  const [attaching, setAttaching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(messages);
  const busyRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<(prompt: string, options?: { retryId?: string; equipmentTag?: string | null }) => void>(() => {});
  const fr = lang === "fr";
  const L = useCallback((en: string, french: string) => fr ? french : en, [fr]);

  useEffect(() => { messagesRef.current = messages; saveAssistantSession(messages); }, [messages]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => {
    const match = location.pathname.match(/^\/equipment\/([^/]+)/);
    setContextTag(match ? decodeURIComponent(match[1]) : null);
  }, [location.pathname]);
  useEffect(() => () => { controllerRef.current?.abort(); if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (el) {
      if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior });
      else el.scrollTop = el.scrollHeight;
    }
    setShowJump(false);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom || busy) scrollToLatest();
    else setShowJump(true);
  }, [messages, busy, scrollToLatest]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { inputRef.current?.focus(); scrollToLatest("auto"); }, 60);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); launcherRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [open, scrollToLatest]);

  const send = useCallback(async (raw: string, options?: { retryId?: string; equipmentTag?: string | null }) => {
    const prompt = raw.trim().slice(0, ASSISTANT_MAX_PROMPT);
    if (!prompt || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFollowUps([]);
    const now = new Date().toISOString();
    const assistantId = options?.retryId ?? newId();
    const pending: AssistantMessage = { id: assistantId, role: "assistant", text: "", createdAt: now, status: "loading", prompt };
    if (options?.retryId) {
      setMessages((prev) => prev.map((message) => message.id === options.retryId ? { ...message, text: "", status: "loading", prompt, createdAt: now } : message));
    } else {
      const user: AssistantMessage = { id: newId(), role: "user", text: prompt, createdAt: now, status: "complete" };
      setMessages((prev) => [...prev, user, pending].slice(-40));
    }
    setInput("");
    const controller = new AbortController();
    controllerRef.current = controller;
    timeoutRef.current = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const started = performance.now();
    try {
      const [{ EQUIPMENT }, { DCS_PANELS }, { MANUALS }, { getActiveAlarms }] = await Promise.all([
        import("@/data"), import("@/data/dcs_panels"), import("@/data/manuals"), import("@/lib/alarmStore"),
      ]);
      const explicitTag = options?.equipmentTag ?? contextTag;
      const resolution = resolvePrompt(prompt, explicitTag);
      const resolvedRecord = resolution.status === "resolved" ? resolution.matches[0]?.record : null;
      const tag = resolvedRecord?.tag ?? explicitTag ?? selectRelevantEquipment(prompt, EQUIPMENT, explicitTag)[0]?.tag ?? null;
      const contextData = buildAssistantContext({ prompt, lang, equipment: EQUIPMENT, panels: DCS_PANELS, manuals: MANUALS, alarms: getActiveAlarms(), currentTag: tag });
      const history = assistantHistory(messagesRef.current.filter((message) => message.id !== assistantId), 6);
      const intent = detectIntent(prompt);

      // Only matching line-list rows leave the browser; the raw CSV is not uploaded.
      let lineListPayload: { fileName: string; rows: LineListDataset["rows"]; warnings: string[] } | null = null;
      if (lineList && resolvedRecord) {
        const result = queryLineList(lineList, resolvedRecord.tag, (candidate) => {
          const candidateResolution = resolvePrompt(candidate);
          return candidateResolution.status === "resolved" && candidateResolution.matches.some((match) => match.record.tag === resolvedRecord.tag);
        });
        lineListPayload = { fileName: lineList.fileName, rows: result.matchedRows.slice(0, 200), warnings: result.warnings };
      }

      // Retrieve manual text only when relevant; failures degrade to title references.
      let manualEvidence: Array<{ id: string; title: string; snippets: string[] }> = [];
      const manualIds = resolvedRecord && "manualIds" in resolvedRecord ? resolvedRecord.manualIds : [];
      if ((intent === "manual" || intent === "equipment") && manualIds.length) {
        const selectedManuals = MANUALS.filter((manual) => manualIds.includes(manual.id)).slice(0, 5);
        if (selectedManuals.length) {
          try {
            const manualController = new AbortController();
            const manualTimeout = setTimeout(() => manualController.abort(), 8000);
            const abortWithParent = () => manualController.abort();
            controller.signal.addEventListener("abort", abortWithParent);
            const manualResponse = await fetch("/api/search-manual", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: resolution.status === "resolved" ? resolution.matches[0].alias : prompt.slice(0, 200), manuals: selectedManuals.map((manual) => ({ id: manual.id, title: lang === "fr" ? manual.title_fr : manual.title_en, driveId: manual.drive_id })) }),
              signal: manualController.signal,
            });
            clearTimeout(manualTimeout);
            controller.signal.removeEventListener("abort", abortWithParent);
            if (manualResponse.ok) {
              const manualData = await manualResponse.json() as { results?: Array<{ id: string; title: string; snippets: string[] }> };
              manualEvidence = (manualData.results ?? []).slice(0, 3).map((hit) => ({ id: hit.id, title: hit.title, snippets: (hit.snippets ?? []).slice(0, 2) }));
            }
          } catch { /* Manual search is optional evidence, not a hard failure. */ }
        }
      }

      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, lang, contextData, history, lineList: lineListPayload, manualEvidence }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as { response?: unknown; mode?: unknown; cached?: unknown; sources?: unknown; error?: unknown; resolution?: { status?: string; tags?: Array<{ input: string; tag: string }> }; verifiedLineList?: unknown };
      if (!response.ok) {
        if (response.status === 429) {
          const wait = response.headers.get("Retry-After");
          throw new Error(L(`Too many requests. Please wait ${wait ? `${wait}s` : "a moment"} before retrying.`, `Trop de requêtes. Veuillez patienter ${wait ? `${wait} s` : "un instant"} avant de réessayer.`));
        }
        throw new Error(typeof data.error === "string" ? data.error : L(`Assistant unavailable (HTTP ${response.status}).`, `Assistant indisponible (HTTP ${response.status}).`));
      }
      if (typeof data.response !== "string" || !data.response.trim()) throw new Error(L("The assistant returned an empty response.", "L'assistant a renvoyé une réponse vide."));
      const mode: AssistantMode = data.mode === "ai" || data.mode === "cache" ? data.mode : "reference";
      const sources = Array.isArray(data.sources) ? data.sources.filter((source): source is AssistantSource => !!source && typeof source === "object" && typeof (source as AssistantSource).id === "string" && typeof (source as AssistantSource).title === "string").slice(0, 10) : [];
      const complete: AssistantMessage = {
        id: assistantId, role: "assistant", text: data.response, createdAt: new Date().toISOString(), status: "complete", prompt,
        mode, cached: data.cached === true, sources, latencyMs: Math.round(performance.now() - started),
        resolvedTags: data.resolution?.status === "resolved" ? data.resolution.tags ?? [] : [],
        verifiedLineList: data.verifiedLineList === true,
      };
      setMessages((prev) => prev.map((message) => message.id === assistantId ? complete : message));
      setFollowUps(followUpPrompts(complete, lang));
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      const text = aborted
        ? L("Request stopped. You can retry the same question.", "Requête arrêtée. Vous pouvez réessayer la même question.")
        : error instanceof Error ? error.message : L("The assistant could not be reached. Please retry.", "Impossible de joindre l'assistant. Veuillez réessayer.");
      setMessages((prev) => prev.map((message) => message.id === assistantId ? { ...message, text, status: aborted ? "cancelled" : "error" } : message));
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      controllerRef.current = null;
      busyRef.current = false;
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [contextTag, lang, L, lineList]);

  useEffect(() => { sendRef.current = (prompt, options) => { void send(prompt, options); }; }, [send]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; equipmentTag?: string }>).detail;
      if (!detail?.prompt) return;
      setOpen(true);
      if (detail.equipmentTag) setContextTag(detail.equipmentTag);
      if (busyRef.current) {
        setInput(detail.prompt.slice(0, ASSISTANT_MAX_PROMPT));
        toast.info(L("The assistant is busy. Your question is ready to send when it finishes.", "L'assistant est occupé. Votre question est prête à être envoyée à la fin du traitement."));
      } else {
        sendRef.current(detail.prompt, { equipmentTag: detail.equipmentTag ?? null });
      }
    };
    window.addEventListener("gnl1z:ask-ai", handler);
    return () => window.removeEventListener("gnl1z:ask-ai", handler);
  }, [L]);

  const attachLineList = async (file: File) => {
    if (file.size > 256 * 1024) { toast.error(L("CSV is larger than 256 KB. Split it or export only the relevant lines.", "Le CSV dépasse 256 Ko. Découpez-le ou exportez uniquement les lignes pertinentes.")); return; }
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) { toast.error(L("Please attach a CSV, TSV, or text line list.", "Veuillez joindre une liste de lignes CSV, TSV ou texte.")); return; }
    setAttaching(true);
    try {
      const dataset = parseLineListCsv(await file.text(), file.name);
      setLineList(dataset);
      toast.success(L(`Loaded ${dataset.rowCount} line-list rows from ${file.name}.`, `${dataset.rowCount} lignes chargées depuis ${file.name}.`));
      if (dataset.warnings.length) toast.warning(dataset.warnings[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : L("Could not parse the line list.", "Impossible d'analyser la liste de lignes."));
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearSession = () => {
    controllerRef.current?.abort();
    setMessages([]);
    setInput("");
    setFollowUps([]);
    setLineList(null);
    setConfirmClear(false);
    clearAssistantSession();
    toast.success(L("Chat session cleared.", "Session de discussion effacée."));
    inputRef.current?.focus();
  };

  const copyAnswer = async (message: AssistantMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId((id) => id === message.id ? null : id), 1500);
    } catch {
      toast.error(L("Copy failed. Select the text manually.", "Échec de la copie. Sélectionnez le texte manuellement."));
    }
  };

  const chips = [t("predictChip"), t("suggestToolsChip"), t("analyzeAlertsChip"), t("judgmentChip")];
  const trimmed = input.trim();
  const overLimit = input.length > ASSISTANT_MAX_PROMPT;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? L("Close Expert AI GNL1", "Fermer Expert AI GNL1") : L("Open Expert AI GNL1", "Ouvrir Expert AI GNL1")}
        aria-expanded={open}
        aria-controls="expert-ai-gnl1-panel"
        className="fixed bottom-4 right-4 z-50 flex h-14 items-center gap-2.5 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-600 to-blue-700 px-4 text-white shadow-[0_8px_30px_rgba(8,145,178,0.35)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        <span className="hidden font-mono text-sm font-bold tracking-wide sm:inline">{ASSISTANT_NAME}</span>
      </button>

      {open && (
        <div
          id="expert-ai-gnl1-panel"
          role="dialog"
          aria-label={ASSISTANT_NAME}
          className="fixed bottom-24 left-4 right-4 z-50 flex h-[min(680px,calc(100dvh-8rem))] max-w-[480px] flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:left-auto sm:right-6 sm:w-[460px]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border bg-gradient-to-r from-cyan-600/10 to-blue-600/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-mono text-sm font-bold tracking-wide">{ASSISTANT_NAME}</h2>
                <p className="truncate text-[11px] text-muted-foreground">{t("aiSubtitle")}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmClear(true)} disabled={!messages.length || busy} aria-label={L("Clear chat session", "Effacer la session")} title={L("Clear chat session", "Effacer la session")}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label={L("Close assistant", "Fermer l'assistant")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {contextTag && (
            <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-1.5 text-[11px] font-mono">
              <span className="text-muted-foreground">{L("Context", "Contexte")}:</span>
              <Link to={`/equipment/${encodeURIComponent(contextTag)}`} className="font-bold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300">{contextTag}</Link>
              <button type="button" onClick={() => setContextTag(null)} className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={L("Clear equipment context", "Effacer le contexte équipement")}><X className="h-3 w-3" /></button>
            </div>
          )}

          {confirmClear && (
            <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs">
              <span>{L("Clear this chat session?", "Effacer cette session de discussion ?")}</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="destructive" className="h-7 px-2.5 text-xs" onClick={clearSession}>{L("Clear", "Effacer")}</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setConfirmClear(false)}>{L("Cancel", "Annuler")}</Button>
              </div>
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            <div
              ref={listRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              onScroll={() => {
                const el = listRef.current;
                if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
              }}
              className="h-full space-y-4 overflow-y-auto px-4 py-4"
            >
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
                    <MessageSquare className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold">{ASSISTANT_NAME}</p>
                    <p className="mx-auto mt-1 max-w-[300px] text-xs leading-relaxed text-muted-foreground">{L("Ask about an equipment tag, test schedule, simulated alarm, DCS panel, or manual. Answers cite the supplied register data.", "Posez une question sur un repère d'équipement, une échéance d'essai, une alarme simulée, un panneau DCS ou un manuel. Les réponses citent les données du registre fournies.")}</p>
                  </div>
                  <p className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground"><Database className="h-3 w-3" />{L("77 register records · 44 P&ID files · 23 DCS panels · 23 manuals", "77 fiches registre · 44 fichiers P&ID · 23 panneaux DCS · 23 manuels")}</p>
                  <div className="grid w-full gap-2">
                    {chips.map((chip) => (
                      <button key={chip} type="button" onClick={() => sendRef.current(chip)} className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-left text-xs transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{chip}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${message.role === "user" ? "bg-gradient-to-br from-cyan-600 to-blue-700 text-white" : message.status === "error" ? "border border-rose-500/40 bg-rose-500/10" : message.status === "cancelled" ? "border border-amber-500/30 bg-amber-500/10" : "border border-border bg-secondary/40"}`}>
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
                    ) : message.status === "loading" ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
                        <span className="animate-pulse">{t("expertThinking")}</span>
                      </div>
                    ) : (
                      <>
                        {message.status === "complete" ? <MarkdownText text={message.text} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>}
                        {message.status === "complete" && message.sources?.length ? <SourceCards sources={message.sources} lang={lang} onNavigate={() => setOpen(false)} /> : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          {message.status === "complete" && (
                            <>
                              {message.resolvedTags?.filter((item) => item.input !== item.tag).map((item) => <span key={`${item.input}-${item.tag}`} className="rounded border border-cyan-500/30 bg-cyan-500/5 px-1.5 py-0.5 text-cyan-700 dark:text-cyan-300">{item.input} → {item.tag}</span>)}
                              {message.verifiedLineList && <span className="rounded border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">{L("CSV verified", "CSV vérifié")}</span>}
                              <span className="rounded border border-border px-1.5 py-0.5">{modeLabel(message.mode, lang)}</span>
                              {typeof message.latencyMs === "number" && message.latencyMs > 0 && <span>{(message.latencyMs / 1000).toFixed(1)}s</span>}
                              <button type="button" onClick={() => void copyAnswer(message)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground" aria-label={L("Copy answer", "Copier la réponse")}>
                                {copiedId === message.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                {copiedId === message.id ? t("copied") : t("copy")}
                              </button>
                            </>
                          )}
                          {(message.status === "error" || message.status === "cancelled") && message.prompt && (
                            <button type="button" onClick={() => sendRef.current(message.prompt!, { retryId: message.id })} disabled={busy} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-secondary disabled:opacity-50">
                              <RotateCcw className="h-3 w-3" />{L("Retry", "Réessayer")}
                            </button>
                          )}
                          <time dateTime={message.createdAt} className="ml-auto">{new Date(message.createdAt).toLocaleTimeString(fr ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</time>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              ))}

              {followUps.length > 0 && !busy && (
                <div className="flex flex-wrap gap-1.5">
                  {followUps.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => sendRef.current(prompt)} className="rounded-full border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-1 text-[11px] text-cyan-700 transition-colors hover:border-cyan-500/50 dark:text-cyan-300">{prompt}</button>
                  ))}
                </div>
              )}
            </div>
            {showJump && (
              <button type="button" onClick={() => scrollToLatest()} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/95 p-2 shadow-lg" aria-label={L("Jump to latest message", "Aller au dernier message")}>
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
          </div>

          <footer className="border-t border-border bg-card/80 px-3 pb-3 pt-2">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="hidden" aria-label={L("Attach piping line list CSV", "Joindre un CSV de liste de lignes")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void attachLineList(file); }} />
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg px-2 text-[11px]" disabled={attaching || busy} onClick={() => fileRef.current?.click()}>
                {attaching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                {L("Attach line list CSV", "Joindre CSV de lignes")}
              </Button>
              {lineList && (
                <span className="inline-flex max-w-[220px] items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <FileSpreadsheet className="h-3 w-3 shrink-0" /><span className="truncate">{lineList.fileName} · {lineList.rowCount} {L("rows", "lignes")}</span>
                  <button type="button" onClick={() => setLineList(null)} className="ml-1 rounded p-0.5 hover:bg-emerald-500/10" aria-label={L("Remove line list", "Retirer la liste de lignes")}><X className="h-3 w-3" /></button>
                </span>
              )}
              <a href="/data/gnl1z_equipment_register.csv" download className="ml-auto text-[10px] font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{L("Register CSV", "CSV registre")}</a>
            </div>
            <div className="flex items-end gap-2">
              <label htmlFor="expert-ai-gnl1-input" className="sr-only">{t("askAiPlaceholder")}</label>
              <textarea
                id="expert-ai-gnl1-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (trimmed && !overLimit && !busy) sendRef.current(input);
                  }
                }}
                rows={2}
                maxLength={ASSISTANT_MAX_PROMPT + 1}
                placeholder={t("askAiPlaceholder")}
                className="max-h-32 min-h-[52px] flex-1 resize-none rounded-xl border border-border bg-background/70 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              />
              {busy ? (
                <Button type="button" size="icon" variant="outline" className="h-[52px] w-[52px] shrink-0 rounded-xl" onClick={() => controllerRef.current?.abort()} aria-label={L("Stop response", "Arrêter la réponse")} title={L("Stop response", "Arrêter la réponse")}>
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" size="icon" className="h-[52px] w-[52px] shrink-0 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600" disabled={!trimmed || overLimit} onClick={() => sendRef.current(input)} aria-label={L("Send message", "Envoyer le message")}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 shrink-0" />{L("Static register + simulated alarms. Not live telemetry or an operating authorization.", "Registre statique + alarmes simulées. Pas de télémétrie temps réel ni d'autorisation d'exploitation.")}</span>
              <span className={`shrink-0 font-mono ${overLimit ? "text-rose-500" : ""}`}>{input.length}/{ASSISTANT_MAX_PROMPT}</span>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
