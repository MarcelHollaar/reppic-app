import { PieChartCard } from "@/components/PieChartCard";
import { ConclusionCard } from "@/components/ConclusionCard";
import { usePlanStatus } from "@/hooks/use-plan-status";
import { TimeFilter, DateSelection, formatSelectedDate } from "@/components/TimeFilter";
import { useDateSelection } from "@/lib/DateContext";
import { DashboardTypeSelector } from "@/components/DashboardTypeSelector";
import { PdfDownloadButton } from "@/components/PdfDownloadButton";
import { buildStrategicReportSections, buildStrategicReportTitle } from "@/lib/buildReportSections";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FileText, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

export default function PropositionDashboard() {
  const { selectedDate, setSelectedDate } = useDateSelection();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const [, setLocation] = useLocation();

  const { strategicPlanActive } = usePlanStatus();
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
  const queryParams = window.location.search;

  const { data: analytics } = useQuery<any>({
    queryKey: ['/api/analytics/summary', { demo: isDemoMode, lang: language, year: selectedDate.year, month: selectedDate.month }],
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isDemoMode) params.set('demo', 'true');
      params.set('lang', language);
      params.set('year', selectedDate.year);
      params.set('month', selectedDate.month);
      const res = await fetch(`/api/analytics/summary?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    }
  });

  const handleSwitchDashboard = () => {
    setLocation(`/operational/pica${queryParams}`);
  };

  const proposition = analytics?.proposition || {};
  const executionData = (proposition.execution || []).map((item: any, i: number) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));
  const resonanceData = (proposition.resonance || []).map((item: any, i: number) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));

  const reportSections = buildStrategicReportSections(analytics, language);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t.proposition}</h1>
          <p className="text-sm text-muted-foreground">{t.propositionDesc}</p>
        </div>
        <div className="flex gap-3">
          {strategicPlanActive && (
            <PdfDownloadButton
              dashboardTitle={buildStrategicReportTitle(language)}
              dashboardSubtitle={t.propositionDesc}
              period={formatSelectedDate(selectedDate, language)}
              conclusion={analytics?.proposition?.comparison}
              sections={reportSections}
              language={language}
              dashboardType="strategic"
              buttonText={t.downloadPdf}
            />
          )}
          <DashboardTypeSelector currentType="strategic" onSwitch={handleSwitchDashboard} />
          <TimeFilter selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>
      </div>

      {/* ── Period indicator ── */}
      <div className="bg-muted/30 border rounded-md px-4 py-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t.selectedPeriod}: <span className="text-foreground font-semibold">{formatSelectedDate(selectedDate, language)}</span>
        </p>
      </div>

      {/* ── No plan gate ── */}
      {!strategicPlanActive && !isDemoMode ? (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="font-semibold text-base text-foreground">{t.propositionNoPlanTitle}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.propositionNoPlanDesc}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-2"
              onClick={() => setLocation(`/admin${queryParams}`)}
              data-testid="button-proposition-upload-plan"
            >
              <UploadCloud className="w-4 h-4" />
              {t.propositionNoPlanAction}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Conclusion card with chat ── */}
          <ConclusionCard
            title={t.conclusionProposition}
            conclusion={analytics?.proposition?.comparison}
            topic={t.proposition}
            planActive={strategicPlanActive}
            planActiveLabel={t.planActiveIndicator}
            noPlanLabel={t.noPlanIndicator}
            emptyWithPlanText={t.conclusionEmptyWithPlan}
            emptyNoPlanText={t.conclusionEmptyNoPlan}
          />

          {/* ── Charts ── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Propositie-uitvoering */}
            <div>
              <h2 className="text-lg font-semibold mb-4">{t.propositionExecution}</h2>
              <p className="text-sm text-muted-foreground mb-3">{t.propositionExecutionDesc}</p>
              <PieChartCard
                title={t.propositionExecution}
                data={executionData}
                alerts={proposition.executionAlerts}
                summary={proposition.executionSummary}
              />
            </div>

            {/* Klantresonantie */}
            <div>
              <h2 className="text-lg font-semibold mb-4">{t.propositionResonance}</h2>
              <p className="text-sm text-muted-foreground mb-3">{t.propositionResonanceDesc}</p>
              <PieChartCard
                title={t.propositionResonance}
                data={resonanceData}
                alerts={proposition.resonanceAlerts}
                summary={proposition.resonanceSummary}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
