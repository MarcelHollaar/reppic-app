"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PicaPerformance } from "@/components/salesDashboards/PicaPerformance";

interface IndividualPicaSectionProps {
  /** Salesperson whose PICA to show. Empty/undefined = the logged-in user. */
  userId?: string;
}

/**
 * PICA sales-phase performance for a single salesperson, shown on the personal
 * dashboard. Fed by the per-conversation analysis (the same source as the deep
 * "Inzichten" layer), averaged over all of the user's conversations — so it
 * mirrors the deep analysis and builds up as more conversations are analysed.
 * This deliberately does NOT use the separate dashboard-backend operational
 * analysis.
 */
export function IndividualPicaSection({ userId }: IndividualPicaSectionProps) {
  const { t } = useTranslation("common");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const headers = getAuthHeaders();
    if (!headers) {
      setError(t("dashboards.states.notLoggedIn"));
      setLoading(false);
      return;
    }

    const url = userId
      ? `/api/analytics/phase-performance?userId=${encodeURIComponent(userId)}`
      : "/api/analytics/phase-performance";

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `API error ${res.status}`);
        }
        return res.json();
      })
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.message || t("dashboards.states.phaseDataError")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  return (
    <div>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
        <h2 className="tw-text-lg tw-font-bold tw-text-gray-900" suppressHydrationWarning>{t("dashboards.phaseResults")}</h2>
        <span className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest" suppressHydrationWarning>{t("dashboards.salesPhases")}</span>
      </div>

      {loading && (
        <div className="tw-bg-white tw-rounded-2xl tw-p-10 tw-text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="tw-inline-block tw-w-6 tw-h-6 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
          <p className="tw-text-sm tw-text-gray-500">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <PicaPerformance data={data} hideConclusion />
      )}
    </div>
  );
}
