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
  const { formatted, maxSpike, peakBucket, totalBuckets, totalSuspiciousInPeak } =
    useMemo(() => {
      const fmt = data.map((d) => ({
        ...d,
        shortHour: d.time_bucket.slice(5, 16),
      }));

      let maxVal = 0;
      let peakTime = "—";
      let peakSuspicious = 0;

      for (const d of data) {
        if (d.total_reviews > maxVal) {
          maxVal = d.total_reviews;
          peakTime = d.time_bucket.slice(0, 16);
          peakSuspicious = d.seeding_spike_reviews;
        }
      }

      return {
        formatted: fmt,
        maxSpike: maxVal,
        peakBucket: peakTime,
        totalBuckets: data.length,
        totalSuspiciousInPeak: peakSuspicious,
      };
    }, [data]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1A73E8]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Mật độ đánh giá theo thời gian
              </h3>
              <p className="text-xs font-medium text-gray-500">
                Theo dõi lưu lượng bình luận tự nhiên và các khung giờ phát sinh dồn đơn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
              Hợp lệ
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
              Nghi vấn
            </span>
          </div>
        </div>

        {/* 3 Quick Summary Stat Pills */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-2.5">
            <div className="text-[11px] font-semibold text-gray-500">
              Số mốc thời gian
            </div>
            <div className="mt-0.5 text-sm font-black text-gray-900">
              {totalBuckets} khung giờ
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-2.5">
            <div className="text-[11px] font-semibold text-gray-500">
              Cao nhất 1 khung giờ
            </div>
            <div className="mt-0.5 text-sm font-black text-[#0D5CB6]">
              {maxSpike} đánh giá
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-2.5">
            <div className="text-[11px] font-semibold text-gray-500">
              Nghi vấn lúc cao điểm
            </div>
            <div className="mt-0.5 text-sm font-black text-[#DC2626]">
              {totalSuspiciousInPeak} đánh giá
            </div>
          </div>
        </div>

        {/* Area Chart */}
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="h-[250px] min-w-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={formatted}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="seedingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="organicGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.03} />
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
                    boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="organic_reviews"
                  name="Đánh giá hợp lệ"
                  stroke="#16A34A"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#organicGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="seeding_spike_reviews"
                  name="Đánh giá nghi vấn"
                  stroke="#DC2626"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#seedingGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-600">
        <span>Khung giờ cao điểm nhất: {peakBucket}</span>
        <span className="text-gray-400">Di chuột lên biểu đồ để xem chi tiết</span>
      </div>
    </div>
  );
}
