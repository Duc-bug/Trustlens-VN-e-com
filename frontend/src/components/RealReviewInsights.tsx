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

    const realWithMedia = realReviews.filter(
      (r) =>
        (r.media_images && r.media_images.length > 0) ||
        (r.media_videos && r.media_videos.length > 0)
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

    // 2. Concrete Seeding / Coin-Farming Breakdown from Real Data
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

    // 3. Real Product Variations Breakdown (grouped from actual `r.variation`)
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
        avgRealStar:
          v.realCount > 0
            ? Number((v.realStarSum / v.realCount).toFixed(2))
            : 5.0,
      }));

    // 4. Real Buyer Topics extracted directly from real comments & template_tags
    const topicRules = [
      {
        label: "Chất lượng / Hiệu quả tốt",
        regex:
          /(chất lượng|dùng tốt|mềm môi|dưỡng ẩm|cấp ẩm|hiệu quả|thấm nhanh|dịu nhẹ|mịn|êm)/i,
      },
      {
        label: "Mùi hương / Kết cấu dễ chịu",
        regex: /(mùi thơm|thơm nhẹ|hương thơm|mùi dễ chịu|kết cấu|không bết)/i,
      },
      {
        label: "Đóng gói kỹ & Giao nhanh",
        regex: /(đóng gói|bọc chống sốc|giao nhanh|ship nhanh|cẩn thận)/i,
      },
      {
        label: "Hàng chính hãng / Đủ tem",
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

    // 5. Real Critical / Low-Star Reviews (1★ - 4★ from real buyers)
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
      realWithMedia,
      totalRealPhotos,
      totalRealVideos,
      repeatBuyers,
      helpfulTotal,
      coinFarmCount,
      duplicateCount,
      burstCount,
      topVariations,
      realTopics,
      criticalRealReviews,
    };
  }, [reviews]);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              Tổng hợp chất lượng đánh giá
            </h3>
            <p className="text-xs font-medium text-gray-500">
              Tổng hợp từ {stats.total} đánh giá của người mua trên Shopee
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {stats.realCount}/{stats.total} Hợp lệ
          </span>
        </div>

        {/* 1. Side-by-Side Comparison */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Box A: Đánh giá từ người mua */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
              <span>Đánh giá từ người mua ({stats.realCount})</span>
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

          {/* Box B: Dấu hiệu Nghi Seeding / Cày xu */}
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-800">
              <ShieldAlert className="h-4 w-4 shrink-0 text-[#DC2626]" />
              <span>Đánh giá nghi vấn ({stats.seedCount})</span>
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

        {/* 2. Buyer Praise Topics */}
        {stats.realTopics.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-800">
                <Sparkles className="h-3.5 w-3.5 text-[#0D5CB6]" />
                Người mua nhận xét gì nhiều nhất?
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                Từ bình luận chi tiết
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

        {/* 3. Variations Breakdown */}
        {stats.topVariations.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-800">
                Đánh giá theo từng phân loại hàng
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                Điểm từng loại
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stats.topVariations.map((v, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div
                      className="truncate font-bold text-gray-900"
                      title={v.name}
                    >
                      {v.name}
                    </div>
                    <div className="text-[11px] font-medium text-gray-500">
                      <span className="font-bold text-emerald-700">
                        {v.realCount} thật
                      </span>
                      {v.seedCount > 0 && (
                        <span className="text-red-600">
                          {" "}
                          • {v.seedCount} nghi vấn
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-white px-2 py-1 font-black text-gray-900 shadow-2xs">
                    {v.avgRealStar.toFixed(1)}
                    <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Highlighted Real Critical Review (if any 1-4★ real review exists) */}
      {stats.criticalRealReviews.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span>
              Góp ý thực tế từ người mua thật (
              {stats.criticalRealReviews[0].user_name} -{" "}
              {stats.criticalRealReviews[0].rating}★):
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
