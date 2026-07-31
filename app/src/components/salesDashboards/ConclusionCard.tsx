"use client";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CheckCircleIcon as CheckCircleOutline,
  ExclamationCircleIcon,
  EyeIcon,
  QuestionMarkCircleIcon,
  WrenchScrewdriverIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

// ─── Section parsing ───────────────────────────────────────────────────────────

type SectionType = "observation" | "cause" | "operational" | "strategic" | "action" | "generic";

const SECTION_PATTERNS: Array<{ patterns: string[]; type: SectionType }> = [
  { patterns: ["wat we zien", "what we see", "ce que nous voyons", "lo que vemos", "was wir sehen", "quello che vediamo"], type: "observation" },
  { patterns: ["waarschijnlijke oorzaak", "probable cause", "cause probable", "causa probable", "wahrscheinliche ursache", "causa probabile"], type: "cause" },
  { patterns: ["operationele betekenis", "operational impact", "operational meaning", "impact opérationnel", "impacto operacional", "operationale bedeutung", "impatto operativo"], type: "operational" },
  { patterns: ["strategische betekenis", "strategic impact", "strategic meaning", "impact stratégique", "impacto estratégico", "strategische bedeutung", "impatto strategico"], type: "strategic" },
  { patterns: ["aanbevolen managementactie", "aanbevolen actie", "recommended management action", "recommended action", "action recommandée", "acción recomendada", "empfohlene maßnahme", "azione raccomandata"], type: "action" },
];

const SECTION_STYLES: Record<SectionType, { icon: any; iconClass: string; headingClass: string; wrapperClass: string }> = {
  observation:  { icon: EyeIcon,                iconClass: "tw-text-blue-500",    headingClass: "tw-text-blue-700",   wrapperClass: "" },
  cause:        { icon: QuestionMarkCircleIcon,  iconClass: "tw-text-amber-500",   headingClass: "tw-text-amber-700",  wrapperClass: "" },
  operational:  { icon: WrenchScrewdriverIcon,   iconClass: "tw-text-green-600",   headingClass: "tw-text-green-700",  wrapperClass: "" },
  strategic:    { icon: ArrowTrendingUpIcon,      iconClass: "tw-text-violet-500",  headingClass: "tw-text-violet-700", wrapperClass: "" },
  action:       { icon: BoltIcon,                iconClass: "tw-text-[#5971F6]",   headingClass: "tw-text-[#5971F6]",  wrapperClass: "tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded-lg tw-px-3 tw-py-2.5" },
  generic:      { icon: DocumentTextIcon,        iconClass: "tw-text-blue-gray-400", headingClass: "tw-text-blue-gray-700", wrapperClass: "" },
};

function detectSectionType(heading: string | null): SectionType {
  if (!heading) return "generic";
  const lower = heading.toLowerCase();
  for (const { patterns, type } of SECTION_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) return type;
  }
  return "generic";
}

function parseSections(text: string): Array<{ heading: string | null; body: string }> {
  return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const match = p.match(/^\*\*(.+?):\*\*\s*([\s\S]+)$/);
    return match ? { heading: match[1].trim(), body: match[2].trim() } : { heading: null, body: p };
  });
}

// ─── Chat labels & suggestions ────────────────────────────────────────────────

const CHAT_LABELS: Record<string, { chatTitle: string; placeholder: string; reset: string; answerLabel: string; backingLabel: string; actionLabel: string; suggestionsLabel: string; planActive: string; planInactive: string; emptyWithPlan: string; emptyNoPlan: string; defaultTitle: string }> = {
  nl: { chatTitle: "Stel een vraag over de conclusie", placeholder: "Stel een vraag over de data…", reset: "Reset gesprek", answerLabel: "Antwoord", backingLabel: "Onderbouwing", actionLabel: "Aanbevolen actie", suggestionsLabel: "Suggestievragen", planActive: "Plan actief", planInactive: "Geen plan", emptyWithPlan: "Upload en analyseer transcripties om een vergelijkende conclusie te zien. Het plan is actief.", emptyNoPlan: "Upload transcripties en een plan om een vergelijkende conclusie te genereren.", defaultTitle: "Vergelijkende Conclusie" },
  en: { chatTitle: "Ask a question about the conclusion", placeholder: "Ask a question about the data…", reset: "Reset conversation", answerLabel: "Answer", backingLabel: "Evidence", actionLabel: "Recommended action", suggestionsLabel: "Suggested questions", planActive: "Plan active", planInactive: "No plan", emptyWithPlan: "Upload and analyze transcripts to see a comparative conclusion. The plan is active.", emptyNoPlan: "Upload transcripts and a plan to generate a comparative conclusion.", defaultTitle: "Comparative Conclusion" },
  de: { chatTitle: "Frage zur Schlussfolgerung stellen", placeholder: "Frage zu den Daten stellen…", reset: "Zurücksetzen", answerLabel: "Antwort", backingLabel: "Belege", actionLabel: "Empfohlene Maßnahme", suggestionsLabel: "Vorschläge", planActive: "Plan aktiv", planInactive: "Kein Plan", emptyWithPlan: "Laden Sie Transkripte hoch und analysieren Sie sie, um eine vergleichende Schlussfolgerung zu sehen. Der Plan ist aktiv.", emptyNoPlan: "Laden Sie Transkripte und einen Plan hoch, um eine vergleichende Schlussfolgerung zu erstellen.", defaultTitle: "Vergleichende Schlussfolgerung" },
  fr: { chatTitle: "Poser une question sur la conclusion", placeholder: "Posez une question sur les données…", reset: "Réinitialiser", answerLabel: "Réponse", backingLabel: "Justification", actionLabel: "Action recommandée", suggestionsLabel: "Suggestions", planActive: "Plan actif", planInactive: "Aucun plan", emptyWithPlan: "Téléversez et analysez des transcriptions pour voir une conclusion comparative. Le plan est actif.", emptyNoPlan: "Téléversez des transcriptions et un plan pour générer une conclusion comparative.", defaultTitle: "Conclusion comparative" },
  es: { chatTitle: "Hacer una pregunta sobre la conclusión", placeholder: "Haz una pregunta sobre los datos…", reset: "Restablecer", answerLabel: "Respuesta", backingLabel: "Respaldo", actionLabel: "Acción recomendada", suggestionsLabel: "Sugerencias", planActive: "Plan activo", planInactive: "Sin plan", emptyWithPlan: "Sube y analiza transcripciones para ver una conclusión comparativa. El plan está activo.", emptyNoPlan: "Sube transcripciones y un plan para generar una conclusión comparativa.", defaultTitle: "Conclusión comparativa" },
  it: { chatTitle: "Fai una domanda sulla conclusione", placeholder: "Fai una domanda sui dati…", reset: "Reimposta", answerLabel: "Risposta", backingLabel: "Supporto", actionLabel: "Azione raccomandata", suggestionsLabel: "Domande suggerite", planActive: "Piano attivo", planInactive: "Nessun piano", emptyWithPlan: "Carica e analizza le trascrizioni per vedere una conclusione comparativa. Il piano è attivo.", emptyNoPlan: "Carica trascrizioni e un piano per generare una conclusione comparativa.", defaultTitle: "Conclusione comparativa" },
};

const FALLBACK_QUESTIONS: Record<string, string[]> = {
  nl: ["Wat is de belangrijkste conclusie?", "Waar moeten we nu mee beginnen?", "Wat gaat er goed en wat moet beter?", "Wat zijn de risico's als we niets doen?", "Welke coaching past bij dit patroon?"],
  en: ["What is the main conclusion?", "What should we start with?", "What is going well and what needs improvement?", "What are the risks if we do nothing?", "What coaching fits this pattern?"],
  de: ["Was ist die wichtigste Schlussfolgerung?", "Womit sollten wir beginnen?", "Was läuft gut und was muss besser werden?", "Welche Risiken gibt es, wenn wir nichts tun?", "Welches Coaching passt zu diesem Muster?"],
  fr: ["Quelle est la principale conclusion?", "Par où commencer?", "Qu'est-ce qui va bien et qu'est-ce qui doit s'améliorer?", "Quels sont les risques si on ne fait rien?", "Quel coaching correspond à ce modèle?"],
  es: ["¿Cuál es la conclusión principal?", "¿Por dónde empezar?", "¿Qué va bien y qué necesita mejorar?", "¿Cuáles son los riesgos?", "¿Qué coaching encaja?"],
  it: ["Qual è la conclusione principale?", "Da dove iniziare?", "Cosa va bene e cosa deve migliorare?", "Quali sono i rischi?", "Quale coaching si adatta?"],
};

// ─── Chat types ───────────────────────────────────────────────────────────────

interface UserMsg { role: "user"; text: string }
interface AssistantMsg { role: "assistant"; answer: string; backing: string; action: string; followups: string[] }
type ChatEntry = UserMsg | AssistantMsg;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConclusionCardProps {
  title?: string;
  conclusion?: string;
  topic?: string;
  dashboardType?: "strategic" | "operational";
  planActive?: boolean;
  language?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConclusionCard({ title, conclusion, topic, dashboardType = "strategic", planActive, language = "nl" }: ConclusionCardProps) {
  const lang = language in CHAT_LABELS ? language : "nl";
  const labels = CHAT_LABELS[lang];
  const fallback = FALLBACK_QUESTIONS[lang] || FALLBACK_QUESTIONS.nl;
  const resolvedTitle = title ?? labels.defaultTitle;

  const [chatOpen, setChatOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:5001";
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Scroll to bottom when chat updates
  useEffect(() => {
    if (chatOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, chatOpen]);

  // Fetch dynamic suggestions when chat opens
  useEffect(() => {
    if (!chatOpen || !conclusion || suggestions !== null || suggestionsLoading) return;
    setSuggestionsLoading(true);
    const token = getToken();
    fetch(`${API_URL}/api/ai/suggested-questions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic || resolvedTitle, conclusion, language: lang, dashboardType }),
    })
      .then((r) => r.json())
      .then((d) => setSuggestions(Array.isArray(d.questions) && d.questions.length > 0 ? d.questions : fallback))
      .catch(() => setSuggestions(fallback))
      .finally(() => setSuggestionsLoading(false));
  }, [chatOpen, conclusion]);

  const buildHistory = () =>
    entries.map((e) => ({
      role: e.role as "user" | "assistant",
      content: e.role === "user" ? (e as UserMsg).text : JSON.stringify({ answer: (e as AssistantMsg).answer, backing: (e as AssistantMsg).backing }),
    }));

  const send = async (question: string) => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setEntries((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/ai/conclusion-chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || resolvedTitle, conclusion: conclusion || "", language: lang, question: q, messages: buildHistory() }),
      });
      const json = await res.json();
      setEntries((prev) => [...prev, { role: "assistant", answer: json.answer || "", backing: json.backing || "", action: json.action || "", followups: json.followups || [] }]);
    } catch {
      setEntries((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const sections = conclusion ? parseSections(conclusion) : [];
  const isStructured = sections.some((s) => s.heading !== null);

  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Header */}
        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          <div className="tw-w-8 tw-h-8 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-flex-shrink-0" style={{ backgroundColor: "#EEF0FE" }}>
            <DocumentTextIcon className="tw-w-4 tw-h-4 tw-text-[#5971F6]" />
          </div>
          <span className="tw-font-semibold tw-text-gray-900 tw-text-sm">{resolvedTitle}</span>
          {planActive !== undefined && (
            planActive ? (
              <span className="tw-ml-auto tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-emerald-600 tw-bg-emerald-50 tw-rounded-full tw-px-2.5 tw-py-1 tw-font-medium">
                <CheckCircleIcon className="tw-w-3.5 tw-h-3.5" /> {labels.planActive}
              </span>
            ) : (
              <span className="tw-ml-auto tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-gray-400 tw-bg-gray-100 tw-rounded-full tw-px-2.5 tw-py-1">
                <ExclamationCircleIcon className="tw-w-3.5 tw-h-3.5" /> {labels.planInactive}
              </span>
            )
          )}
        </div>

        {/* Conclusion text */}
        {conclusion ? (
          isStructured ? (
            <div className="tw-space-y-3">
              {sections.map((s, i) => {
                const type = detectSectionType(s.heading);
                const style = SECTION_STYLES[type];
                const Icon = style.icon;
                return (
                  <div key={i} className={`tw-space-y-1 ${style.wrapperClass}`}>
                    {s.heading && (
                      <div className="tw-flex tw-items-center tw-gap-1.5">
                        <Icon className={`tw-w-3.5 tw-h-3.5 tw-flex-shrink-0 ${style.iconClass}`} />
                        <span className={`tw-text-sm tw-font-semibold ${style.headingClass}`}>{s.heading}</span>
                      </div>
                    )}
                    <Typography variant="small" className="tw-text-blue-gray-600 tw-leading-relaxed">{s.body}</Typography>
                  </div>
                );
              })}
            </div>
          ) : (
            <Typography variant="small" className="tw-text-blue-gray-700 tw-leading-relaxed">{conclusion}</Typography>
          )
        ) : (
          <Typography variant="small" className="tw-text-blue-gray-400 tw-italic">
            {planActive ? labels.emptyWithPlan : labels.emptyNoPlan}
          </Typography>
        )}

        {/* Chat toggle */}
        <div className="tw-border-t tw-border-gray-100 tw-mt-4 tw-pt-3">
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="tw-flex tw-items-center tw-gap-1.5 tw-text-xs tw-text-gray-400 hover:tw-text-[#5971F6] tw-transition-colors"
          >
            <ChatBubbleLeftRightIcon className="tw-w-3.5 tw-h-3.5" />
            {labels.chatTitle}
          </button>
        </div>

        {/* Inline chat panel */}
        {chatOpen && (
          <div className="tw-mt-3 tw-rounded-2xl tw-overflow-hidden tw-bg-[#F5F6F8]">
            {/* Chat header */}
            <div className="tw-flex tw-items-center tw-justify-between tw-px-3 tw-py-2 tw-bg-[#F5F6F8] tw-border-b tw-border-gray-200">
              <div className="tw-flex tw-items-center tw-gap-1.5">
                <ChatBubbleLeftRightIcon className="tw-w-3.5 tw-h-3.5 tw-text-[#5971F6]" />
                <span className="tw-text-xs tw-font-medium tw-text-blue-gray-700">{labels.chatTitle}</span>
              </div>
              {entries.length > 0 && (
                <button onClick={() => setEntries([])} className="tw-flex tw-items-center tw-gap-1 tw-text-[10px] tw-text-blue-gray-400 hover:tw-text-blue-gray-700 tw-transition-colors">
                  <ArrowPathIcon className="tw-w-2.5 tw-h-2.5" />
                  {labels.reset}
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="tw-h-64 tw-overflow-y-auto tw-px-3 tw-py-3 tw-space-y-3 tw-bg-white">
              {entries.length === 0 ? (
                <div className="tw-space-y-2">
                  <p className="tw-text-[10px] tw-font-semibold tw-text-blue-gray-400 tw-uppercase tw-tracking-wide">{labels.suggestionsLabel}</p>
                  {suggestionsLoading ? (
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <div className="tw-w-3.5 tw-h-3.5 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                      <span className="tw-text-xs tw-text-blue-gray-400">…</span>
                    </div>
                  ) : (
                    <div className="tw-flex tw-flex-wrap tw-gap-1.5">
                      {(suggestions ?? fallback).map((q, i) => (
                        <button key={i} onClick={() => send(q)} className="tw-text-[11px] tw-text-blue-gray-500 tw-border tw-border-blue-gray-200 tw-rounded-full tw-px-2.5 tw-py-1 hover:tw-border-[#5971F6] hover:tw-text-[#5971F6] tw-transition-colors tw-bg-white">
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {entries.map((e, i) =>
                    e.role === "user" ? (
                      <div key={i} className="tw-flex tw-justify-end">
                        <div className="tw-max-w-[85%] tw-rounded-lg tw-bg-[#5971F6] tw-px-3 tw-py-2">
                          <Typography variant="small" className="!tw-text-white">{(e as UserMsg).text}</Typography>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-px-3 tw-py-2.5 tw-space-y-2">
                        <div>
                          <p className="tw-text-[10px] tw-font-bold tw-text-[#5971F6] tw-uppercase tw-tracking-wide">{labels.answerLabel}</p>
                          <Typography variant="small" className="tw-text-blue-gray-700">{(e as AssistantMsg).answer}</Typography>
                        </div>
                        {(e as AssistantMsg).backing && (
                          <div>
                            <p className="tw-text-[10px] tw-font-semibold tw-text-blue-gray-400 tw-uppercase tw-tracking-wide">{labels.backingLabel}</p>
                            <Typography variant="small" className="tw-text-blue-gray-500">{(e as AssistantMsg).backing}</Typography>
                          </div>
                        )}
                        {(e as AssistantMsg).action && (
                          <div className="tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded-md tw-px-2.5 tw-py-2">
                            <div className="tw-flex tw-items-center tw-gap-1 tw-mb-1">
                              <BoltIcon className="tw-w-3 tw-h-3 tw-text-[#5971F6]" />
                              <p className="tw-text-[10px] tw-font-bold tw-text-[#5971F6] tw-uppercase tw-tracking-wide">{labels.actionLabel}</p>
                            </div>
                            <Typography variant="small" className="tw-text-blue-gray-700">{(e as AssistantMsg).action}</Typography>
                          </div>
                        )}
                        {(e as AssistantMsg).followups?.length > 0 && (
                          <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-pt-1">
                            {(e as AssistantMsg).followups.map((q, j) => (
                              <button key={j} onClick={() => send(q)} className="tw-text-[11px] tw-text-blue-gray-500 tw-border tw-border-blue-gray-200 tw-rounded-full tw-px-2.5 tw-py-1 hover:tw-border-[#5971F6] hover:tw-text-[#5971F6] tw-transition-colors tw-bg-white">
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}
                  {loading && (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-px-1">
                      <div className="tw-w-3.5 tw-h-3.5 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                      <span className="tw-text-xs tw-text-blue-gray-400">…</span>
                    </div>
                  )}
                  <div ref={endRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="tw-flex tw-gap-2 tw-px-3 tw-py-2 tw-border-t tw-border-gray-100 tw-bg-[#F5F6F8]">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={labels.placeholder}
                disabled={loading}
                className="tw-flex-1 tw-text-sm tw-bg-transparent tw-outline-none tw-text-blue-gray-700 placeholder:tw-text-blue-gray-300"
              />
              <button onClick={() => send(input)} disabled={loading || !input.trim()} className="tw-text-[#5971F6] disabled:tw-opacity-40 hover:tw-text-blue-700 tw-transition-colors">
                {loading ? <div className="tw-w-4 tw-h-4 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /> : <PaperAirplaneIcon className="tw-w-4 tw-h-4" />}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
