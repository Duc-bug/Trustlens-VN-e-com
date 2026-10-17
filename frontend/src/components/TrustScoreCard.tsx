"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Star,
  Share2,
  Printer,
  Bookmark,
  ExternalLink,
  Clock,
  Copy,
  Users,
  Coins,
  Check,
  Store,
  Image as ImageIcon,
  Layers,
  Package,
  Cpu,
  ArrowRight,
} from "lucide-react";
import {
  TrustMetrics,
  ProductInfo,
  ReviewItem,
  BurstTimelinePoint,
  SeedingGraphPayload,
  LiveModelComparisonItem,
} from "@/types/trustlens";

interface TrustScoreCardProps {
  product: ProductInfo;
  metrics: TrustMetrics;
  reviews: ReviewItem[];
  burstTimeline?: BurstTimelinePoint[];
  graphData?: SeedingGraphPayload;
  liveModels?: LiveModelComparisonItem[];
  isSaved?: boolean;
  onToggleSave?: () => void;
  onSelectShopProduct?: (productUrl: string) => void;
  onOpenTechnicalTab?: () => void;
}

const PLATFORM_STYLE: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Shopee: {
    bg: "bg-[#EE4D2D]/10",
    text: "text-[#EE4D2D]",
    border: "border-[#EE4D2D]/25",
  },
  "TikTok Shop": {
    bg: "bg-gray-900",
    text: "text-white",
    border: "border-gray-900",
  },
  Tiki: {
    bg: "bg-[#1A94FF]/10",
    text: "text-[#0D5CB6]",
    border: "border-[#1A94FF]/25",
  },
  Lazada: {
    bg: "bg-[#0F146D]/10",
    text: "text-[#0F146D]",
    border: "border-[#0F146D]/25",
  },
  "Google Maps": {
    bg: "bg-[#16A34A]/10",
    text: "text-[#16A34A]",
    border: "border-[#16A34A]/25",
  },
};

const FALLBACK_IMAGES: Record<string, string> = {
  Shopee:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=360&auto=format&fit=crop&q=80",
  "TikTok Shop":
    "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=360&auto=format&fit=crop&q=80",
  Tiki: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=360&auto=format&fit=crop&q=80",
  Lazada:
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=360&auto=format&fit=crop&q=80",
  "Google Maps":
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=360&auto=format&fit=crop&q=80",
};

export default function TrustScoreCard({
  product,
  metrics,
  reviews,
  burstTimeline = [],
  graphData,
  liveModels = [],
  isSaved = false,
  onToggleSave,
  onSelectShopProduct,
  onOpenTechnicalTab,
}: TrustScoreCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const score = metrics.trust_score;
  const verdict =
    score >= 70
      ? {
          label: "NÊN MUA",
          subLabel: "Đánh giá tự nhiên cao",
          bg: "from-emerald-50/80 via-emerald-50/30 to-white",
          border: "border-emerald-200",
          badgeBg: "bg-[#16A34A]",
          textColor: "text-[#16A34A]",
          strokeColor: "#16A34A",
          Icon: CheckCircle2,
        }
      : score >= 45
      ? {
          label: "CÂN NHẮC",
          subLabel: "Có dấu hiệu buff đơn / nhận xu",
          bg: "from-amber-50/80 via-amber-50/30 to-white",
          border: "border-amber-200",
          badgeBg: "bg-[#F59E0B]",
          textColor: "text-[#D97706]",
          strokeColor: "#F59E0B",
          Icon: AlertTriangle,
        }
      : {
          label: "NÊN TRÁNH",
          subLabel: "Nghi vấn thao túng đánh giá cao",
          bg: "from-red-50/80 via-red-50/30 to-white",
          border: "border-red-200",
          badgeBg: "bg-[#DC2626]",
          textColor: "text-[#DC2626]",
          strokeColor: "#DC2626",
          Icon: ShieldAlert,
        };

  const VerdictIcon = verdict.Icon;

  const shortReasonSentence =
    metrics.seeding_rate_pct >= 25
      ? `Phát hiện ${Math.round(metrics.seeding_rate_pct)}% đánh giá có dấu hiệu nghi vấn. Điểm thực tế sau lọc là ${metrics.adjusted_rating.toFixed(2)}★ (trên sàn hiển thị ${metrics.platform_rating.toFixed(2)}★).`
      : `Chỉ có ${Math.round(metrics.seeding_rate_pct)}% đánh giá nghi vấn. Điểm thực tế ${metrics.adjusted_rating.toFixed(2)}★ bám sát mức hiển thị ${metrics.platform_rating.toFixed(2)}★ trên sàn.`;

  // Circular Gauge SVG parameters (fixed 80x80px)
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const meta = product.shopee_live_meta;
  const productImage =
    product.image_url ||
    meta?.product_image_url ||
    FALLBACK_IMAGES[product.platform] ||
    FALLBACK_IMAGES.Shopee;

  const displayShopName =
    meta?.shop_name ||
    meta?.shop_username ||
    product.shop_name ||
    `Gian hàng ${product.platform}`;

  const displayPrice =
    product.price_vnd && product.price_vnd > 0
      ? `${product.price_vnd.toLocaleString("vi-VN")}₫`
      : "Giá theo phân loại trên sàn";

  const platformBadge = PLATFORM_STYLE[product.platform] || {
    bg: "bg-blue-50",
    text: "text-[#0D5CB6]",
    border: "border-blue-200",
  };

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

  const clusterAccountsCount =
    graphData?.summary?.largest_cluster_size &&
    graphData.summary.largest_cluster_size > 0
      ? graphData.summary.largest_cluster_size
      : Math.max(
          graphData?.nodes?.filter((n) => n.is_seeding).length || 0,
          burstCount
        );

  // Parallel Star Distribution 5★ -> 1★
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

  const mediaReviewsCount =
    meta?.reviews_with_media_count ??
    reviews.filter(
      (r) =>
        r.has_media ||
        (r.media_images && r.media_images.length > 0) ||
        (r.media_videos && r.media_videos.length > 0)
    ).length;

  const repeatBuyersCount = reviews.filter(
    (r) => !r.is_seeding && r.is_repeated_purchase
  ).length;

  const authenticPct = Math.max(
    0,
    Math.min(100, Math.round(100 - metrics.seeding_rate_pct))
  );

  const handleCopyShare = () => {
    const shareText = `${product.name} — Kết luận: ${verdict.label} (${Math.round(score)}/100). ${shortReasonSentence}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* MAIN UNIFIED HERO CARD */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        {/* SECTION 1: PRODUCT HEADER + THUMBNAIL (FIXED 96x96) + QUICK ACTIONS */}
        <div className="border-b border-gray-100 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4 sm:items-center">
              {/* Fixed 96x96px Product Thumbnail */}
              <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                <img
                  src={productImage}
                  alt={product.name}
                  width={96}
                  height={96}
                  className="h-20 w-20 rounded-2xl border border-gray-200 object-cover shadow-2xs sm:h-24 sm:w-24"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      FALLBACK_IMAGES.Shopee;
                  }}
                />
                {meta?.is_official_shop && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#D0011B] px-2 py-0.5 text-[10px] font-extrabold text-white shadow-2xs">
                    Shopee Mall
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-bold ${platformBadge.bg} ${platformBadge.text} ${platformBadge.border}`}
                  >
                    {product.platform}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-800">
                    {meta?.shop_avatar_url ? (
                      <img
                        src={meta.shop_avatar_url}
                        alt={displayShopName}
                        width={16}
                        height={16}
                        className="h-4 w-4 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <Store className="h-3.5 w-3.5 shrink-0 text-[#1A73E8]" />
                    )}
                    <span className="truncate">{displayShopName}</span>
                  </span>
                  {product.url && (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0D5CB6] transition hover:bg-blue-100"
                    >
                      <span>Xem trên Shopee</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>

                <h2 className="line-clamp-2 text-base font-extrabold leading-snug text-gray-900 sm:text-xl">
                  {product.name}
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-gray-600">
                  {product.price_vnd > 0 && (
                    <span className="text-base font-black text-[#EE4D2D]">
                      {displayPrice}
                    </span>
                  )}
                  <span>
                    Tổng mẫu phân tích:{" "}
                    <strong className="text-gray-900">
                      {metrics.total_reviews_analyzed} đánh giá
                    </strong>
                  </span>
                  {mediaReviewsCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[#0D5CB6]">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                      <strong>{mediaReviewsCount}</strong> có ảnh/video thực tế
                    </span>
                  )}
                  {repeatBuyersCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <strong>{repeatBuyersCount}</strong> khách mua lại
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyShare}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4 text-[#16A34A]" />
                    <span className="text-[#16A34A]">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 text-[#1A73E8]" />
                    <span>Chia sẻ</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
              >
                <Printer className="h-4 w-4 text-gray-600" />
                <span>In báo cáo</span>
              </button>

              {onToggleSave && (
                <button
                  type="button"
                  onClick={onToggleSave}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                    isSaved
                      ? "border-[#1A73E8] bg-blue-50 text-[#0D5CB6]"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Bookmark
                    className={`h-4 w-4 ${
                      isSaved
                        ? "fill-[#0D5CB6] text-[#0D5CB6]"
                        : "text-gray-600"
                    }`}
                  />
                  <span>{isSaved ? "Đã lưu" : "Lưu theo dõi"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-Ratings & Shop Info Strip */}
          {meta && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/90 px-4 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-3 font-medium text-gray-600">
                <span>
                  Shop ID: <strong className="text-gray-900">{meta.shopid}</strong>
                </span>
                {meta.itemid && (
                  <span>
                    • Mã SP: <strong className="text-gray-900">{meta.itemid}</strong>
                  </span>
                )}
                {meta.total_shop_items > 0 && (
                  <span className="inline-flex items-center gap-1">
                    • <Package className="h-3.5 w-3.5 text-gray-400" />{" "}
                    <strong className="text-gray-900">{meta.total_shop_items}</strong> SP trong shop
                  </span>
                )}
              </div>

              {meta.detailed_ratings_avg && (
                <div className="flex flex-wrap items-center gap-2 font-bold">
                  <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-700">
                    Chất lượng SP:{" "}
                    <strong className="text-[#F59E0B]">
                      {meta.detailed_ratings_avg.product_quality}★
                    </strong>
                  </span>
                  <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-700">
                    Dịch vụ Shop:{" "}
                    <strong className="text-[#16A34A]">
                      {meta.detailed_ratings_avg.seller_service}★
                    </strong>
                  </span>
                  <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-700">
                    Vận chuyển:{" "}
                    <strong className="text-[#1A73E8]">
                      {meta.detailed_ratings_avg.delivery_service}★
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Other Products in Same Shop Switcher */}
          {meta?.shop_top_products && meta.shop_top_products.length > 1 && (
            <div className="mt-3 pt-1">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-[#0D5CB6]" />
                  Chuyển nhanh sang sản phẩm khác cùng gian hàng ({meta.shop_top_products.length}):
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {meta.shop_top_products.slice(0, 8).map((sp) => {
                  const isCurrent =
                    String(meta.itemid || "") === String(sp.itemid);
                  const itemUrl = `https://shopee.vn/product/${meta.shopid}/${sp.itemid}`;
                  return (
                    <button
                      key={sp.itemid}
                      type="button"
                      onClick={() =>
                        onSelectShopProduct && onSelectShopProduct(itemUrl)
                      }
                      className={`flex shrink-0 items-center gap-2 rounded-xl border p-1.5 pr-3 text-left transition ${
                        isCurrent
                          ? "border-[#1A73E8] bg-blue-50/90 text-[#0D5CB6]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-[#1A73E8]/50 hover:bg-gray-50"
                      }`}
                    >
                      {sp.image_url && (
                        <img
                          src={sp.image_url}
                          alt={sp.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 shrink-0 rounded-lg border border-gray-100 object-cover"
                        />
                      )}
                      <div className="max-w-[165px] min-w-0">
                        <div className="truncate text-[11px] font-bold">
                          {sp.name}
                        </div>
                        <div className="text-[10px] font-semibold text-gray-500">
                          {sp.review_count} đánh giá
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: 2-COLUMN SPACIOUS VERDICT & STAR DISTRIBUTION */}
        <div className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* LEFT (7 cols): VERDICT + 80x80 GAUGE + PLATFORM VS REAL RATING */}
          <div
            className={`flex flex-col justify-between bg-gradient-to-br p-5 sm:p-6 lg:col-span-7 ${verdict.bg}`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-xs ${verdict.badgeBg}`}
                  >
                    <VerdictIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`whitespace-nowrap rounded-lg px-3 py-0.5 text-sm font-black tracking-tight text-white ${verdict.badgeBg}`}
                      >
                        {verdict.label}
                      </span>
                      <span className="text-sm font-extrabold text-gray-800">
                        {metrics.risk_label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-gray-600">
                      {verdict.subLabel}
                    </p>
                  </div>
                </div>

                {/* Fixed 80x80px Circular Trust Score Gauge */}
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200/60 bg-white px-3.5 py-2 shadow-2xs">
                  <div className="relative h-16 w-16 shrink-0">
                    <svg
                      width={64}
                      height={64}
                      className="h-16 w-16 -rotate-90"
                      viewBox="0 0 88 88"
                    >
                      <circle
                        cx="44"
                        cy="44"
                        r={radius}
                        fill="transparent"
                        stroke="#E5E7EB"
                        strokeWidth="8"
                      />
                      <circle
                        cx="44"
                        cy="44"
                        r={radius}
                        fill="transparent"
                        stroke={verdict.strokeColor}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span
                        className={`text-lg font-black leading-none ${verdict.textColor}`}
                      >
                        {Math.round(score)}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400">
                        /100
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-gray-500">
                      Điểm tin cậy
                    </div>
                    <div className={`text-xs font-black ${verdict.textColor}`}>
                      {verdict.label}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3.5 text-sm font-bold leading-relaxed text-gray-800">
                {shortReasonSentence}
              </p>
            </div>

            {/* Side-by-Side Platform Rating vs Adjusted True Rating */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <div className="text-xs font-bold text-gray-500">
                  Điểm hiển thị trên sàn
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-gray-900">
                    {metrics.platform_rating.toFixed(2)}
                  </span>
                  <Star className="h-5 w-5 fill-[#F59E0B] text-[#F59E0B]" />
                </div>
                <div className="mt-1 text-xs font-medium text-gray-500">
                  Trung bình hiển thị gốc trên Shopee
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-300 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#0D5CB6]">
                    Điểm thực tế sau lọc
                  </span>
                  {metrics.rating_inflation > 0.03 && (
                    <span className="whitespace-nowrap rounded-md bg-red-50 px-2 py-0.5 text-xs font-extrabold text-[#DC2626]">
                      -{metrics.rating_inflation.toFixed(2)}★
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[#16A34A]">
                    {metrics.adjusted_rating.toFixed(2)}
                  </span>
                  <Star className="h-5 w-5 fill-[#16A34A] text-[#16A34A]" />
                </div>
                <div className="mt-1 text-xs font-semibold text-emerald-700">
                  Tính từ {metrics.authentic_reviews_count} đánh giá hợp lệ
                </div>
              </div>
            </div>

            {/* Authentic vs Suspicious Split Progress Bar */}
            <div className="mt-4 rounded-xl border border-gray-200/60 bg-white p-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                <span className="text-[#16A34A]">
                  ✓ Đánh giá hợp lệ: {metrics.authentic_reviews_count} ({authenticPct}%)
                </span>
                <span className="text-[#DC2626]">
                  ⚠ Đánh giá nghi vấn: {metrics.seeding_reviews_count} ({Math.round(metrics.seeding_rate_pct)}%)
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-red-100">
                <div
                  className="h-full bg-[#16A34A] transition-all"
                  style={{ width: `${authenticPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT (5 cols): PARALLEL STAR DISTRIBUTION (5★ -> 1★) */}
          <div className="flex flex-col justify-between p-5 sm:p-6 lg:col-span-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Phân bố sao trước &amp; sau lọc
                  </h3>
                  <p className="text-xs font-medium text-gray-500">
                    Đối chiếu số lượng đánh giá theo từng mức sao
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-500">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    Hiển thị
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#16A34A]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
                    Thực tế
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {starComparison.map((row) => {
                  const shownPct = Math.round(
                    (row.shownCount / maxStarCount) * 100
                  );
                  const realPct = Math.round(
                    (row.realCount / maxStarCount) * 100
                  );
                  const fakeCount = Math.max(0, row.shownCount - row.realCount);

                  return (
                    <div key={row.star} className="flex items-center gap-3">
                      <div className="w-9 shrink-0 whitespace-nowrap text-xs font-extrabold text-gray-800">
                        {row.star} ★
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-gray-300"
                              style={{ width: `${shownPct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs font-bold text-gray-500">
                            {row.shownCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#16A34A]"
                              style={{ width: `${realPct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs font-extrabold text-[#16A34A]">
                            {row.realCount}
                          </span>
                        </div>
                      </div>
                      <div className="w-24 shrink-0 text-right">
                        {fakeCount > 0 ? (
                          <span className="inline-block whitespace-nowrap rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#DC2626]">
                            -{fakeCount} nghi vấn
                          </span>
                        ) : (
                          <span className="inline-block whitespace-nowrap text-[11px] font-semibold text-emerald-700">
                            Hợp lệ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {meta?.variations && meta.variations.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="mb-1.5 text-xs font-bold text-gray-500">
                  Phân loại hàng phổ biến ({meta.variations.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {meta.variations.slice(0, 6).map((v, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-700"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: BOTTOM HORIZONTAL STRIP FOR 4 SIGNALS + 5-MODEL CONSENSUS */}
        <div className="border-t border-gray-100 bg-gray-50/60 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#DC2626]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-gray-900">
                    Đơn dồn theo giờ
                  </div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Cao nhất 1 khung giờ
                  </div>
                </div>
              </div>
              <span className="whitespace-nowrap text-base font-black text-gray-900">
                {maxHourlyOrders} đơn
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#D97706]">
                  <Copy className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-gray-900">
                    Trùng lặp văn mẫu
                  </div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Nội dung tương tự
                  </div>
                </div>
              </div>
              <span className="whitespace-nowrap text-base font-black text-[#D97706]">
                {duplicateCount}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C]">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-gray-900">
                    Bình luận nhận xu
                  </div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Viết chung chung lấy xu
                  </div>
                </div>
              </div>
              <span className="whitespace-nowrap text-base font-black text-[#EA580C]">
                {coinCount}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1A73E8]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-gray-900">
                    Cụm liên kết đồ thị
                  </div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Đánh giá trùng thời điểm
                  </div>
                </div>
              </div>
              <span className="whitespace-nowrap text-base font-black text-[#1A73E8]">
                {clusterAccountsCount} TK
              </span>
            </div>
          </div>

          {/* Spacious 5-Column Bar for the 5 Models */}
          {liveModels.length > 0 && (
            <div className="mt-4 rounded-2xl border border-blue-200/80 bg-white p-4 shadow-2xs">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-[#0D5CB6]">
                    <Cpu className="h-3.5 w-3.5" />
                    Kết quả 5 mô hình học máy chạy song song trên sản phẩm này
                  </span>
                </div>
                {onOpenTechnicalTab && (
                  <button
                    type="button"
                    onClick={onOpenTechnicalTab}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-[#1A73E8] hover:underline"
                  >
                    <span>Xem bảng thông số chi tiết</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {liveModels.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border px-3 py-2 ${
                      m.is_proposed
                        ? "border-blue-300 bg-blue-50/50"
                        : "border-gray-200/80 bg-gray-50/70"
                    }`}
                  >
                    <div className="truncate text-xs font-extrabold text-gray-900">
                      {m.short_name}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                      <span className="whitespace-nowrap font-bold text-[#DC2626]">
                        {m.flagged_count} nghi vấn
                      </span>
                      <span className="whitespace-nowrap font-semibold text-gray-500">
                        ({m.flagged_rate_pct}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
