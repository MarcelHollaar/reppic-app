import { useState } from "react";
import { PieChartCard } from "@/components/PieChartCard";
import { ConclusionCard } from "@/components/ConclusionCard";
import { usePlanStatus } from "@/hooks/use-plan-status";
import { TimeFilter, DateSelection, formatSelectedDate, getCurrentDateSelection } from "@/components/TimeFilter";
import { DashboardTypeSelector } from "@/components/DashboardTypeSelector";
import { PdfDownloadButton, type ReportSection } from "@/components/PdfDownloadButton";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

export default function TeamInsightsDashboard() {
  const [selectedDate, setSelectedDate] = useState<DateSelection>(getCurrentDateSelection());
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

  const teamSkillsAbsolute = ((analytics?.teamInsights?.absolute || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));

  const teamSkillsPercentages = ((analytics?.teamInsights?.percentages || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));


  const uspOverview = ((analytics?.teamInsights?.uspOverview || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));

  const getRelevanceBadge = (relevance: string) => {
    switch (relevance) {
      case 'high':
        return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">{t.highRelevance}</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">{t.mediumRelevance}</Badge>;
      case 'low':
        return <Badge variant="default" className="bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30">{t.lowRelevance}</Badge>;
      default:
        return null;
    }
  };

  const reportSections: ReportSection[] = [
    {
      title: `${t.teamSkillsOverview} - ${t.absoluteNumbers}`,
      type: "table",
      data: teamSkillsAbsolute.map(item => ({ name: item.name, value: item.value }))
    },
    {
      title: `${t.teamSkillsOverview} - ${t.percentages}`,
      type: "table",
      data: teamSkillsPercentages.map(item => ({ name: item.name, value: item.value }))
    },
    {
      title: t.uspOverview,
      type: "table",
      data: uspOverview.map(item => ({ name: item.name, value: item.value }))
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t.teamInsights}</h1>
          <p className="text-sm text-muted-foreground">
            {t.teamInsightsDesc}
          </p>
        </div>
        <div className="flex gap-3">
          <PdfDownloadButton 
            dashboardTitle={t.teamInsights}
            dashboardSubtitle={t.teamInsightsDesc}
            period={formatSelectedDate(selectedDate, language)}
            conclusion={analytics?.teamInsights?.comparison}
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
        conclusion={analytics?.teamInsights?.comparison}
        planActive={operationalPlanActive}
        planActiveLabel={t.planActiveIndicator}
        noPlanLabel={t.noPlanIndicator}
        emptyWithPlanText={t.conclusionEmptyWithPlan}
        emptyNoPlanText={t.conclusionEmptyNoPlan}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {teamSkillsAbsolute.length > 0 && (
          <PieChartCard
            title={t.teamSkillsOverview}
            data={teamSkillsAbsolute}
            alerts={analytics?.teamInsights?.absoluteAlerts}
            summary={analytics?.teamInsights?.absoluteSummary}
          />
        )}
        {teamSkillsPercentages.length > 0 && (
          <PieChartCard
            title={`${t.teamSkillsOverview} — %`}
            data={teamSkillsPercentages}
            alerts={analytics?.teamInsights?.percentageAlerts}
            summary={analytics?.teamInsights?.percentageSummary}
          />
        )}
      </div>

      {uspOverview.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t.uspOverview}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <PieChartCard 
              title={t.mostMentionedUsps}
              data={uspOverview}
              alerts={analytics?.teamInsights?.uspAlerts}
              summary={analytics?.teamInsights?.uspSummary}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.uspMentions}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {uspOverview.map((usp: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        <span className="font-medium">{usp.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{usp.value}x</span>
                        {usp.relevance && getRelevanceBadge(usp.relevance)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
