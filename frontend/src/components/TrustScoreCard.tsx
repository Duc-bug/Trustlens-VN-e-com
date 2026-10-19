"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Star,
  Share2,
  Bookmark,
  ExternalLink,
  Clock,
  Copy,
  Coins,
  Check,
  Store,
  Image as ImageIcon,
  Layers,
  Repeat,
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
  isSaved?: boolean;
  onToggleSave?: () => void;
  onSelectShopProduct?: (productUrl: string) => void;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=360&auto=format&fit=crop&q=80";

export default function TrustScoreCard({
  product,
  metrics,
  reviews,
  burstTimeline = [],
  isSaved = false,
  onToggleSave,
  onSelectShopProduct,
}: TrustScoreCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const score = metrics.trust_score;
  const verdict =
    score >= 70
      ? {
          label: "NÊN MUA",
          subLabel: "Đánh giá tự nhiên cao",
          bg: "from-emerald-50/70 via-emerald-50/20 to-white",
          badgeBg: "bg-[#16A34A]",
          textColor: "text-[#16A34A]",
          strokeColor: "#16A34A",
          Icon: CheckCircle2,
        }
      : score >= 45
      ? {
          label: "CÂN NHẮC",
          subLabel: "Có một số bình luận nhận xu / trùng lặp",
          bg: "from-amber-50/70 via-amber-50/20 to-white",
          badgeBg: "bg-[#F59E0B]",
          textColor: "text-[#D97706]",
          strokeColor: "#F59E0B",
          Icon: AlertTriangle,
        }
      : {
          label: "NÊN TRÁNH",
          subLabel: "Tỷ lệ đánh giá bất thường cao",
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
    reviews.filter((r) => r.seeding_type === "TIME_BURST_SEEDING").length;

  const duplicateCount =
    (metrics.archetype_breakdown["TEMPLATE_COPY_PASTE"] || 0) +
    (metrics.archetype_breakdown["AI_MARKETING_SEEDING"] || 0) +
    (metrics.archetype_breakdown["GRAPH_CLUSTER_SEEDING"] || 0);

  const coinCount =
    metrics.archetype_breakdown["COIN_FARM_SPAM"] ??
    reviews.filter((r) => r.seeding_type === "COIN_FARM_SPAM").length;

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
      };
    }

    return {
      star,
      shownCount: matching.length,
      realCount: organicMatching.length,
    };
  });
  const maxStarCount = Math.max(
    ...starComparison.map((s) => s.shownCount),
    1
  );

  const handleCopyShare = () => {
    const shareText = `${product.name} — ${verdict.label} (${Math.round(score)}/100) • Điểm thực tế: ${metrics.adjusted_rating.toFixed(2)}★`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
      {/* 1. COMPACT PRODUCT HEADER */}
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <img
              src={productImage}
              alt={product.name}
              width={80}
              height={80}
              className="h-18 w-18 shrink-0 rounded-2xl border border-gray-200 object-cover sm:h-20 sm:w-20"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
              }}
            />

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-bold text-gray-700">
                  <Store className="h-3 w-3 text-[#1A73E8]" />
                  <span className="truncate">{displayShopName}</span>
                </span>
                {meta?.is_official_shop && (
                  <span className="rounded bg-[#D0011B] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    Mall
                  </span>
                )}
                {product.url && (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#0D5CB6] hover:underline"
                  >
                    <span>Mở trên Shopee</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <h2 className="line-clamp-2 text-base font-extrabold text-gray-900 sm:text-lg">
                {product.name}
              </h2>

              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-500">
                {displayPrice && (
                  <span className="text-sm font-black text-[#EE4D2D]">
                    {displayPrice}
                  </span>
                )}
                <span>{metrics.total_reviews_analyzed} đánh giá</span>
                {mediaReviewsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#0D5CB6]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {mediaReviewsCount} ảnh/video
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyShare}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                  <span className="text-[#16A34A]">Đã chép</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-[#1A73E8]" />
                  <span>Chia sẻ</span>
                </>
              )}
            </button>

            {onToggleSave && (
              <button
                type="button"
                onClick={onToggleSave}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  isSaved
                    ? "border-[#1A73E8] bg-blue-50 text-[#0D5CB6]"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Bookmark
                  className={`h-3.5 w-3.5 ${
                    isSaved ? "fill-[#0D5CB6] text-[#0D5CB6]" : "text-gray-500"
                  }`}
                />
                <span>{isSaved ? "Đã lưu" : "Lưu"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Shop Product Switcher (Compact) */}
        {meta?.shop_top_products && meta.shop_top_products.length > 1 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pt-1">
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-gray-400">
              <Layers className="h-3 w-3" />
              Cùng shop:
            </span>
            {meta.shop_top_products.slice(0, 6).map((sp) => {
              const isCurrent = String(meta.itemid || "") === String(sp.itemid);
              const itemUrl = `https://shopee.vn/product/${meta.shopid}/${sp.itemid}`;
              return (
                <button
                  key={sp.itemid}
                  type="button"
                  onClick={() =>
                    onSelectShopProduct && onSelectShopProduct(itemUrl)
                  }
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11px] font-bold transition ${
                    isCurrent
                      ? "border-[#1A73E8] bg-blue-50 text-[#0D5CB6]"
                      : "border-gray-200 bg-gray-50/70 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="max-w-[140px] truncate">{sp.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. VERDICT + RATINGS + STAR BARS */}
      <div className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Left: Verdict & Rating Numbers */}
        <div
          className={`flex flex-col justify-between bg-gradient-to-br p-4 sm:p-5 lg:col-span-7 ${verdict.bg}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${verdict.badgeBg}`}
              >
                <VerdictIcon className="h-5 w-5" />
              </div>
              <div>
                <span
                  className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-black text-white ${verdict.badgeBg}`}
                >
                  {verdict.label}
                </span>
                <p className="mt-1 text-xs font-semibold text-gray-600">
                  {verdict.subLabel}
                </p>
              </div>
            </div>

            {/* Compact Score Circle */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-gray-200/70 bg-white px-3 py-1.5">
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
                  Độ tin cậy
                </div>
                <div className="text-xs font-extrabold text-gray-800">
                  / 100 điểm
                </div>
              </div>
            </div>
          </div>

          {/* 2 Big Rating Boxes */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200/80 bg-white p-3.5">
              <div className="text-xs font-bold text-gray-500">
                Điểm hiển thị
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900 sm:text-3xl">
                  {metrics.platform_rating.toFixed(2)}
                </span>
                <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-300 bg-white p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#16A34A]">
                  Điểm thực tế
                </span>
                {metrics.rating_inflation > 0.03 && (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-extrabold text-[#DC2626]">
                    -{metrics.rating_inflation.toFixed(2)}★
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-[#16A34A] sm:text-3xl">
                  {metrics.adjusted_rating.toFixed(2)}
                </span>
                <Star className="h-4 w-4 fill-[#16A34A] text-[#16A34A]" />
              </div>
            </div>
          </div>

          {/* Valid vs Suspicious Bar */}
          <div className="mt-3.5 rounded-xl border border-gray-200/60 bg-white px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span className="text-[#16A34A]">
                Hợp lệ: {metrics.authentic_reviews_count} ({authenticPct}%)
              </span>
              <span className="text-[#DC2626]">
                Nghi vấn: {metrics.seeding_reviews_count} (
                {Math.round(metrics.seeding_rate_pct)}%)
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-red-100">
              <div
                className="h-full bg-[#16A34A]"
                style={{ width: `${authenticPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Clean Star Bars */}
        <div className="flex flex-col justify-center p-4 sm:p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
              Phân bố mức sao
            </h3>
            <div className="flex items-center gap-2.5 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 text-gray-400">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                Gốc
              </span>
              <span className="inline-flex items-center gap-1 text-[#16A34A]">
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                Thực tế
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {starComparison.map((row) => {
              const shownPct = Math.round((row.shownCount / maxStarCount) * 100);
              const realPct = Math.round((row.realCount / maxStarCount) * 100);
              return (
                <div key={row.star} className="flex items-center gap-2.5 text-xs">
                  <span className="w-7 shrink-0 font-extrabold text-gray-700">
                    {row.star}★
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gray-300"
                        style={{ width: `${shownPct}%` }}
                      />
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#16A34A]"
                        style={{ width: `${realPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right font-bold text-gray-700">
                    <strong className="text-[#16A34A]">{row.realCount}</strong>
                    <span className="text-gray-400">/{row.shownCount}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. COMPACT 4-STAT STRIP */}
      <div className="grid grid-cols-2 gap-2.5 border-t border-gray-100 bg-gray-50/60 p-3.5 sm:grid-cols-4 sm:px-5">
        <div className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Clock className="h-3.5 w-3.5 text-[#DC2626]" />
            Đơn/giờ cao nhất
          </span>
          <strong className="text-xs font-black text-gray-900">
            {maxHourlyOrders}
          </strong>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Copy className="h-3.5 w-3.5 text-[#D97706]" />
            Trùng nội dung
          </span>
          <strong className="text-xs font-black text-[#D97706]">
            {duplicateCount}
          </strong>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Coins className="h-3.5 w-3.5 text-[#EA580C]" />
            Bình luận nhận xu
          </span>
          <strong className="text-xs font-black text-[#EA580C]">
            {coinCount}
          </strong>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Repeat className="h-3.5 w-3.5 text-[#16A34A]" />
            Khách mua lại
          </span>
          <strong className="text-xs font-black text-[#16A34A]">
            {repeatBuyersCount}
          </strong>
        </div>
      </div>
    </div>
  );
}
