"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import { MetricCard } from "@/components/salesDashboards/MetricCard";
import { ConclusionCard } from "@/components/salesDashboards/ConclusionCard";
import { useCompanyTerminology } from "@/hooks/useCompanyTerminology";

// ─── Constants (shared by team and individual PICA views) ───────────────────────

// Phase order matches the operational analysis; labels are translated via i18n
// (dashboards.picaPhases.*). Metric labels are translated via
// dashboards.picaMetrics.<metric key> at render time.
const PHASE_KEYS = ["proposition", "inventory", "conviction", "closing"] as const;
const PHASE_COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171"];

// Score is only green from 80; amber covers 36-79, red 0-35.
function scoreBg(v: number) {
  if (v <= 35) return "tw-bg-red-500";
  if (v < 80) return "tw-bg-amber-500";
  return "tw-bg-green-500";
}
function scoreText(v: number) {
  if (v <= 35) return "tw-text-red-600";
  if (v < 80) return "tw-text-amber-600";
  return "tw-text-green-600";
}

// Phase 3 (Overtuiging): all 3 elements must be >=80 for green
function phase3Style(metrics: { key: string; value: number }[]): { bar: string; badge: string } {
  const keys = ["uspUbrLink", "result", "acknowledgement"];
  const failing = keys.filter((k) => { const m = metrics.find((m) => m.key === k); return !m || m.value < 80; }).length;
  if (failing === 0) return { bar: "tw-bg-green-500", badge: "tw-text-green-600" };
  if (failing === 1) return { bar: "tw-bg-amber-500", badge: "tw-text-amber-600" };
  return { bar: "tw-bg-red-500", badge: "tw-text-red-600" };
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-10 tw-text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
      <p className="tw-text-sm tw-text-gray-400">{text}</p>
    </div>
  );
}

interface PicaPerformanceProps {
  /** Operational analytics object containing `picaPerformance`. */
  data: any;
  /** Title for the optional conclusion card. Falls back to a translated default. */
  conclusionTitle?: string;
  /** Hide the AI conclusion/chat card (e.g. on the individual dashboard). */
  hideConclusion?: boolean;
}

/**
 * Sales-phase (PICA) performance display. Used at team level in the operational
 * dashboard and at individual level in the salesperson's personal dashboard —
 * identical tiles, fed by the same per-conversation operational analysis.
 *
 * All user-facing labels go through i18n so the tile follows the language
 * selector; the AI conclusion card is asked for the currently selected language.
 */
export function PicaPerformance({ data, conclusionTitle, hideConclusion = false }: PicaPerformanceProps) {
  const { t, i18n } = useTranslation("common");
  const glossary = useCompanyTerminology();

  const phaseScores: any[] = data?.picaPerformance?.phaseScores || [];
  const phaseDetails: any[] = data?.picaPerformance?.phaseDetails || [];

  const getScore = (i: number) => phaseScores[i]?.value ?? null;
  const getMetrics = (phaseNum: number): { key: string; value: number }[] => {
    const d = phaseDetails.find((d: any) => d.phase === phaseNum);
    return d?.metrics || [];
  };

  const avgScore = phaseScores.length > 0
    ? Math.round(phaseScores.reduce((s: number, p: any) => s + (p.value || 0), 0) / phaseScores.length)
    : null;

  // Overlay the company's own training term when it has a glossary entry for
  // this concept; otherwise fall back to the standard translated label.
  const phaseName = (idx: number) => {
    const key = PHASE_KEYS[idx];
    if (!key) return `${t("dashboards.phase")} ${idx + 1}`;
    return glossary[key] || t(`dashboards.picaPhases.${key}`);
  };
  const metricLabel = (key: string) =>
    glossary[key] || t(`dashboards.picaMetrics.${key}`, { defaultValue: key });
  const resolvedTitle = conclusionTitle ?? t("dashboards.conclusions.pica");

  return (
    <div className="tw-space-y-5">
      {!hideConclusion && (
        <ConclusionCard
          title={resolvedTitle}
          conclusion={data?.picaPerformance?.comparison}
          dashboardType="operational"
          language={i18n.language}
        />
      )}

      {phaseScores.length > 0 && (
        <div className="tw-grid tw-grid-cols-2 lg:tw-grid-cols-5 tw-gap-4">
          <MetricCard title={t("dashboards.avgPicaScore")} value={avgScore !== null ? `${avgScore}%` : "—"} />
          {phaseScores.map((p: any, i: number) => (
            <MetricCard key={i} title={phaseName(i)} value={`${p.value ?? 0}%`} />
          ))}
        </div>
      )}

      {phaseScores.length > 0 && (
        <div className="tw-grid tw-gap-4 tw-grid-cols-1 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
          {PHASE_KEYS.map((_key, idx) => {
            const phaseNum = idx + 1;
            const score = getScore(idx);
            const metrics = getMetrics(phaseNum);
            const color = PHASE_COLORS[idx];
            const isPhase3 = idx === 2;
            const p3 = isPhase3 ? phase3Style(metrics) : null;
            const barClass = p3 ? p3.bar : scoreBg(score ?? 0);
            const badgeClass = p3 ? p3.badge : scoreText(score ?? 0);

            return (
              <div key={phaseNum} className="tw-bg-white tw-rounded-2xl tw-p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <div className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="tw-text-sm tw-font-semibold tw-text-gray-900">{phaseName(idx)}</span>
                  </div>
                  {score !== null && (
                    <span className={`tw-text-xs tw-font-bold tw-tabular-nums tw-rounded-full tw-px-2.5 tw-py-0.5 tw-bg-[#F5F6F8] ${badgeClass}`}>{score}</span>
                  )}
                </div>
                {score !== null && (
                  <div className="tw-h-1.5 tw-w-full tw-rounded-full tw-bg-[#F5F6F8] tw-mb-3 tw-overflow-hidden">
                    <div className={`tw-h-full tw-rounded-full ${barClass}`} style={{ width: `${score}%` }} />
                  </div>
                )}
                <div className="tw-space-y-2">
                  {metrics.map((m) => {
                    const label = metricLabel(m.key);
                    return (
                      <div key={m.key} className="tw-bg-[#F5F6F8] tw-rounded-xl tw-px-3 tw-py-2">
                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
                          <span className="tw-text-xs tw-text-gray-500 tw-flex-1 tw-leading-tight">{label}</span>
                          <span className={`tw-text-xs tw-font-semibold tw-tabular-nums tw-ml-2 tw-flex-shrink-0 ${scoreText(m.value)}`}>{m.value}</span>
                        </div>
                        <div className="tw-h-1.5 tw-w-full tw-rounded-full tw-bg-white tw-overflow-hidden">
                          <div className={`tw-h-full tw-rounded-full ${scoreBg(m.value)}`} style={{ width: `${m.value}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {phaseScores.length === 0 && <EmptyState text={t("dashboards.states.noAnalyzedConversations")} />}
    </div>
  );
}
