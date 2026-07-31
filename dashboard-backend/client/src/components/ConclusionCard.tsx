import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, CheckCircle2, AlertCircle, Eye, HelpCircle, Wrench,
  TrendingUp, Zap, MessageSquare, Send, Loader2, BarChart2, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/LanguageContext";

// ─── Section rendering ─────────────────────────────────────────────────────────

type SectionType = 'observation' | 'cause' | 'operational' | 'strategic' | 'action' | 'generic';

const SECTION_PATTERNS: Array<{ patterns: string[]; type: SectionType }> = [
  { patterns: ['wat we zien', 'what we see', 'ce que nous voyons', 'lo que vemos', 'was wir sehen', 'quello che vediamo'], type: 'observation' },
  { patterns: ['waarschijnlijke oorzaak', 'probable cause', 'cause probable', 'causa probable', 'wahrscheinliche ursache', 'causa probabile'], type: 'cause' },
  { patterns: ['operationele betekenis', 'operational impact', 'operational meaning', 'impact opérationnel', 'impacto operacional', 'operationale bedeutung', 'impatto operativo'], type: 'operational' },
  { patterns: ['strategische betekenis', 'strategic impact', 'strategic meaning', 'impact stratégique', 'impacto estratégico', 'strategische bedeutung', 'impatto strategico'], type: 'strategic' },
  { patterns: ['aanbevolen managementactie', 'aanbevolen actie', 'recommended management action', 'recommended action', 'action recommandée', 'acción recomendada', 'empfohlene maßnahme', 'azione raccomandata'], type: 'action' },
];

function detectSectionType(heading: string | null): SectionType {
  if (!heading) return 'generic';
  const lower = heading.toLowerCase();
  for (const { patterns, type } of SECTION_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) return type;
  }
  return 'generic';
}

const SECTION_STYLES: Record<SectionType, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string; headingClass: string; wrapperClass: string;
}> = {
  observation: { icon: Eye, iconClass: "text-blue-500 dark:text-blue-400", headingClass: "text-blue-700 dark:text-blue-300", wrapperClass: "" },
  cause: { icon: HelpCircle, iconClass: "text-amber-500 dark:text-amber-400", headingClass: "text-amber-700 dark:text-amber-300", wrapperClass: "" },
  operational: { icon: Wrench, iconClass: "text-green-600 dark:text-green-400", headingClass: "text-green-700 dark:text-green-300", wrapperClass: "" },
  strategic: { icon: TrendingUp, iconClass: "text-violet-500 dark:text-violet-400", headingClass: "text-violet-700 dark:text-violet-300", wrapperClass: "" },
  action: { icon: Zap, iconClass: "text-primary", headingClass: "text-primary", wrapperClass: "bg-primary/5 border border-primary/20 rounded-md px-3 py-2.5" },
  generic: { icon: FileText, iconClass: "text-muted-foreground", headingClass: "text-foreground", wrapperClass: "" },
};

function parseSections(text: string): Array<{ heading: string | null; body: string }> {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean).map(p => {
    const match = p.match(/^\*\*(.+?):\*\*\s*([\s\S]+)$/);
    return match ? { heading: match[1].trim(), body: match[2].trim() } : { heading: null, body: p };
  });
}

// ─── Chat labels & suggested questions ────────────────────────────────────────

const CHAT_LABELS: Record<string, {
  chatTitle: string; placeholder: string; reset: string;
  answerLabel: string; backingLabel: string; actionLabel: string; suggestionsLabel: string;
}> = {
  nl: { chatTitle: "Stel een vraag over de conclusie", placeholder: "Stel een vraag over de data…", reset: "Reset gesprek", answerLabel: "Antwoord", backingLabel: "Onderbouwing", actionLabel: "Aanbevolen actie", suggestionsLabel: "Suggestievragen" },
  en: { chatTitle: "Ask a question about the conclusion", placeholder: "Ask a question about the data…", reset: "Reset conversation", answerLabel: "Answer", backingLabel: "Evidence", actionLabel: "Recommended action", suggestionsLabel: "Suggested questions" },
  de: { chatTitle: "Frage zur Schlussfolgerung stellen", placeholder: "Frage zu den Daten stellen…", reset: "Zurücksetzen", answerLabel: "Antwort", backingLabel: "Belege", actionLabel: "Empfohlene Maßnahme", suggestionsLabel: "Vorschläge" },
  fr: { chatTitle: "Poser une question sur la conclusion", placeholder: "Posez une question sur les données…", reset: "Réinitialiser", answerLabel: "Réponse", backingLabel: "Justification", actionLabel: "Action recommandée", suggestionsLabel: "Suggestions" },
  es: { chatTitle: "Hacer una pregunta sobre la conclusión", placeholder: "Haz una pregunta sobre los datos…", reset: "Restablecer", answerLabel: "Respuesta", backingLabel: "Respaldo", actionLabel: "Acción recomendada", suggestionsLabel: "Sugerencias" },
  it: { chatTitle: "Fai una domanda sulla conclusione", placeholder: "Fai una domanda sui dati…", reset: "Reimposta", answerLabel: "Risposta", backingLabel: "Supporto", actionLabel: "Azione raccomandata", suggestionsLabel: "Domande suggerite" },
};

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  nl: ["Wat is de belangrijkste conclusie?", "Waar moeten we nu mee beginnen?", "Wat gaat er goed en wat moet beter?", "Wat zijn de risico's als we niets doen?", "Welke coaching past bij dit patroon?"],
  en: ["What is the main conclusion?", "What should we start with now?", "What is going well and what needs improvement?", "What are the risks if we do nothing?", "What coaching fits this pattern?"],
  de: ["Was ist die wichtigste Schlussfolgerung?", "Womit sollten wir jetzt beginnen?", "Was läuft gut und was muss besser werden?", "Welche Risiken bestehen, wenn wir nichts tun?", "Welches Coaching passt zu diesem Muster?"],
  fr: ["Quelle est la principale conclusion?", "Par où commencer maintenant?", "Qu'est-ce qui va bien et qu'est-ce qui doit s'améliorer?", "Quels sont les risques si on ne fait rien?", "Quel coaching correspond à ce modèle?"],
  es: ["¿Cuál es la conclusión principal?", "¿Por dónde empezar ahora?", "¿Qué va bien y qué necesita mejorar?", "¿Cuáles son los riesgos si no hacemos nada?", "¿Qué coaching encaja con este patrón?"],
  it: ["Qual è la conclusione principale?", "Da dove iniziare ora?", "Cosa va bene e cosa deve migliorare?", "Quali sono i rischi se non facciamo nulla?", "Quale coaching si adatta a questo pattern?"],
};

// ─── Chat types ───────────────────────────────────────────────────────────────

interface UserMessage { role: 'user'; text: string }
interface AssistantMessage { role: 'assistant'; answer: string; backing: string; action: string; followups: string[] }
type ChatEntry = UserMessage | AssistantMessage;

// ─── Chat bubble components ───────────────────────────────────────────────────

function ChatBubbleUser({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2">
        <p className="text-sm text-primary-foreground leading-snug">{text}</p>
      </div>
    </div>
  );
}

function ChatBubbleAssistant({
  answer, backing, action, followups, labels, onFollowup
}: AssistantMessage & { labels: typeof CHAT_LABELS['nl']; onFollowup: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2.5">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">{labels.answerLabel}</p>
          <p className="text-sm leading-snug text-foreground">{answer}</p>
        </div>
        {backing && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{labels.backingLabel}</p>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">{backing}</p>
          </div>
        )}
        {action && (
          <div className="space-y-0.5 bg-primary/5 border border-primary/20 rounded-md px-2.5 py-2">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">{labels.actionLabel}</p>
            </div>
            <p className="text-xs leading-snug text-foreground">{action}</p>
          </div>
        )}
      </div>
      {followups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {followups.map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowup(q)}
              className="text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-1 hover-elevate bg-background"
              data-testid={`button-conclusion-followup-${i}`}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConclusionCardProps {
  title?: string;
  conclusion?: string;
  topic?: string;
  dashboardType?: 'strategic' | 'operational';
  planActive?: boolean;
  planActiveLabel?: string;
  noPlanLabel?: string;
  emptyWithPlanText?: string;
  emptyNoPlanText?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConclusionCard({
  title = "Vergelijkende Conclusie",
  conclusion,
  topic,
  dashboardType = 'strategic',
  planActive,
  planActiveLabel = "Plan actief",
  noPlanLabel = "Geen plan",
  emptyWithPlanText = "Upload en analyseer transcripties om een vergelijkende conclusie te zien. Het plan document is actief en wordt gebruikt bij de volgende analyse.",
  emptyNoPlanText = "Upload en analyseer transcripties om een vergelijkende conclusie te zien. Upload een plan document in het Admin Dashboard voor vergelijking met doelstellingen."
}: ConclusionCardProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const lang = language in CHAT_LABELS ? language : 'nl';
  const labels = CHAT_LABELS[lang];
  const fallbackSuggestions = SUGGESTED_QUESTIONS[lang] || SUGGESTED_QUESTIONS['nl'];

  const [chatOpen, setChatOpen] = useState(false);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sections = conclusion ? parseSections(conclusion) : [];
  const isStructured = sections.some(s => s.heading !== null);

  useEffect(() => {
    if (chatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatEntries, chatOpen]);

  // Fetch dynamic questions once when chat opens (if conclusion exists)
  useEffect(() => {
    if (!chatOpen || !conclusion || dynamicSuggestions !== null || suggestionsLoading) return;
    setSuggestionsLoading(true);
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
    apiRequest("POST", "/api/ai/suggested-questions", {
      topic: topic || title,
      conclusion,
      language: lang,
      dashboardType,
      demo: isDemoMode,
    })
      .then(r => r.json())
      .then(data => {
        const qs: string[] = Array.isArray(data.questions) && data.questions.length > 0
          ? data.questions
          : fallbackSuggestions;
        setDynamicSuggestions(qs);
      })
      .catch(() => setDynamicSuggestions(fallbackSuggestions))
      .finally(() => setSuggestionsLoading(false));
  }, [chatOpen, conclusion]);

  const buildHistoryForApi = () => chatEntries.map(e => ({
    role: e.role as 'user' | 'assistant',
    content: e.role === 'user'
      ? (e as UserMessage).text
      : JSON.stringify({ answer: (e as AssistantMessage).answer, backing: (e as AssistantMessage).backing }),
  }));

  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';

  const sendQuestion = async (question: string) => {
    if (!question.trim() || chatLoading) return;
    const q = question.trim();
    setChatInput("");
    setChatEntries(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/conclusion-chat", {
        topic: topic || title,
        conclusion: conclusion || '',
        language: lang,
        question: q,
        messages: buildHistoryForApi(),
        demo: isDemoMode,
      });
      const json = await res.json();
      setChatEntries(prev => [...prev, {
        role: 'assistant',
        answer: json.answer || '',
        backing: json.backing || '',
        action: json.action || '',
        followups: json.followups || [],
      }]);
    } catch {
      toast({ title: "Fout", description: "Chat antwoord kon niet worden geladen.", variant: "destructive" });
      setChatEntries(prev => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <Card data-testid="card-conclusion" className="bg-card/50 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-primary" />
          {title}
          {planActive !== undefined && (
            planActive ? (
              <Badge variant="outline" className="text-xs font-normal gap-1 ml-auto" data-testid="badge-plan-active">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {planActiveLabel}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-normal gap-1 ml-auto text-muted-foreground" data-testid="badge-plan-inactive">
                <AlertCircle className="w-3 h-3" />
                {noPlanLabel}
              </Badge>
            )
          )}
        </CardTitle>
      </CardHeader>

      <CardContent data-testid="text-conclusion" className="space-y-4">
        {/* Conclusion text */}
        {conclusion ? (
          isStructured ? (
            <div className="space-y-3">
              {sections.map((section, i) => {
                const type = detectSectionType(section.heading);
                const style = SECTION_STYLES[type];
                const Icon = style.icon;
                return (
                  <div key={i} className={`space-y-1 ${style.wrapperClass}`}>
                    {section.heading && (
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${style.iconClass}`} />
                        <p className={`text-sm font-semibold ${style.headingClass}`}>{section.heading}</p>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">{conclusion}</p>
          )
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground italic">
            {planActive ? emptyWithPlanText : emptyNoPlanText}
          </p>
        )}

        {/* Chat toggle button */}
        <div className="border-t border-border/50 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-muted-foreground"
            onClick={() => setChatOpen(v => !v)}
            data-testid="button-conclusion-chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {labels.chatTitle}
          </Button>
        </div>

        {/* Inline chat panel */}
        {chatOpen && (
          <div className="border border-border rounded-md overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">{labels.chatTitle}</span>
              </div>
              {chatEntries.length > 0 && (
                <button
                  onClick={() => setChatEntries([])}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover-elevate px-1.5 py-0.5 rounded"
                  data-testid="button-conclusion-chat-reset"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  {labels.reset}
                </button>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="h-64 px-3 py-3">
              {chatEntries.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{labels.suggestionsLabel}</p>
                  {suggestionsLoading ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">…</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(dynamicSuggestions ?? fallbackSuggestions).map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendQuestion(q)}
                          className="text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-1 hover-elevate bg-background"
                          data-testid={`button-conclusion-suggestion-${i}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {chatEntries.map((entry, i) =>
                    entry.role === 'user'
                      ? <ChatBubbleUser key={i} text={(entry as UserMessage).text} />
                      : <ChatBubbleAssistant key={i} {...(entry as AssistantMessage)} labels={labels} onFollowup={sendQuestion} />
                  )}
                  {chatLoading && (
                    <div className="flex items-center gap-2 px-1">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">…</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2 px-3 py-2 border-t border-border bg-muted/20">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(chatInput); } }}
                placeholder={labels.placeholder}
                disabled={chatLoading}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
                data-testid="input-conclusion-chat"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => sendQuestion(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                data-testid="button-conclusion-chat-send"
              >
                {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
