"use client";

import React, { useMemo } from "react";
import {
  CheckCircle2,
  Camera,
  Repeat,
  PackageCheck,
  AlertCircle,
  Star,
} from "lucide-react";
import { ReviewItem } from "@/types/trustlens";

interface RealReviewInsightsProps {
  reviews: ReviewItem[];
}

export default function RealReviewInsights({
  reviews,
}: RealReviewInsightsProps) {
  const stats = useMemo(() => {
    const total = reviews.length;
    const realReviews = reviews.filter((r) => !r.is_seeding);

    const realWithText = realReviews.filter(
      (r) => r.is_text_review ?? !r.comment.trim().startsWith("[Đánh giá ")
    ).length;

    const totalRealPhotos = realReviews.reduce(
      (acc, r) => acc + (r.media_images ? r.media_images.length : 0),
      0
    );

    const totalRealVideos = realReviews.reduce(
      (acc, r) =>
        acc +
        (r.media_videos
          ? r.media_videos.filter(
              (v) => (v.duration_ms || 0) >= 3000 && !v.template_video
            ).length
          : 0),
      0
    );

    const repeatBuyers = realReviews.filter(
      (r) => r.is_repeated_purchase
    ).length;

    // 4 Aspect Scores
    let pqSum = 0,
      pqCnt = 0;
    let ssSum = 0,
      ssCnt = 0;
    let dsSum = 0,
      dsCnt = 0;

    for (const r of realReviews) {
      if (r.detailed_rating?.product_quality) {
        pqSum += r.detailed_rating.product_quality;
        pqCnt += 1;
      } else {
        pqSum += r.rating;
        pqCnt += 1;
      }
      if (r.detailed_rating?.seller_service) {
        ssSum += r.detailed_rating.seller_service;
        ssCnt += 1;
      }
      if (r.detailed_rating?.delivery_service) {
        dsSum += r.detailed_rating.delivery_service;
        dsCnt += 1;
      }
    }

    const avgProductQuality = pqCnt > 0 ? pqSum / pqCnt : 4.8;
    const avgSellerService = ssCnt > 0 ? ssSum / ssCnt : avgProductQuality;
    const avgDeliveryService = dsCnt > 0 ? dsSum / dsCnt : avgProductQuality;
    const detailRatioScore =
      realReviews.length > 0
        ? Math.min(
            5.0,
            3.8 + (realWithText / Math.max(1, realReviews.length)) * 1.2
          )
        : 4.5;

    const aspectBars = [
      {
        label: "Chất lượng sản phẩm (từ người mua thật)",
        score5: Number(avgProductQuality.toFixed(2)),
        pct: Math.round((avgProductQuality / 5) * 100),
        color: "bg-[#16A34A]",
      },
      {
        label: "Dịch vụ & Phản hồi của Gian hàng",
        score5: Number(avgSellerService.toFixed(2)),
        pct: Math.round((avgSellerService / 5) * 100),
        color: "bg-[#1A73E8]",
      },
      {
        label: "Đóng gói & Tốc độ Giao hàng",
        score5: Number(avgDeliveryService.toFixed(2)),
        pct: Math.round((avgDeliveryService / 5) * 100),
        color: "bg-[#0D5CB6]",
      },
      {
        label: "Mức độ mô tả chi tiết trải nghiệm",
        score5: Number(detailRatioScore.toFixed(2)),
        pct: Math.round((detailRatioScore / 5) * 100),
        color: "bg-[#F59E0B]",
      },
    ];

    // All Variations (full name, no truncation)
    const varMap = new Map<
      string,
      {
        name: string;
        realCount: number;
        seedCount: number;
        realStarSum: number;
      }
    >();

    for (const r of reviews) {
      const rawVar = (r.variation || "").trim();
      if (!rawVar) continue;
      const entry = varMap.get(rawVar) || {
        name: rawVar,
        realCount: 0,
        seedCount: 0,
        realStarSum: 0,
      };
      if (r.is_seeding) {
        entry.seedCount += 1;
      } else {
        entry.realCount += 1;
        entry.realStarSum += r.rating;
      }
      varMap.set(rawVar, entry);
    }

    const topVariations = Array.from(varMap.values())
      .filter((v) => v.realCount + v.seedCount >= 1)
      .sort((a, b) => b.realCount - a.realCount)
      .slice(0, 6)
      .map((v) => ({
        ...v,
        avgRealStar:
          v.realCount > 0
            ? Number((v.realStarSum / v.realCount).toFixed(2))
            : 5.0,
      }));

    const criticalRealReviews = realReviews
      .filter(
        (r) =>
          r.rating <= 4 &&
          (r.is_text_review ?? !r.comment.trim().startsWith("[Đánh giá "))
      )
      .sort((a, b) => a.rating - b.rating);

    return {
      total,
      realCount: realReviews.length,
      realWithText,
      totalRealPhotos,
      totalRealVideos,
      repeatBuyers,
      aspectBars,
      topVariations,
      criticalRealReviews,
    };
  }, [reviews]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-extrabold text-gray-900">
            Tổng hợp chi tiết từ Người mua thật
          </h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {stats.realCount}/{stats.total} đánh giá hợp lệ
          </span>
        </div>

        {/* 4 Stat Tiles */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
              <Camera className="h-3 w-3 text-[#0D5CB6]" />
              Ảnh &amp; Video thật
            </div>
            <div className="mt-0.5 text-sm font-black text-gray-900">
              {stats.totalRealPhotos} ảnh • {stats.totalRealVideos} video
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
              <Repeat className="h-3 w-3 text-[#16A34A]" />
              Khách mua lại
            </div>
            <div className="mt-0.5 text-sm font-black text-[#16A34A]">
              {stats.repeatBuyers} lượt
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
              <PackageCheck className="h-3 w-3 text-gray-600" />
              Có viết nhận xét
            </div>
            <div className="mt-0.5 text-sm font-black text-gray-900">
              {stats.realWithText} bình luận
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              Phản biện 1–4★
            </div>
            <div className="mt-0.5 text-sm font-black text-amber-700">
              {stats.criticalRealReviews.length} bình luận
            </div>
          </div>
        </div>

        {/* 4 Aspect Satisfaction Bars */}
        <div className="space-y-2.5">
          {stats.aspectBars.map((asp, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">{asp.label}</span>
                <span className="font-extrabold text-gray-900">
                  {asp.score5.toFixed(2)}★ / 5.00★
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${asp.color}`}
                  style={{ width: `${asp.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Variations Breakdown (Full text, no truncation) */}
        {stats.topVariations.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <div className="mb-2 text-xs font-extrabold text-gray-700">
              Chi tiết theo từng Phân loại hàng đã mua
            </div>
            <div className="space-y-2">
              {stats.topVariations.map((v, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs"
                >
                  <span className="font-bold text-gray-800">{v.name}</span>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-600">
                    <span className="text-[#16A34A]">
                      {v.realCount} hợp lệ
                    </span>
                    {v.seedCount > 0 && (
                      <span className="text-[#DC2626]">
                        • {v.seedCount} nghi vấn
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 font-extrabold text-gray-900">
                      {v.avgRealStar}
                      <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full Critical Buyer Feedback (No line-clamp) */}
      {stats.criticalRealReviews.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          <div className="text-xs font-extrabold text-amber-900">
            Ý kiến góp ý thực tế từ người mua chấm 1–4 sao ({stats.criticalRealReviews.length}):
          </div>
          {stats.criticalRealReviews.slice(0, 3).map((crit) => (
            <div
              key={crit.review_id}
              className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs leading-relaxed text-amber-950"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-1 font-bold">
                <span>
                  {crit.user_name} ({crit.rating}★)
                  {crit.variation ? ` — Phân loại: ${crit.variation}` : ""}
                </span>
                <span className="text-[11px] text-amber-700">
                  {crit.timestamp.slice(0, 16)}
                </span>
              </div>
              <p className="whitespace-pre-line">{crit.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
