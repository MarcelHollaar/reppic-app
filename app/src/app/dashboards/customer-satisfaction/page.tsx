"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#34d399",
  neutral: "#94a3b8",
  negative: "#f87171",
  positief: "#34d399",
  neutraal: "#94a3b8",
  negatief: "#f87171",
};

export default function CustomerSatisfactionPage() {
  const { t, i18n } = useTranslation("common");
  const { get } = useDashboardApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    get("/api/analytics/summary", { lang: i18n.language })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [get, i18n.language]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} />;

  const cs = data?.customerSatisfaction || {};
  const sentiments: any[] = cs.sentiments || [];
  const issues: any[] = cs.issues || [];

  // Positive share is intensity-weighted: sum of positive-type sentiment scores
  // over the total. Classification comes from `type`, not the (descriptive) name.
  const sentimentScoreTotal = sentiments.reduce((s: number, i: any) => s + (i.value || 0), 0);
  const positiveScore = sentiments
    .filter((s: any) => (s.type || "").toLowerCase().startsWith("pos"))
    .reduce((sum: number, s: any) => sum + (s.value || 0), 0);
  const positivePct = sentimentScoreTotal > 0 ? Math.round((positiveScore / sentimentScoreTotal) * 100) : 0;
  const conversationCount = data?.conversationCount ?? null;

  const pieData = sentiments.map((s: any) => ({
    name: s.name,
    description: s.description,
    value: s.value,
    color: SENTIMENT_COLORS[s.name?.toLowerCase()] || "#a78bfa",
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.positiveSentiment")} value={`${positivePct}%`} />
        <MetricCard title={t("dashboards.metrics.totalConversations")} value={conversationCount ?? "—"} />
        <MetricCard title={t("dashboards.metrics.reportedIssues")} value={issues.length} />
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <PieChartCard title={t("dashboards.metrics.sentimentDistribution")} data={pieData} summary={cs.comparison} />
        <RankedBarList
          title={t("dashboards.metrics.topIssues")}
          items={issues.slice(0, 8).map((i: any) => ({
            name: i.name,
            description: i.description,
            value: i.value,
            color: i.severity === "high" ? "#f87171" : i.severity === "medium" ? "#f59e0b" : "#94a3b8",
          }))}
        />
      </div>
    </div>
  );
}

function Loading() {
  return <div className="tw-flex tw-justify-center tw-py-24"><div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /></div>;
}
function ErrorView({ message }: { message: string }) {
  return <div className="tw-text-center tw-py-16"><p className="tw-text-base tw-font-semibold tw-text-red-500">{message}</p></div>;
}
