import { PieChartCard } from "@/components/PieChartCard";
import { ConclusionCard } from "@/components/ConclusionCard";
import { usePlanStatus } from "@/hooks/use-plan-status";
import { TimeFilter, DateSelection, formatSelectedDate } from "@/components/TimeFilter";
import { useDateSelection } from "@/lib/DateContext";
import { DashboardTypeSelector } from "@/components/DashboardTypeSelector";
import { PdfDownloadButton, type ReportSection } from "@/components/PdfDownloadButton";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

export default function ConversationActivityDashboard() {
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

  const activityAbsolute = ((analytics?.conversationActivity?.absolute || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));

  const activityPercentages = ((analytics?.conversationActivity?.percentages || []) as any[]).map((item, i) => ({
    ...item,
    color: chartColors[i % chartColors.length]
  }));


  const reportSections: ReportSection[] = [
    {
      title: `${t.conversationActivity} - ${t.absoluteNumbers}`,
      type: "table",
      data: activityAbsolute.map(item => ({ name: item.name, value: item.value }))
    },
    {
      title: `${t.conversationActivity} - ${t.percentages}`,
      type: "table",
      data: activityPercentages.map(item => ({ name: item.name, value: item.value }))
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t.conversationActivity}</h1>
          <p className="text-sm text-muted-foreground">
            {t.conversationActivityDesc}
          </p>
        </div>
        <div className="flex gap-3">
          <PdfDownloadButton 
            dashboardTitle={t.conversationActivity}
            dashboardSubtitle={t.conversationActivityDesc}
            period={formatSelectedDate(selectedDate, language)}
            conclusion={analytics?.conversationActivity?.comparison}
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
        conclusion={analytics?.conversationActivity?.comparison}
        planActive={operationalPlanActive}
        planActiveLabel={t.planActiveIndicator}
        noPlanLabel={t.noPlanIndicator}
        emptyWithPlanText={t.conclusionEmptyWithPlan}
        emptyNoPlanText={t.conclusionEmptyNoPlan}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {activityAbsolute.length > 0 && (
          <PieChartCard
            title={t.conversationActivity}
            data={activityAbsolute}
            alerts={analytics?.conversationActivity?.absoluteAlerts}
            summary={analytics?.conversationActivity?.absoluteSummary}
          />
        )}
        {activityPercentages.length > 0 && (
          <PieChartCard
            title={`${t.conversationActivity} — %`}
            data={activityPercentages}
            alerts={analytics?.conversationActivity?.percentageAlerts}
            summary={analytics?.conversationActivity?.percentageSummary}
          />
        )}
      </div>
    </div>
  );
}
