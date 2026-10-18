"use client";

import React from "react";
import { HelpCircle, Info } from "lucide-react";
import { ShapFeatureItem } from "@/types/trustlens";

interface ShapChartProps {
  data: ShapFeatureItem[];
  showTechnicalSubtext?: boolean;
}

// Map technical feature names / labels to plain everyday Vietnamese (A.6)
function toEverydayVietnameseReason(item: ShapFeatureItem): {
  plainTitle: string;
  technicalTooltip: string;
} {
  const f = (item.feature || "").toLowerCase();
  const label = item.label || item.feature;

  if (f.includes("device") || label.toLowerCase().includes("thiết bị")) {
    return {
      plainTitle: "Nhiều tài khoản dùng chung thiết bị",
      technicalTooltip: `Đặc trưng kỹ thuật: ${item.feature} (${label}) • |SHAP| = ${item.importance.toFixed(4)}`,
    };
  }
  if (
    f.includes("gat") ||
    f.includes("pagerank") ||
    f.includes("degree") ||
    f.includes("cluster") ||
    label.toLowerCase().includes("cụm") ||
    label.toLowerCase().includes("đồ thị")
  ) {
    return {
      plainTitle: "Nhóm tài khoản cấu kết đánh giá cùng lúc",
      technicalTooltip: `Đặc trưng đồ thị (GAT / PageRank / Degree Centrality): ${item.feature} • |SHAP| = ${item.importance.toFixed(4)}`,
    };
  }
  if (
    f.includes("burst") ||
    f.includes("hour") ||
    f.includes("time") ||
    label.toLowerCase().includes("khung giờ") ||
    label.toLowerCase().includes("dồn")
  ) {
    return {
      plainTitle: "Review đăng dồn bất thường vào vài giờ",
      technicalTooltip: `Đặc trưng thời gian (Burst Window): ${item.feature} • |SHAP| = ${item.importance.toFixed(4)}`,
    };
  }
  if (
    f.includes("dup") ||
    f.includes("sim") ||
    f.includes("svd") ||
    f.includes("tfidf") ||
    f.includes("template") ||
    f.includes("cosine") ||
    label.toLowerCase().includes("văn mẫu") ||
    label.toLowerCase().includes("trùng")
  ) {
    return {
      plainTitle: "Văn mẫu khen ngợi giống hệt nhau",
      technicalTooltip: `Đặc trưng ngữ nghĩa NLP (TF-IDF / SVD Cosine): ${item.feature} • |SHAP| = ${item.importance.toFixed(4)}`,
    };
  }
  if (
    f.includes("coin") ||
    f.includes("junk") ||
    f.includes("emoji") ||
    f.includes("length") ||
    label.toLowerCase().includes("cày xu")
  ) {
    return {
      plainTitle: "Bình luận rác viết cho đủ ký tự nhận xu",
      technicalTooltip: `Đặc trưng văn bản (Coin Farming / Entropy): ${item.feature} • |SHAP| = ${item.importance.toFixed(4)}`,
    };
  }
  if (f.includes("rating") || f.includes("deviation") || f.includes("star")) {
    return {
      plainTitle: "Chấm 5 sao tuyệt đối lệch hẳn thực tế",
      technicalTooltip: `Đặc trưng độ lệch điểm sao: ${item.feature} • |SHAP| = ${item.importance.toFixed(4)}`,
    };
  }

  const cleaned = label.replace(/\s*\([^)]*\)/g, "").trim();
  return {
    plainTitle: cleaned || "Dấu hiệu hành vi đánh giá bất thường",
    technicalTooltip: `Đặc trưng gốc: ${item.feature} (${label}) • |SHAP| = ${item.importance.toFixed(4)}`,
  };
}

export default function ShapChart({
  data,
  showTechnicalSubtext = false,
}: ShapChartProps) {
  // Keep at most 5 distinct plain-language reasons (A.6)
  const deduplicated: Array<{
    plainTitle: string;
    technicalTooltip: string;
    importance: number;
    rawFeature: string;
  }> = [];

  for (const item of data) {
    const mapped = toEverydayVietnameseReason(item);
    const existing = deduplicated.find(
      (d) => d.plainTitle === mapped.plainTitle
    );
    if (existing) {
      existing.importance = Math.max(existing.importance, item.importance);
    } else {
      deduplicated.push({
        plainTitle: mapped.plainTitle,
        technicalTooltip: mapped.technicalTooltip,
        importance: item.importance,
        rawFeature: item.feature,
      });
    }
    if (deduplicated.length >= 5) break;
  }

  const maxImportance = Math.max(
    ...deduplicated.map((d) => d.importance),
    0.001
  );

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
      <div>
        {/* Header: Short title <= 4 words (C) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#DC2626]">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Vì sao AI nghi ngờ?
              </h3>
              <p className="text-xs font-medium text-gray-500">
                5 dấu hiệu ảnh hưởng lớn nhất tới kết luận
              </p>
            </div>
          </div>
          <span
            className="inline-flex cursor-help items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600"
            title="Di chuột vào biểu tượng ⓘ ở từng dòng để xem tên đặc trưng kỹ thuật (GAT, PageRank, SVD, SHAP)"
          >
            <Info className="h-3.5 w-3.5 text-gray-500" />
            Giải thích AI
          </span>
        </div>

        {/* Top 5 Plain Reasons + Impact Bars (A.6) */}
        <div className="mt-5 space-y-4">
          {deduplicated.map((reason, idx) => {
            const pct = Math.max(
              14,
              Math.round((reason.importance / maxImportance) * 100)
            );
            const barColor =
              idx === 0
                ? "bg-[#DC2626]"
                : idx === 1
                ? "bg-[#EA580C]"
                : idx === 2
                ? "bg-[#F59E0B]"
                : "bg-[#1A73E8]";

            const levelLabel =
              pct >= 80 ? "Rất cao" : pct >= 55 ? "Cao" : "Trung bình";

            return (
              <div key={reason.rawFeature} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-extrabold text-gray-700">
                      {idx + 1}
                    </span>
                    <span className="truncate font-bold text-gray-900">
                      {reason.plainTitle}
                    </span>
                    <span
                      className="shrink-0 cursor-help text-gray-400 hover:text-[#1A73E8]"
                      title={reason.technicalTooltip}
                    >
                      ⓘ
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-gray-600">
                    {showTechnicalSubtext
                      ? `|SHAP| ${reason.importance.toFixed(3)}`
                      : levelLabel}
                  </span>
                </div>

                {/* Impact bar */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {showTechnicalSubtext && (
                  <div className="text-[11px] font-medium text-gray-500">
                    {reason.technicalTooltip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-600">
        <span>Thanh càng dài = dấu hiệu càng rõ</span>
        <span className="text-gray-400">Chạm ⓘ xem thông số gốc</span>
      </div>
    </div>
  );
}
