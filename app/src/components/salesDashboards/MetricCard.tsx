"use client";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpIcon, ArrowDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface DetailItem {
  name: string;
  value: number;
  suffix?: string;
  severity?: string;
  type?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  sparklineData?: number[];
  detailItems?: DetailItem[];
  detailTitle?: string;
}

export function MetricCard({ title, value, change, sparklineData, detailItems, detailTitle }: MetricCardProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const isPositive = (change ?? 0) >= 0;
  const chartData = (sparklineData || []).map((v, i) => ({ v, i }));
  const hasDetails = detailItems && detailItems.length > 0;
  const maxVal = hasDetails ? Math.max(...detailItems!.map((d) => d.value)) : 0;

  const isTextValue =
    typeof value === "string" && !/^[\d.,%\s—–-]+$/.test(value.trim());

  return (
    <>
      <div
        className={`tw-bg-white tw-rounded-2xl tw-p-5 ${hasDetails ? "tw-cursor-pointer hover:tw-shadow-md" : ""} tw-transition-shadow`}
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
        onClick={hasDetails ? () => setOpen(true) : undefined}
      >
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
          <span className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest">
            {title}
          </span>
          {hasDetails && <ChevronRightIcon className="tw-w-3.5 tw-h-3.5 tw-text-gray-300" />}
        </div>

        <div
          className={`tw-font-bold tw-text-gray-900 ${
            isTextValue
              ? "tw-text-base tw-leading-snug tw-line-clamp-3 tw-break-words"
              : "tw-text-3xl tw-font-mono tw-tracking-tight tw-truncate"
          }`}
          title={isTextValue ? String(value) : undefined}
        >
          {value}
        </div>

        {change !== undefined && (
          <div className={`tw-flex tw-items-center tw-gap-1 tw-mt-2 tw-text-xs tw-font-semibold ${isPositive ? "tw-text-emerald-500" : "tw-text-red-500"}`}>
            {isPositive ? <ArrowUpIcon className="tw-w-3 tw-h-3" /> : <ArrowDownIcon className="tw-w-3 tw-h-3" />}
            <span>{Math.abs(change)}%</span>
            <span className="tw-text-gray-400 tw-font-normal">{t("dashboards.vsLastYear")}</span>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="tw-h-10 tw-mt-3 tw--mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="v" stroke="#5971F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {open && hasDetails && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/30 tw-backdrop-blur-sm tw-p-4">
          <div className="tw-bg-white tw-rounded-2xl tw-w-full tw-max-w-md tw-overflow-hidden"
            style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.12)" }}>
            <div className="tw-px-6 tw-py-4 tw-border-b tw-border-gray-100 tw-flex tw-items-center tw-justify-between">
              <span className="tw-font-semibold tw-text-gray-900">{detailTitle || title}</span>
              <button onClick={() => setOpen(false)} className="tw-text-gray-300 hover:tw-text-gray-600 tw-text-lg tw-font-bold tw-leading-none">✕</button>
            </div>
            <div className="tw-px-6 tw-py-4 tw-space-y-3">
              {detailItems!.map((item, idx) => {
                const barW = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                const color = item.severity === "high" ? "#ef4444" : item.severity === "medium" ? "#f59e0b" : item.type === "positive" ? "#10b981" : "#5971F6";
                return (
                  <div key={idx} className="tw-bg-[#F5F6F8] tw-rounded-xl tw-px-3 tw-py-2.5">
                    <div className="tw-flex tw-justify-between tw-mb-1.5">
                      <span className="tw-text-sm tw-font-medium tw-text-gray-800 tw-truncate tw-max-w-[70%]">{item.name}</span>
                      <span className="tw-text-sm tw-font-mono tw-text-gray-500">{item.value}{item.suffix || ""}</span>
                    </div>
                    <div className="tw-h-1.5 tw-rounded-full tw-bg-white tw-overflow-hidden">
                      <div className="tw-h-full tw-rounded-full tw-transition-all" style={{ width: `${barW}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
