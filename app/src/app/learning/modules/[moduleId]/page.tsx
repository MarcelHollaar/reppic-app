"use client";
/**
 * /learning/modules/[id] — module-speler + quiz (LMS-integratie Fase 4).
 * Video/presentatie/document bekijken, voortgang bijhouden en de quiz maken.
 * De quiz wordt server-side beoordeeld; bij slagen volgt een certificaat.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { sanitizeEmbedHtml } from "@/utils/safeHtml";
import { ChevronLeftIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

type Question = {
  id: string;
  question: string;
  options: string[];
  image_url: string | null;
};

type ModuleDetail = {
  id: string;
  title: string;
  description: string;
  duration: number;
  content_type: string;
  video_url: string | null;
  video_embed_code: string | null;
  phase: number | null;
  category: { id: string; name: string } | null;
  questions: Question[];
  progress: { status: string; progress: number; score: number | null } | null;
};

type QuizResult = {
  score: number;
  passed: boolean;
  pass_score: number;
  results: {
    question_id: string;
    given: number | undefined;
    correct_answer: number;
    is_correct: boolean;
    explanation: string | null;
  }[];
  certificate: { certificate_number: string } | null;
};

function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation("common");
  const [detail, setDetail] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  const headers = getAuthHeaders();

  useEffect(() => {
    if (!headers || !moduleId) return;
    fetch(`/api/learning/modules/${moduleId}?lang=${i18n.language}`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res) => setDetail(res.data))
      .catch(() => router.replace("/learning"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  // Bij openen: voortgang op minimaal 10% zetten (gestart). Bij verlaten:
  // bestede tijd bijschrijven.
  useEffect(() => {
    if (!detail || !headers) return;
    if ((detail.progress?.progress ?? 0) < 10) {
      fetch(`/api/learning/modules/${moduleId}/progress`, {
        method: "POST",
        headers,
        body: JSON.stringify({ progress: 10 }),
      }).catch(() => {});
    }
    const started = startedAtRef.current;
    return () => {
      const minutes = Math.round((Date.now() - started) / 60000);
      if (minutes > 0) {
        fetch(`/api/learning/modules/${moduleId}/progress`, {
          method: "POST",
          headers: getAuthHeaders() || {},
          body: JSON.stringify({ time_spent_delta: minutes }),
          keepalive: true,
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  const embedHtml = useMemo(() => {
    if (!detail?.video_embed_code) return null;
    return sanitizeEmbedHtml(
      detail.video_embed_code
        .replace(
          '<div style="position: relative; overflow: hidden; aspect-ratio: 1920/1080"',
          "<div",
        )
        .replace(
          /<iframe[^>]*width="[^"]*"[^>]*height="[^"]*"/,
          '<iframe width="100%" height="100%"',
        ),
    );
  }, [detail?.video_embed_code]);

  const markViewed = async () => {
    if (!headers) return;
    await fetch(`/api/learning/modules/${moduleId}/progress`, {
      method: "POST",
      headers,
      body: JSON.stringify({ progress: 100 }),
    });
    setDetail((d) =>
      d
        ? {
            ...d,
            progress: {
              status: "completed",
              progress: 100,
              score: d.progress?.score ?? null,
            },
          }
        : d,
    );
    toast.success(t("learning.completed"));
  };

  const submitQuiz = async () => {
    if (!headers || !detail) return;
    if (Object.keys(answers).length < detail.questions.length) {
      toast.error(t("learning.question") + "…");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/learning/modules/${moduleId}/quiz`, {
        method: "POST",
        headers,
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setQuizResult(json.data);
      if (json.data.passed) {
        toast.success(`${t("learning.passed")} — ${json.data.score}%`);
      } else {
        toast.warn(`${t("learning.failed")} — ${json.data.score}%`);
      }
    } catch {
      toast.error("Error");
    }
    setSubmitting(false);
  };

  if (loading || !detail) {
    return (
      <div className="tw-flex tw-justify-center tw-py-20">
        <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
      </div>
    );
  }

  const resultByQuestion = new Map(
    quizResult?.results.map((r) => [r.question_id, r]) || [],
  );

  return (
    <div className="tw-p-6 tw-max-w-4xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.title")}
      </button>

      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2 tw-flex-wrap">
        {detail.phase != null && (
          <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-bg-indigo-100 tw-text-[#5971F6] tw-rounded-full tw-px-2 tw-py-0.5">
            {t("learning.phase")} {detail.phase}
          </span>
        )}
        {detail.category && (
          <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-bg-gray-100 tw-text-gray-600 tw-rounded-full tw-px-2 tw-py-0.5">
            {detail.category.name}
          </span>
        )}
        {detail.progress?.status === "completed" && (
          <span className="tw-flex tw-items-center tw-gap-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-bg-green-100 tw-text-green-700 tw-rounded-full tw-px-2 tw-py-0.5">
            <CheckCircleIcon className="tw-w-3 tw-h-3" /> {t("learning.completed")}
          </span>
        )}
      </div>
      <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-2">
        {detail.title}
      </h1>
      <p className="tw-text-gray-600 tw-mb-6 tw-whitespace-pre-line">
        {detail.description}
      </p>

      {/* Speler / inhoud */}
      {embedHtml ? (
        <div
          className="tw-w-full tw-aspect-video tw-bg-black tw-rounded-2xl tw-overflow-hidden tw-mb-4"
          dangerouslySetInnerHTML={{ __html: embedHtml }}
        />
      ) : detail.video_url ? (
        // 1-op-1 met productie (VideoPlayer.tsx): video's staan als bestand op de
        // FTP/DAM en spelen via een native <video>-speler, NIET via een iframe.
        <div className="tw-w-full tw-aspect-video tw-bg-black tw-rounded-2xl tw-overflow-hidden tw-mb-4">
          <video
            src={detail.video_url}
            className="tw-w-full tw-h-full"
            controls
            playsInline
          >
            <source src={detail.video_url} type="video/mp4" />
            {t("learning.browserNoVideoSupport")}
          </video>
        </div>
      ) : null}

      {detail.progress?.status !== "completed" && (
        <button
          onClick={markViewed}
          className="tw-bg-white tw-border tw-border-gray-300 tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-text-gray-700 hover:tw-bg-gray-50 tw-mb-8"
        >
          ✓ {t("learning.completed")}
        </button>
      )}

      {/* Quiz */}
      {detail.questions.length > 0 && (
        <div className="tw-mt-6">
          <h2 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-4">
            {t("learning.quiz")}
            {detail.progress?.score != null && !quizResult && (
              <span className="tw-ml-2 tw-text-sm tw-font-normal tw-text-gray-500">
                ({t("learning.score")}: {detail.progress.score}%)
              </span>
            )}
          </h2>
          <div className="tw-flex tw-flex-col tw-gap-6">
            {detail.questions.map((q, qi) => {
              const result = resultByQuestion.get(q.id);
              return (
                <div
                  key={q.id}
                  className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-5"
                >
                  <p className="tw-font-semibold tw-text-gray-900 tw-mb-3">
                    {qi + 1}. {q.question}
                  </p>
                  {q.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.image_url}
                      alt=""
                      className="tw-max-h-48 tw-rounded-lg tw-mb-3"
                    />
                  )}
                  <div className="tw-flex tw-flex-col tw-gap-2">
                    {(q.options || []).map((opt, oi) => {
                      const chosen = answers[q.id] === oi;
                      let cls =
                        "tw-border-gray-300 tw-bg-white hover:tw-bg-gray-50";
                      if (result) {
                        if (oi === result.correct_answer)
                          cls = "tw-border-green-500 tw-bg-green-50";
                        else if (chosen && !result.is_correct)
                          cls = "tw-border-red-400 tw-bg-red-50";
                        else cls = "tw-border-gray-200 tw-bg-white";
                      } else if (chosen) {
                        cls = "tw-border-[#5971F6] tw-bg-indigo-50";
                      }
                      return (
                        <button
                          key={oi}
                          disabled={Boolean(result)}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [q.id]: oi }))
                          }
                          className={`tw-text-left tw-border tw-rounded-xl tw-px-4 tw-py-2.5 tw-text-sm tw-transition-colors ${cls}`}
                        >
                          <span className="tw-font-semibold tw-mr-2">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          {opt}
                          {result && oi === result.correct_answer && (
                            <CheckCircleIcon className="tw-inline tw-w-4 tw-h-4 tw-text-green-500 tw-ml-2" />
                          )}
                          {result && chosen && !result.is_correct && (
                            <XCircleIcon className="tw-inline tw-w-4 tw-h-4 tw-text-red-400 tw-ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {result?.explanation && (
                    <p className="tw-text-xs tw-text-gray-500 tw-mt-3 tw-bg-gray-50 tw-rounded-lg tw-p-3">
                      {result.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {quizResult ? (
            <div className="tw-mt-6 tw-flex tw-items-center tw-gap-4">
              <div
                className={`tw-rounded-2xl tw-px-5 tw-py-3 tw-font-semibold ${
                  quizResult.passed
                    ? "tw-bg-green-100 tw-text-green-700"
                    : "tw-bg-amber-100 tw-text-amber-700"
                }`}
              >
                {t("learning.score")}: {quizResult.score}% —{" "}
                {quizResult.passed ? t("learning.passed") : t("learning.failed")}
              </div>
              {!quizResult.passed && (
                <button
                  onClick={() => {
                    setQuizResult(null);
                    setAnswers({});
                  }}
                  className="tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline"
                >
                  {t("learning.startQuiz")}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={submitQuiz}
              disabled={submitting}
              className={`tw-mt-6 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-6 tw-py-2.5 tw-font-semibold hover:tw-bg-blue-700 ${
                submitting ? "tw-opacity-50" : ""
              }`}
            >
              {t("learning.submit")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default authMiddleware(ModulePage, undefined, false, "learner");
