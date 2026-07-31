"use client";

import { types } from "@/app/api/utils/type-constants";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ProgressChart from "./ProgressChart";
type ScoreData = {
  label: string;
  avg_score: number;
};
interface ProgressCardProps {
  userId?: string | null;
}

const formatLabels = (rawLabels: string[], range: string): string[] => {
  return rawLabels.map((label) => {
    if (range === "12 months" || range === "3 months") {
      const [year, month] = label.split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleString(
        "default",
        {
          month: "short",
        },
      );
    }

    if (range === "30 days" || range === "7 days") {
      const date = new Date(label);
      return date.toLocaleDateString("default", {
        day: "2-digit",
        month: "short",
      });
    }

    if (range === "24 hours") {
      const date = new Date(label.replace(" ", "T"));
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return label;
  });
};

const ProgressCard: React.FC = ({ userId }: ProgressCardProps) => {
  const [activeTab, setActiveTab] = useState("12 months");
  const [labels, setLabels] = useState<string[]>([]);
  const [data, setData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const headers = getAuthHeaders();
  const { t } = useTranslation("common");
  const tabs = [`12 months`, `3 months`, `30 days`, `7 days`, "24 hours"];

  // Sync i18next with the URL path locale
  // useEffect(() => {
  //   const locale = window.location.pathname.split('/')[1] || 'en';
  //   i18next.changeLanguage(locale).then(() => {
  //   }).catch((error: any) => {
  //     console.error('Error changing language:', error);
  //     i18next.changeLanguage('en'); // Fallback to 'en'
  //   });
  // }, []);

  const fetchChartData = async (range: string) => {
    setIsLoading(true);
    try {
      const formattedRange = range.replace(" ", "");

      const baseUrl = `/api/dashboard-stats?type=${types.GET_PROGRESS_STATS}&range=${formattedRange}`;
      const url = userId ? `${baseUrl}&user_id=${userId}` : baseUrl;

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      const json = await response.json();

      const rawData: ScoreData[] = json.data ?? [];
      const rawLabels = rawData.map((item) => item.label);
      const scores = rawData.map((item) => item.avg_score);

      const formattedLabels = formatLabels(rawLabels, range);
      setLabels(formattedLabels);
      setData(scores);
    } catch (error) {
      console.error("Failed to fetch chart data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(activeTab);
  }, [activeTab, userId]);

  const hasData = data.length > 0;

  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow tw-p-6 tw-w-full">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <h3 className="tw-text-lg tw-font-medium tw-text-black">
          {t("progressCard.progress")}
        </h3>
      </div>
      <div className="tw-border-b-2 tw-border-gray-300"></div>

      <div className="tw-flex tw-gap-2 tw-mt-4 tw-pb-2 tw-overflow-x-auto md:tw-overflow-x-hidden md:hover:tw-overflow-x-auto table-scrollbar tw-mb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tw-px-3 tw-py-1 tw-text-sm tw-rounded-2xl tw-whitespace-nowrap ${
              activeTab === tab
                ? "tw-bg-blue-50 tw-text-blue-800"
                : "tw-text-gray-500 hover:tw-bg-gray-100"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.split(" ")[0]} {t(`common.${tab.split(" ")[1]}`) || ""}
          </button>
        ))}
      </div>

      {hasData && !isLoading ? (
        <div className="tw-mt-4">
          <ProgressChart labels={labels} data={data} />
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-h-40">
          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
        </div>
      )}
    </div>
  );
};

export default ProgressCard;
