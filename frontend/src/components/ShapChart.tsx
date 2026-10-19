"use client";

import React from "react";
import { Sliders, Info } from "lucide-react";
import { ShapFeatureItem } from "@/types/trustlens";

interface ShapChartProps {
  data: ShapFeatureItem[];
  showTechnicalSubtext?: boolean;
}

function getFeatureCategoryBadge(featureName: string): {
  groupLabel: string;
  badgeClass: string;
  barColor: string;
} {
  const f = (featureName || "").toLowerCase();
  if (
    f.startsWith("graph_") ||
    f.includes("gat") ||
    f.includes("pagerank") ||
    f.includes("degree") ||
    f.includes("cluster") ||
    f.includes("device")
  ) {
    return {
      groupLabel: "Đồ thị & GAT",
      badgeClass: "border-purple-200 bg-purple-50 text-purple-700",
      barColor: "bg-[#8B5CF6]",
    };
  }
  if (
    f.startsWith("temp_") ||
    f.includes("burst") ||
    f.includes("15m") ||
    f.includes("arrival")
  ) {
    return {
      groupLabel: "Thời gian",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
      barColor: "bg-[#F59E0B]",
    };
  }
  if (f.startsWith("beh_") || f.includes("velocity") || f.includes("rating")) {
    return {
      groupLabel: "Hành vi",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      barColor: "bg-[#16A34A]",
    };
  }
  return {
    groupLabel: "Ngữ nghĩa NLP",
    badgeClass: "border-blue-200 bg-blue-50 text-[#0D5CB6]",
    barColor: "bg-[#1A73E8]",
  };
}

export default function ShapChart({
  data,
  showTechnicalSubtext = false,
}: ShapChartProps) {
  const items = data.slice(0, 8);
  const maxImportance = Math.max(
    ...items.map((d) => d.importance),
    0.001
  );

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0D5CB6]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Trọng số đóng góp của các đặc trưng (SHAP)
              </h3>
              <p className="text-xs font-medium text-gray-500">
                Top {items.length} đặc trưng ảnh hưởng lớn nhất trong bộ 39 đặc trưng trên sản phẩm này
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700">
            <Info className="h-3.5 w-3.5 text-[#1A73E8]" />
            TreeExplainer SHAP
          </span>
        </div>

        {/* Feature Impact Bars */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {items.map((item, idx) => {
            const pct = Math.max(
              14,
              Math.round((item.importance / maxImportance) * 100)
            );
            const cat = getFeatureCategoryBadge(item.feature);

            return (
              <div
                key={item.feature}
                className="rounded-xl border border-gray-100 bg-gray-50/70 p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-gray-700 shadow-2xs">
                      {idx + 1}
                    </span>
                    <span className="truncate font-bold text-gray-900">
                      {item.label || item.feature}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold ${cat.badgeClass}`}
                  >
                    {cat.groupLabel}
                  </span>
                </div>

                {/* Impact bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200/80">
                  <div
                    className={`h-full rounded-full transition-all ${cat.barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-500">
                  {showTechnicalSubtext ? (
                    <span className="font-mono text-[10px] text-gray-500">
                      Biến: {item.feature}
                    </span>
                  ) : (
                    <span>Mức đóng góp tương đối: {pct}%</span>
                  )}
                  <span className="font-mono font-bold text-gray-800">
                    |SHAP| = {item.importance.toFixed(4)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-600">
        <span>
          Giá trị <strong>|SHAP|</strong> càng lớn thể hiện đặc trưng đó càng đóng vai trò quyết định khi phân loại
        </span>
        <span className="text-gray-400">Tổng 39 đặc trưng đầu vào</span>
      </div>
    </div>
  );
}
