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

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

const GROUP_KEYS = ["relational", "functional", "financial", "organizational", "strategic", "urgency"] as const;
type GroupKey = typeof GROUP_KEYS[number];

function mapGroupToTranslationKey(group: GroupKey): keyof ReturnType<typeof useTranslation> {
  const map: Record<GroupKey, keyof ReturnType<typeof useTranslation>> = {
    relational: "trendGroupRelational",
    functional: "trendGroupFunctional",
    financial: "trendGroupFinancial",
    organizational: "trendGroupOrganizational",
    strategic: "trendGroupStrategic",
    urgency: "trendGroupUrgency",
  };
  return map[group];
}

export default function TrendsDashboard() {
  const { selectedDate, setSelectedDate } = useDateSelection();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const [, setLocation] = useLocation();

  const { strategicPlanActive } = usePlanStatus();
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
  const queryParams = window.location.search;

  const handleSwitchDashboard = () => {
    setLocation(`/operational/pica${queryParams}`);
  };

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

  const trendGroups = analytics?.trends?.trendGroups || {};

  const getGroupData = (group: GroupKey) => {
    const items = ((trendGroups[group] || []) as any[]).slice(0, 5);
    return items.map((item: any, i: number) => ({
      ...item,
      color: chartColors[i % chartColors.length]
    }));
  };

  const reportSections = buildStrategicReportSections(analytics, language);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t.trends}</h1>
          <p className="text-sm text-muted-foreground">
            {t.trendsDesc}
          </p>
        </div>
        <div className="flex gap-3">
          <PdfDownloadButton
            dashboardTitle={buildStrategicReportTitle(language)}
            dashboardSubtitle={t.trendsDesc}
            period={formatSelectedDate(selectedDate, language)}
            conclusion={analytics?.trends?.comparison}
            sections={reportSections}
            language={language}
            dashboardType="strategic"
            buttonText={t.downloadPdf}
          />
          <DashboardTypeSelector currentType="strategic" onSwitch={handleSwitchDashboard} />
          <TimeFilter selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>
      </div>

      <div className="bg-muted/30 border rounded-md px-4 py-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t.selectedPeriod}: <span className="text-foreground font-semibold">{formatSelectedDate(selectedDate, language)}</span>
        </p>
      </div>

      <ConclusionCard
        title={t.conclusionTrends}
        conclusion={analytics?.trends?.comparison}
        planActive={strategicPlanActive}
        planActiveLabel={t.planActiveIndicator}
        noPlanLabel={t.noPlanIndicator}
        emptyWithPlanText={t.conclusionEmptyWithPlan}
        emptyNoPlanText={t.conclusionEmptyNoPlan}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {GROUP_KEYS.map(group => (
          <PieChartCard
            key={group}
            title={t[mapGroupToTranslationKey(group)] as string}
            data={getGroupData(group)}
          />
        ))}
      </div>
    </div>
  );
}
