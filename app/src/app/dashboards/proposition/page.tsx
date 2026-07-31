"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

export default function PropositionPage() {
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

  const prop = data?.proposition || {};
  // API shape is { execution, resonance, comparison }.
  const execution: any[] = prop.execution || [];
  const resonance: any[] = prop.resonance || [];

  const pieData = resonance.slice(0, 5).map((item: any, i: number) => ({
    name: item.name,
    description: item.description,
    value: item.value,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.communicatedElements")} value={execution.length} />
        <MetricCard title={t("dashboards.metrics.resonatedWithCustomer")} value={resonance.length} />
        <MetricCard title={t("dashboards.metrics.strongestResonance")} value={resonance[0]?.name || "—"} />
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <RankedBarList
          title={t("dashboards.metrics.communicatedProposition")}
          items={execution.slice(0, 8).map((r: any) => ({
            name: r.name,
            description: r.description,
            value: r.value,
            color: "#5971F6",
          }))}
        />
        <PieChartCard title={t("dashboards.metrics.resonanceWithCustomer")} data={pieData} summary={prop.comparison} />
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
