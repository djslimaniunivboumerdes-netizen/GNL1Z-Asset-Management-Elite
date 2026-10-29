import { useState, useRef, useEffect } from "react";
import { MarkdownText } from "@/components/MarkdownText";
import { useI18n } from "@/contexts/I18nContext";
import { Bot, X, Send, Sparkles, RefreshCw, AlertTriangle, Hammer, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EQUIPMENT } from "@/data";
import { DCS_PANELS } from "@/data/dcs_panels";
import { MANUALS } from "@/data/manuals";
import { getActiveAlarms, subscribeAlarms } from "@/lib/alarmStore";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  cached?: boolean;
  hitCount?: number;
}

export function AiAgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen]);
  const { t, lang } = useI18n();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: lang === "fr"
        ? "Bonjour. Je peux consulter les données statiques du registre GNL1Z et les alarmes simulées affichées. Je ne dispose pas de télémétrie temps réel et je ne remplace pas les procédures approuvées, un plan d'essai ou un plan de levage. Posez une question sur un repère équipement."
        : "Hello. I can look up static GNL1Z register data and the simulated alarms shown on screen. I do not have real-time telemetry and I do not replace approved procedures, a test plan, or a lift plan. Ask about an equipment tag."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveAlarms, setLiveAlarms] = useState(getActiveAlarms());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [messages, loading, isOpen]);

  // 🚀 Live simulated Safety Alarm feed (from Smart Process Flow) — kept in sync
  // so the AI Agent can answer "any active alarms?" with the real screen state.
  useEffect(() => subscribeAlarms(() => setLiveAlarms(getActiveAlarms())), []);

  // 🚀 Cross-page deep-link: Smart Process Flow's "Ask AI Expert" button dispatches
  // this event with a pre-filled prompt; open the chat and send it automatically.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt: string }>).detail;
      if (!detail?.prompt) return;
      setIsOpen(true);
      handleSend(detail.prompt);
    };
    window.addEventListener("gnl1z:ask-ai", handler);
    return () => window.removeEventListener("gnl1z:ask-ai", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(customPrompt?: string) {
    const prompt = (customPrompt ?? input).trim();
    if (!prompt || loading) return;

    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: prompt };
    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setLoading(true);

    try {
      // Data minimization: send full records only for likely matches; otherwise
      // send a compact static catalog. Manual drive IDs and the full spare-parts
      // catalog are not needed by the assistant and are not transmitted.
      const q = prompt.toLowerCase();
      const matched = EQUIPMENT.filter((eq) => q.includes(eq.tag.toLowerCase()) || q.includes(eq.name.toLowerCase()) || q.includes(eq.unit.toLowerCase())).slice(0, 5);
      const compactCatalog = EQUIPMENT.map((eq) => ({
        tag: eq.tag, name: eq.name, unit: eq.unit, section: eq.section, type: eq.type, testing_status: eq.testing_status,
        technical: { pressure_bar: eq.technical.pressure_bar, weight_kg: eq.technical.weight_kg, volume_m3: eq.technical.volume_m3, temperature_c: eq.technical.temperature_c },
        maintenance: { last_tested: eq.maintenance.last_tested, next_test_due: eq.maintenance.next_test_due },
      }));
      const completePlantContext = {
        facility: "Sonatrach GL1/Z Arzew LNG Complex",
        process: "AP-C3MR™ Liquefaction",
        masterEquipmentCatalog: matched.length ? matched : compactCatalog,
        dcsPanelsList: DCS_PANELS.map(p => ({ id: p.id, title: p.title_en, section: p.section, tags: p.tags })),
        operationalManualsList: MANUALS.map(m => ({ id: m.id, title: m.title_en, category: m.category })),
        simulatedSafetyAlarms: liveAlarms.map(a => ({
          tag: a.dbTag || a.tag, name: a.nameEn, unit: a.unit, severity: a.severity,
          description: a.descriptionEn, simulated: true,
        }))
      };
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25_000);
      let res: Response;
      try {
        res = await fetch("/api/ai-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ prompt: prompt.slice(0, 2000), lang, contextData: completePlantContext })
        });
      } finally { window.clearTimeout(timeout); }

      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          sender: "ai", 
          text: typeof data.response === "string" && data.response.trim() ? data.response : (lang === "fr" ? "La réponse du service est vide. Veuillez réessayer." : "The service returned an empty response. Please try again."),
          cached: data.cached,
          hitCount: data.hit_count
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error("API Network error");
      }
    } catch (err) {
      console.error("[AiAgentChat] API error:", err);
      const fallbackMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: lang === "fr"
          ? "### Service indisponible\n\nJe ne peux pas vérifier les données ni produire une analyse pour le moment. Consultez le dossier équipement et les procédures approuvées, puis réessayez. Aucune prédiction de pression ou de défaillance n'a été générée."
          : "### Assistant unavailable\n\nI cannot verify the data or produce an analysis right now. Consult the equipment record and approved procedures, then try again. No pressure or failure prediction has been generated.",
        cached: false
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  }

  const quickChips = [
    { key: "predictChip", promptEn: "Review schedule for X01-E-501", promptFr: "Consulter l'échéance de X01-E-501", icon: AlertTriangle },
    { key: "suggestToolsChip", promptEn: "Reference tools for X01-E-501", promptFr: "Outils de référence pour X01-E-501", icon: Hammer },
    { key: "analyzeAlertsChip", promptEn: "Show simulated alarms", promptFr: "Afficher les alarmes simulées", icon: ShieldAlert },
    { key: "judgmentChip", promptEn: "Review record for X01-F-502", promptFr: "Consulter le dossier de X01-F-502", icon: Sparkles },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6 font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t("aiAssistant")}
          className="group relative flex items-center gap-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-5 py-3.5 rounded-full shadow-[0_10px_30px_rgba(6,182,212,0.4)] hover:shadow-[0_15px_40px_rgba(6,182,212,0.6)] border border-cyan-400/30 transition-all duration-300 transform hover:scale-105 motion-reduce:transform-none cursor-pointer"
        >
          <Bot className="h-6 w-6 text-white animate-bounce motion-reduce:animate-none" />
          <span className="hidden sm:inline font-mono font-bold text-sm tracking-wide pr-1">{t("aiAssistant")}</span>
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border border-slate-900"></span>
          </span>
        </button>
      )}

      {isOpen && (
        <div role="dialog" aria-label={t("aiAssistant")} className="w-[calc(100vw-2rem)] max-w-[460px] h-[min(620px,calc(100dvh-6rem))] bg-card/95 border border-border backdrop-blur-2xl rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
          <div className="px-6 py-4 bg-card/80 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20">
                <Sparkles className="h-5 w-5 text-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2 truncate">
                  {t("aiAssistant")}
                  <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 px-2.5 py-0.5 rounded-full animate-pulse shadow-inner">
                    STATIC REFERENCE
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{t("aiSubtitle")}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label={lang === "fr" ? "Fermer l'assistant" : "Close assistant"}
              className="p-2.5 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0 shadow-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-secondary/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-2xl text-xs md:text-sm font-light leading-relaxed shadow-lg relative ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none font-sans"
                      : "bg-card border border-border text-foreground rounded-tl-none font-mono"
                  }`}
                >
                  {/* 🚀 MASTER ENHANCEMENT: SUPABASE AI CACHE HIT INDICATOR PILL */}
                  {msg.sender === "ai" && msg.cached && (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold mb-3 shadow-inner w-fit">
                      <Zap className="h-3 w-3 text-emerald-700 dark:text-emerald-400 animate-pulse" />
                      {lang === "en" ? `SUPABASE CACHE HIT (0ms) • ${msg.hitCount} Hits` : `CACHE SUPABASE (0ms) • ${msg.hitCount} Requêtes`}
                    </div>
                  )}

                  {msg.sender === "ai" ? (
                    <MarkdownText text={msg.text} />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-4 rounded-2xl bg-card border border-border text-muted-foreground rounded-tl-none font-mono text-xs flex items-center gap-3 shadow-lg">
                  <RefreshCw className="h-4 w-4 text-cyan-700 dark:text-cyan-400 animate-spin" />
                  <span className="animate-pulse">{t("expertThinking")}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-3 bg-secondary/60 border-t border-border flex gap-2 overflow-x-auto scrollbar-none">
            {quickChips.map((chip) => {
              const Icon = chip.icon;
              const prompt = lang === "fr" ? chip.promptFr : chip.promptEn;
              return (
                <button
                  key={chip.key}
                  onClick={() => handleSend(prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-secondary border border-border text-[11px] font-mono text-muted-foreground hover:text-cyan-400 transition-all shrink-0 cursor-pointer shadow-sm font-bold"
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                  {t(chip.key)}
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-background border-t border-border flex items-center gap-3">
            <input
              type="text"
              maxLength={2000}
              aria-label={t("askAiPlaceholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("askAiPlaceholder")}
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3.5 text-xs text-foreground placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors font-mono shadow-inner"
            />
            <button
              onClick={() => handleSend()}
              aria-label={lang === "fr" ? "Envoyer la question" : "Send question"}
              disabled={loading || !input.trim()}
              className={`p-3.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-lg ${
                loading || !input.trim()
                  ? "bg-secondary border-border text-muted-foreground cursor-not-allowed"
                  : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20"
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
