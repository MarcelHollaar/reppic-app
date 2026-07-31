import { PieChartCard } from "@/components/PieChartCard";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Users, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

export default function NextStepDisciplineDashboard() {
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

  const nextStepsAbsolute = ((analytics?.nextStepDiscipline?.absolute || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));

  const nextStepsPercentages = ((analytics?.nextStepDiscipline?.percentages || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));

  const dmu = analytics?.dmuInsights;
  const dmuClarity = dmu?.dmuClarity ?? 0;
  const stakeholders = (dmu?.stakeholders || []) as Array<{ name: string; role: string; mentioned: boolean }>;

  const getClarityColor = (score: number) => {
    if (score >= 70) return "text-chart-2";
    if (score >= 40) return "text-chart-4";
    return "text-destructive";
  };

  const reportSections = buildOperationalReportSections(analytics, language);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t.nextStepDiscipline}</h1>
          <p className="text-sm text-muted-foreground">
            {t.nextStepDisciplineDesc}
          </p>
        </div>
        <div className="flex gap-3">
          <PdfDownloadButton 
            dashboardTitle={buildOperationalReportTitle(language)}
            dashboardSubtitle={t.nextStepDisciplineDesc}
            period={formatSelectedDate(selectedDate, language)}
            conclusion={analytics?.nextStepDiscipline?.comparison}
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
        conclusion={analytics?.nextStepDiscipline?.comparison}
        planActive={operationalPlanActive}
        planActiveLabel={t.planActiveIndicator}
        noPlanLabel={t.noPlanIndicator}
        emptyWithPlanText={t.conclusionEmptyWithPlan}
        emptyNoPlanText={t.conclusionEmptyNoPlan}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {nextStepsPercentages.length > 0 && (
          <PieChartCard
            title={`${t.nextStepDiscipline} — %`}
            data={nextStepsPercentages}
            alerts={analytics?.nextStepDiscipline?.percentageAlerts}
            summary={analytics?.nextStepDiscipline?.percentageSummary}
          />
        )}
      </div>

      {dmu && (
        <>
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-1" data-testid="text-dmu-title">{t.dmuInsights}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t.dmuInsightsDesc}</p>
          </div>

          {dmu.comparison && (
            <ConclusionCard 
              dashboardType="operational"
              title={t.dmuInsights}
              conclusion={dmu.comparison}
              planActive={operationalPlanActive}
              planActiveLabel={t.planActiveIndicator}
              noPlanLabel={t.noPlanIndicator}
              emptyWithPlanText={t.conclusionEmptyWithPlan}
              emptyNoPlanText={t.conclusionEmptyNoPlan}
            />
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="hover-elevate" data-testid="card-dmu-clarity">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.dmuClarityScore}</CardTitle>
                <Target className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold font-mono", getClarityColor(dmuClarity))} data-testid="text-dmu-clarity-value">
                  {dmuClarity}<span className="text-lg text-muted-foreground">/100</span>
                </div>
                <div className="mt-3 w-full bg-muted rounded-full h-2">
                  <div 
                    className={cn(
                      "h-2 rounded-full transition-all",
                      dmuClarity >= 70 ? "bg-chart-2" : dmuClarity >= 40 ? "bg-chart-4" : "bg-destructive"
                    )}
                    style={{ width: `${dmuClarity}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-dmu-mentioned">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.dmuMentioned}</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {dmu.dmuMentioned ? (
                    <CheckCircle className="w-5 h-5 text-chart-2" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <span className="text-lg font-semibold" data-testid="text-dmu-mentioned-value">
                    {dmu.dmuMentioned ? t.dmuMentioned : t.dmuNotMentioned}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-decision-process">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.decisionProcessClear}</CardTitle>
                <Target className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {dmu.decisionProcessClear ? (
                    <CheckCircle className="w-5 h-5 text-chart-2" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <span className="text-lg font-semibold" data-testid="text-decision-process-value">
                    {dmu.decisionProcessClear ? t.decisionProcessClear : t.decisionProcessUnclear}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

        </>
      )}
    </div>
  );
}
