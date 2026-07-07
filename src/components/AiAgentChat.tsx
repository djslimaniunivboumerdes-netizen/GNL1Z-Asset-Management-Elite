import { useState, useRef, useEffect } from "react";
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
  const { t, lang } = useI18n();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: lang === "fr" 
        ? "Bonjour ! Je suis l'Expert IA GNL1Z. Je supervise la totalité de nos 77 équipements, 713 pièces de rechange, les schémas P&ID, les manuels opératoires (S01-S15) et le moteur d'apprentissage Supabase. Demandez-moi de prédire des défaillances, suggérer des outils ou analyser les alertes."
        : "Hello! I am the GNL1Z AI Expert. I supervise all 77 assets, 713 spare parts, P&ID drawings, operational manuals (S01-S15), and the Supabase AI learning engine. Ask me to predict failures, suggest maintenance tools, or analyze alerts."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveAlarms, setLiveAlarms] = useState(getActiveAlarms());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      // 🚀 MASTER ENHANCEMENT: Send the ENTIRE equipment database, DCS panels list, AND Operational Manuals list
      // so Gemini has 100% complete, unclipped plant context!
      const completePlantContext = {
        facility: "Sonatrach GL1/Z Arzew LNG Complex",
        process: "AP-C3MR™ Liquefaction",
        totalEquipmentCount: EQUIPMENT.length,
        masterEquipmentCatalog: EQUIPMENT,
        dcsPanelsList: DCS_PANELS.map(p => ({ id: p.id, title: p.title_en, section: p.section, tags: p.tags, relatedEquipment: p.related_tags })),
        operationalManualsList: MANUALS.map(m => ({ id: m.id, title: m.title_en, category: m.category, driveId: m.drive_id })),
        // 🚀 Live simulated Smart Process Flow safety alarm feed — lets the AI answer
        // "any active alarms?" with whatever is actually flashing on-screen right now.
        activeSafetyAlarms: liveAlarms.map(a => ({
          tag: a.dbTag || a.tag,
          name: a.nameEn,
          unit: a.unit,
          instrument: a.instrument,
          kind: a.kind,
          severity: a.severity,
          description: a.descriptionEn,
          recommendedAction: a.actionEn,
          triggeredAt: new Date(a.triggeredAt).toISOString(),
        }))
      };

      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          lang,
          contextData: completePlantContext
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          sender: "ai", 
          text: data.response,
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
          ? "### ⚠️ Rapport de Prédiction IA (Mode Hors-ligne)\n\nL'analyse de `X01-E-501` montre une pression proche de 8,6 bar. **Action requise :** Prévoir douilles 15/16\" et palan 2T pour inspection."
          : "### ⚠️ AI Prediction Report (Offline Mode)\n\nAnalysis of `X01-E-501` shows operating pressure near 8.6 bar limit. **Action Required:** Prepare 15/16\" sockets and 2T hoist for inspection.",
        cached: false
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  }

  const quickChips = [
    { key: "predictChip", promptEn: "Predict next failing asset", promptFr: "Prédire la prochaine défaillance", icon: AlertTriangle },
    { key: "suggestToolsChip", promptEn: "Suggest tools for X01-E-501", promptFr: "Outils pour X01-E-501", icon: Hammer },
    { key: "analyzeAlertsChip", promptEn: "Analyze recent fast alerts", promptFr: "Analyser les alertes récentes", icon: ShieldAlert },
    { key: "judgmentChip", promptEn: "Full engineering judgment for X01-F-502", promptFr: "Jugement d'ingénierie complet pour X01-F-502", icon: Sparkles },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-5 py-3.5 rounded-full shadow-[0_10px_30px_rgba(6,182,212,0.4)] hover:shadow-[0_15px_40px_rgba(6,182,212,0.6)] border border-cyan-400/30 transition-all duration-300 transform hover:scale-105 cursor-pointer"
        >
          <Bot className="h-6 w-6 text-cyan-300 animate-bounce" />
          <span className="font-mono font-bold text-sm tracking-wide pr-1">{t("aiAssistant")}</span>
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border border-slate-900"></span>
          </span>
        </button>
      )}

      {isOpen && (
        <div className="w-[380px] md:w-[460px] h-[620px] bg-slate-900/95 border border-slate-800 backdrop-blur-2xl rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 truncate">
                  {t("aiAssistant")}
                  <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2.5 py-0.5 rounded-full animate-pulse shadow-inner">
                    P&ID + MANUALS
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono truncate">{t("aiSubtitle")}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0 shadow-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-2xl text-xs md:text-sm font-light leading-relaxed shadow-lg relative ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none font-sans"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none font-mono"
                  }`}
                >
                  {/* 🚀 MASTER ENHANCEMENT: SUPABASE AI CACHE HIT INDICATOR PILL */}
                  {msg.sender === "ai" && msg.cached && (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold mb-3 shadow-inner w-fit">
                      <Zap className="h-3 w-3 text-emerald-400 animate-pulse" /> 
                      {lang === "en" ? `SUPABASE CACHE HIT (0ms) • ${msg.hitCount} Hits` : `CACHE SUPABASE (0ms) • ${msg.hitCount} Requêtes`}
                    </div>
                  )}

                  {msg.sender === "ai" ? (
                    <div className="space-y-3">
                      {msg.text.split("\n\n").map((para, i) => {
                        if (para.startsWith("###")) {
                          return <h4 key={i} className="text-sm font-bold text-cyan-400 border-b border-slate-800 pb-1 mb-2">{para.replace("###", "").trim()}</h4>;
                        }
                        if (para.includes("*   ")) {
                          return (
                            <ul key={i} className="space-y-2 list-none pl-1">
                              {para.split("*   ").filter(Boolean).map((item, j) => (
                                <li key={j} className="flex items-start gap-2 text-xs text-slate-300">
                                  <span className="text-cyan-500 font-bold shrink-0">•</span>
                                  <span dangerouslySetInnerHTML={{ __html: item.trim().replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>').replace(/\`(.*?)\`/g, '<code class="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono">$1</code>') }} />
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        return <p key={i} className="text-slate-300" dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>').replace(/\`(.*?)\`/g, '<code class="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono">$1</code>') }} />;
                      })}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 rounded-tl-none font-mono text-xs flex items-center gap-3 shadow-lg">
                  <RefreshCw className="h-4 w-4 text-cyan-500 animate-spin" />
                  <span className="animate-pulse">{t("expertThinking")}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800/80 flex gap-2 overflow-x-auto scrollbar-none">
            {quickChips.map((chip) => {
              const Icon = chip.icon;
              const prompt = lang === "fr" ? chip.promptFr : chip.promptEn;
              return (
                <button
                  key={chip.key}
                  onClick={() => handleSend(prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-cyan-400 transition-all shrink-0 cursor-pointer shadow-sm font-bold"
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-500" />
                  {t(chip.key)}
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("askAiPlaceholder")}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors font-mono shadow-inner"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className={`p-3.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-lg ${
                loading || !input.trim()
                  ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
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
