"use client";
/**
 * LearningCard — leerdata-tegel op het dashboard (AI-uitbreiding, afronding F3).
 * Toont voor iedereen met een leer-rol: afgerond/bezig/toegewezen/certificaten,
 * de eerste AI-aanbeveling en een link naar de leeromgeving. Rendert niets als
 * de gebruiker geen leer-toegang heeft.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { AcademicCapIcon } from "@heroicons/react/24/solid";

type Summary = {
  stats: {
    completed: number;
    in_progress: number;
    assigned: number;
    certificates: number;
  };
};

type Recommendation = {
  modules: { id: string; title: string; reason_phase: string }[];
};

const LearningCard: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loaded, setLoaded] = useState(false);

  const hasLearningAccess = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user_data") || "{}");
      return (
        u?.role?.name === "superadmin" ||
        (u?.learning_role && u.learning_role !== "none")
      );
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!hasLearningAccess) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    Promise.all([
      fetch("/api/learning/progress", { headers }).then((r) =>
        r.ok ? r.json() : { data: null },
      ),
      fetch("/api/learning/recommendations", { headers }).then((r) =>
        r.ok ? r.json() : { data: null },
      ),
    ])
      .then(([p, rc]) => {
        setSummary(p.data);
        setRec(rc.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [hasLearningAccess]);

  if (!hasLearningAccess || !loaded || !summary) return null;

  const tiles = [
    { label: t("learning.completed"), value: summary.stats.completed },
    { label: t("learning.inProgress"), value: summary.stats.in_progress },
    { label: t("learning.assigned"), value: summary.stats.assigned },
    { label: t("learning.certificates"), value: summary.stats.certificates },
  ];
  const firstRec = rec?.modules?.[0];

  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-5 tw-shadow-sm tw-border tw-border-gray-100">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
        <div className="tw-flex tw-items-center tw-gap-2">
          <AcademicCapIcon className="tw-w-5 tw-h-5 tw-text-[#5971F6]" />
          <h3 className="tw-font-bold tw-text-gray-900">
            {t("learning.title")}
          </h3>
        </div>
        <button
          onClick={() => router.push("/learning")}
          className="tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline"
        >
          {t("learning.title")} →
        </button>
      </div>

      <div className="tw-grid tw-grid-cols-4 tw-gap-2 tw-mb-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="tw-text-center tw-bg-indigo-50/60 tw-rounded-xl tw-py-3"
          >
            <div className="tw-text-xl tw-font-bold tw-text-gray-900">
              {tile.value}
            </div>
            <div className="tw-text-[10px] tw-text-gray-500 tw-leading-tight">
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      {firstRec && (
        <button
          onClick={() => router.push(`/learning/modules/${firstRec.id}`)}
          className="tw-w-full tw-text-left tw-bg-indigo-50 tw-border tw-border-indigo-100 tw-rounded-xl tw-px-4 tw-py-3 hover:tw-border-[#5971F6] tw-transition-colors"
        >
          <div className="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wide tw-text-[#5971F6] tw-mb-0.5">
            {t("learning.recommendedForYou")}
          </div>
          <div className="tw-text-sm tw-font-medium tw-text-gray-900">
            {firstRec.title}
          </div>
          <div className="tw-text-[11px] tw-text-gray-500">
            {firstRec.reason_phase}
          </div>
        </button>
      )}
    </div>
  );
};

export default LearningCard;
