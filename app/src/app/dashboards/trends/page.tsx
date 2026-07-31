"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#38bdf8"];

const GROUP_KEYS = ["relational", "functional", "financial", "organizational", "strategic", "urgency"];

export default function TrendsDashboardPage() {
  const { t, i18n } = useTranslation("common");
  const { get } = useDashboardApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupLabel = (key: string) => (GROUP_KEYS.includes(key) ? t(`dashboards.trendGroups.${key}`) : key);

  useEffect(() => {
    setLoading(true);
    get("/api/analytics/summary", { lang: i18n.language })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [get, i18n.language]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const trendGroups = data?.trends?.trendGroups || {};
  const groups = Object.entries(trendGroups) as [string, any[]][];

  // Count of distinct needs found — not the sum of their intensity scores.
  const allNeeds = groups.flatMap(([, items]) => items);
  const totalNeeds = allNeeds.length;
  // New vs known derived from each need's `type` (no separate API arrays).
  const newNeeds = allNeeds.filter((i: any) => (i.type || "").toLowerCase() === "new").length;
  const knownNeeds = allNeeds.filter((i: any) => (i.type || "").toLowerCase() === "known").length;

  const pieData = groups.map(([key, items], i) => ({
    name: groupLabel(key),
    value: items.reduce((s: number, it: any) => s + (it.value || 0), 0),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.totalNeeds")} value={totalNeeds} />
        <MetricCard title={t("dashboards.metrics.categories")} value={groups.length} />
        <MetricCard title={t("dashboards.metrics.newNeeds")} value={newNeeds} />
        <MetricCard title={t("dashboards.metrics.knownNeeds")} value={knownNeeds} />
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <PieChartCard title={t("dashboards.metrics.distributionPerGroup")} data={pieData} summary={data?.trends?.comparison} />

        <div className="tw-space-y-4">
          {groups.slice(0, 3).map(([key, items]) => (
            <RankedBarList
              key={key}
              title={groupLabel(key)}
              items={items.slice(0, 5).map((it: any, i: number) => ({
                name: it.name,
                description: it.description,
                value: it.value,
                color: COLORS[i % COLORS.length],
              }))}
            />
          ))}
        </div>
      </div>

      {groups.slice(3).map(([key, items]) => (
        <RankedBarList
          key={key}
          title={groupLabel(key)}
          items={items.slice(0, 8).map((it: any, i: number) => ({
            name: it.name,
            description: it.description,
            value: it.value,
            color: COLORS[i % COLORS.length],
          }))}
        />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="tw-flex tw-justify-center tw-items-center tw-py-24">
      <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="tw-text-center tw-py-16">
      <p className="tw-text-base tw-font-semibold tw-text-red-500 tw-mb-2">{t("dashboards.states.loadError")}</p>
      <p className="tw-text-sm tw-text-gray-500">{message}</p>
    </div>
  );
}
