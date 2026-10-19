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

type FilterMode = "all" | "organic" | "seeding" | "media" | "repeat";

type SortMode =
  | "most_detailed"
  | "newest"
  | "has_media"
  | "lowest_star"
  | "highest_star";

function toPct(val: number): number {
  if (!val || Number.isNaN(val)) return 0;
  return val > 1.0 ? val : val * 100.0;
}

function getShortTags(review: ReviewItem): { text: string; isWarn: boolean }[] {
  const probPct = toPct(review.seeding_probability);
  const simPctRaw = toPct(review.cosine_similarity_max);

  if (review.is_seeding || probPct >= 45) {
    const tags: { text: string; isWarn: boolean }[] = [];
    if (review.seeding_signals && review.seeding_signals.length > 0) {
      return review.seeding_signals
        .slice(0, 2)
        .map((t) => ({ text: t, isWarn: true }));
    }
    if (
      simPctRaw >= 50 ||
      review.seeding_type === "TEMPLATE_COPY_PASTE" ||
      review.seeding_type === "AI_MARKETING_SEEDING"
    ) {
      tags.push({ text: "Nội dung trùng lặp", isWarn: true });
    }
    if (
      review.burst_15m_count >= 4 ||
      review.seeding_type === "TIME_BURST_SEEDING"
    ) {
      tags.push({
        text: `Đăng dồn ${Math.max(review.burst_15m_count, 4)} đơn/15p`,
        isWarn: true,
      });
    }
    if (review.seeding_type === "COIN_FARM_SPAM") {
      tags.push({ text: "Bình luận nhận xu", isWarn: true });
    }
    return tags.slice(0, 2);
  }

  const tags: { text: string; isWarn: boolean }[] = [];
  if (review.authenticity_signals && review.authenticity_signals.length > 0) {
    return review.authenticity_signals
      .slice(0, 2)
      .map((t) => ({ text: t, isWarn: false }));
  }
  if (review.is_repeated_purchase) {
    tags.push({ text: "Khách mua lại", isWarn: false });
  }
  if ((review.media_images?.length || 0) > 0) {
    tags.push({
      text: `Có ${review.media_images?.length} ảnh thực tế`,
      isWarn: false,
    });
  }
  return tags.slice(0, 2);
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
  const [lightboxMedia, setLightboxMedia] = useState<{
    type: "image" | "video";
    url: string;
    cover?: string;
    review: ReviewItem;
  } | null>(null);

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
      if (items.length >= 14) break;
    }
    return items.slice(0, 12);
  }, [reviews]);

  const counts = useMemo(
    () => ({
      all: reviews.length,
      seeding: reviews.filter((r) => r.is_seeding).length,
      organic: reviews.filter((r) => !r.is_seeding).length,
      repeat: reviews.filter((r) => r.is_repeated_purchase).length,
      media: reviews.filter(
        (r) =>
          r.has_media ||
          (r.media_images && r.media_images.length > 0) ||
          (r.media_videos && r.media_videos.length > 0)
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

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.comment.toLowerCase().includes(q) ||
          r.user_name.toLowerCase().includes(q) ||
          (r.variation && r.variation.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "most_detailed") {
        const scoreA =
          (a.is_seeding ? 0 : 100) +
          Math.min(80, a.comment.length / 4) +
          (a.media_images?.length || 0) * 15 +
          (a.is_repeated_purchase ? 25 : 0);
        const scoreB =
          (b.is_seeding ? 0 : 100) +
          Math.min(80, b.comment.length / 4) +
          (b.media_images?.length || 0) * 15 +
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

  const filterTabs = [
    { id: "all", label: `Tất cả (${counts.all})` },
    { id: "organic", label: `Hợp lệ (${counts.organic})` },
    { id: "seeding", label: `Nghi vấn (${counts.seeding})` },
    { id: "media", label: `Có ảnh/video (${counts.media})` },
    ...(counts.repeat > 0
      ? [{ id: "repeat", label: `Mua lại (${counts.repeat})` }]
      : []),
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
        <h3 className="text-base font-extrabold text-gray-900">
          Danh sách đánh giá ({filteredAndSorted.length})
        </h3>

        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
            Hợp lệ
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
            <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            Nghi vấn
          </span>
        </div>
      </div>

      {/* Buyer Media Gallery Strip */}
      {buyerGalleryItems.length > 0 && (
        <div className="mt-3.5 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <Camera className="h-3.5 w-3.5 text-[#0D5CB6]" />
              Ảnh &amp; video thực tế ({buyerGalleryItems.length})
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {buyerGalleryItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setLightboxMedia(item)}
                className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <img
                  src={item.type === "video" ? item.cover || item.url : item.url}
                  alt="Ảnh thực tế"
                  width={56}
                  height={56}
                  className="h-14 w-14 object-cover transition group-hover:scale-105"
                />
                {item.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Star Filter + Search + Sort Bar */}
      <div className="my-3.5 space-y-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
        <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
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
                      ? "bg-[#0D5CB6] text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:w-52">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(12);
                }}
                placeholder="Tìm từ khóa, phân loại..."
                className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-gray-900 placeholder-gray-400 focus:border-[#1A73E8] focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="rounded-xl border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-xs font-bold text-gray-700 focus:border-[#1A73E8] focus:outline-none"
                aria-label="Sắp xếp bình luận"
              >
                <option value="most_detailed">Chi tiết nhất</option>
                <option value="newest">Mới nhất</option>
                <option value="has_media">Có ảnh / video</option>
                <option value="lowest_star">Sao thấp → cao</option>
                <option value="highest_star">Sao cao → thấp</option>
              </select>
            </div>
          </div>
        </div>

        {/* Star Rating Filter Row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-200/60 pt-2">
          <button
            type="button"
            onClick={() => {
              setStarFilter(null);
              setVisibleCount(12);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              starFilter === null
                ? "bg-amber-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
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
                  : "bg-white text-gray-700 hover:bg-amber-50"
              }`}
            >
              <span>{st}★</span>
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

      {/* Review Cards (Minimalist & Scannable) */}
      <div className="space-y-3">
        {visibleReviews.map((review) => {
          const probPct = toPct(review.seeding_probability);
          const isSeeding = review.is_seeding && probPct >= 65;
          const isWarning =
            (review.is_seeding && probPct < 65) ||
            (!review.is_seeding && probPct >= 40);

          const statusConfig = isSeeding
            ? {
                badgeText: "Nghi vấn",
                badgeClass:
                  "border-[#DC2626]/25 bg-[#DC2626]/10 text-[#DC2626]",
                cardClass: "border-gray-200 bg-red-50/15",
                avatarClass: "bg-[#DC2626] text-white",
                Icon: ShieldAlert,
              }
            : isWarning
            ? {
                badgeText: "Cần xem lại",
                badgeClass:
                  "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#D97706]",
                cardClass: "border-gray-200 bg-amber-50/15",
                avatarClass: "bg-[#F59E0B] text-white",
                Icon: AlertTriangle,
              }
            : {
                badgeText: "Hợp lệ",
                badgeClass:
                  "border-[#16A34A]/25 bg-[#16A34A]/10 text-[#16A34A]",
                cardClass: "border-gray-200 bg-white",
                avatarClass: "bg-[#16A34A] text-white",
                Icon: CheckCircle2,
              };

          const StatusIcon = statusConfig.Icon;
          const isTextExpanded = !!expandedTextIds[review.review_id];
          const isLongText = review.comment.length > 180;
          const tags = getShortTags(review);

          const initials = (review.user_name || "KH")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={review.review_id}
              className={`rounded-2xl border p-4 transition ${statusConfig.cardClass}`}
            >
              {/* Top Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {review.user_avatar ? (
                    <img
                      src={review.user_avatar}
                      alt={review.user_name}
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${statusConfig.avatarClass}`}
                    >
                      {initials}
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-gray-900 sm:text-sm">
                        {review.user_name}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < review.rating
                                ? "fill-[#F59E0B] text-[#F59E0B]"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-gray-400">
                      <span>{review.timestamp.slice(0, 16)}</span>
                      {review.variation && (
                        <span>
                          • Phân loại:{" "}
                          <strong className="text-gray-600">
                            {review.variation}
                          </strong>
                        </span>
                      )}
                      {review.helpful_votes > 0 && (
                        <span className="inline-flex items-center gap-1 text-[#0D5CB6]">
                          • <ThumbsUp className="h-3 w-3" />{" "}
                          {review.helpful_votes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status + Short Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t, idx) => (
                    <span
                      key={idx}
                      className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
                        t.isWarn
                          ? "border-red-200 bg-white text-[#DC2626]"
                          : "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                      }`}
                    >
                      {t.isWarn ? `⚠ ${t.text}` : `✓ ${t.text}`}
                    </span>
                  ))}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${statusConfig.badgeClass}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.badgeText}
                  </span>
                </div>
              </div>

              {/* Comment Text */}
              <div className="mt-2.5">
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

              {/* Buyer Photos & Videos */}
              {((review.media_images && review.media_images.length > 0) ||
                (review.media_videos && review.media_videos.length > 0)) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {review.media_videos?.map((vid, vIdx) => (
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
                      className="group relative h-14 w-14 overflow-hidden rounded-xl border border-gray-200 bg-gray-900"
                    >
                      {vid.cover && (
                        <img
                          src={vid.cover}
                          alt="Video review"
                          width={56}
                          height={56}
                          className="h-14 w-14 object-cover opacity-85 transition group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-3.5 w-3.5 text-white" />
                      </div>
                    </button>
                  ))}

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
                      className="h-14 w-14 overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                    >
                      <img
                        src={imgUrl}
                        alt={`Ảnh ${imgIdx + 1}`}
                        width={56}
                        height={56}
                        className="h-14 w-14 object-cover transition hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Seller Reply */}
              {review.seller_reply && (
                <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                  <div>
                    <strong className="text-gray-800">Phản hồi của Shop: </strong>
                    <span>{review.seller_reply}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredAndSorted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
            Không tìm thấy bình luận nào khớp với bộ lọc.
          </div>
        )}
      </div>

      {/* Load More Button */}
      {visibleCount < filteredAndSorted.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 12)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-100"
          >
            <span>
              Xem thêm ({filteredAndSorted.length - visibleCount})
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
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
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center justify-center bg-gray-950 p-3 md:min-h-[400px]">
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
                  alt="Ảnh thực tế"
                  className="max-h-[75vh] w-full rounded-xl object-contain"
                />
              )}
            </div>

            <div className="flex w-full flex-col justify-between border-t border-gray-100 p-4 md:w-72 md:border-l md:border-t-0">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-gray-900">
                    {lightboxMedia.review.user_name}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#16A34A]">
                    {lightboxMedia.review.rating}★
                  </span>
                </div>
                {lightboxMedia.review.variation && (
                  <div className="mt-1 text-xs text-gray-500">
                    Phân loại: {lightboxMedia.review.variation}
                  </div>
                )}
                <p className="mt-2.5 max-h-48 overflow-y-auto text-xs leading-relaxed text-gray-700">
                  {lightboxMedia.review.comment}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
