"use client";
import React, { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

interface RankedItem {
  name: string;
  value: number;
  color?: string;
  /** Full AI-generated explanation for this item (shown when expanded). */
  description?: string;
}

interface RankedBarListProps {
  title: string;
  items: RankedItem[];
  barColor?: string;
  /** Unit shown after the value. Empty by default — scores have no unit;
   *  pass "x" only for genuine frequency/mention counts. */
  suffix?: string;
}

export function RankedBarList({ title, items, barColor = "#5971F6", suffix = "" }: RankedBarListProps) {
  const max = items.length > 0 ? Math.max(...items.map((i) => i.value)) : 0;
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div
      className="tw-bg-white tw-rounded-2xl tw-p-5"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-4">
        {title}
      </p>
      <div className="tw-space-y-2">
        {items.map((item, idx) => {
          const barW = max > 0 ? (item.value / max) * 100 : 0;
          const hasDescription = !!item.description?.trim();
          const isOpen = expanded === idx;
          return (
            <div
              key={idx}
              className={`tw-bg-[#F5F6F8] tw-rounded-xl tw-px-3 tw-py-2.5 ${hasDescription ? "tw-cursor-pointer" : ""}`}
              onClick={hasDescription ? () => setExpanded(isOpen ? null : idx) : undefined}
            >
              <div className="tw-flex tw-justify-between tw-items-start tw-mb-1.5 tw-gap-2">
                <span className="tw-text-sm tw-font-medium tw-text-gray-700 tw-flex-1 tw-break-words tw-leading-tight">
                  <span className="tw-text-gray-300 tw-font-mono tw-text-xs tw-mr-1.5">{String(idx + 1).padStart(2, "0")}</span>
                  {item.name}
                </span>
                <span className="tw-flex tw-items-center tw-gap-1.5 tw-flex-shrink-0">
                  <span className="tw-text-xs tw-font-mono tw-font-bold tw-text-gray-500 tw-tabular-nums">
                    {item.value}{suffix}
                  </span>
                  {hasDescription && (
                    <ChevronDownIcon
                      className={`tw-w-3.5 tw-h-3.5 tw-text-gray-300 tw-transition-transform ${isOpen ? "tw-rotate-180" : ""}`}
                    />
                  )}
                </span>
              </div>
              <div className="tw-h-1.5 tw-rounded-full tw-bg-white tw-overflow-hidden">
                <div
                  className="tw-h-full tw-rounded-full tw-transition-all"
                  style={{ width: `${barW}%`, backgroundColor: item.color || barColor }}
                />
              </div>
              {hasDescription && isOpen && (
                <p className="tw-text-sm tw-text-gray-600 tw-leading-relaxed tw-mt-2.5 tw-whitespace-pre-line">
                  {item.description}
                </p>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="tw-text-sm tw-text-gray-400 tw-text-center tw-py-6">
            Geen data beschikbaar
          </p>
        )}
      </div>
    </div>
  );
}
