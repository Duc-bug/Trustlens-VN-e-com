"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Star,
  ArrowUpDown,
  ThumbsUp,
  CornerDownRight,
  Video,
  Camera,
  Repeat,
  FileCheck2,
  FileWarning,
} from "lucide-react";
import { ReviewItem } from "@/types/trustlens";

interface ReviewExplorerProps {
  reviews: ReviewItem[];
}

type FilterMode = "all" | "organic" | "seeding" | "media" | "repeat";

type SortMode =
  | "most_detailed"
  | "highest_risk"
  | "newest"
  | "has_media"
  | "lowest_star"
  | "highest_star";

function toPct(val: number): number {
  if (!val || Number.isNaN(val)) return 0;
  return val > 1.0 ? val : val * 100.0;
}

function getFullDiagnosticReasons(review: ReviewItem): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const probPct = toPct(review.seeding_probability);
  const simPctRaw = toPct(review.cosine_similarity_max);

  if (review.is_seeding || probPct >= 45) {
    const reasons: string[] = [];
    if (review.seeding_signals && review.seeding_signals.length > 0) {
      reasons.push(...review.seeding_signals);
    }
    if (reasons.length === 0) {
      if (
        simPctRaw >= 50 ||
        review.seeding_type === "TEMPLATE_COPY_PASTE" ||
        review.seeding_type === "AI_MARKETING_SEEDING"
      ) {
        reasons.push(
          `Nội dung trùng lặp ngữ nghĩa cao (${simPctRaw.toFixed(1)}%) so với các bình luận khác cùng sản phẩm`
        );
      }
      if (
        review.burst_15m_count >= 4 ||
        review.seeding_type === "TIME_BURST_SEEDING"
      ) {
        reasons.push(
          `Bất thường thời gian: Đăng dồn ${Math.max(review.burst_15m_count, 4)} đánh giá 5 sao trong khung 15 phút`
        );
      }
      if (review.seeding_type === "COIN_FARM_SPAM") {
        reasons.push(
          "Bình luận theo mẫu hình thức để nhận xu thưởng Shopee, thiếu trải nghiệm thực tế"
        );
      }
      if (reasons.length === 0) {
        reasons.push(
          "Nhận xét khen chung chung, thiếu chi tiết kiểm chứng sử dụng thực tế"
        );
      }
    }
    return { isSuspicious: true, reasons };
  }

  const reasons: string[] = [];
  if (review.authenticity_signals && review.authenticity_signals.length > 0) {
    reasons.push(...review.authenticity_signals);
  }
  if (reasons.length === 0) {
    if (review.is_repeated_purchase) {
      reasons.push("Khách hàng quay lại mua lần thứ 2 trở lên tại gian hàng");
    }
    if ((review.media_images?.length || 0) > 0) {
      reasons.push(
        `Đính kèm ${review.media_images?.length} hình ảnh chụp sản phẩm thực tế`
      );
    }
    if (reasons.length === 0) {
      reasons.push(
        "Đánh giá tự nhiên từ giao dịch xác thực, không phát hiện dấu hiệu spam xu hay trùng lặp"
      );
    }
  }
  return { isSuspicious: false, reasons };
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
      if (sortBy === "highest_risk") {
        return toPct(b.seeding_probability) - toPct(a.seeding_probability);
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

  const filterTabs = [
    { id: "all", label: `Tất cả (${counts.all})` },
    { id: "organic", label: `Hợp lệ (${counts.organic})` },
    { id: "seeding", label: `Nghi vấn (${counts.seeding})` },
    { id: "media", label: `Có ảnh/video (${counts.media})` },
    ...(counts.repeat > 0
      ? [{ id: "repeat", label: `Khách mua lại (${counts.repeat})` }]
      : []),
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
        <div>
          <h3 className="text-base font-extrabold text-gray-900">
            Danh sách Đánh giá &amp; Chẩn đoán Chi tiết ({filteredAndSorted.length} đánh giá)
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Hiển thị nguyên văn 100% nội dung bình luận, hình ảnh/video và toàn bộ căn cứ nhận diện từng đánh giá.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            Hợp lệ ({counts.organic})
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
            Nghi vấn ({counts.seeding})
          </span>
        </div>
      </div>

      {/* Filter + Star Filter + Search + Sort Bar */}
      <div className="my-4 space-y-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
        <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as FilterMode)}
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
            <div className="relative min-w-[200px] flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm nội dung, người mua, phân loại..."
                className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs font-semibold text-gray-900 placeholder-gray-400 focus:border-[#1A73E8] focus:outline-none"
              />
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="rounded-xl border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-xs font-bold text-gray-700 focus:border-[#1A73E8] focus:outline-none"
                aria-label="Sắp xếp bình luận"
              >
                <option value="most_detailed">Ưu tiên đánh giá chi tiết</option>
                <option value="highest_risk">Mức độ nghi vấn cao → thấp</option>
                <option value="newest">Thời gian mới nhất</option>
                <option value="has_media">Nhiều ảnh / video nhất</option>
                <option value="lowest_star">Số sao thấp → cao</option>
                <option value="highest_star">Số sao cao → thấp</option>
              </select>
            </div>
          </div>
        </div>

        {/* Star Rating Filter Row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-200/60 pt-2">
          <button
            type="button"
            onClick={() => setStarFilter(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              starFilter === null
                ? "bg-amber-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Tất cả mức sao
          </button>
          {[5, 4, 3, 2, 1].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStarFilter(starFilter === st ? null : st)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                starFilter === st
                  ? "bg-amber-500 text-white"
                  : "bg-white text-gray-700 hover:bg-amber-50"
              }`}
            >
              <span>{st} sao ({st}★)</span>
              <span
                className={`text-[10px] ${
                  starFilter === st ? "text-amber-100" : "text-gray-400"
                }`}
              >
                [{counts.stars[st] || 0}]
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Review Cards (Full Un-truncated Content + Complete Diagnostic Box) */}
      <div className="space-y-4">
        {filteredAndSorted.map((review) => {
          const probPct = toPct(review.seeding_probability);
          const simPct = toPct(review.cosine_similarity_max);
          const isSeeding = review.is_seeding && probPct >= 60;
          const isWarning =
            (review.is_seeding && probPct < 60) ||
            (!review.is_seeding && probPct >= 42);

          const statusConfig = isSeeding
            ? {
                badgeText: `Nghi vấn Seeding / Spam xu (${probPct.toFixed(0)}%)`,
                badgeClass:
                  "border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]",
                cardClass: "border-red-200 bg-red-50/15",
                avatarClass: "bg-[#DC2626] text-white",
                Icon: ShieldAlert,
              }
            : isWarning
            ? {
                badgeText: `Cần kiểm tra (${probPct.toFixed(0)}%)`,
                badgeClass:
                  "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#D97706]",
                cardClass: "border-amber-200 bg-amber-50/15",
                avatarClass: "bg-[#F59E0B] text-white",
                Icon: AlertTriangle,
              }
            : {
                badgeText: `Đánh giá Hợp lệ (${Math.max(1, Math.round(100 - probPct))}% tin cậy)`,
                badgeClass:
                  "border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]",
                cardClass: "border-gray-200 bg-white",
                avatarClass: "bg-[#16A34A] text-white",
                Icon: CheckCircle2,
              };

          const StatusIcon = statusConfig.Icon;
          const diag = getFullDiagnosticReasons(review);

          const initials = (review.user_name || "KH")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={review.review_id}
              className={`rounded-2xl border p-4 sm:p-5 ${statusConfig.cardClass}`}
            >
              {/* Top Row: User Info + Full Status Badge */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
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
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">
                        {review.user_name}
                      </span>
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
                      <span className="text-xs font-bold text-gray-700">
                        ({review.rating}/5 sao)
                      </span>
                      {review.is_repeated_purchase && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                          <Repeat className="h-3 w-3" />
                          Khách mua lại lần 2+
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500">
                      <span>Thời gian: {review.timestamp.slice(0, 16)}</span>
                      {review.variation && (
                        <span>
                          • Phân loại đã mua:{" "}
                          <strong className="text-gray-800">
                            {review.variation}
                          </strong>
                        </span>
                      )}
                      {review.helpful_votes > 0 && (
                        <span className="inline-flex items-center gap-1 font-bold text-[#0D5CB6]">
                          • <ThumbsUp className="h-3 w-3" />{" "}
                          {review.helpful_votes} lượt hữu ích
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge & Archetype */}
                <div className="flex flex-wrap items-center gap-2">
                  {review.is_seeding && review.seeding_type_label && (
                    <span className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-[#DC2626]">
                      Nhóm: {review.seeding_type_label}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${statusConfig.badgeClass}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusConfig.badgeText}
                  </span>
                </div>
              </div>

              {/* Shopee Template Criteria Tags & Low Rating Reasons (Full) */}
              {((review.template_tags && review.template_tags.length > 0) ||
                (review.low_rating_reasons &&
                  review.low_rating_reasons.length > 0)) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {review.template_tags?.map((tag, tIdx) => (
                    <span
                      key={`tpl-${tIdx}`}
                      className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-0.5 text-xs font-semibold text-blue-900"
                    >
                      {tag}
                    </span>
                  ))}
                  {review.low_rating_reasons?.map((lr, lIdx) => (
                    <span
                      key={`low-${lIdx}`}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900"
                    >
                      Lý do phản ánh: {lr}
                    </span>
                  ))}
                </div>
              )}

              {/* Full Comment Text (No line-clamp, no truncation) */}
              <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3.5">
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-900">
                  {renderHighlightedText(review.comment, search)}
                </p>
              </div>

              {/* Direct Inline Buyer Photos & Videos (No Lightbox Popup Required) */}
              {((review.media_images && review.media_images.length > 0) ||
                (review.media_videos && review.media_videos.length > 0)) && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <Camera className="h-3.5 w-3.5 text-[#0D5CB6]" />
                    <span>
                      Tư liệu đính kèm:{" "}
                      {review.media_images?.length || 0} hình ảnh
                      {review.media_videos && review.media_videos.length > 0
                        ? ` • ${review.media_videos.length} video`
                        : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-start gap-3">
                    {review.media_videos?.map((vid, vIdx) => {
                      const sec = vid.duration_ms
                        ? Math.round(vid.duration_ms / 1000)
                        : null;
                      return (
                        <div
                          key={`vid-${vIdx}`}
                          className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950"
                        >
                          {vid.url ? (
                            <video
                              src={vid.url}
                              poster={vid.cover}
                              controls
                              preload="metadata"
                              className="h-36 w-52 object-contain"
                            />
                          ) : (
                            <div className="relative h-36 w-52">
                              {vid.cover && (
                                <img
                                  src={vid.cover}
                                  alt="Ảnh bìa video"
                                  className="h-36 w-52 object-cover"
                                />
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">
                                <Video className="mr-1 h-4 w-4" />
                                Video {sec ? `(${sec}s)` : ""}
                              </div>
                            </div>
                          )}
                          <div className="bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-gray-200">
                            Video đính kèm {sec ? `• Thời lượng: ${sec} giây` : ""}
                            {vid.template_video ? " • (Video mẫu)" : ""}
                          </div>
                        </div>
                      );
                    })}

                    {review.media_images?.map((imgUrl, imgIdx) => (
                      <a
                        key={`img-${imgIdx}`}
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        <img
                          src={imgUrl}
                          alt={`Ảnh thực tế ${imgIdx + 1} của ${review.user_name}`}
                          className="h-36 w-36 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* COMPLETE DIAGNOSTIC REASONS & METRICS BOX */}
              <div
                className={`mt-3 rounded-xl border p-3.5 text-xs ${
                  diag.isSuspicious
                    ? "border-red-200 bg-red-50/50 text-red-950"
                    : "border-emerald-200 bg-emerald-50/40 text-emerald-950"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2">
                  <span className="inline-flex items-center gap-1.5 font-extrabold">
                    {diag.isSuspicious ? (
                      <>
                        <FileWarning className="h-4 w-4 text-[#DC2626]" />
                        <span>
                          Căn cứ nhận diện Đánh giá Nghi vấn / Seeding / Spam xu:
                        </span>
                      </>
                    ) : (
                      <>
                        <FileCheck2 className="h-4 w-4 text-[#16A34A]" />
                        <span>
                          Căn cứ xác nhận Đánh giá Hợp lệ từ Người mua thật:
                        </span>
                      </>
                    )}
                  </span>

                  {/* Concrete Quantitative Indicators */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="rounded bg-white/90 px-2 py-0.5 text-gray-700">
                      Tương đồng văn bản: {simPct.toFixed(1)}%
                    </span>
                    <span className="rounded bg-white/90 px-2 py-0.5 text-gray-700">
                      Mật độ 15 phút: {review.burst_15m_count} đơn
                    </span>
                    <span className="rounded bg-white/90 px-2 py-0.5 text-gray-700">
                      Tần suất tài khoản tại shop: {review.user_total_reviews} lần
                    </span>
                    {review.detailed_rating && (
                      <span className="rounded bg-white/90 px-2 py-0.5 text-gray-700">
                        Điểm thành phần: Chất lượng{" "}
                        {review.detailed_rating.product_quality ?? review.rating}★ •
                        Shop {review.detailed_rating.seller_service ?? 5}★ • Giao hàng{" "}
                        {review.detailed_rating.delivery_service ?? 5}★
                      </span>
                    )}
                  </div>
                </div>

                {/* Full Bulleted List of Diagnostic Sentences */}
                <ul className="mt-2 space-y-1.5 pl-1">
                  {diag.reasons.map((reasonText, rIdx) => (
                    <li
                      key={rIdx}
                      className="flex items-start gap-2 leading-relaxed font-semibold"
                    >
                      <span
                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          diag.isSuspicious ? "bg-[#DC2626]" : "bg-[#16A34A]"
                        }`}
                      />
                      <span>{reasonText}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Seller Reply (Full) */}
              {review.seller_reply && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-gray-200/70 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-700">
                  <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                  <div>
                    <strong className="text-gray-900">
                      Phản hồi từ Gian hàng:{" "}
                    </strong>
                    <span className="whitespace-pre-line">
                      {review.seller_reply}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredAndSorted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
            Không tìm thấy bình luận nào khớp với bộ lọc hiện tại.
          </div>
        )}
      </div>
    </div>
  );
}
