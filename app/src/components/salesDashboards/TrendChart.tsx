"use client";
import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TrendChartProps {
  title: string;
  data: Array<{ month: string; rolling: number; thisYear: number; lastYear: number }>;
}

export function TrendChart({ title, data }: TrendChartProps) {
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
      <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">
        {title}
      </h2>
      <div className="tw-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="rolling" name="Rolling" stroke="#5971F6" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="thisYear" name="Dit jaar" stroke="#34d399" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="lastYear" name="Vorig jaar" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
