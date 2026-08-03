"use client";
/**
 * /learning — leeromgeving voor de learner (LMS-integratie Fase 4).
 * Toont alle zichtbare modules (globaal + eigen bedrijf) met voortgang,
 * gefilterd op type (salesvaardigheden / kennis) en categorie.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PlayIcon, DocumentTextIcon, PresentationChartBarIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

type ModuleItem = {
  id: string;
  title: string;
  description: string;
  duration: number;
  learning_path_type: "sales_skills" | "knowledge";
  phase: number | null;
  content_type: "video" | "presentation" | "document";
  thumbnail_url: string | null;
  is_required: boolean;
  category: { id: string; name: string } | null;
  question_count: number;
  progress: { status: string; progress: number; score: number | null } | null;
  assignment: { is_required: boolean; due_date: string | null } | null;
};

const contentIcon = (type: string) => {
  switch (type) {
    case "presentation":
      return <PresentationChartBarIcon className="tw-w-4 tw-h-4" />;
    case "document":
      return <DocumentTextIcon className="tw-w-4 tw-h-4" />;
    default:
      return <PlayIcon className="tw-w-4 tw-h-4" />;
  }
};

function LearningPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sales_skills" | "knowledge">("sales_skills");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // AI-uitbreiding: aanbevelingen op basis van zwakke gespreksfasen.
  const [recommendations, setRecommendations] = useState<{
    weak_phases: { name: string; score: number }[];
    modules: {
      id: string;
      title: string;
      duration: number;
      reason_phase: string;
      reason_score: number | null;
    }[];
  } | null>(null);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/modules", { headers })
      .then((r) => r.json())
      .then((res) => setModules(res.data || []))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
    fetch("/api/learning/recommendations", { headers })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((res) => setRecommendations(res.data))
      .catch(() => {});
  }, []);

  const hasKnowledge = useMemo(
    () => modules.some((m) => m.learning_path_type === "knowledge"),
    [modules],
  );

  // Kennisbibliotheek-add-on: knop alleen tonen als het bedrijf toegang heeft
  // (superadmin altijd); de server dwingt dit sowieso af.
  const hasLibraryAccess = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user_data") || "{}");
      return (
        u?.role?.name === "superadmin" ||
        Boolean(u?.company?.has_knowledge_access)
      );
    } catch {
      return false;
    }
  }, []);

  const visible = useMemo(
    () =>
      modules.filter(
        (m) =>
          m.learning_path_type === tab &&
          (!categoryFilter || m.category?.id === categoryFilter),
      ),
    [modules, tab, categoryFilter],
  );

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    modules
      .filter((m) => m.learning_path_type === tab && m.category)
      .forEach((m) => map.set(m.category!.id, m.category!.name));
    return Array.from(map.entries());
  }, [modules, tab]);

  const completedCount = modules.filter(
    (m) => m.progress?.status === "completed",
  ).length;

  return (
    <div className="tw-p-6 tw-max-w-7xl tw-mx-auto">
      {/* Kop + samenvatting */}
      <div className="tw-flex tw-flex-col md:tw-flex-row md:tw-items-center md:tw-justify-between tw-mb-6 tw-gap-3">
        <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
          {t("learning.title")}
        </h1>
        <div className="tw-flex tw-items-center tw-gap-4">
          <span className="tw-text-sm tw-text-gray-500">
            {completedCount}/{modules.length} {t("learning.completed").toLowerCase()}
          </span>
          {hasLibraryAccess && (
            <button
              onClick={() => router.push("/learning/library")}
              className="tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline"
            >
              {t("learning.library")} →
            </button>
          )}
          <button
            onClick={() => router.push("/learning/progress")}
            className="tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline"
          >
            {t("learning.progress")} →
          </button>
        </div>
      </div>

      {/* Aanbevolen voor jou — zwakste gespreksfasen uit de gespreksanalyses */}
      {recommendations && recommendations.modules.length > 0 && (
        <div className="tw-mb-6 tw-bg-indigo-50 tw-border tw-border-indigo-100 tw-rounded-2xl tw-p-5">
          <h2 className="tw-font-bold tw-text-gray-900 tw-mb-1">
            {t("learning.recommendedForYou")}
          </h2>
          <p className="tw-text-xs tw-text-gray-500 tw-mb-3">
            {t("learning.recommendedReason", {
              phases: recommendations.weak_phases
                .map((p) => `${p.name} (${p.score}%)`)
                .join(", "),
            })}
          </p>
          <div className="tw-flex tw-gap-2 tw-flex-wrap">
            {recommendations.modules.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/learning/modules/${m.id}`)}
                className="tw-bg-white tw-border tw-border-indigo-200 tw-rounded-xl tw-px-4 tw-py-2.5 tw-text-left hover:tw-border-[#5971F6] tw-transition-colors"
              >
                <div className="tw-text-sm tw-font-semibold tw-text-gray-900">
                  {m.title}
                </div>
                <div className="tw-text-[11px] tw-text-gray-500">
                  {m.reason_phase}
                  {m.duration > 0 && ` · ${m.duration} ${t("learning.minutes")}`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs sales_skills / knowledge */}
      {hasKnowledge && (
        <div className="tw-inline-flex tw-gap-1 tw-rounded-xl tw-p-1 tw-mb-4" style={{ backgroundColor: "#EBEBEB" }}>
          {(["sales_skills", "knowledge"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setCategoryFilter(null);
              }}
              className={`tw-px-4 tw-py-1.5 tw-text-sm tw-rounded-lg tw-transition-all ${
                tab === k
                  ? "tw-bg-white tw-text-gray-900 tw-font-semibold"
                  : "tw-text-gray-500 hover:tw-text-gray-700"
              }`}
            >
              {k === "sales_skills" ? t("learning.salesSkills") : t("learning.knowledge")}
            </button>
          ))}
        </div>
      )}

      {/* Categoriefilter */}
      {categories.length > 0 && (
        <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-6">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`tw-px-3 tw-py-1 tw-text-xs tw-rounded-full tw-border ${
              !categoryFilter
                ? "tw-bg-[#5971F6] tw-text-white tw-border-[#5971F6]"
                : "tw-bg-white tw-text-gray-600 tw-border-gray-300"
            }`}
          >
            {t("learning.allCategories")}
          </button>
          {categories.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setCategoryFilter(id)}
              className={`tw-px-3 tw-py-1 tw-text-xs tw-rounded-full tw-border ${
                categoryFilter === id
                  ? "tw-bg-[#5971F6] tw-text-white tw-border-[#5971F6]"
                  : "tw-bg-white tw-text-gray-600 tw-border-gray-300"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Modules */}
      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : visible.length === 0 ? (
        <p className="tw-text-gray-500 tw-py-10 tw-text-center">
          {t("learning.noModules")}
        </p>
      ) : (
        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-5">
          {visible.map((m) => {
            const pct = m.progress?.progress ?? 0;
            const done = m.progress?.status === "completed";
            return (
              <button
                key={m.id}
                onClick={() => router.push(`/learning/modules/${m.id}`)}
                className="tw-text-left tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow tw-overflow-hidden tw-flex tw-flex-col"
              >
                <div className="tw-h-36 tw-bg-indigo-50 tw-flex tw-items-center tw-justify-center tw-relative">
                  {m.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbnail_url}
                      alt={m.title}
                      className="tw-w-full tw-h-full tw-object-cover"
                    />
                  ) : (
                    <span className="tw-text-[#5971F6]">{contentIcon(m.content_type)}</span>
                  )}
                  {done && (
                    <CheckCircleIcon className="tw-absolute tw-top-2 tw-right-2 tw-w-6 tw-h-6 tw-text-green-500 tw-bg-white tw-rounded-full" />
                  )}
                </div>
                <div className="tw-p-4 tw-flex tw-flex-col tw-flex-1">
                  <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1 tw-flex-wrap">
                    {m.phase != null && (
                      <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-bg-indigo-100 tw-text-[#5971F6] tw-rounded-full tw-px-2 tw-py-0.5">
                        {t("learning.phase")} {m.phase}
                      </span>
                    )}
                    {(m.assignment?.is_required ?? m.is_required) && (
                      <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-bg-amber-100 tw-text-amber-700 tw-rounded-full tw-px-2 tw-py-0.5">
                        {t("learning.required")}
                      </span>
                    )}
                    {m.assignment && !m.assignment.is_required && (
                      <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wide tw-bg-gray-100 tw-text-gray-600 tw-rounded-full tw-px-2 tw-py-0.5">
                        {t("learning.recommended")}
                      </span>
                    )}
                  </div>
                  <h3 className="tw-font-semibold tw-text-gray-900 tw-mb-1 tw-line-clamp-2">
                    {m.title}
                  </h3>
                  <p className="tw-text-sm tw-text-gray-500 tw-line-clamp-2 tw-flex-1">
                    {m.description}
                  </p>
                  <div className="tw-mt-3">
                    <div className="tw-flex tw-justify-between tw-text-xs tw-text-gray-500 tw-mb-1">
                      <span>
                        {m.duration > 0 && `${m.duration} ${t("learning.minutes")}`}
                        {m.question_count > 0 &&
                          ` · ${m.question_count} ${t("learning.quiz").toLowerCase()}`}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="tw-h-1.5 tw-bg-gray-100 tw-rounded-full tw-overflow-hidden">
                      <div
                        className={`tw-h-full tw-rounded-full ${done ? "tw-bg-green-500" : "tw-bg-[#5971F6]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default authMiddleware(LearningPage, undefined, false, "learner");
