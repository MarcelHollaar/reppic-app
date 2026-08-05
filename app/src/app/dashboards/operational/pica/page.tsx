"use client";
import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { RankedBarList } from "@/components/salesDashboards/RankedBarList";

const PHASE_LABELS: Record<number, string> = { 1: "Propositie", 2: "Inventarisatie", 3: "Overtuiging", 4: "Afsluiting" };
const PHASE_COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171"];

export default function PicaPerformancePage() {
  const { get } = useDashboardApi();
  const { i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Taal volgt de gebruikersinstelling én herlaadt bij een taalwissel, zodat
    // een Duitse gebruiker Duitse inhoud krijgt (niet hardcoded "nl").
    get("/api/analytics/operational", { lang: i18n.language })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [get, i18n.language]);

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  const pica = data?.picaPerformance || {};
  const phaseScores: any[] = pica.phaseScores || [];
  const phaseDetails: any[] = pica.phaseDetails || [];

  const avgScore = phaseScores.length > 0
    ? Math.round(phaseScores.reduce((s: number, p: any) => s + p.value, 0) / phaseScores.length)
    : 0;

  const chartData = phaseScores.map((p: any) => ({
    name: PHASE_LABELS[p.name] || `Fase ${p.name}`,
    score: p.value,
  }));

  return (
    <div className="tw-space-y-6">
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-4 tw-gap-4">
        {phaseScores.map((p: any, i: number) => (
          <MetricCard
            key={i}
            title={PHASE_LABELS[p.name] || `Fase ${p.name}`}
            value={`${p.value}%`}
          />
        ))}
      </div>

      <div className="tw-bg-white tw-rounded-2xl tw-p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">
            PICA Fasescores
          </h2>
          <div className="tw-h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Score"]} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
      </div>

      {phaseDetails.map((phase: any) => {
        const metrics: any[] = phase.metrics || [];
        return (
          <RankedBarList
            key={phase.phase}
            title={`Detail: ${PHASE_LABELS[phase.phase] || `Fase ${phase.phase}`}`}
            items={metrics.map((m: any) => ({ name: m.key, value: Math.round(m.value) }))}
            suffix="%"
          />
        );
      })}

      {pica.comparison && (
        <div className="tw-bg-blue-50 tw-rounded-2xl tw-p-4">
          <p className="tw-text-sm tw-text-gray-600 tw-leading-relaxed">
            {pica.comparison}
          </p>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return <div className="tw-flex tw-justify-center tw-py-24"><div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /></div>;
}
function Error({ message }: { message: string }) {
  return <div className="tw-text-center tw-py-16"><p className="tw-text-base tw-font-semibold tw-text-red-500">{message}</p></div>;
}
