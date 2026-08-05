"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { PieChartCard } from "@/components/salesDashboards/PieChartCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

export default function NextStepsPage() {
  const { get } = useDashboardApi();
  const { i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get("/api/analytics/operational", { lang: i18n.language })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [get, i18n.language]);

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  const ns = data?.nextStepDiscipline || {};
  const withNextStep = ns.withClearNextStep ?? 0;
  const nextStepTypes: any[] = ns.nextStepTypes || [];
  const avgClarity = Math.round(ns.avgNextStepClarity ?? 0);

  const gaugeColor = withNextStep >= 70 ? "#34d399" : withNextStep >= 50 ? "#f59e0b" : "#f87171";

  const pieData = nextStepTypes.slice(0, 6).map((t: any, i: number) => ({
    name: t.name,
    value: t.value,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title="Gesprekken met duidelijke vervolgstap" value={`${withNextStep}%`} />
        <MetricCard title="Gemiddelde helderheid (0–100)" value={avgClarity} />
        <MetricCard title="Types vervolgstappen" value={nextStepTypes.length} />
      </div>

      {/* Gauge visual */}
      <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-flex tw-flex-col tw-items-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">
            Vervolgstap discipline
          </h2>
          <div className="tw-relative tw-w-48 tw-h-24">
            <svg viewBox="0 0 200 100" className="tw-w-full tw-h-full">
              <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
              <path
                d="M 10 100 A 90 90 0 0 1 190 100"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={`${(withNextStep / 100) * 283} 283`}
              />
            </svg>
            <div className="tw-absolute tw-inset-0 tw-flex tw-flex-col tw-items-center tw-justify-end tw-pb-1">
              <span className="tw-text-3xl tw-font-bold tw-font-mono" style={{ color: gaugeColor }}>{withNextStep}%</span>
            </div>
          </div>
          {ns.comparison && (
            <p className="tw-text-sm tw-text-gray-500 tw-text-center tw-mt-3 tw-max-w-md">
              {ns.comparison}
            </p>
          )}
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        <PieChartCard title="Types vervolgstappen" data={pieData} />
        <RankedBarList
          title="Meest voorkomende vervolgstappen"
          items={nextStepTypes.slice(0, 8).map((t: any, i: number) => ({
            name: t.name,
            value: t.value,
            color: COLORS[i % COLORS.length],
          }))}
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
