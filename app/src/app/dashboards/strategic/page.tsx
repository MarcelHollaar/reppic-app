"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";
import { PlanUploadModal } from "@/components/salesDashboards/PlanUploadModal";
import { ConclusionCard } from "@/components/salesDashboards/ConclusionCard";

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#38bdf8"];

const TABS = ["trends", "customerSatisfaction", "competition", "proposition"] as const;
type Tab = typeof TABS[number];

// Trend-group keys map to dashboards.trendGroups.<key>; unknown keys fall back to the raw key.
const GROUP_KEYS = ["relational", "functional", "financial", "organizational", "strategic", "urgency"];

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#34d399", positief: "#34d399", neutral: "#94a3b8", neutraal: "#94a3b8",
  negative: "#f87171", negatief: "#f87171",
};

function useGroupLabel() {
  const { t } = useTranslation("common");
  return (key: string) => (GROUP_KEYS.includes(key) ? t(`dashboards.trendGroups.${key}`) : key);
}

export default function StrategicDashboard() {
  const { t, i18n } = useTranslation("common");
  const { get } = useDashboardApi();
  const [activeTab, setActiveTab] = useState<Tab>("trends");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(null);
    get("/api/analytics/summary", { lang: i18n.language })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Re-fetch on language change so AI-generated content follows the selector too.
  useEffect(() => { loadData(); }, [get, i18n.language]);

  return (
    <div>
      {/* Upload modal */}
      <PlanUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        planType="strategic"
        title={t("dashboards.uploadStrategicPlanTitle")}
        description={t("dashboards.uploadStrategicPlanDesc")}
        onUploaded={() => { setShowUpload(false); loadData(); }}
      />

      {/* Header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-mb-6">
        <div>
          <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1" suppressHydrationWarning>{t("dashboards.strategic")}</h1>
          <p className="tw-text-sm tw-text-gray-400" suppressHydrationWarning>{t("dashboards.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-white tw-rounded-xl tw-px-4 tw-py-2 tw-flex-shrink-0 tw-transition-opacity hover:tw-opacity-90"
          style={{ backgroundColor: "#5971F6" }}
        >
          <ArrowUpTrayIcon className="tw-w-4 tw-h-4" />
          <span suppressHydrationWarning>{t("dashboards.strategicPlan")}</span>
        </button>
      </div>

      {/* Tabs — nomi pill style */}
      <div className="tw-flex tw-gap-1 tw-mb-6 tw-rounded-2xl tw-p-1 tw-w-fit" style={{ backgroundColor: "#EBEBEB" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tw-px-4 tw-py-1.5 tw-text-sm tw-font-medium tw-rounded-xl tw-transition-all ${
              activeTab === tab
                ? "tw-bg-white tw-text-gray-900 tw-font-semibold"
                : "tw-text-gray-500 hover:tw-text-gray-700"
            }`}
            style={activeTab === tab ? { boxShadow: "0 1px 4px rgba(0,0,0,0.10)" } : {}}
          >
            <span suppressHydrationWarning>{t(`dashboards.${tab}`)}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data && (
        <>
          {activeTab === "trends" && <TrendsTab data={data} />}
          {activeTab === "customerSatisfaction" && <CustomerSatisfactionTab data={data} />}
          {activeTab === "competition" && <CompetitionTab data={data} />}
          {activeTab === "proposition" && <PropositionTab data={data} />}
        </>
      )}
    </div>
  );
}

function TrendsTab({ data }: { data: any }) {
  const { t, i18n } = useTranslation("common");
  const groupLabel = useGroupLabel();
  const trendGroups = data?.trends?.trendGroups || {};
  const groups = Object.entries(trendGroups) as [string, any[]][];
  // Count of distinct needs found — not the sum of their intensity scores.
  const allNeeds = groups.flatMap(([, items]) => items);
  const totalNeeds = allNeeds.length;
  // New vs known are derived from each need's `type` (the API has no separate
  // newNeeds/knownNeeds arrays).
  const newNeeds = allNeeds.filter((i: any) => (i.type || "").toLowerCase() === "new").length;
  const knownNeeds = allNeeds.filter((i: any) => (i.type || "").toLowerCase() === "known").length;
  // Pie shows relative intensity per category (sum of value scores).
  const pieData = groups.map(([key, items], i) => ({
    name: groupLabel(key),
    value: items.reduce((s: number, it: any) => s + (it.value || 0), 0),
    color: COLORS[i % COLORS.length],
  }));
  return (
    <div className="tw-space-y-6">
      <ConclusionCard title={t("dashboards.conclusions.trends")} conclusion={data?.trends?.comparison} dashboardType="strategic" language={i18n.language} />
      <div className="tw-grid tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.totalNeeds")} value={totalNeeds} />
        <MetricCard title={t("dashboards.metrics.categories")} value={groups.length} />
        <MetricCard title={t("dashboards.metrics.newNeeds")} value={newNeeds} />
        <MetricCard title={t("dashboards.metrics.knownNeeds")} value={knownNeeds} />
      </div>
      {/* Distribution chart spans the full page width... */}
      <PieChartCard title={t("dashboards.metrics.distributionPerGroup")} data={pieData} />
      {/* ...with all category lists in a responsive grid below it. */}
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        {groups.map(([key, items]) => (
          <RankedBarList key={key} title={groupLabel(key)}
            items={items.slice(0, 8).map((it: any, i: number) => ({ name: it.name, value: it.value, description: it.description, color: COLORS[i % COLORS.length] }))} />
        ))}
      </div>
    </div>
  );
}

function CustomerSatisfactionTab({ data }: { data: any }) {
  const { t, i18n } = useTranslation("common");
  const cs = data?.customerSatisfaction || {};
  const sentiments: any[] = cs.sentiments || [];
  const issues: any[] = cs.issues || [];
  // Positive share is intensity-weighted: sum of positive-type sentiment scores
  // over the total. Classification comes from `type`, not the (descriptive) name.
  const sentimentScoreTotal = sentiments.reduce((s: number, i: any) => s + (i.value || 0), 0);
  const pos = sentiments
    .filter((s: any) => (s.type || "").toLowerCase().startsWith("pos"))
    .reduce((sum: number, s: any) => sum + (s.value || 0), 0);
  const conversationCount = data?.conversationCount ?? null;
  const pieData = sentiments.map((s: any) => ({ name: s.name, value: s.value, description: s.description, color: SENTIMENT_COLORS[s.name?.toLowerCase()] || "#a78bfa" }));
  return (
    <div className="tw-space-y-6">
      <ConclusionCard title={t("dashboards.conclusions.customerSatisfaction")} conclusion={cs.comparison} dashboardType="strategic" language={i18n.language} />
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.positiveSentiment")} value={sentimentScoreTotal > 0 ? `${Math.round((pos / sentimentScoreTotal) * 100)}%` : "—"} />
        <MetricCard title={t("dashboards.metrics.totalConversations")} value={conversationCount ?? "—"} />
        <MetricCard title={t("dashboards.metrics.reportedIssues")} value={issues.length} />
      </div>
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <PieChartCard title={t("dashboards.metrics.sentimentDistribution")} data={pieData} />
        <RankedBarList title={t("dashboards.metrics.topIssues")} items={issues.slice(0, 8).map((i: any) => ({ name: i.name, value: i.value, description: i.description, color: i.severity === "high" ? "#f87171" : i.severity === "medium" ? "#f59e0b" : "#94a3b8" }))} />
      </div>
    </div>
  );
}

function CompetitionTab({ data }: { data: any }) {
  const { t, i18n } = useTranslation("common");
  const comp = data?.competition || {};
  const competitors: any[] = comp.competitors || [];
  const strengths: any[] = comp.strengths || [];
  // Real mention frequency only (fall back to 1 = "at least mentioned once"),
  // never the 1-100 intensity score.
  const totalMentions = competitors.reduce((s: number, c: any) => s + (c.mentions ?? 1), 0);
  const pieData = competitors.slice(0, 6).map((c: any, i: number) => ({ name: c.name, value: c.mentions ?? c.value ?? 1, color: COLORS[i % COLORS.length] }));
  return (
    <div className="tw-space-y-6">
      <ConclusionCard title={t("dashboards.conclusions.competition")} conclusion={comp.comparison} dashboardType="strategic" language={i18n.language} />
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.mostMentioned")} value={competitors[0]?.competitor || competitors[0]?.name || "—"} />
        <MetricCard title={t("dashboards.metrics.totalMentions")} value={totalMentions} />
        <MetricCard title={t("dashboards.metrics.uniqueCompetitors")} value={competitors.length} />
      </div>
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <PieChartCard title={t("dashboards.metrics.competitorsShare")} data={pieData} />
        <RankedBarList title={t("dashboards.metrics.strengthsVsCompetition")} items={strengths.slice(0, 8).map((s: any, i: number) => ({ name: s.name, value: s.value, description: s.description, color: COLORS[i % COLORS.length] }))} />
      </div>
    </div>
  );
}

function PropositionTab({ data }: { data: any }) {
  const { t, i18n } = useTranslation("common");
  const prop = data?.proposition || {};
  // API shape is { execution, resonance, comparison }: which proposition
  // elements the seller communicated (execution) and which landed with the
  // customer (resonance).
  const execution: any[] = prop.execution || [];
  const resonance: any[] = prop.resonance || [];
  const pieData = resonance.slice(0, 5).map((item: any, i: number) => ({ name: item.name, value: item.value, description: item.description, color: COLORS[i % COLORS.length] }));
  return (
    <div className="tw-space-y-6">
      <ConclusionCard title={t("dashboards.conclusions.proposition")} conclusion={prop.comparison} dashboardType="strategic" language={i18n.language} />
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.communicatedElements")} value={execution.length} />
        <MetricCard title={t("dashboards.metrics.resonatedWithCustomer")} value={resonance.length} />
        <MetricCard title={t("dashboards.metrics.strongestResonance")} value={resonance[0]?.name || "—"} />
      </div>
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <RankedBarList title={t("dashboards.metrics.communicatedProposition")} items={execution.slice(0, 8).map((r: any) => ({ name: r.name, value: r.value, description: r.description, color: "#5971F6" }))} />
        <PieChartCard title={t("dashboards.metrics.resonanceWithCustomer")} data={pieData} />
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="tw-flex tw-justify-center tw-py-24"><div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /></div>;
}
function ErrorState({ message }: { message: string }) {
  return <div className="tw-text-center tw-py-16"><p className="tw-text-red-500 tw-font-medium">{message}</p></div>;
}
