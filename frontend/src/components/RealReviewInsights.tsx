"use client";

import React, { useMemo } from "react";
import {
  CheckCircle2,
  ShieldAlert,
  Camera,
  Repeat,
  PackageCheck,
  ThumbsUp,
  AlertCircle,
  Sparkles,
  Star,
  SlidersHorizontal,
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
    const seedReviews = reviews.filter((r) => r.is_seeding);

    // 1. Concrete Real Review Breakdown
    const realWithText = realReviews.filter(
      (r) =>
        r.is_text_review ?? !r.comment.trim().startsWith("[Đánh giá ")
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

    const helpfulTotal = realReviews.reduce(
      (acc, r) => acc + (r.helpful_votes || 0),
      0
    );

    // 2. Concrete Suspicious Breakdown from Real Data
    const coinFarmCount = seedReviews.filter(
      (r) =>
        r.seeding_type === "COIN_FARM_SPAM" ||
        r.seeding_signals?.some((s) => s.includes("xu"))
    ).length;

    const duplicateCount = seedReviews.filter(
      (r) =>
        r.cosine_similarity_max >= 50 ||
        r.seeding_type === "TEMPLATE_COPY_PASTE" ||
        r.seeding_type === "AI_MARKETING_SEEDING"
    ).length;

    const burstCount = seedReviews.filter(
      (r) =>
        r.burst_15m_count >= 4 || r.seeding_type === "TIME_BURST_SEEDING"
    ).length;

    // 3. 4 Aspect Scores computed from real buyer detailed_rating & text
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
        label: "Chất lượng & Công dụng",
        score5: Number(avgProductQuality.toFixed(2)),
        pct: Math.round((avgProductQuality / 5) * 100),
        color: "bg-[#16A34A]",
      },
      {
        label: "Phản hồi & Dịch vụ Shop",
        score5: Number(avgSellerService.toFixed(2)),
        pct: Math.round((avgSellerService / 5) * 100),
        color: "bg-[#1A73E8]",
      },
      {
        label: "Đóng gói & Vận chuyển",
        score5: Number(avgDeliveryService.toFixed(2)),
        pct: Math.round((avgDeliveryService / 5) * 100),
        color: "bg-[#0D5CB6]",
      },
      {
        label: "Mức độ chi tiết từ khách mua",
        score5: Number(detailRatioScore.toFixed(2)),
        pct: Math.round((detailRatioScore / 5) * 100),
        color: "bg-[#F59E0B]",
      },
    ];

    // 4. Real Product Variations Breakdown (grouped from actual `r.variation`)
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
      .slice(0, 4)
      .map((v) => ({
        ...v,
        totalVar: v.realCount + v.seedCount,
        realRatioPct: Math.round(
          (v.realCount / Math.max(1, v.realCount + v.seedCount)) * 100
        ),
        avgRealStar:
          v.realCount > 0
            ? Number((v.realStarSum / v.realCount).toFixed(2))
            : 5.0,
      }));

    // 5. Real Buyer Topics extracted directly from real comments & template_tags
    const topicRules = [
      {
        label: "Chất lượng / Hiệu quả sử dụng tốt",
        regex:
          /(chất lượng|dùng tốt|mềm môi|dưỡng ẩm|cấp ẩm|hiệu quả|thấm nhanh|dịu nhẹ|mịn|êm|chắc chắn)/i,
      },
      {
        label: "Mùi hương / Kết cấu dễ chịu",
        regex: /(mùi thơm|thơm nhẹ|hương thơm|mùi dễ chịu|kết cấu|không bết)/i,
      },
      {
        label: "Đóng gói kỹ & Giao hàng nhanh",
        regex: /(đóng gói|bọc chống sốc|giao nhanh|ship nhanh|cẩn thận)/i,
      },
      {
        label: "Hàng chính hãng / Đầy đủ tem nhãn",
        regex: /(chính hãng|auth|check mã|tem phụ|official|mall)/i,
      },
    ];

    const realTopics = topicRules
      .map((rule) => {
        const matched = realReviews.filter(
          (r) =>
            rule.regex.test(r.comment) ||
            (r.template_tags &&
              r.template_tags.some((t) => rule.regex.test(t)))
        ).length;
        return {
          label: rule.label,
          count: matched,
          pct:
            realReviews.length > 0
              ? Math.round((matched / realReviews.length) * 100)
              : 0,
        };
      })
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count);

    // 6. Real Critical / Low-Star Reviews (1★ - 4★ from real buyers)
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
      seedCount: seedReviews.length,
      realWithText,
      totalRealPhotos,
      totalRealVideos,
      repeatBuyers,
      helpfulTotal,
      coinFarmCount,
      duplicateCount,
      burstCount,
      aspectBars,
      topVariations,
      realTopics,
      criticalRealReviews,
    };
  }, [reviews]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              Tổng hợp chất lượng đánh giá thực tế
            </h3>
            <p className="text-xs font-medium text-gray-500">
              Phân tích từ {stats.total} bình luận của người mua trên sàn
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {stats.realCount}/{stats.total} Hợp lệ
          </span>
        </div>

        {/* 1. 4 Aspect Satisfaction Bars */}
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-800">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#0D5CB6]" />
              Điểm thành phần từ người mua thật
            </span>
            <span className="text-[11px] font-semibold text-gray-500">
              Thang 5.0★
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stats.aspectBars.map((asp, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">{asp.label}</span>
                  <span className="shrink-0 whitespace-nowrap font-extrabold text-gray-900">
                    {asp.score5.toFixed(2)}★
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/80">
                  <div
                    className={`h-full rounded-full transition-all ${asp.color}`}
                    style={{ width: `${asp.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Side-by-Side Comparison */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Box A: Đánh giá từ người mua */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
              <span>Đánh giá hợp lệ ({stats.realCount})</span>
            </div>
            <ul className="mt-2.5 space-y-2 text-xs text-gray-700">
              <li className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Camera className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>Hình ảnh &amp; video:</span>
                </span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-gray-900">
                  {stats.totalRealPhotos} ảnh • {stats.totalRealVideos} video
                </strong>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Repeat className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>Khách mua lại:</span>
                </span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-emerald-700">
                  {stats.repeatBuyers} đơn
                </strong>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <PackageCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>Nhận xét chi tiết:</span>
                </span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-gray-900">
                  {stats.realWithText} bình luận
                </strong>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>Lượt nhấn Hữu ích:</span>
                </span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-gray-900">
                  {stats.helpfulTotal} lượt
                </strong>
              </li>
            </ul>
          </div>

          {/* Box B: Đánh giá nghi vấn */}
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-800">
              <ShieldAlert className="h-4 w-4 shrink-0 text-[#DC2626]" />
              <span>Đánh giá đáng ngờ ({stats.seedCount})</span>
            </div>
            <ul className="mt-2.5 space-y-2 text-xs text-gray-700">
              <li className="flex items-center justify-between gap-2">
                <span className="font-medium">Bình luận nhận xu:</span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-[#DC2626]">
                  {stats.coinFarmCount} đánh giá
                </strong>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="font-medium">Nội dung trùng lặp:</span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-[#DC2626]">
                  {stats.duplicateCount} đánh giá
                </strong>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="font-medium">Đăng dồn khung 15p:</span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-[#DC2626]">
                  {stats.burstCount} đánh giá
                </strong>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="font-medium">Đánh giá 1★–4★ có góp ý:</span>
                <strong className="shrink-0 whitespace-nowrap font-extrabold text-amber-700">
                  {stats.criticalRealReviews.length} đánh giá
                </strong>
              </li>
            </ul>
          </div>
        </div>

        {/* 3. Buyer Praise Topics */}
        {stats.realTopics.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-800">
                <Sparkles className="h-3.5 w-3.5 text-[#0D5CB6]" />
                Chủ đề được người mua nhắc tới nhiều nhất
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                Từ bình luận tự viết
              </span>
            </div>
            <div className="space-y-2">
              {stats.realTopics.slice(0, 3).map((topic, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800">
                      {topic.label}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-extrabold text-[#0D5CB6]">
                      {topic.count} lượt nhắc tới
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#16A34A]"
                      style={{
                        width: `${Math.min(100, Math.max(12, topic.pct * 2))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Variations Breakdown with Visual Progress Bar */}
        {stats.topVariations.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-800">
                Đánh giá theo từng phân loại hàng
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                Tỷ lệ hợp lệ &amp; điểm sao
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stats.topVariations.map((v, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="truncate font-bold text-gray-900"
                      title={v.name}
                    >
                      {v.name}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-white px-2 py-0.5 font-black text-gray-900 shadow-2xs">
                      {v.avgRealStar.toFixed(1)}
                      <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-gray-500">
                    <span className="font-bold text-emerald-700">
                      {v.realCount} hợp lệ ({v.realRatioPct}%)
                    </span>
                    {v.seedCount > 0 && (
                      <span className="text-red-600">
                        {v.seedCount} nghi vấn
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-red-100">
                    <div
                      className="h-full rounded-full bg-[#16A34A]"
                      style={{ width: `${v.realRatioPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Highlighted Real Critical Review (if any 1-4★ real review exists) */}
      {stats.criticalRealReviews.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span>
              Góp ý thực tế từ người mua ({stats.criticalRealReviews[0].user_name}{" "}
              - {stats.criticalRealReviews[0].rating}★):
            </span>
          </div>
          <p className="mt-1 line-clamp-2 italic text-amber-950">
            &ldquo;{stats.criticalRealReviews[0].comment}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
