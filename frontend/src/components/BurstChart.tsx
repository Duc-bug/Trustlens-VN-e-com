"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock } from "lucide-react";
import { BurstTimelinePoint } from "@/types/trustlens";

interface BurstChartProps {
  data: BurstTimelinePoint[];
}

export default function BurstChart({ data }: BurstChartProps) {
  const { formatted, maxSpike, peakBucket } = useMemo(() => {
    const fmt = data.map((d) => ({
      ...d,
      shortHour: d.time_bucket.slice(5, 16),
    }));

    let maxVal = 0;
    let peakTime = "—";
    for (const d of data) {
      if (d.total_reviews > maxVal) {
        maxVal = d.total_reviews;
        peakTime = d.time_bucket.slice(0, 16);
      }
    }

    return {
      formatted: fmt,
      maxSpike: maxVal,
      peakBucket: peakTime,
    };
  }, [data]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#1A73E8]" />
            <h3 className="text-base font-extrabold text-gray-900">
              Lưu lượng đánh giá theo giờ
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
              <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
              Hợp lệ
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              Nghi vấn
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="h-[260px] min-w-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={formatted}
                margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="seedingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="organicGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#F3F4F6"
                  vertical={false}
                />
                <XAxis
                  dataKey="shortHour"
                  tick={{ fill: "#6B7280", fontSize: 11, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  tick={{ fill: "#6B7280", fontSize: 11, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E5E7EB",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#111827",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="organic_reviews"
                  name="Hợp lệ"
                  stroke="#16A34A"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#organicGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="seeding_spike_reviews"
                  name="Nghi vấn"
                  stroke="#DC2626"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#seedingGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-600">
        <span>Cao điểm: {peakBucket}</span>
        <strong>{maxSpike} đánh giá / giờ</strong>
      </div>
    </div>
  );
}
