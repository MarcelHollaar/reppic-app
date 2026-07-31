"use client";
import React from "react";

interface MetricCardProps {
    value: number | string;
    label: string;
    bgColor?: string;
}

const MetricCard = ({ value, label, bgColor = "tw-bg-blue-50" }: MetricCardProps) => {
  return (
    <div
      className={`${bgColor} tw-rounded-xl tw-p-6 tw-w-[110px] md:tw-w-[132px] tw-h-[142px] tw-flex tw-flex-col tw-items-center tw-justify-center tw-shadow-md`}
    >
      <p className="tw-text-[1.625rem] tw-font-semibold tw-text-gray-900">
        {value}
      </p>
      <p className="tw-text-black tw-font-medium tw-text-sm">{label}</p>
    </div>
  );
};

export default MetricCard;
