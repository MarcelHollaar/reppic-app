"use client";
import React from "react";

export default function SelectableCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tw-w-full tw-text-left tw-p-4 tw-rounded-xl tw-border tw-transition tw-duration-150 tw-bg-white hover:tw-shadow-md ${
        selected
          ? "tw-border-blue-600 tw-ring-2 tw-ring-blue-200"
          : "tw-border-blue-gray-100"
      }`}
    >
      <div className="tw-flex tw-items-center tw-gap-3">
        <div
          className={`tw-w-4 tw-h-4 tw-rounded-full tw-border ${
            selected ? "tw-bg-blue-600 tw-border-blue-600" : "tw-border-blue-gray-300"
          }`}
        />
        <span className="tw-font-medium tw-text-blue-gray-900">{label}</span>
      </div>
    </button>
  );
}

