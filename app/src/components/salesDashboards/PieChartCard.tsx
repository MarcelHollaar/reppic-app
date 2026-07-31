"use client";
import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#5971F6", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#38bdf8"];

interface DataItem {
  name: string;
  value: number;
  color?: string;
}

interface PieChartCardProps {
  title: string;
  data: DataItem[];
  summary?: string;
}

export function PieChartCard({ title, data, summary }: PieChartCardProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div
      className="tw-bg-white tw-rounded-2xl tw-p-5"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <p className="tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-4">
        {title}
      </p>

      <div className="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
        <div className="tw-h-44 tw-w-44 tw-flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" strokeWidth={0}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, ""]}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="tw-flex-1 tw-min-w-0 tw-space-y-1.5">
          {data.map((item, i) => (
            <div key={i} className="tw-bg-[#F5F6F8] tw-rounded-xl tw-px-3 tw-py-2 tw-flex tw-items-start tw-justify-between tw-gap-2">
              <div className="tw-flex tw-items-start tw-gap-2 tw-min-w-0">
                <div className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-flex-shrink-0 tw-mt-1" style={{ backgroundColor: item.color || COLORS[i % COLORS.length] }} />
                <span className="tw-text-sm tw-text-gray-700 tw-break-words tw-leading-tight">{item.name}</span>
              </div>
              <span className="tw-text-xs tw-font-mono tw-font-bold tw-text-gray-500 tw-flex-shrink-0 tw-tabular-nums tw-mt-0.5">
                {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {summary && (
        <p className="tw-text-xs tw-text-gray-500 tw-mt-4 tw-leading-relaxed tw-border-t tw-border-gray-100 tw-pt-3">
          {summary}
        </p>
      )}
    </div>
  );
}
