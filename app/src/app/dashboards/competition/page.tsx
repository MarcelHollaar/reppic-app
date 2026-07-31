"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#38bdf8"];

export default function CompetitionPage() {
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

  const comp = data?.competition || {};
  const competitors: any[] = comp.competitors || [];
  const strengths: any[] = comp.strengths || [];

  // Show the competitor's company name when it was extracted from the transcript,
  // otherwise fall back to the advantage/feature so something is always shown.
  const topCompetitor = competitors[0]?.competitor || competitors[0]?.name || "—";
  // Real mention frequency only (fall back to 1 = "at least mentioned once"),
  // never the 1-100 intensity score.
  const totalMentions = competitors.reduce((s: number, c: any) => s + (c.mentions ?? 1), 0);

  const pieData = competitors.slice(0, 6).map((c: any, i: number) => ({
    name: c.name,
    description: c.description,
    value: c.mentions ?? c.value ?? 1,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.mostMentionedCompetitor")} value={topCompetitor} />
        <MetricCard title={t("dashboards.metrics.totalMentions")} value={totalMentions} />
        <MetricCard title={t("dashboards.metrics.uniqueCompetitors")} value={competitors.length} />
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <PieChartCard title={t("dashboards.metrics.competitorsShare")} data={pieData} summary={comp.comparison} />
        <RankedBarList
          title={t("dashboards.metrics.ownStrengthsVsCompetition")}
          items={strengths.slice(0, 8).map((s: any, i: number) => ({
            name: s.name,
            description: s.description,
            value: s.value,
            color: COLORS[i % COLORS.length],
          }))}
        />
      </div>

      <RankedBarList
        title={t("dashboards.metrics.allCompetitors")}
        items={competitors.map((c: any, i: number) => ({
          name: c.name,
          description: c.description,
          value: c.value || c.mentions || 1,
          color: COLORS[i % COLORS.length],
        }))}
        suffix=" x"
      />
    </div>
  );
}

function Loading() {
  return <div className="tw-flex tw-justify-center tw-py-24"><div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /></div>;
}
function ErrorView({ message }: { message: string }) {
  return <div className="tw-text-center tw-py-16"><p className="tw-text-base tw-font-semibold tw-text-red-500">{message}</p></div>;
}
