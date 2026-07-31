"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardApi } from "@/components/salesDashboards/useDashboardApi";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { ConclusionCard } from "@/components/salesDashboards/ConclusionCard";
import { PlanUploadModal } from "@/components/salesDashboards/PlanUploadModal";
import { PicaPerformance } from "@/components/salesDashboards/PicaPerformance";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#38bdf8", "#fb923c", "#e879f9"];

const TABS = ["pica", "resistance", "nextSteps"] as const;
type Tab = typeof TABS[number];

// ─── Score helpers ─────────────────────────────────────────────────────────────

function scoreBg(v: number) {
  if (v <= 35) return "tw-bg-red-500";
  if (v <= 60) return "tw-bg-amber-500";
  return "tw-bg-green-500";
}

// ─── PICA Tab ─────────────────────────────────────────────────────────────────
// Uses the shared PicaPerformance component so the team view and the individual
// salesperson view show identical tiles.

function PicaTab({ data }: { data: any }) {
  return <PicaPerformance data={data} />;
}

// ─── Resistance Tab ───────────────────────────────────────────────────────────

function ResistanceTab({ data }: { data: any }) {
  const { t, i18n } = useTranslation("common");
  const rn = data?.resistanceNeeds || {};
  // Backend returns both resistances/triggers (aliased) and topResistances/commercialTriggers
  const resistances: any[] = (rn.resistances || rn.topResistances || []).map((r: any, i: number) => ({ ...r, color: COLORS[i % COLORS.length] }));
  const triggers: any[] = (rn.triggers || rn.commercialTriggers || []).map((tr: any, i: number) => ({ ...tr, color: COLORS[i % COLORS.length] }));
  const hasData = resistances.length > 0 || triggers.length > 0;

  return (
    <div className="tw-space-y-5">
      <ConclusionCard
        title={t("dashboards.conclusions.resistance")}
        conclusion={rn.comparison}
        dashboardType="operational"
        language={i18n.language}
      />

      {hasData ? (
        <>
          <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
            <MetricCard title={t("dashboards.metrics.mostCommonResistance")} value={resistances[0]?.name || "—"} />
            <MetricCard title={t("dashboards.metrics.totalResistances")} value={resistances.length} />
            <MetricCard title={t("dashboards.metrics.strongestTrigger")} value={triggers[0]?.name || "—"} />
          </div>

          <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
            {resistances.length > 0 && <PieCard title={t("dashboards.metrics.topResistances")} data={resistances} summary={rn.resistanceSummary} />}
            {triggers.length > 0 && <PieCard title={t("dashboards.metrics.commercialTriggers")} data={triggers} summary={rn.triggerSummary} />}
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function PieCard({ title, data, summary }: { title: string; data: any[]; summary?: string }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
      <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-4">{title}</p>
      <div className="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
        <div className="tw-h-44 tw-w-44 tw-flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68} strokeWidth={0}>
                {data.map((d, i) => <Cell key={i} fill={d.color || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, ""]}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="tw-flex-1 tw-min-w-0 tw-space-y-1.5">
          {data.map((item, i) => (
            <div key={i} className="tw-bg-[#F5F6F8] tw-rounded-xl tw-px-3 tw-py-2 tw-flex tw-items-center tw-justify-between tw-gap-2">
              <div className="tw-flex tw-items-center tw-gap-2 tw-min-w-0">
                <div className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-flex-shrink-0" style={{ backgroundColor: item.color || COLORS[i % COLORS.length] }} />
                <span className="tw-text-sm tw-text-gray-700 tw-truncate" title={item.name}>{item.name}</span>
              </div>
              <span className="tw-text-xs tw-font-mono tw-font-bold tw-text-gray-500 tw-flex-shrink-0 tw-tabular-nums">
                {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%"}
              </span>
            </div>
          ))}
        </div>
      </div>
      {summary && <p className="tw-text-xs tw-text-gray-500 tw-mt-4 tw-leading-relaxed tw-border-t tw-border-gray-100 tw-pt-3">{summary}</p>}
    </div>
  );
}

// ─── NextSteps Tab ────────────────────────────────────────────────────────────

function NextStepsTab({ data }: { data: any }) {
  const { t, i18n } = useTranslation("common");
  const ns = data?.nextStepDiscipline || {};
  const absolute: any[] = (ns.absolute || []).map((it: any, i: number) => ({ ...it, color: COLORS[i % COLORS.length] }));
  const percentages: any[] = (ns.percentages || []).map((it: any, i: number) => ({ ...it, color: COLORS[i % COLORS.length] }));
  const dmu = data?.dmuInsights;

  const withNextStep = Math.round(ns.withClearNextStep ?? 0);
  const avgClarity = Math.round(ns.avgNextStepClarity ?? 0);
  const hasData = absolute.length > 0 || percentages.length > 0 || !!dmu || ns.withClearNextStep !== undefined;

  return (
    <div className="tw-space-y-5">
      <ConclusionCard
        title={t("dashboards.conclusions.nextSteps")}
        conclusion={ns.comparison}
        dashboardType="operational"
        language={i18n.language}
      />

      {!hasData && <EmptyState />}

      {hasData && (
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
        <MetricCard title={t("dashboards.metrics.withClearNextStep")} value={`${withNextStep}%`} />
        <MetricCard title={t("dashboards.metrics.avgClarity")} value={avgClarity} />
        <MetricCard title={t("dashboards.metrics.nextStepTypes")} value={absolute.length} />
      </div>
      )}

      {/* Gauge */}
      {ns.withClearNextStep !== undefined && (
        <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-flex tw-flex-col tw-items-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
          <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-4">{t("dashboards.metrics.nextStepDiscipline")}</p>
          <GaugeWidget value={Math.round(ns.withClearNextStep ?? 0)} />
        </div>
      )}

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        {absolute.length > 0 && <PieCard title={t("dashboards.metrics.nextStepTypesAbsolute")} data={absolute} />}
        {percentages.length > 0 && <PieCard title={t("dashboards.metrics.nextStepDisciplinePct")} data={percentages} summary={ns.percentageSummary} />}
      </div>

      {/* DMU insights */}
      {dmu && (
        <div className="tw-space-y-4">
          <div className="tw-pt-2">
            <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-1">{t("dashboards.dmu.insights")}</p>
            <p className="tw-text-sm tw-text-gray-500">{t("dashboards.dmu.subtitle")}</p>
          </div>

          {dmu.comparison && (
            <ConclusionCard title={t("dashboards.conclusions.dmu")} conclusion={dmu.comparison} dashboardType="operational" language={i18n.language} />
          )}

          <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
            <DmuCard title={t("dashboards.dmu.clarityScore")} value={`${dmu.dmuClarity ?? 0}/100`} progress={dmu.dmuClarity ?? 0} />
            <DmuCard title={t("dashboards.dmu.mentioned")} value={dmu.dmuMentioned ? t("dashboards.values.yes") : t("dashboards.values.no")} ok={dmu.dmuMentioned} />
            <DmuCard title={t("dashboards.dmu.processClear")} value={dmu.decisionProcessClear ? t("dashboards.values.clear") : t("dashboards.values.unclear")} ok={dmu.decisionProcessClear} />
          </div>
        </div>
      )}
    </div>
  );
}

function GaugeWidget({ value }: { value: number }) {
  const color = value >= 70 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="tw-relative tw-w-48 tw-h-24">
      <svg viewBox="0 0 200 100" className="tw-w-full tw-h-full">
        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 283} 283`} />
      </svg>
      <div className="tw-absolute tw-inset-0 tw-flex tw-flex-col tw-items-center tw-justify-end tw-pb-1">
        <span className="tw-text-3xl tw-font-bold tw-font-mono" style={{ color }}>{value}%</span>
      </div>
    </div>
  );
}

function DmuCard({ title, value, progress, ok }: { title: string; value: string; progress?: number; ok?: boolean }) {
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
      <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-3">{title}</p>
      <div className="tw-flex tw-items-center tw-gap-2">
        {ok !== undefined && (
          <span className={`tw-text-lg tw-font-bold ${ok ? "tw-text-emerald-500" : "tw-text-red-500"}`}>
            {ok ? "✓" : "✗"}
          </span>
        )}
        <span className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-font-mono">{value}</span>
      </div>
      {progress !== undefined && (
        <div className="tw-mt-3 tw-h-1.5 tw-rounded-full tw-bg-[#F5F6F8] tw-overflow-hidden">
          <div className={`tw-h-full tw-rounded-full ${scoreBg(progress)}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Shared states ────────────────────────────────────────────────────────────

function LoadingState() {
  return <div className="tw-flex tw-justify-center tw-py-24"><div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" /></div>;
}
function ErrorState({ message }: { message: string }) {
  return <div className="tw-text-center tw-py-16"><p className="tw-text-red-500 tw-font-medium">{message}</p></div>;
}
function EmptyState() {
  const { t } = useTranslation("common");
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-py-14 tw-text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <p className="tw-text-sm tw-text-gray-400 tw-italic">{t("dashboards.states.noData")}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperationalDashboard() {
  const { t, i18n } = useTranslation("common");
  const { get } = useDashboardApi();
  const [activeTab, setActiveTab] = useState<Tab>("pica");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(null);
    get("/api/analytics/operational", { lang: i18n.language })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Re-fetch when the language changes so the AI-generated content follows the selector too.
  useEffect(() => { loadData(); }, [get, i18n.language]);

  return (
    <div>
      {/* Upload modal */}
      <PlanUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        planType="operational"
        title={t("dashboards.uploadSalesPlanTitle")}
        description={t("dashboards.uploadSalesPlanDesc")}
        onUploaded={() => { setShowUpload(false); loadData(); }}
      />

      {/* Header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-mb-6">
        <div>
          <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1" suppressHydrationWarning>{t("dashboards.operational")}</h1>
          <p className="tw-text-sm tw-text-gray-400" suppressHydrationWarning>{t("dashboards.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-white tw-rounded-xl tw-px-4 tw-py-2 tw-flex-shrink-0 tw-transition-opacity hover:tw-opacity-90"
          style={{ backgroundColor: "#5971F6" }}
        >
          <ArrowUpTrayIcon className="tw-w-4 tw-h-4" />
          <span suppressHydrationWarning>{t("dashboards.salesPlan")}</span>
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
            <span suppressHydrationWarning>
              {t(tab === "pica" ? "dashboards.phaseResults" : `dashboards.${tab}`)}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data && (
        <>
          {activeTab === "pica" && <PicaTab data={data} />}
          {activeTab === "resistance" && <ResistanceTab data={data} />}
          {activeTab === "nextSteps" && <NextStepsTab data={data} />}
        </>
      )}
    </div>
  );
}
