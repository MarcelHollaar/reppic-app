import { ConclusionCard } from "@/components/ConclusionCard";
import { usePlanStatus } from "@/hooks/use-plan-status";
import { TimeFilter, DateSelection, formatSelectedDate } from "@/components/TimeFilter";
import { useDateSelection } from "@/lib/DateContext";
import { DashboardTypeSelector } from "@/components/DashboardTypeSelector";
import { PdfDownloadButton } from "@/components/PdfDownloadButton";
import { buildOperationalReportSections, buildOperationalReportTitle } from "@/lib/buildReportSections";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PHASE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

const PHASE_NAMES: Record<string, string[]> = {
  nl: ["Propositie", "Inventarisatie", "Overtuiging", "Afsluiting"],
  en: ["Proposition", "Investigation", "Convincing", "Agreement"],
  de: ["Proposition", "Analyse", "Überzeugung", "Abschluss"],
  fr: ["Proposition", "Investigation", "Persuasion", "Accord"],
  es: ["Propuesta", "Investigación", "Persuasión", "Acuerdo"],
  it: ["Proposta", "Analisi", "Persuasione", "Accordo"],
};

const METRIC_LABELS: Record<string, Record<string, string>> = {
  nl: {
    breakTheIce: "IJsbreken",
    salesPitch: "Pitch",
    goalQuestion: "Doelvraag",
    expectationMgt: "Verwachtingen managen",
    contactPerson: "Gesprekspartner",
    company: "Bedrijf",
    cooperation: "Samenwerking",
    consequences: "Gevolgen",
    cure: "Oplossing",
    deepQuestioning: "Doorvragen",
    customerType: "Klantprofiel",
    uspUbrLink: "USP-koppeling",
    result: "Resultaat",
    acknowledgement: "Bevestiging",
    agreement: "Concrete afspraak",
  },
  en: {
    breakTheIce: "Ice breaker",
    salesPitch: "Pitch",
    goalQuestion: "Goal question",
    expectationMgt: "Expectation management",
    contactPerson: "Contact person",
    company: "Company",
    cooperation: "Cooperation",
    consequences: "Consequences",
    cure: "Solution",
    deepQuestioning: "Deep questioning",
    customerType: "Customer profile",
    uspUbrLink: "USP link",
    result: "Result",
    acknowledgement: "Confirmation",
    agreement: "Concrete agreement",
  },
  de: {
    breakTheIce: "Einstieg",
    salesPitch: "Pitch",
    goalQuestion: "Zielfrage",
    expectationMgt: "Erwartungsmanagement",
    contactPerson: "Kontaktperson",
    company: "Unternehmen",
    cooperation: "Zusammenarbeit",
    consequences: "Konsequenzen",
    cure: "Lösung",
    deepQuestioning: "Tiefes Fragen",
    customerType: "Kundenprofil",
    uspUbrLink: "USP-Verknüpfung",
    result: "Ergebnis",
    acknowledgement: "Bestätigung",
    agreement: "Konkrete Vereinbarung",
  },
  fr: {
    breakTheIce: "Brise-glace",
    salesPitch: "Pitch",
    goalQuestion: "Question d'objectif",
    expectationMgt: "Gestion des attentes",
    contactPerson: "Interlocuteur",
    company: "Entreprise",
    cooperation: "Coopération",
    consequences: "Conséquences",
    cure: "Solution",
    deepQuestioning: "Questionnement approfondi",
    customerType: "Profil client",
    uspUbrLink: "Lien USP",
    result: "Résultat",
    acknowledgement: "Confirmation",
    agreement: "Accord concret",
  },
  es: {
    breakTheIce: "Rompe el hielo",
    salesPitch: "Pitch",
    goalQuestion: "Pregunta de objetivo",
    expectationMgt: "Gestión de expectativas",
    contactPerson: "Persona de contacto",
    company: "Empresa",
    cooperation: "Cooperación",
    consequences: "Consecuencias",
    cure: "Solución",
    deepQuestioning: "Pregunta profunda",
    customerType: "Perfil del cliente",
    uspUbrLink: "Vinculación USP",
    result: "Resultado",
    acknowledgement: "Confirmación",
    agreement: "Acuerdo concreto",
  },
  it: {
    breakTheIce: "Rompere il ghiaccio",
    salesPitch: "Pitch",
    goalQuestion: "Domanda obiettivo",
    expectationMgt: "Gestione aspettative",
    contactPerson: "Persona di contatto",
    company: "Azienda",
    cooperation: "Cooperazione",
    consequences: "Conseguenze",
    cure: "Soluzione",
    deepQuestioning: "Domande approfondite",
    customerType: "Profilo cliente",
    uspUbrLink: "Collegamento USP",
    result: "Risultato",
    acknowledgement: "Conferma",
    agreement: "Accordo concreto",
  },
};

const PHASE_METRICS = [
  ["breakTheIce", "salesPitch", "goalQuestion", "expectationMgt"],
  ["contactPerson", "company", "cooperation", "consequences", "cure", "deepQuestioning", "customerType"],
  ["uspUbrLink", "result", "acknowledgement"],
  ["agreement"],
];

function getScoreColor(value: number): string {
  if (value <= 35) return "bg-red-500";
  if (value <= 60) return "bg-amber-500";
  return "bg-green-500";
}

function getScoreBadgeVariant(value: number): string {
  if (value <= 35) return "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20";
  if (value <= 60) return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20";
}

// Phase 3 (Overtuiging) uses a chained logic:
// All 3 elements (USP link, Result, Acknowledgement) must be present (>60) for GREEN.
// 1 missing → ORANGE, 2 or 3 missing → RED.
// Individual metric bars still use their own score.
function getPhase3IndicatorStyle(metrics: { key: string; value: number }[]): { barColor: string; badgeVariant: string } {
  const keys = ["uspUbrLink", "result", "acknowledgement"];
  const failing = keys.filter(k => {
    const m = metrics.find(m => m.key === k);
    return !m || m.value <= 60;
  }).length;
  if (failing === 0) return {
    barColor: "bg-green-500",
    badgeVariant: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20",
  };
  if (failing === 1) return {
    barColor: "bg-amber-500",
    badgeVariant: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  return {
    barColor: "bg-red-500",
    badgeVariant: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
  };
}

export default function PicaPerformanceDashboard() {
  const { selectedDate, setSelectedDate } = useDateSelection();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const [, setLocation] = useLocation();

  const { operationalPlanActive } = usePlanStatus();
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
  const queryParams = window.location.search;

  const { data: analytics } = useQuery<any>({
    queryKey: ['/api/analytics/operational', { demo: isDemoMode, lang: language, year: selectedDate.year, month: selectedDate.month }],
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isDemoMode) params.set('demo', 'true');
      params.set('lang', language);
      params.set('year', selectedDate.year);
      params.set('month', selectedDate.month);
      const res = await fetch(`/api/analytics/operational?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    }
  });

  const handleSwitchDashboard = () => {
    setLocation(`/${queryParams}`);
  };

  const phaseScores: any[] = analytics?.picaPerformance?.phaseScores || [];
  const phaseDetails: any[] = analytics?.picaPerformance?.phaseDetails || [];
  const phaseNames = PHASE_NAMES[language] || PHASE_NAMES.en;
  const metricLabels = METRIC_LABELS[language] || METRIC_LABELS.en;

  const getPhaseScore = (phaseIndex: number): number | null => {
    const item = phaseScores[phaseIndex];
    return item ? item.value : null;
  };

  const getPhaseMetrics = (phaseNum: number): { key: string; value: number }[] => {
    const detail = phaseDetails.find((d: any) => d.phase === phaseNum);
    if (detail) return detail.metrics || [];
    return PHASE_METRICS[phaseNum - 1].map(key => ({ key, value: 0 }));
  };

  const reportSections = buildOperationalReportSections(analytics, language);

  const hasData = phaseScores.length > 0 || phaseDetails.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t.picaPerformance}</h1>
          <p className="text-sm text-muted-foreground">{t.picaPerformanceDesc}</p>
        </div>
        <div className="flex gap-3">
          <PdfDownloadButton
            dashboardTitle={buildOperationalReportTitle(language)}
            dashboardSubtitle={t.picaPerformanceDesc}
            period={formatSelectedDate(selectedDate, language)}
            conclusion={analytics?.picaPerformance?.comparison}
            sections={reportSections}
            language={language}
            dashboardType="operational"
            buttonText={t.downloadPdf}
          />
          <DashboardTypeSelector currentType="operational" onSwitch={handleSwitchDashboard} />
          <TimeFilter selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>
      </div>

      <div className="bg-muted/30 border rounded-md px-4 py-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t.selectedPeriod}: <span className="text-foreground font-semibold">{formatSelectedDate(selectedDate, language)}</span>
        </p>
      </div>

      <ConclusionCard
        dashboardType="operational"
        title={t.conclusionOperational}
        conclusion={analytics?.picaPerformance?.comparison}
        planActive={operationalPlanActive}
        planActiveLabel={t.planActiveIndicator}
        noPlanLabel={t.noPlanIndicator}
        emptyWithPlanText={t.conclusionEmptyWithPlan}
        emptyNoPlanText={t.conclusionEmptyNoPlan}
      />

      {hasData && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {phaseNames.map((phaseName, phaseIndex) => {
            const phaseNum = phaseIndex + 1;
            const phaseScore = getPhaseScore(phaseIndex);
            const metrics = getPhaseMetrics(phaseNum);
            const color = PHASE_COLORS[phaseIndex];

            // Phase 3 (Overtuiging): chained logic — all 3 elements required for green
            const isPhase3 = phaseIndex === 2;
            const phase3Style = isPhase3 ? getPhase3IndicatorStyle(metrics) : null;
            const indicatorBarColor = phase3Style ? phase3Style.barColor : getScoreColor(phaseScore ?? 0);
            const indicatorBadgeVariant = phase3Style ? phase3Style.badgeVariant : getScoreBadgeVariant(phaseScore ?? 0);

            return (
              <Card key={phaseNum} data-testid={`card-phase-${phaseNum}`} className="overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-sm leading-tight">{phaseName}</span>
                    </div>
                    {phaseScore !== null && (
                      <Badge
                        variant="outline"
                        className={`text-xs font-bold tabular-nums ${indicatorBadgeVariant}`}
                        data-testid={`badge-phase-score-${phaseNum}`}
                      >
                        {phaseScore}
                      </Badge>
                    )}
                  </div>
                  {phaseScore !== null && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${indicatorBarColor}`}
                        style={{ width: `${phaseScore}%` }}
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2.5">
                    {metrics.map((metric) => {
                      const label = metricLabels[metric.key] || metric.key;
                      const val = metric.value;
                      return (
                        <div key={metric.key} data-testid={`metric-${metric.key}`}>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs text-muted-foreground leading-tight flex-1">{label}</span>
                            <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${
                              val <= 35 ? 'text-red-600 dark:text-red-400' :
                              val <= 60 ? 'text-amber-600 dark:text-amber-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>{val}</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getScoreColor(val)}`}
                              style={{ width: `${val}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!hasData && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">{t.conclusionEmptyNoPlan}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
