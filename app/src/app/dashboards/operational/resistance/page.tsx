"use client";
import React, { useEffect, useState } from "react";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";

const COLORS = ["#f87171", "#f59e0b", "#5971F6", "#34d399", "#a78bfa", "#38bdf8"];

export default function ResistancePage() {
  const { get } = useDashboardApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get("/api/analytics/operational", { lang: "nl" })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [get]);

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  const rn = data?.resistanceNeeds || {};
  const resistances: any[] = rn.topResistances || [];
  const triggers: any[] = rn.commercialTriggers || [];

  const topResistance = resistances[0]?.name || "—";
  const topTrigger = triggers[0]?.name || "—";

  const pieData = triggers.slice(0, 6).map((t: any, i: number) => ({
    name: t.name,
    description: t.description,
    value: t.value,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title="Meest voorkomende weerstand" value={topResistance} />
        <MetricCard title="Totaal weerstanden" value={resistances.length} />
        <MetricCard title="Sterkste commerciële trigger" value={topTrigger} />
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <RankedBarList
          title="Top weerstanden"
          items={resistances.slice(0, 8).map((r: any, i: number) => ({
            name: r.name,
            description: r.description,
            value: r.value,
            color: r.category === "price" || r.category === "prijs" ? "#f87171" : COLORS[i % COLORS.length],
          }))}
        />
        <PieChartCard
          title="Commerciële triggers"
          data={pieData}
          summary={rn.comparison}
        />
      </div>
    </div>
  );
}

function Loading() {
  return <div className="tw-flex tw-justify-center tw-py-24"><div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /></div>;
}
function Error({ message }: { message: string }) {
  return <div className="tw-text-center tw-py-16"><p className="tw-text-base tw-font-semibold tw-text-red-500">{message}</p></div>;
}
