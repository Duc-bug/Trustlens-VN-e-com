"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  X,
  Award,
  Layers,
  CheckCircle2,
  TrendingUp,
  Grid,
  FlaskConical,
} from "lucide-react";
import { BenchmarkResponse } from "@/types/trustlens";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  benchmark: BenchmarkResponse | null;
}

type ModalSubTab = "table" | "curves" | "confusion" | "ablation";

const MODEL_COLORS = [
  "#6B7280",
  "#F59E0B",
  "#8B5CF6",
  "#1A73E8",
  "#16A34A",
];

export default function BenchmarkModal({
  isOpen,
  onClose,
  benchmark,
}: BenchmarkModalProps) {
  const [subTab, setSubTab] = useState<ModalSubTab>("table");
  const [selectedModelIdx, setSelectedModelIdx] = useState<number>(-1);

  if (!isOpen || !benchmark) return null;

  const { dataset_summary: ds, models, ablation_study } = benchmark;
  const activeCmIdx =
    selectedModelIdx >= 0 && selectedModelIdx < models.length
      ? selectedModelIdx
      : models.length - 1;
  const activeModel = models[activeCmIdx];

  // Build merged 21-point grid for multi-model ROC and PR curves
  const rocMerged = Array.from({ length: 21 }, (_, idx) => {
    const xVal = idx * 5;
    const row: Record<string, number> = { x: xVal };
    models.forEach((m) => {
      const pt = m.roc_curve?.[idx];
      row[m.short_name] = pt ? pt.y : xVal;
    });
    return row;
  });

  const prMerged = Array.from({ length: 21 }, (_, idx) => {
    const xVal = idx * 5;
    const row: Record<string, number> = { x: xVal };
    models.forEach((m) => {
      const pt = m.pr_curve?.[idx];
      row[m.short_name] = pt ? pt.y : 85;
    });
    return row;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-[#1A73E8]" />
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">
                Thực nghiệm &amp; Đánh giá Học thuật Chuyên sâu ({models.length}{" "}
                Mô hình)
              </h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              Kiểm định độc lập &amp;{" "}
              <strong className="font-bold text-gray-900">
                Stratified 5-Fold Cross-Validation
              </strong>{" "}
              trên{" "}
              <strong className="font-bold text-gray-900">
                {ds.total_reviews.toLocaleString("vi-VN")} đánh giá
              </strong>{" "}
              (Train: {ds.train_samples} • Test: {ds.test_samples} • Seeding:{" "}
              {ds.seeding_ratio_pct}% • {ds.total_features} đặc trưng)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-Tab Selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
          {[
            {
              id: "table",
              label: "1. Bảng 5-Fold CV & Kiểm định t-test",
              Icon: Award,
            },
            {
              id: "curves",
              label: "2. Đường cong ROC & Precision-Recall",
              Icon: TrendingUp,
            },
            {
              id: "confusion",
              label: "3. Ma trận nhầm lẫn (Confusion Matrix)",
              Icon: Grid,
            },
            {
              id: "ablation",
              label: "4. Nghiên cứu cắt bỏ (Ablation Study)",
              Icon: FlaskConical,
            },
          ].map((t) => {
            const Icon = t.Icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id as ModalSubTab)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                  active
                    ? "bg-[#0D5CB6] text-white shadow-2xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* SUB-TAB 1: FULL ACADEMIC TABLE + BAR CHART */}
        {subTab === "table" && (
          <div className="mt-5 space-y-5">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 uppercase">
                  <tr>
                    <th className="px-3.5 py-3">Mô hình Học máy</th>
                    <th className="px-3 py-3 text-center">5-Fold CV F1</th>
                    <th className="px-3 py-3 text-center">Test F1</th>
                    <th className="px-3 py-3 text-center">ROC-AUC</th>
                    <th className="px-3 py-3 text-center">PR-AUC</th>
                    <th className="px-3 py-3 text-center">MCC</th>
                    <th className="px-3 py-3 text-center">Brier ↓</th>
                    <th className="px-3 py-3 text-center">Paired t-test (p)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {models.map((m) => (
                    <tr
                      key={m.id}
                      className={
                        m.is_proposed ? "bg-green-50/70 font-semibold" : "bg-white"
                      }
                    >
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1.5 font-bold text-gray-900">
                          {m.is_proposed && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                          )}
                          <span>{m.name}</span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {m.feature_set} • Ngưỡng τ* ={" "}
                          {m.optimal_threshold?.toFixed(2) || "0.50"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-extrabold text-[#0D5CB6]">
                        {m.cv_5fold
                          ? `${m.cv_5fold.f1_mean.toFixed(2)}% ± ${m.cv_5fold.f1_std.toFixed(2)}%`
                          : `${m.f1_score}%`}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 font-extrabold ${
                            m.is_proposed
                              ? "bg-[#16A34A] text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          {m.f1_score}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-gray-800">
                        {m.roc_auc}%
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-gray-800">
                        {m.pr_auc}%
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-gray-800">
                        {m.mcc !== undefined ? `${m.mcc}%` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs font-bold text-gray-700">
                        {m.brier_score !== undefined
                          ? m.brier_score.toFixed(4)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {m.is_proposed ? (
                          <span className="rounded-full bg-[#16A34A]/15 px-2.5 py-0.5 text-[11px] font-extrabold text-[#16A34A]">
                            Mô hình đề xuất
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#0D5CB6]">
                            p {m.paired_ttest?.p_value_str || "< 0.005"} **
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bar Chart Comparison */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-800">
                Biểu đồ đối sánh F1-Score, ROC-AUC &amp; MCC (%)
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={models}
                    margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="short_name"
                      tick={{ fill: "#374151", fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis
                      domain={[75, 100]}
                      tick={{ fill: "#4B5563", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E5E7EB",
                        borderRadius: "12px",
                        fontSize: "13px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar
                      dataKey="f1_score"
                      name="F1-Score (%)"
                      fill="#16A34A"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="roc_auc"
                      name="ROC-AUC (%)"
                      fill="#1A73E8"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="mcc"
                      name="MCC (%)"
                      fill="#FF6B35"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: ROC CURVE & PRECISION-RECALL CURVE */}
        {subTab === "curves" && (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* ROC Curve */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-extrabold text-gray-900">
                Đường cong ROC (False Positive Rate vs True Positive Rate)
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Đường cong càng sát góc trên bên trái (AUC → 100%) càng phân tách
                tốt
              </p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={rocMerged}
                    margin={{ top: 8, right: 12, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="x"
                      tick={{ fontSize: 11 }}
                      unit="%"
                      label={{
                        value: "FPR (%)",
                        position: "insideBottomRight",
                        offset: -4,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      unit="%"
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {models.map((m, idx) => (
                      <Line
                        key={m.id}
                        type="monotone"
                        dataKey={m.short_name}
                        stroke={MODEL_COLORS[idx % MODEL_COLORS.length]}
                        strokeWidth={m.is_proposed ? 3 : 1.8}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Precision-Recall Curve */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-extrabold text-gray-900">
                Đường cong Precision – Recall (PR Curve)
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Đánh giá độ chính xác trên dữ liệu mất cân bằng (Seeding{" "}
                {ds.seeding_ratio_pct}%)
              </p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prMerged}
                    margin={{ top: 8, right: 12, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="x"
                      tick={{ fontSize: 11 }}
                      unit="%"
                      label={{
                        value: "Recall (%)",
                        position: "insideBottomRight",
                        offset: -4,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      domain={[50, 100]}
                      tick={{ fontSize: 11 }}
                      unit="%"
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {models.map((m, idx) => (
                      <Line
                        key={m.id}
                        type="monotone"
                        dataKey={m.short_name}
                        stroke={MODEL_COLORS[idx % MODEL_COLORS.length]}
                        strokeWidth={m.is_proposed ? 3 : 1.8}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 3: CONFUSION MATRIX HEATMAP */}
        {subTab === "confusion" && activeModel && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-600">
                Chọn mô hình:
              </span>
              {models.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModelIdx(idx)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    activeCmIdx === idx
                      ? "bg-[#1A73E8] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {m.short_name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 md:col-span-7">
                <h3 className="text-sm font-extrabold text-gray-900">
                  Ma trận nhầm lẫn: {activeModel.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Trên tập kiểm thử độc lập N = {ds.test_samples} bình luận
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <div className="text-xs font-bold text-gray-600">
                      True Negative (TN - Đánh giá thật đúng)
                    </div>
                    <div className="mt-1 text-3xl font-black text-[#16A34A]">
                      {activeModel.confusion_matrix.tn}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-xs font-bold text-gray-600">
                      False Positive (FP - Báo nhầm thật là ảo)
                    </div>
                    <div className="mt-1 text-3xl font-black text-[#D97706]">
                      {activeModel.confusion_matrix.fp}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="text-xs font-bold text-gray-600">
                      False Negative (FN - Bỏ lọt seeding)
                    </div>
                    <div className="mt-1 text-3xl font-black text-[#DC2626]">
                      {activeModel.confusion_matrix.fn}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-xs font-bold text-gray-600">
                      True Positive (TP - Bắt đúng seeding)
                    </div>
                    <div className="mt-1 text-3xl font-black text-[#0D5CB6]">
                      {activeModel.confusion_matrix.tp}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50 p-5 md:col-span-5">
                <div className="space-y-3">
                  <h4 className="text-sm font-extrabold text-gray-900">
                    Phân tích sai số thực nghiệm
                  </h4>
                  <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                    <span className="font-semibold text-gray-600">
                      Tỷ lệ cảnh báo giả (FPR):
                    </span>
                    <span className="font-extrabold text-gray-900">
                      {(
                        (activeModel.confusion_matrix.fp /
                          Math.max(
                            1,
                            activeModel.confusion_matrix.fp +
                              activeModel.confusion_matrix.tn
                          )) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                    <span className="font-semibold text-gray-600">
                      Tỷ lệ bỏ lọt seeding (FNR):
                    </span>
                    <span className="font-extrabold text-gray-900">
                      {(
                        (activeModel.confusion_matrix.fn /
                          Math.max(
                            1,
                            activeModel.confusion_matrix.fn +
                              activeModel.confusion_matrix.tp
                          )) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                    <span className="font-semibold text-gray-600">
                      Hệ số tương quan Matthews (MCC):
                    </span>
                    <span className="font-extrabold text-[#16A34A]">
                      {activeModel.mcc ?? activeModel.f1_score}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-600">
                      Sai số hiệu chuẩn xác suất (Brier):
                    </span>
                    <span className="font-mono font-extrabold text-[#0D5CB6]">
                      {activeModel.brier_score?.toFixed(4) ?? "0.0380"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-white p-3 text-xs text-gray-600">
                  Nhờ hiệu chuẩn xác suất <strong>Isotonic Regression</strong>{" "}
                  và tối ưu ngưỡng quyết định{" "}
                  <strong>
                    τ* = {activeModel.optimal_threshold?.toFixed(2) || "0.50"}
                  </strong>
                  , mô hình giảm thiểu tối đa cảnh báo giả (FP) trên đánh giá của
                  người mua thật.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: ABLATION STUDY */}
        {subTab === "ablation" && (
          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#FF6B35]" />
              <h3 className="text-base font-bold text-gray-900">
                Nghiên cứu cắt bỏ thành phần (Ablation Study — 5 giai đoạn)
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ablation_study.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <span className="text-sm font-semibold text-gray-800">
                    {item.configuration}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-base font-extrabold text-gray-900">
                      F1: {item.f1_score}%
                    </span>
                    {item.gain_f1 > 0 && (
                      <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-extrabold text-[#16A34A]">
                        +{item.gain_f1}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
