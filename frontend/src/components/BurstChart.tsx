"use client";

import React from "react";
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
  const formatted = data.map((d) => ({
    ...d,
    shortHour: d.time_bucket.slice(5, 16),
  }));

  const maxSpike =
    data.length > 0 ? Math.max(...data.map((d) => d.total_reviews)) : 0;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
      {/* Header: Title <= 4 words, subtitle <= 12 words (C) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1A73E8]">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              Đánh giá theo giờ
            </h3>
            <p className="text-xs font-medium text-gray-500">
              Cột đỏ cao vọt là thời điểm nghi bơm đơn ảo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
            Nghi vấn
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            Đánh giá thật
          </span>
        </div>
      </div>

      {/* Horizontally scrollable on mobile (B.11) */}
      <div className="overflow-x-auto pb-1">
        <div className="h-[235px] min-w-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formatted}
              margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
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
                  fontSize: "13px",
                  color: "#111827",
                  boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="seeding_spike_reviews"
                name="Nghi seeding"
                stroke="#DC2626"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#seedingGrad)"
              />
              <Area
                type="monotone"
                dataKey="organic_reviews"
                name="Đánh giá thật"
                stroke="#16A34A"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#organicGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-600">
        <span>Đỉnh cao nhất: {maxSpike} đánh giá / giờ</span>
        <span className="text-gray-400">Chạm vào điểm để xem giờ</span>
      </div>
    </div>
  );
}
