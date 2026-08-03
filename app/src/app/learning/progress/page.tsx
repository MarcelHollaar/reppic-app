"use client";
/**
 * /learning/progress — eigen leervoortgang + certificaten (Fase 4).
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { ChevronLeftIcon, AcademicCapIcon } from "@heroicons/react/24/solid";

type Summary = {
  stats: {
    completed: number;
    in_progress: number;
    assigned: number;
    total_time_minutes: number;
    certificates: number;
  };
  progress: {
    id: string;
    status: string;
    progress: number;
    score: number | null;
    time_spent: number;
    last_accessed_at: string;
    module: {
      id: string;
      title: string;
      learning_path_type: string;
      phase: number | null;
      duration: number;
    };
  }[];
  certificates: {
    id: string;
    certificate_number: string;
    score: number;
    completed_at: string;
    module: { id: string; title: string };
  }[];
};

function ProgressPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/progress", { headers })
      .then((r) => r.json())
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !summary) {
    return (
      <div className="tw-flex tw-justify-center tw-py-20">
        <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
      </div>
    );
  }

  const statTiles = [
    { label: t("learning.completed"), value: summary.stats.completed },
    { label: t("learning.inProgress"), value: summary.stats.in_progress },
    { label: t("learning.assigned"), value: summary.stats.assigned },
    {
      label: t("learning.certificates"),
      value: summary.stats.certificates,
    },
  ];

  return (
    <div className="tw-p-6 tw-max-w-5xl tw-mx-auto">
      <button
        onClick={() => router.push("/learning")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.title")}
      </button>
      <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-6">
        {t("learning.progress")}
      </h1>

      {/* Stat-tegels */}
      <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-4 tw-mb-8">
        {statTiles.map((s) => (
          <div
            key={s.label}
            className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-4 tw-text-center"
          >
            <div className="tw-text-2xl tw-font-bold tw-text-gray-900">
              {s.value}
            </div>
            <div className="tw-text-xs tw-text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Certificaten */}
      {summary.certificates.length > 0 && (
        <>
          <h2 className="tw-text-lg tw-font-bold tw-text-gray-900 tw-mb-3">
            {t("learning.certificates")}
          </h2>
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 tw-mb-8">
            {summary.certificates.map((c) => (
              <div
                key={c.id}
                className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-4 tw-flex tw-items-center tw-gap-3"
              >
                <AcademicCapIcon className="tw-w-8 tw-h-8 tw-text-[#5971F6]" />
                <div className="tw-flex-1">
                  <div className="tw-font-semibold tw-text-gray-900">
                    {c.module.title}
                  </div>
                  <div className="tw-text-xs tw-text-gray-500">
                    {c.certificate_number} · {t("learning.score")} {c.score}% ·{" "}
                    {new Date(c.completed_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Voortgangslijst */}
      <h2 className="tw-text-lg tw-font-bold tw-text-gray-900 tw-mb-3">
        {t("learning.myModules")}
      </h2>
      {summary.progress.length === 0 ? (
        <p className="tw-text-gray-500">{t("learning.noModules")}</p>
      ) : (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-divide-y tw-divide-gray-100">
          {summary.progress.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/learning/modules/${p.module.id}`)}
              className="tw-w-full tw-text-left tw-px-5 tw-py-3.5 tw-flex tw-items-center tw-gap-4 hover:tw-bg-gray-50"
            >
              <div className="tw-flex-1">
                <div className="tw-font-medium tw-text-gray-900">
                  {p.module.title}
                </div>
                <div className="tw-text-xs tw-text-gray-500">
                  {p.module.phase != null &&
                    `${t("learning.phase")} ${p.module.phase} · `}
                  {p.score != null && `${t("learning.score")} ${p.score}% · `}
                  {p.time_spent} {t("learning.minutes")}
                </div>
              </div>
              <div className="tw-w-28">
                <div className="tw-h-1.5 tw-bg-gray-100 tw-rounded-full tw-overflow-hidden">
                  <div
                    className={`tw-h-full ${
                      p.status === "completed"
                        ? "tw-bg-green-500"
                        : "tw-bg-[#5971F6]"
                    }`}
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
              <span
                className={`tw-text-xs tw-font-semibold tw-rounded-full tw-px-2.5 tw-py-1 ${
                  p.status === "completed"
                    ? "tw-bg-green-100 tw-text-green-700"
                    : p.status === "in_progress"
                      ? "tw-bg-indigo-100 tw-text-[#5971F6]"
                      : "tw-bg-gray-100 tw-text-gray-500"
                }`}
              >
                {p.status === "completed"
                  ? t("learning.completed")
                  : p.status === "in_progress"
                    ? t("learning.inProgress")
                    : t("learning.notStarted")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default authMiddleware(ProgressPage, undefined, false, "learner");
