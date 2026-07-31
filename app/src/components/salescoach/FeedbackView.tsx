"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Loader2, ArrowLeft, Shield } from "lucide-react";
import type { FeedbackPhaseId, SalesCoachFeedback, SalesCoachFeedbackPhase } from "@/types/salescoach";

const PHASE_ORDER: FeedbackPhaseId[] = ["opening", "needs_analysis", "offer", "agreement"];

type Props = {
  sessionId: string;
  onBack: () => void;
};

type FetchState = "idle" | "loading" | "error" | "ready";

const scoreTone = (score: number) => {
  if (score >= 8) return "tw-text-green-600";
  if (score >= 6) return "tw-text-amber-500";
  return "tw-text-red-600";
};

const badgeTone = (score: number) => {
  if (score >= 8) return "tw-bg-green-100 tw-text-green-700";
  if (score >= 6) return "tw-bg-amber-100 tw-text-amber-700";
  return "tw-bg-red-100 tw-text-red-700";
};

const progressTone = (score: number) => {
  if (score >= 8) return "tw-bg-green-500";
  if (score >= 6) return "tw-bg-amber-500";
  return "tw-bg-red-500";
};

export default function FeedbackView({ sessionId, onBack }: Props) {
  const { t } = useTranslation("common");
  const [feedback, setFeedback] = useState<SalesCoachFeedback | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      setState("loading");
      setError("");
      try {
        const response = await fetch(`/api/sessions/${sessionId}/feedback`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (!aborted) {
            setError(data?.error || t('salescoach.feedback.error'));
            setState("error");
          }
          return;
        }
        const payload = (await response.json()) as SalesCoachFeedback;
        if (!aborted) {
          setFeedback(payload);
          setState("ready");
        }
      } catch (err) {
        if (aborted) return;
        console.error("[FeedbackView] failed to fetch feedback", err);
        setError(err instanceof Error ? err.message : t('salescoach.feedback.error'));
        setState("error");
      }
    };

    load();
    return () => {
      aborted = true;
    };
  }, [sessionId, t]);

  const orderedPhases: SalesCoachFeedbackPhase[] = useMemo(() => {
    if (!feedback) return [];
    const map = new Map(feedback.phases.map((phase) => [phase.id, phase] as const));
    return PHASE_ORDER.map((id) =>
      map.get(id) || { id, detected: false, score: 0, comments: "" }
    );
  }, [feedback]);

  if (state === "loading" || state === "idle") {
    return (
      <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-min-h-[400px] tw-gap-4 tw-text-center tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-blue-gray-100">
        <Loader2 className="tw-h-10 tw-w-10 tw-animate-spin tw-text-blue-600" />
        <p className="tw-text-base tw-text-blue-gray-600">{t('salescoach.feedback.loading')}</p>
      </div>
    );
  }

  if (state === "error" || !feedback) {
    return (
      <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-blue-gray-100 tw-p-8">
        <XCircle className="tw-h-12 tw-w-12 tw-text-red-500" />
        <p className="tw-text-base tw-text-red-600 tw-text-center tw-max-w-md">
          {error || t('salescoach.feedback.error')}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-border-blue-gray-200 tw-text-blue-gray-700 tw-font-medium tw-px-5 tw-py-2"
        >
          <ArrowLeft className="tw-h-4 tw-w-4" />
          {t('salescoach.feedback.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="tw-space-y-6">
      <div className="tw-flex tw-items-center tw-justify-between">
        <h3 className="tw-text-3xl tw-font-semibold">{t('salescoach.feedback.title')}</h3>
        <button
          type="button"
          onClick={onBack}
          className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-border-blue-gray-200 tw-text-blue-gray-700 tw-font-medium tw-px-4 tw-py-2"
        >
          <ArrowLeft className="tw-h-4 tw-w-4" />
          {t('salescoach.feedback.backButton')}
        </button>
      </div>

      <section className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-p-6">
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-4 tw-flex-wrap">
          <div>
            <p className="tw-text-sm tw-uppercase tw-text-blue-gray-400 tw-font-semibold">{t('salescoach.feedback.overallScore')}</p>
            <p className="tw-text-base tw-text-blue-gray-600 tw-mt-1">{t('salescoach.feedback.summary')}</p>
          </div>
          <span className={`tw-text-3xl tw-font-bold tw-rounded-full tw-px-5 tw-py-2 ${badgeTone(feedback.overallScore)}`}>
            {feedback.overallScore}/10
          </span>
        </div>
        {feedback.summary && (
          <p className="tw-mt-4 tw-text-blue-gray-700 tw-leading-relaxed">{feedback.summary}</p>
        )}
      </section>

      <section className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-p-6">
        <div className="tw-mb-4">
          <h4 className="tw-text-xl tw-font-semibold">{t('salescoach.feedback.phasesAnalysis')}</h4>
          <p className="tw-text-sm tw-text-blue-gray-500">{t('salescoach.feedback.score')}</p>
        </div>
        <div className="tw-space-y-5">
          {orderedPhases.map((phase) => (
            <div key={phase.id} className="tw-space-y-2">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-flex-wrap">
                <div className="tw-flex tw-items-center tw-gap-2">
                  {phase.detected ? (
                    <CheckCircle2 className="tw-h-5 tw-w-5 tw-text-green-600" />
                  ) : (
                    <XCircle className="tw-h-5 tw-w-5 tw-text-red-500" />
                  )}
                  <p className="tw-font-semibold">
                    {t(`salescoach.phases.${phase.id}`)}
                  </p>
                </div>
                <span className={`tw-font-semibold ${scoreTone(phase.score)}`}>
                  {phase.score}/10
                </span>
              </div>
              <div className="tw-h-2 tw-bg-blue-gray-100 tw-rounded-full">
                <div
                  className={`tw-h-full tw-rounded-full ${progressTone(phase.score)}`}
                  style={{ width: `${Math.min(100, phase.score * 10)}%` }}
                />
              </div>
              {phase.comments && (
                <p className="tw-text-sm tw-text-blue-gray-600">{phase.comments}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {feedback.objections && (
        <section className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-p-6">
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <Shield className="tw-h-5 tw-w-5 tw-text-blue-600" />
            <div>
              <p className="tw-text-lg tw-font-semibold">{t('salescoach.feedback.objectionsHandling')}</p>
              <p className="tw-text-sm tw-text-blue-gray-500">
                {feedback.objections.detected
                  ? t('salescoach.feedback.objectionsDetected')
                  : t('salescoach.feedback.objectionsNotDetected')}
              </p>
            </div>
          </div>

          {feedback.objections.detected && (
            <div className="tw-space-y-4">
              {feedback.objections.handled.length > 0 && (
                <div>
                  <p className="tw-font-semibold tw-text-sm tw-text-blue-gray-600">
                    {t('salescoach.feedback.objectionsHandled')}
                  </p>
                  <ul className="tw-mt-2 tw-space-y-1 tw-text-sm tw-text-blue-gray-600 tw-list-disc tw-pl-5">
                    {feedback.objections.handled.map((item, index) => (
                      <li key={`handled-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.objections.mishandled.length > 0 && (
                <div>
                  <p className="tw-font-semibold tw-text-sm tw-text-blue-gray-600">
                    {t('salescoach.feedback.objectionsNeedImprovement')}
                  </p>
                  <ul className="tw-mt-2 tw-space-y-1 tw-text-sm tw-text-blue-gray-600 tw-list-disc tw-pl-5">
                    {feedback.objections.mishandled.map((item, index) => (
                      <li key={`mishandled-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {feedback.objections.comments && (
            <p className="tw-mt-4 tw-text-sm tw-text-blue-gray-600">{feedback.objections.comments}</p>
          )}
        </section>
      )}

      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
        <section className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-p-6">
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <TrendingUp className="tw-h-5 tw-w-5 tw-text-green-600" />
            <p className="tw-text-lg tw-font-semibold">{t('salescoach.feedback.strengths')}</p>
          </div>
          <ul className="tw-space-y-2 tw-text-sm tw-text-blue-gray-700">
            {feedback.strengths.length ? (
              feedback.strengths.map((item, idx) => <li key={`strength-${idx}`}>• {item}</li>)
            ) : (
              <li className="tw-text-blue-gray-400">—</li>
            )}
          </ul>
        </section>

        <section className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-p-6">
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <TrendingDown className="tw-h-5 tw-w-5 tw-text-amber-600" />
            <p className="tw-text-lg tw-font-semibold">{t('salescoach.feedback.improvements')}</p>
          </div>
          <ul className="tw-space-y-2 tw-text-sm tw-text-blue-gray-700">
            {feedback.improvements.length ? (
              feedback.improvements.map((item, idx) => <li key={`improve-${idx}`}>• {item}</li>)
            ) : (
              <li className="tw-text-blue-gray-400">—</li>
            )}
          </ul>
        </section>
      </div>

      {feedback.examples.length > 0 && (
        <section className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-p-6">
          <p className="tw-text-lg tw-font-semibold tw-mb-3">{t('salescoach.feedback.examples')}</p>
          <ul className="tw-space-y-3">
            {feedback.examples.map((example, idx) => (
              <li key={`example-${idx}`} className="tw-border-l-4 tw-border-blue-200 tw-pl-4 tw-text-sm tw-text-blue-gray-700">
                {example}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="tw-flex tw-justify-center">
        <button
          type="button"
          onClick={onBack}
          className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-blue-600 hover:tw-bg-blue-700 tw-text-white tw-font-medium tw-px-6 tw-py-3"
        >
          <ArrowLeft className="tw-h-4 tw-w-4" />
          {t('salescoach.feedback.backButton')}
        </button>
      </div>
    </div>
  );
}
