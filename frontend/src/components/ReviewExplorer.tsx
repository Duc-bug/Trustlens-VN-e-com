"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Star,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  CornerDownRight,
  Video,
  X,
} from "lucide-react";
import { ReviewItem } from "@/types/trustlens";

interface ReviewExplorerProps {
  reviews: ReviewItem[];
}

type FilterMode =
  | "all"
  | "text_only"
  | "target_item"
  | "seeding"
  | "organic"
  | "media"
  | "repeat"
  | "burst"
  | "duplicate"
  | "coin";
type SortMode = "suspicious" | "newest" | "lowest_star";

function toPct(val: number): number {
  if (!val || Number.isNaN(val)) return 0;
  return val > 1.0 ? val : val * 100.0;
}

// Generate concrete seeding reason chips from real Shopee review data
function getShortReasonChips(review: ReviewItem): string[] {
  if (review.seeding_signals && review.seeding_signals.length > 0) {
    return review.seeding_signals.slice(0, 3);
  }

  const probPct = toPct(review.seeding_probability);
  const simPctRaw = toPct(review.cosine_similarity_max);

  if (!review.is_seeding && probPct < 45) {
    return [];
  }
  const chips: string[] = [];

  if (
    simPctRaw >= 50 ||
    review.seeding_type === "TEMPLATE_COPY_PASTE" ||
    review.seeding_type === "AI_MARKETING_SEEDING" ||
    review.seeding_type === "duplicate_template"
  ) {
    chips.push("Nội dung trùng lặp tương tự");
  }
  if (
    review.burst_15m_count >= 4 ||
    review.seeding_type === "TIME_BURST_SEEDING" ||
    review.seeding_type === "burst_seeding"
  ) {
    chips.push(`Đăng dồn ${Math.max(review.burst_15m_count, 4)} đơn/15p`);
  }
  if (
    review.seeding_type === "COIN_FARM_SPAM" ||
    review.seeding_type === "coin_farming"
  ) {
    chips.push("Bình luận nhận xu Shopee");
  }
  if (
    review.graph_degree >= 15 ||
    review.seeding_type === "GRAPH_CLUSTER_SEEDING"
  ) {
    chips.push(`Tài khoản lặp ${Math.max(2, review.user_total_reviews)} lần`);
  }
  if (chips.length === 0 && probPct >= 45) {
    chips.push("Nhận xét chung chung");
  }
  return chips.slice(0, 3);
}

// Generate concrete authenticity chips for verified Real Buyer reviews
function getAuthenticityChips(review: ReviewItem): string[] {
  const probPct = toPct(review.seeding_probability);
  if (review.is_seeding || probPct >= 45) return [];

  if (review.authenticity_signals && review.authenticity_signals.length > 0) {
    return review.authenticity_signals.slice(0, 3);
  }

  const chips: string[] = [];
  const imgCount = review.media_images?.length || 0;
  const realVids = (review.media_videos || []).filter(
    (v) => (v.duration_ms || 0) >= 3500 && !v.template_video
  );

  if (review.is_repeated_purchase) {
    chips.push("Khách mua lại lần 2+");
  }
  if (imgCount > 0 && realVids.length > 0) {
    const sec = Math.round((realVids[0].duration_ms || 5000) / 1000);
    chips.push(`Có ${imgCount} ảnh & video (${sec}s)`);
  } else if (realVids.length > 0) {
    const sec = Math.round((realVids[0].duration_ms || 5000) / 1000);
    chips.push(`Có video quay sản phẩm (${sec}s)`);
  } else if (imgCount > 0) {
    chips.push(`Đính kèm ${imgCount} hình ảnh`);
  }
  if (
    review.rating <= 4 &&
    !review.comment.trim().startsWith("[Đánh giá ")
  ) {
    chips.push("Phản hồi khách quan thực tế");
  } else if (
    !review.comment.trim().startsWith("[Đánh giá ") &&
    review.comment.trim().split(/\s+/).length >= 16 &&
    toPct(review.cosine_similarity_max) < 38
  ) {
    chips.push("Mô tả trải nghiệm chi tiết");
  }
  if (review.helpful_votes > 0) {
    chips.push(`${review.helpful_votes} lượt thấy hữu ích`);
  }
  return chips.slice(0, 3);
}

// Highlight matching search query in review text (B.10)
function renderHighlightedText(text: string, keyword: string) {
  const cleanQuery = keyword.trim();
  if (!cleanQuery) return text;

  const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, idx) =>
    part.toLowerCase() === cleanQuery.toLowerCase() ? (
      <mark
        key={idx}
        className="rounded-xs bg-amber-200 px-1 py-0.5 font-bold text-gray-900"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function ReviewExplorer({ reviews }: ReviewExplorerProps) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("suspicious");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [expandedTextIds, setExpandedTextIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedChipIds, setExpandedChipIds] = useState<
    Record<string, boolean>
  >({});
  const [lightboxMedia, setLightboxMedia] = useState<{
    type: "image" | "video";
    url: string;
    cover?: string;
    review: ReviewItem;
  } | null>(null);

  const counts = useMemo(
    () => ({
      all: reviews.length,
      textOnly: reviews.filter(
        (r) =>
          r.is_text_review ??
          !r.comment.trim().startsWith("[Đánh giá ")
      ).length,
      targetItem: reviews.filter((r) => r.is_target_item).length,
      seeding: reviews.filter((r) => r.is_seeding).length,
      organic: reviews.filter((r) => !r.is_seeding).length,
      repeat: reviews.filter((r) => r.is_repeated_purchase).length,
      media: reviews.filter(
        (r) =>
          r.has_media ||
          (r.media_images && r.media_images.length > 0) ||
          (r.media_videos && r.media_videos.length > 0)
      ).length,
      burst: reviews.filter(
        (r) =>
          r.seeding_type === "TIME_BURST_SEEDING" ||
          r.seeding_type === "burst_seeding"
      ).length,
      duplicate: reviews.filter(
        (r) =>
          r.seeding_type === "TEMPLATE_COPY_PASTE" ||
          r.seeding_type === "AI_MARKETING_SEEDING" ||
          r.seeding_type === "GRAPH_CLUSTER_SEEDING" ||
          r.seeding_type === "duplicate_template"
      ).length,
      coin: reviews.filter(
        (r) =>
          r.seeding_type === "COIN_FARM_SPAM" ||
          r.seeding_type === "coin_farming"
      ).length,
      stars: {
        5: reviews.filter((r) => Math.round(r.rating) === 5).length,
        4: reviews.filter((r) => Math.round(r.rating) === 4).length,
        3: reviews.filter((r) => Math.round(r.rating) === 3).length,
        2: reviews.filter((r) => Math.round(r.rating) === 2).length,
        1: reviews.filter((r) => Math.round(r.rating) === 1).length,
      } as Record<number, number>,
    }),
    [reviews]
  );

  const filteredAndSorted = useMemo(() => {
    const list = reviews.filter((r) => {
      if (starFilter !== null && Math.round(r.rating) !== starFilter) {
        return false;
      }
      if (filter === "text_only") {
        const isText =
          r.is_text_review ?? !r.comment.trim().startsWith("[Đánh giá ");
        if (!isText) return false;
      }
      if (filter === "target_item" && !r.is_target_item) return false;
      if (filter === "seeding" && !r.is_seeding) return false;
      if (filter === "organic" && r.is_seeding) return false;
      if (filter === "repeat" && !r.is_repeated_purchase) return false;
      if (
        filter === "media" &&
        !r.has_media &&
        !(r.media_images && r.media_images.length > 0) &&
        !(r.media_videos && r.media_videos.length > 0)
      )
        return false;
      if (
        filter === "burst" &&
        r.seeding_type !== "TIME_BURST_SEEDING" &&
        r.seeding_type !== "burst_seeding"
      )
        return false;
      if (
        filter === "duplicate" &&
        r.seeding_type !== "TEMPLATE_COPY_PASTE" &&
        r.seeding_type !== "AI_MARKETING_SEEDING" &&
        r.seeding_type !== "GRAPH_CLUSTER_SEEDING" &&
        r.seeding_type !== "duplicate_template"
      )
        return false;
      if (
        filter === "coin" &&
        r.seeding_type !== "COIN_FARM_SPAM" &&
        r.seeding_type !== "coin_farming"
      )
        return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.comment.toLowerCase().includes(q) ||
          r.user_name.toLowerCase().includes(q) ||
          (r.variation && r.variation.toLowerCase().includes(q)) ||
          (r.product_name && r.product_name.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "suspicious") {
        return b.seeding_probability - a.seeding_probability;
      }
      if (sortBy === "newest") {
        return b.timestamp.localeCompare(a.timestamp);
      }
      if (sortBy === "lowest_star") {
        return a.rating - b.rating;
      }
      return 0;
    });
  }, [reviews, filter, starFilter, sortBy, search]);

  const visibleReviews = filteredAndSorted.slice(0, visibleCount);

  const toggleExpandText = (id: string) => {
    setExpandedTextIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandChip = (id: string) => {
    setExpandedChipIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filterTabs = [
    { id: "all", label: `Tất cả (${counts.all})` },
    { id: "organic", label: `Đánh giá thật (${counts.organic})` },
    { id: "seeding", label: `Nghi seeding (${counts.seeding})` },
    ...(counts.repeat > 0
      ? [{ id: "repeat", label: `Khách mua lại (${counts.repeat})` }]
      : []),
    { id: "media", label: `Có ảnh/video (${counts.media})` },
    ...(counts.textOnly < counts.all
      ? [{ id: "text_only", label: `Có lời bình (${counts.textOnly})` }]
      : []),
    ...(counts.targetItem > 0 && counts.targetItem < counts.all
      ? [{ id: "target_item", label: `Đúng SP này (${counts.targetItem})` }]
      : []),
    { id: "coin", label: `Cày xu (${counts.coin})` },
    { id: "duplicate", label: `Trùng mẫu (${counts.duplicate})` },
    { id: "burst", label: `Dồn đơn (${counts.burst})` },
  ];

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
      {/* Header + 1-time Color Legend at top of block */}
      <div className="flex flex-col justify-between gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">
            Danh sách bình luận ({filteredAndSorted.length})
          </h3>
          <p className="text-xs font-medium text-gray-500">
            Hiển thị nội dung, phân loại hàng, ảnh/video người mua, phản hồi của shop và biểu quyết 5 mô hình
          </p>
        </div>

        {/* Single Color Legend */}
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-gray-50 px-3.5 py-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            Thật
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
            Nghi seeding
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#D97706]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
            Cần xem lại
          </span>
        </div>
      </div>

      {/* Sticky Filter + Star Filter + Search + Sort Bar */}
      <div className="sticky top-14 z-20 -mx-2 my-4 space-y-2.5 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xs backdrop-blur-xs">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFilter(tab.id as FilterMode);
                    setVisibleCount(12);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? "bg-[#1A73E8] text-white shadow-2xs"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Input + Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:w-56">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(12);
                }}
                placeholder="Tìm từ khóa, phân loại..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-7 text-xs font-semibold text-gray-900 placeholder-gray-400 focus:border-[#1A73E8] focus:bg-white focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="rounded-xl border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-xs font-bold text-gray-700 focus:border-[#1A73E8] focus:bg-white focus:outline-none"
                aria-label="Sắp xếp bình luận"
              >
                <option value="suspicious">Sắp xếp: Nghi vấn nhất</option>
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="lowest_star">Sắp xếp: Sao thấp → cao</option>
              </select>
            </div>
          </div>
        </div>

        {/* Star Rating Filter Row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
          <span className="mr-1 text-[11px] font-bold text-gray-500">
            Lọc theo số sao:
          </span>
          <button
            type="button"
            onClick={() => {
              setStarFilter(null);
              setVisibleCount(12);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              starFilter === null
                ? "bg-amber-500 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Tất cả sao
          </button>
          {[5, 4, 3, 2, 1].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStarFilter(starFilter === st ? null : st);
                setVisibleCount(12);
              }}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                starFilter === st
                  ? "bg-amber-500 text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-amber-50"
              }`}
            >
              <span>{st} ★</span>
              <span
                className={`text-[10px] ${
                  starFilter === st ? "text-amber-100" : "text-gray-400"
                }`}
              >
                ({counts.stars[st] || 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Review Cards with Full Real Shopee Details */}
      <div className="space-y-3.5">
        {visibleReviews.map((review) => {
          const probPct = toPct(review.seeding_probability);
          const isSeeding = review.is_seeding && probPct >= 65;
          const isWarning =
            (review.is_seeding && probPct < 65) ||
            (!review.is_seeding && probPct >= 40);

          const statusConfig = isSeeding
            ? {
                badgeText: "Nghi seeding",
                badgeClass:
                  "border-[#DC2626]/25 bg-[#DC2626]/10 text-[#DC2626]",
                cardClass: "border-gray-200 bg-red-50/20",
                avatarClass: "bg-[#DC2626] text-white",
                Icon: ShieldAlert,
              }
            : isWarning
            ? {
                badgeText: "Cần xem lại",
                badgeClass:
                  "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#D97706]",
                cardClass: "border-gray-200 bg-amber-50/20",
                avatarClass: "bg-[#F59E0B] text-white",
                Icon: AlertTriangle,
              }
            : {
                badgeText: "Thật",
                badgeClass:
                  "border-[#16A34A]/25 bg-[#16A34A]/10 text-[#16A34A]",
                cardClass: "border-gray-200 bg-white",
                avatarClass: "bg-[#16A34A] text-white",
                Icon: CheckCircle2,
              };

          const StatusIcon = statusConfig.Icon;
          const isTextExpanded = !!expandedTextIds[review.review_id];
          const isLongText = review.comment.length > 180;
          const shortChips = getShortReasonChips(review);
          const authChips = getAuthenticityChips(review);
          const isChipExpanded = !!expandedChipIds[review.review_id];

          const initials = (review.user_name || "KH")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={review.review_id}
              className={`rounded-2xl border p-4 transition sm:p-5 ${statusConfig.cardClass}`}
            >
              {/* Top Row: Avatar + Name + Stars + Status Badge + Date */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {review.user_avatar ? (
                    <img
                      src={review.user_avatar}
                      alt={review.user_name}
                      className="h-9 w-9 shrink-0 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${statusConfig.avatarClass}`}
                    >
                      {initials}
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">
                        {review.user_name}
                      </span>
                      {review.is_repeated_purchase && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700"
                          title="Dữ liệu thật Shopee: Tài khoản này đã mua lại sản phẩm từ lần thứ 2 trở lên"
                        >
                          ✓ Khách mua lại
                        </span>
                      )}
                      {review.anonymous && (
                        <span
                          className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600"
                          title="Người mua bật chế độ đánh giá ẩn danh trên Shopee"
                        >
                          Ẩn danh
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < review.rating
                                ? "fill-[#F59E0B] text-[#F59E0B]"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                      <span>{review.timestamp.slice(0, 16)}</span>
                      {review.edit_delay_sec !== undefined &&
                        review.edit_delay_sec > 60 && (
                          <span
                            className="text-[11px] font-semibold text-amber-600"
                            title={`Đánh giá đã được chỉnh sửa sau ${Math.round(
                              review.edit_delay_sec / 60
                            )} phút`}
                          >
                            • Đã sửa đánh giá
                          </span>
                        )}
                      {review.variation && (
                        <span>
                          • Phân loại hàng:{" "}
                          <strong className="text-gray-700">
                            {review.variation}
                          </strong>
                        </span>
                      )}
                      {review.helpful_votes > 0 && (
                        <span className="inline-flex items-center gap-1 text-[#0D5CB6]">
                          • <ThumbsUp className="h-3 w-3" />{" "}
                          {review.helpful_votes} hữu ích
                        </span>
                      )}
                    </div>
                  </div>
