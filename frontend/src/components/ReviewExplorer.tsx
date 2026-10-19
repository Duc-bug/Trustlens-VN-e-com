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
  Camera,
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

type SortMode =
  | "newest"
  | "most_detailed"
  | "has_media"
  | "lowest_star"
  | "highest_star"
  | "suspicious";

function toPct(val: number): number {
  if (!val || Number.isNaN(val)) return 0;
  return val > 1.0 ? val : val * 100.0;
}

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
    chips.push("Bình luận nhận xu");
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
  const [sortBy, setSortBy] = useState<SortMode>("most_detailed");
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

  // Extract gallery items from verified authentic buyer reviews
  const buyerGalleryItems = useMemo(() => {
    const items: Array<{
      type: "image" | "video";
      url: string;
      cover?: string;
      review: ReviewItem;
    }> = [];

    for (const r of reviews) {
      if (r.is_seeding) continue;
      if (r.media_videos) {
        for (const vid of r.media_videos) {
          if (!vid.template_video && (vid.url || vid.cover)) {
            items.push({
              type: "video",
              url: vid.url || vid.cover,
              cover: vid.cover,
              review: r,
            });
          }
        }
      }
      if (r.media_images) {
        for (const imgUrl of r.media_images) {
          items.push({
            type: "image",
            url: imgUrl,
            review: r,
          });
        }
      }
      if (items.length >= 16) break;
    }
    return items.slice(0, 14);
  }, [reviews]);

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
      if (sortBy === "most_detailed") {
        const scoreA =
          (a.is_seeding ? 0 : 100) +
          Math.min(80, a.comment.length / 4) +
          ((a.media_images?.length || 0) * 15) +
          (a.is_repeated_purchase ? 25 : 0);
        const scoreB =
          (b.is_seeding ? 0 : 100) +
          Math.min(80, b.comment.length / 4) +
          ((b.media_images?.length || 0) * 15) +
          (b.is_repeated_purchase ? 25 : 0);
        return scoreB - scoreA;
      }
      if (sortBy === "has_media") {
        const mA =
          (a.media_images?.length || 0) + (a.media_videos?.length || 0) * 2;
        const mB =
          (b.media_images?.length || 0) + (b.media_videos?.length || 0) * 2;
        if (mB !== mA) return mB - mA;
        return b.timestamp.localeCompare(a.timestamp);
      }
      if (sortBy === "suspicious") {
        return b.seeding_probability - a.seeding_probability;
      }
      if (sortBy === "newest") {
        return b.timestamp.localeCompare(a.timestamp);
      }
      if (sortBy === "lowest_star") {
        return a.rating - b.rating;
      }
      if (sortBy === "highest_star") {
        return b.rating - a.rating;
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
    { id: "organic", label: `Hợp lệ (${counts.organic})` },
    { id: "seeding", label: `Nghi vấn (${counts.seeding})` },
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
    { id: "coin", label: `Nhận xu (${counts.coin})` },
    { id: "duplicate", label: `Trùng mẫu (${counts.duplicate})` },
    { id: "burst", label: `Dồn đơn (${counts.burst})` },
  ];

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
      {/* Header + Single Color Legend */}
      <div className="flex flex-col justify-between gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">
            Danh sách bình luận ({filteredAndSorted.length})
          </h3>
          <p className="text-xs font-medium text-gray-500">
            Hiển thị nội dung, phân loại hàng, ảnh/video người mua, phản hồi của shop và biểu quyết 5 mô hình
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-gray-50 px-3.5 py-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            Hợp lệ
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
            Nghi vấn
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#D97706]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
            Cần xem lại
          </span>
        </div>
      </div>

      {/* Buyer Media Gallery Strip */}
      {buyerGalleryItems.length > 0 && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-800">
              <Camera className="h-4 w-4 text-[#0D5CB6]" />
              Thư viện hình ảnh &amp; video từ người mua thật ({buyerGalleryItems.length})
            </span>
            <span className="text-[11px] font-semibold text-gray-500">
              Bấm vào ảnh để phóng to và xem bình luận
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {buyerGalleryItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setLightboxMedia(item)}
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xs"
                title={`${item.review.user_name} (${item.review.rating}★): ${item.review.comment.slice(0, 80)}`}
              >
                <img
                  src={item.type === "video" ? item.cover || item.url : item.url}
                  alt="Ảnh thực tế"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-cover transition group-hover:scale-105"
                />
                {item.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="h-4 w-4 text-white" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-amber-300">
                  {item.review.rating}★
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                <option value="most_detailed">Sắp xếp: Chi tiết &amp; Thực tế nhất</option>
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="has_media">Sắp xếp: Có hình ảnh / video</option>
                <option value="lowest_star">Sắp xếp: Sao thấp → cao</option>
                <option value="highest_star">Sắp xếp: Sao cao → thấp</option>
                <option value="suspicious">Sắp xếp: Nghi vấn cao nhất</option>
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

      {/* Review Cards */}
      <div className="space-y-3.5">
        {visibleReviews.map((review) => {
          const probPct = toPct(review.seeding_probability);
          const isSeeding = review.is_seeding && probPct >= 65;
          const isWarning =
            (review.is_seeding && probPct < 65) ||
            (!review.is_seeding && probPct >= 40);

          const statusConfig = isSeeding
            ? {
                badgeText: "Đánh giá nghi vấn",
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
                badgeText: "Đánh giá hợp lệ",
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
                      width={36}
                      height={36}
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
                          title="Tài khoản này đã mua lại sản phẩm từ lần thứ 2 trở lên"
                        >
                          ✓ Khách mua lại
                        </span>
                      )}
                      {review.anonymous && (
                        <span
                          className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600"
                          title="Người mua bật chế độ đánh giá ẩn danh"
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
                </div>

                {/* Status Badge + 5-Model Consensus */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {review.models_flagged_count !== undefined && (
                    <button
                      type="button"
                      onClick={() => toggleExpandChip(review.review_id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100"
                      title="Bấm để xem kết quả biểu quyết từ cả 5 mô hình"
                    >
                      <span>
                        {review.is_seeding
                          ? `${Math.max(3, review.models_flagged_count)}/5 mô hình nghi vấn`
                          : `${Math.max(3, 5 - review.models_flagged_count)}/5 mô hình xác nhận`}
                      </span>
                    </button>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${statusConfig.badgeClass}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusConfig.badgeText}
                  </span>
                </div>
              </div>

              {/* Template Tags & Low Rating Reasons */}
              {((review.template_tags && review.template_tags.length > 0) ||
                (review.low_rating_reasons &&
                  review.low_rating_reasons.length > 0)) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {review.template_tags?.map((tag, tIdx) => (
                    <span
                      key={`tag-${tIdx}`}
                      className="rounded-md border border-blue-100 bg-blue-50/70 px-2 py-0.5 text-[11px] font-semibold text-[#0D5CB6]"
                    >
                      {tag}
                    </span>
                  ))}
                  {review.low_rating_reasons?.map((reason, rIdx) => (
                    <span
                      key={`reason-${rIdx}`}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                    >
                      Lý do sao thấp: {reason}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="mt-3">
                <p
                  className={`text-sm leading-relaxed text-gray-800 ${
                    !isTextExpanded ? "line-clamp-3" : ""
                  }`}
                >
                  {renderHighlightedText(review.comment, search)}
                </p>
                {isLongText && (
                  <button
                    type="button"
                    onClick={() => toggleExpandText(review.review_id)}
                    className="mt-1 text-xs font-bold text-[#1A73E8] hover:underline"
                  >
                    {isTextExpanded ? "Thu gọn" : "Xem thêm"}
                  </button>
                )}
              </div>

              {/* 3-Criteria Detailed Sub-Ratings */}
              {review.detailed_rating &&
                (review.detailed_rating.product_quality ||
                  review.detailed_rating.seller_service ||
                  review.detailed_rating.delivery_service) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-600">
                    {review.detailed_rating.product_quality ? (
                      <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5">
                        Chất lượng SP:{" "}
                        <strong className="text-gray-900">
                          {review.detailed_rating.product_quality}★
                        </strong>
                      </span>
                    ) : null}
                    {review.detailed_rating.seller_service ? (
                      <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5">
                        Dịch vụ Shop:{" "}
                        <strong className="text-gray-900">
                          {review.detailed_rating.seller_service}★
                        </strong>
                      </span>
                    ) : null}
                    {review.detailed_rating.delivery_service ? (
                      <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5">
                        Vận chuyển:{" "}
                        <strong className="text-gray-900">
                          {review.detailed_rating.delivery_service}★
                        </strong>
                      </span>
                    ) : null}
                  </div>
                )}

              {/* Real Buyer Photos & Videos */}
              {((review.media_images && review.media_images.length > 0) ||
                (review.media_videos && review.media_videos.length > 0)) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {review.media_videos?.map((vid, vIdx) => {
                    const sec = vid.duration_ms
                      ? Math.max(1, Math.round(vid.duration_ms / 1000))
                      : 0;
                    const durLabel =
                      sec > 0
                        ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(
                            2,
                            "0"
                          )}`
                        : "";
                    return (
                      <button
                        key={`vid-${vIdx}`}
                        type="button"
                        onClick={() =>
                          setLightboxMedia({
                            type: "video",
                            url: vid.url || vid.cover,
                            cover: vid.cover,
                            review,
                          })
                        }
                        className="group relative h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-2xs"
                        title="Bấm để xem video thực tế của người mua"
                      >
                        {vid.cover && (
                          <img
                            src={vid.cover}
                            alt="Video review"
                            width={64}
                            height={64}
                            className="h-16 w-16 object-cover opacity-85 transition group-hover:scale-105"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Video className="h-4 w-4 text-white" />
                        </div>
                        {durLabel && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.2 text-[9px] font-bold text-white">
                            {durLabel}
                          </span>
                        )}
                        {vid.template_video && (
                          <span className="absolute left-1 top-1 rounded bg-red-600/90 px-1 text-[8px] font-extrabold text-white">
                            Mẫu
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {review.media_images?.slice(0, 6).map((imgUrl, imgIdx) => (
                    <button
                      key={`img-${imgIdx}`}
                      type="button"
                      onClick={() =>
                        setLightboxMedia({
                          type: "image",
                          url: imgUrl,
                          review,
                        })
                      }
                      className="h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-2xs"
                      title="Bấm để phóng to ảnh thực tế của người mua"
                    >
                      <img
                        src={imgUrl}
                        alt={`Ảnh review ${imgIdx + 1}`}
                        width={64}
                        height={64}
                        className="h-16 w-16 object-cover transition hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Seller Reply */}
              {review.seller_reply && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                  <div>
                    <span className="font-extrabold text-gray-900">
                      Phản hồi của Người bán:{" "}
                    </span>
                    <span>{review.seller_reply}</span>
                  </div>
                </div>
              )}

              {/* Concrete Real-Data Chips */}
              {(shortChips.length > 0 || authChips.length > 0) && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {shortChips.map((chipText, idx) => (
                      <button
                        key={`seed-${idx}`}
                        type="button"
                        onClick={() => toggleExpandChip(review.review_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-[#DC2626] transition hover:bg-red-50"
                        title="Bấm để xem số liệu kiểm chứng của bình luận này"
                      >
                        <span>⚠ {chipText}</span>
                        {isChipExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ))}

                    {authChips.map((chipText, idx) => (
                      <button
                        key={`auth-${idx}`}
                        type="button"
                        onClick={() => toggleExpandChip(review.review_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                        title="Bấm để xem số liệu xác thực của bình luận này"
                      >
                        <span>✓ {chipText}</span>
                        {isChipExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ))}
                  </div>

                  {isChipExpanded && (
                    <div className="mt-2.5 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-2xs">
                      <div className="font-extrabold text-gray-900">
                        Số liệu kiểm chứng thực tế của đánh giá này:
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                          <span className="text-gray-500">
                            Độ trùng lặp nội dung:
                          </span>
                          <strong
                            className={
                              toPct(review.cosine_similarity_max) >= 50
                                ? "text-[#DC2626]"
                                : "text-[#16A34A]"
                            }
                          >
                            {Math.round(toPct(review.cosine_similarity_max))}%
                          </strong>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                          <span className="text-gray-500">
                            Mật độ đơn cùng khung 15p:
                          </span>
                          <strong
                            className={
                              review.burst_15m_count >= 4
                                ? "text-[#DC2626]"
                                : "text-gray-900"
                            }
                          >
                            {Math.max(1, review.burst_15m_count)} đánh giá
                          </strong>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                          <span className="text-gray-500">
                            Tần suất đánh giá tại shop:
                          </span>
                          <strong className="text-gray-900">
                            {Math.max(1, review.user_total_reviews)} lần
                          </strong>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                          <span className="text-gray-500">
                            Bằng chứng mua hàng thật:
                          </span>
                          <strong className="text-emerald-700">
                            {review.is_repeated_purchase
                              ? "Khách mua lại • "
                              : ""}
                            {review.media_images?.length || 0} ảnh •{" "}
                            {review.media_videos?.length || 0} video
                          </strong>
                        </div>
                      </div>

                      {review.model_votes &&
                        Object.keys(review.model_votes).length > 0 && (
                          <div className="mt-3 border-t border-gray-100 pt-2.5">
                            <div className="mb-1.5 font-extrabold text-gray-900">
                              Kết quả đánh giá từ cả 5 mô hình học máy:
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                              {Object.entries(review.model_votes).map(
                                ([modelName, votePct]) => {
                                  const isFlagged = votePct >= 50;
                                  return (
                                    <div
                                      key={modelName}
                                      className={`rounded-lg border px-2 py-1.5 ${
                                        isFlagged
                                          ? "border-red-200 bg-red-50/50"
                                          : "border-emerald-200 bg-emerald-50/40"
                                      }`}
                                    >
                                      <div className="truncate text-[10px] font-bold text-gray-600">
                                        {modelName}
                                      </div>
                                      <div className="mt-0.5 flex items-center justify-between">
                                        <span
                                          className={`text-[11px] font-extrabold ${
                                            isFlagged
                                              ? "text-[#DC2626]"
                                              : "text-[#16A34A]"
                                          }`}
                                        >
                                          {isFlagged ? "Nghi vấn" : "Hợp lệ"}
                                        </span>
                                        <span className="text-[10px] font-semibold text-gray-500">
                                          ({Math.round(votePct)}%)
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredAndSorted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm font-medium text-gray-500">
            Không tìm thấy bình luận nào khớp với bộ lọc.
          </div>
        )}
      </div>

      {/* Load More Reviews Button */}
      {visibleCount < filteredAndSorted.length && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-extrabold text-gray-800 shadow-2xs transition hover:bg-gray-50"
          >
            <span>
              Tải thêm bình luận (còn {filteredAndSorted.length - visibleCount})
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* IN-APP LIGHTBOX MODAL FOR BUYER PHOTOS & VIDEOS */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => setLightboxMedia(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxMedia(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center justify-center bg-gray-950 p-3 md:min-h-[420px]">
              {lightboxMedia.type === "video" ? (
                <video
                  src={lightboxMedia.url}
                  poster={lightboxMedia.cover}
                  controls
                  autoPlay
                  className="max-h-[75vh] w-full rounded-xl object-contain"
                />
              ) : (
                <img
                  src={lightboxMedia.url}
                  alt="Ảnh thực tế người mua"
                  className="max-h-[75vh] w-full rounded-xl object-contain"
                />
              )}
            </div>

            <div className="flex w-full flex-col justify-between border-t border-gray-100 p-5 md:w-80 md:border-l md:border-t-0">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-gray-900">
                    {lightboxMedia.review.user_name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      lightboxMedia.review.is_seeding
                        ? "bg-red-100 text-[#DC2626]"
                        : "bg-emerald-100 text-[#16A34A]"
                    }`}
                  >
                    {lightboxMedia.review.is_seeding ? "Nghi vấn" : "Đánh giá hợp lệ"}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < lightboxMedia.review.rating
                          ? "fill-[#F59E0B] text-[#F59E0B]"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-xs font-medium text-gray-400">
                    {lightboxMedia.review.timestamp.slice(0, 16)}
                  </span>
                </div>

                {lightboxMedia.review.variation && (
                  <div className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    Phân loại: <strong>{lightboxMedia.review.variation}</strong>
                  </div>
                )}

                <p className="mt-3 max-h-48 overflow-y-auto text-xs leading-relaxed text-gray-700">
                  {lightboxMedia.review.comment}
                </p>
              </div>

              {lightboxMedia.review.media_images &&
                lightboxMedia.review.media_images.length > 1 && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="mb-1.5 text-[11px] font-bold text-gray-500">
                      Ảnh khác trong cùng đánh giá:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lightboxMedia.review.media_images.map((u, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setLightboxMedia({
                              type: "image",
                              url: u,
                              review: lightboxMedia.review,
                            })
                          }
                          className={`h-11 w-11 overflow-hidden rounded-lg border-2 ${
                            lightboxMedia.url === u
                              ? "border-[#1A73E8]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={u}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
