"use client";

import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Star,
  ExternalLink,
  Clock,
  Copy,
  Coins,
  Store,
  Image as ImageIcon,
  Repeat,
  FileWarning,
  ShieldCheck,
} from "lucide-react";
import {
  TrustMetrics,
  ProductInfo,
  ReviewItem,
  BurstTimelinePoint,
} from "@/types/trustlens";

interface TrustScoreCardProps {
  product: ProductInfo;
  metrics: TrustMetrics;
  reviews: ReviewItem[];
  burstTimeline?: BurstTimelinePoint[];
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=360&auto=format&fit=crop&q=80";

export default function TrustScoreCard({
  product,
  metrics,
  reviews,
  burstTimeline = [],
}: TrustScoreCardProps) {
  const score = metrics.trust_score;
  const verdict =
    score >= 70
      ? {
          label: "NÊN MUA — ĐỘ TIN CẬY TỐT",
          subLabel: metrics.verdict || "Đa số đánh giá đến từ người mua thực tế, phân bố tự nhiên.",
          bg: "from-emerald-50/70 via-emerald-50/20 to-white",
          badgeBg: "bg-[#16A34A]",
          textColor: "text-[#16A34A]",
          strokeColor: "#16A34A",
          Icon: CheckCircle2,
        }
      : score >= 45
      ? {
          label: "CÂN NHẮC — CÓ DẤU HIỆU SPAM XU / SEEDING",
          subLabel: metrics.verdict || "Phát hiện một số bình luận nhận xu hoặc trùng lặp nội dung.",
          bg: "from-amber-50/70 via-amber-50/20 to-white",
          badgeBg: "bg-[#F59E0B]",
          textColor: "text-[#D97706]",
          strokeColor: "#F59E0B",
          Icon: AlertTriangle,
        }
      : {
          label: "CẢNH BÁO — TỶ LỆ ĐÁNH GIÁ BẤT THƯỜNG CAO",
          subLabel: metrics.verdict || "Tỷ lệ bình luận seeding hoặc cày xu cao, điểm thực tế chênh lệch lớn.",
          bg: "from-red-50/70 via-red-50/20 to-white",
          badgeBg: "bg-[#DC2626]",
          textColor: "text-[#DC2626]",
          strokeColor: "#DC2626",
          Icon: ShieldAlert,
        };

  const VerdictIcon = verdict.Icon;

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const meta = product.shopee_live_meta;
  const productImage =
    product.image_url || meta?.product_image_url || FALLBACK_IMAGE;

  const displayShopName =
    meta?.shop_name ||
    meta?.shop_username ||
    product.shop_name ||
    product.platform;

  const displayPrice =
    product.price_vnd && product.price_vnd > 0
      ? `${product.price_vnd.toLocaleString("vi-VN")}₫`
      : null;

  const burstCount =
    metrics.archetype_breakdown["TIME_BURST_SEEDING"] ??
    reviews.filter((r) => r.seeding_type === "TIME_BURST_SEEDING" || r.burst_15m_count >= 4).length;

  const duplicateCount =
    (metrics.archetype_breakdown["TEMPLATE_COPY_PASTE"] || 0) +
    (metrics.archetype_breakdown["AI_MARKETING_SEEDING"] || 0) +
    (metrics.archetype_breakdown["GRAPH_CLUSTER_SEEDING"] || 0);

  const coinCount =
    metrics.archetype_breakdown["COIN_FARM_SPAM"] ??
    reviews.filter((r) => r.seeding_type === "COIN_FARM_SPAM").length;

  const mismatchOrShortVidCount = reviews.filter((r) => {
    const det = r.detailed_rating;
    const subMismatch = det && r.rating === 5 && (det.product_quality || 5) <= 3;
    const hasShortOrTplVid =
      r.media_videos &&
      r.media_videos.some(
        (v) => v.template_video || (v.duration_ms && v.duration_ms > 0 && v.duration_ms <= 2600)
      );
    return Boolean(subMismatch || hasShortOrTplVid);
  }).length;

  const maxHourlyOrders =
    burstTimeline.length > 0
      ? Math.max(...burstTimeline.map((b) => b.total_reviews), burstCount)
      : Math.max(burstCount, 1);

  const repeatBuyersCount = reviews.filter(
    (r) => !r.is_seeding && r.is_repeated_purchase
  ).length;

  const mediaReviewsCount =
    meta?.reviews_with_media_count ??
    reviews.filter(
      (r) =>
        r.has_media ||
        (r.media_images && r.media_images.length > 0) ||
        (r.media_videos && r.media_videos.length > 0)
    ).length;

  const authenticMediaCount = reviews.filter(
    (r) =>
      !r.is_seeding &&
      ((r.media_images && r.media_images.length > 0) ||
        (r.media_videos && r.media_videos.length > 0))
  ).length;

  const authenticPct = Math.max(
    0,
    Math.min(100, Math.round(100 - metrics.seeding_rate_pct))
  );

  // Star Distribution 5★ -> 1★
  const trueStarShare = meta?.true_star_share_pct;
  const starComparison = [5, 4, 3, 2, 1].map((star) => {
    const matching = reviews.filter((r) => Math.round(r.rating) === star);
    const organicMatching = matching.filter((r) => !r.is_seeding);

    if (trueStarShare && trueStarShare[String(star)] !== undefined) {
      const shareRatio = Number(trueStarShare[String(star)]) / 100.0;
      const estShown = Math.max(
        matching.length > 0 ? 1 : 0,
        Math.round(shareRatio * metrics.total_reviews_analyzed)
      );
      const authFraction =
        matching.length > 0 ? organicMatching.length / matching.length : 1.0;
      const estReal = Math.round(estShown * authFraction);
      return {
        star,
        shownCount: estShown,
        realCount: estReal,
        suspiciousCount: Math.max(0, estShown - estReal),
      };
    }

    return {
      star,
      shownCount: matching.length,
      realCount: organicMatching.length,
      suspiciousCount: Math.max(0, matching.length - organicMatching.length),
    };
  });
  const maxStarCount = Math.max(
    ...starComparison.map((s) => s.shownCount),
    1
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
      {/* 1. FULL PRODUCT HEADER (NO TRUNCATION) */}
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={productImage}
            alt={product.name}
            width={88}
            height={88}
            className="h-20 w-20 shrink-0 rounded-2xl border border-gray-200 object-cover sm:h-22 sm:w-22"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 font-bold text-gray-800">
                <Store className="h-3.5 w-3.5 text-[#1A73E8]" />
                <span>Gian hàng: {displayShopName}</span>
              </span>
              {meta?.is_official_shop && (
                <span className="rounded bg-[#D0011B] px-2 py-0.5 text-[11px] font-extrabold text-white">
                  Shopee Mall Chính Hãng
                </span>
              )}
              {product.url && (
                <a
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#0D5CB6] hover:underline"
                >
                  <span>Liên kết gốc trên Shopee</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <h2 className="text-base font-extrabold leading-snug text-gray-900 sm:text-lg">
              {product.name}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600">
              {displayPrice && (
                <span className="text-base font-black text-[#EE4D2D]">
                  Giá niêm yết: {displayPrice}
                </span>
              )}
              <span>
                • Tổng mẫu phân tích:{" "}
                <strong className="text-gray-900">
                  {metrics.total_reviews_analyzed} đánh giá
                </strong>
              </span>
              {mediaReviewsCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[#0D5CB6]">
                  • <ImageIcon className="h-3.5 w-3.5" />
                  {mediaReviewsCount} đánh giá đính kèm ảnh/video
                </span>
              )}
              {meta?.total_raw_ratings_scanned !== undefined && meta.total_raw_ratings_scanned > 0 && (
                <span>
                  • Tổng lượt đánh giá quét từ sàn:{" "}
                  <strong className="text-gray-900">
                    {meta.total_raw_ratings_scanned.toLocaleString("vi-VN")}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. VERDICT + RATINGS + STAR BARS */}
      <div className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Left: Verdict & Rating Numbers */}
        <div
          className={`flex flex-col justify-between bg-gradient-to-br p-4 sm:p-5 lg:col-span-7 ${verdict.bg}`}
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${verdict.badgeBg}`}
              >
                <VerdictIcon className="h-5 w-5" />
              </div>
              <div>
                <span
                  className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-black text-white ${verdict.badgeBg}`}
                >
                  {verdict.label}
                </span>
                <p className="mt-1.5 text-xs leading-relaxed font-semibold text-gray-700">
                  {verdict.subLabel}
                </p>
              </div>
            </div>

            {/* Score Circle */}
            <div className="flex shrink-0 items-center gap-2.5 self-start rounded-2xl border border-gray-200/70 bg-white px-3 py-1.5 sm:self-center">
              <div className="relative h-14 w-14 shrink-0">
                <svg
                  width={56}
                  height={56}
                  className="h-14 w-14 -rotate-90"
                  viewBox="0 0 80 80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="transparent"
                    stroke="#E5E7EB"
                    strokeWidth="7"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="transparent"
                    stroke={verdict.strokeColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-base font-black ${verdict.textColor}`}>
                    {Math.round(score)}
                  </span>
                </div>
              </div>
              <div className="pr-1">
                <div className="text-[10px] font-bold text-gray-400">
                  Chỉ số Tin cậy
                </div>
                <div className="text-xs font-extrabold text-gray-800">
                  / 100 điểm
                </div>
              </div>
            </div>
          </div>

          {/* 2 Big Rating Boxes */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200/80 bg-white p-3.5">
              <div className="text-xs font-bold text-gray-500">
                Điểm hiển thị trên sàn Shopee
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-gray-900 sm:text-3xl">
                  {metrics.platform_rating.toFixed(2)}
                </span>
                <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                <span className="text-xs font-semibold text-gray-400">
                  / 5.00
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-300 bg-white p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#16A34A]">
                  Điểm thực tế sau khi lọc nhiễu
                </span>
                {metrics.rating_inflation > 0.03 && (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-extrabold text-[#DC2626]">
                    Độ lệch: -{metrics.rating_inflation.toFixed(2)}★
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-[#16A34A] sm:text-3xl">
                  {metrics.adjusted_rating.toFixed(2)}
                </span>
                <Star className="h-4 w-4 fill-[#16A34A] text-[#16A34A]" />
                <span className="text-xs font-semibold text-gray-400">
                  / 5.00
                </span>
              </div>
            </div>
          </div>

          {/* Valid vs Suspicious Bar */}
          <div className="mt-3.5 rounded-xl border border-gray-200/60 bg-white px-3.5 py-2.5">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span className="text-[#16A34A]">
                Đánh giá hợp lệ (Người mua thật): {metrics.authentic_reviews_count} đánh giá ({authenticPct}%)
              </span>
              <span className="text-[#DC2626]">
                Đánh giá nghi vấn (Seeding / Spam xu): {metrics.seeding_reviews_count} đánh giá ({Math.round(metrics.seeding_rate_pct)}%)
              </span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-red-100">
              <div
                className="h-full bg-[#16A34A]"
                style={{ width: `${authenticPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Detailed Star Bars */}
        <div className="flex flex-col justify-center p-4 sm:p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-600">
              Phân bố mức sao (Thực tế / Tổng hiển thị)
            </h3>
            <div className="flex items-center gap-2.5 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 text-[#16A34A]">
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                Hợp lệ
              </span>
              <span className="inline-flex items-center gap-1 text-[#DC2626]">
                <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
                Nghi vấn
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {starComparison.map((row) => {
              const shownPct = Math.round((row.shownCount / maxStarCount) * 100);
              const realPct = Math.round((row.realCount / maxStarCount) * 100);
              return (
                <div key={row.star} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-800">
                      Mức {row.star} sao ({row.star}★)
                    </span>
                    <span className="font-bold text-gray-700">
                      <strong className="text-[#16A34A]">
                        {row.realCount} hợp lệ
                      </strong>{" "}
                      / {row.shownCount} tổng{" "}
                      {row.suspiciousCount > 0 && (
                        <span className="text-[#DC2626]">
                          ({row.suspiciousCount} nghi vấn)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-red-200"
                        style={{ width: `${shownPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-[#16A34A]"
                        style={{ width: `${realPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. DETAILED 6-CATEGORY DIAGNOSTIC BREAKDOWN */}
      <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:px-5">
        <div className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-gray-600">
          Thống kê chi tiết các nhóm dấu hiệu nhận diện trên sản phẩm
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-700">
              <Coins className="h-4 w-4 shrink-0 text-[#EA580C]" />
              <span>Bình luận kiếm xu / khen sớm chưa dùng</span>
            </span>
            <strong className="ml-2 text-sm font-black text-[#EA580C]">
              {coinCount}
            </strong>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-700">
              <Copy className="h-4 w-4 shrink-0 text-[#D97706]" />
              <span>Nội dung văn mẫu / trùng lặp ngữ nghĩa</span>
            </span>
            <strong className="ml-2 text-sm font-black text-[#D97706]">
              {duplicateCount}
            </strong>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-700">
              <Clock className="h-4 w-4 shrink-0 text-[#DC2626]" />
              <span>Đăng dồn khung giờ (Đỉnh: {maxHourlyOrders} đơn/giờ)</span>
            </span>
            <strong className="ml-2 text-sm font-black text-[#DC2626]">
              {burstCount}
            </strong>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-700">
              <FileWarning className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Lệch điểm thành phần / video mẫu ngắn</span>
            </span>
            <strong className="ml-2 text-sm font-black text-rose-600">
              {mismatchOrShortVidCount}
            </strong>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-700">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#0D5CB6]" />
              <span>Đánh giá thật có hình ảnh / video quay thực tế</span>
            </span>
            <strong className="ml-2 text-sm font-black text-[#0D5CB6]">
              {authenticMediaCount}
            </strong>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-700">
              <Repeat className="h-4 w-4 shrink-0 text-[#16A34A]" />
              <span>Khách hàng mua lại lần 2+ (Repeated Buyer)</span>
            </span>
            <strong className="ml-2 text-sm font-black text-[#16A34A]">
              {repeatBuyersCount}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
