"use client";
import React from "react";
import { useTranslation } from "react-i18next";

interface StatCardProps {
  title: string;
  value: string | number;
  children?: React.ReactNode;
  symbol?: string;
  rightContent?: React.ReactNode;
  showLine?: boolean;
  showEllipsisIcon?: boolean;
  trend?: "up" | "down";
  pastState?: string;

  // New Props
  showTrend?: boolean; // show trend image (default: true)
  showComparison?: boolean; // show percentage & comparison (default: true)
  forTime?: boolean; // for time stats, e.g., Average Conversation Length
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  children,
  rightContent,
  showLine = false,
  showEllipsisIcon = true,
  symbol = "",
  trend,
  pastState = "0% vs N/A",
  showTrend = true,
  showComparison = true,
  forTime = false,
}) => {
  const isUpTrend = trend === "up";
  const trendIcon = isUpTrend ? "/img/uptrend.svg" : "/img/downtrend.svg";

  const percentageMatch = pastState?.match(/(-?\d+(\.\d+)?)%/);
  const percentageValue = percentageMatch ? percentageMatch[1] : "0";
  const restOfText =
    pastState?.replace(/(-?\d+(\.\d+)?)%/, "").trim() || "vs N/A";
  const {t} = useTranslation('common');
  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow tw-p-6 tw-w-full">
      {/* Header */}
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-6">
        <h3 className="tw-text-base tw-font-medium tw-text-[#101828]">
          {title}
        </h3>
        {rightContent}
      </div>

      <div className="tw-flex tw-flex-row">
        {/* Value and Comparison (Left) */}
        <div className="tw-w-[60%] tw-pr-2">
          <div className="tw-mb-2">
            <p
              className="tw-text-4xl tw-font-semibold tw-text-gray-900"
              style={{ display: "flex", gap: "9px", alignItems: "center"}}
            >
              {forTime ? String(value).split(' ')[0] : value}
              {symbol && (
                <span className="tw-text-4xl tw-text-gray-900"> {forTime ? t(`common.${String(value).split(' ')[1]}`, '') : symbol}</span>
              )}
            </p>
          </div>

          {/* Show comparison if enabled */}
          {showComparison && (
            <div className="tw-flex tw-items-center">
              {percentageValue && (
                <span
                  className={`tw-flex tw-text-sm tw-items-center ${
                    isUpTrend ? "tw-text-green-500" : "tw-text-red-500"
                  } tw-font-medium`}
                >
                  {isUpTrend ? "↑" : "↓"}{" "}
                  {percentageValue === "undefined" ? 0 : percentageValue}%
                </span>
              )}
              {restOfText && (
                <span className="tw-text-gray-500 tw-font-medium tw-text-sm tw-ml-1">
                  {restOfText}
                </span>
              )}
            </div>
          )}

          {showLine && (
            <div className="tw-w-14 tw-h-1 tw-bg-[#667085] tw-rounded-full tw-mt-3"></div>
          )}
        </div>

        {/* Trend image (Right) */}
        <div className="tw-w-[40%] tw-flex tw-justify-end tw-items-center">
          {trend && showTrend && (
            <img
              src={trendIcon}
              alt={isUpTrend ? "Uptrend" : "Downtrend"}
              className={`${!isUpTrend && forTime && String(value).split(':')[0]?.length > 2 ? "tw-w-[6rem]" : "tw-w-[8rem]"} tw-h-[4rem]`}
            />
          )}
        </div>
      </div>

      {children && <div className="tw-mt-4">{children}</div>}
    </div>
  );
};

export default StatCard;
