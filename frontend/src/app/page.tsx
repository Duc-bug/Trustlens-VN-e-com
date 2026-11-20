"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Loader2,
  LayoutDashboard,
  MessageSquareText,
  ArrowUp,
  X,
  Star,
  ExternalLink,
  ShoppingBag,
  Store,
  Gift,
  ThumbsUp,
  AlertTriangle,
  Camera,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Link2,
} from "lucide-react";

import Navbar, { SavedProductItem } from "@/components/Navbar";
import TrustScoreCard from "@/components/TrustScoreCard";
import RealReviewInsights from "@/components/RealReviewInsights";
import ReviewExplorer from "@/components/ReviewExplorer";

import { AnalysisResponse } from "@/types/trustlens";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type ActiveTab = "overview" | "reviews";

export default function HomePage() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [urlInput, setUrlInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [savedWatchlist, setSavedWatchlist] = useState<SavedProductItem[]>([]);

  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const rawWatchlist = localStorage.getItem("trustlens_saved_products_v2");
      if (rawWatchlist) {
        const parsedW = JSON.parse(rawWatchlist);
        if (Array.isArray(parsedW)) {
          setSavedWatchlist(parsedW.filter((item) => item && item.product_id));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleToggleWatchlist = () => {
    if (!analysis) return;
    const item: SavedProductItem = {
      product_id: analysis.product_info.product_id,
      product_name: analysis.product_info.name,
      platform: analysis.product_info.platform,
      trust_score: analysis.trust_metrics.trust_score,
      adjusted_rating: analysis.trust_metrics.adjusted_rating,
      source_url: analysis.product_info.url,
    };
    setSavedWatchlist((prev) => {
      const exists = prev.some((x) => x.product_id === item.product_id);
      const next = exists
        ? prev.filter((x) => x.product_id !== item.product_id)
        : [item, ...prev];
      try {
        localStorage.setItem(
          "trustlens_saved_products_v2",
          JSON.stringify(next)
        );
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleRemoveSavedProduct = (productId: string) => {
    setSavedWatchlist((prev) => {
      const next = prev.filter((x) => x.product_id !== productId);
      try {
        localStorage.setItem(
          "trustlens_saved_products_v2",
          JSON.stringify(next)
        );
      } catch {
        // Ignore
      }
      return next;
    });
  };

  async function handleAnalyzeUrl(e: React.FormEvent, overrideUrl?: string) {
    e.preventDefault();
    const targetUrl = (overrideUrl ?? urlInput).trim();
    if (!targetUrl) return;

    setLoading(true);
    setStatusBanner(null);

    try {
      const res = await fetch(`${API_BASE}/api/analyze-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          max_reviews: 2500,
        }),
      });
      if (res.ok) {
        const data: AnalysisResponse = await res.json();
        setAnalysis(data);
        setLoading(false);
        return;
      } else {
        const errBody = await res.json().catch(() => null);
        setStatusBanner(
          errBody?.detail || "Không thể tải dữ liệu từ đường dẫn này."
        );
      }
    } catch {
      setStatusBanner(
        "Không kết nối được tới máy chủ phân tích (Port 8001)."
      );
    }

    setLoading(false);
  }

  const scrollToSearchBox = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      urlInputRef.current?.focus();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] pb-20 text-gray-900 md:pb-12">
      {/* 1. MINIMAL HEADER */}
      <Navbar
        watchlistCount={savedWatchlist.length}
        savedItems={savedWatchlist}
        onSelectSavedProduct={(url) => {
          setUrlInput(url);
          handleAnalyzeUrl({ preventDefault: () => {} } as React.FormEvent, url);
        }}
        onRemoveSavedProduct={handleRemoveSavedProduct}
      />

      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
        {/* 2. MINIMAL SEARCH BAR */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs sm:p-5">
          <form
            onSubmit={(e) => handleAnalyzeUrl(e)}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Dán link sản phẩm Shopee..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2.5 pl-10 pr-9 text-sm font-medium text-gray-900 placeholder-gray-400 transition focus:border-[#1A73E8] focus:bg-white focus:outline-none"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput("");
                    urlInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-2.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  aria-label="Xóa"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6B35] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#e85a25] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <span>Kiểm tra</span>
              )}
            </button>
          </form>

          {statusBanner && (
            <div className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-[#DC2626]">
              {statusBanner}
            </div>
          )}
        </section>

        {/* Empty Landing State — Minimalist visual showcase */}
        {!analysis && !loading && (
          <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white via-[#F8FAFF] to-[#FFF6F2] p-6 shadow-2xs sm:p-10">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12">
              {/* Left: concise headline */}
              <div className="space-y-4 md:col-span-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0D5CB6]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Shopee Review Checker</span>
                </span>
                <h1 className="text-2xl font-black leading-tight tracking-tight text-gray-900 sm:text-3xl">
                  Nhận diện đánh giá ảo{" "}
                  <span className="text-[#FF6B35]">trước khi mua hàng</span>
                </h1>
                <p className="text-sm text-gray-500">
                  Dán link Shopee ở trên để lọc seeding, cày xu và xem điểm sao thực tế.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                    <Link2 className="h-3.5 w-3.5 text-[#0D5CB6]" />
                    1. Dán link
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                    <Sparkles className="h-3.5 w-3.5 text-[#FF6B35]" />
                    2. AI lọc seeding
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    3. Xem sao thật
                  </span>
                </div>
              </div>

              {/* Right: clean visual preview illustration */}
              <div className="md:col-span-6">
                <div className="mx-auto max-w-sm rounded-2xl border border-gray-200/90 bg-white p-5 shadow-md">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          Điểm tin cậy
                        </div>
                        <div className="text-2xl font-black text-gray-900">
                          86<span className="text-sm font-bold text-gray-400">/100</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 text-sm font-black text-amber-600">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span>4.5★</span>
                      </div>
                      <div className="text-[10px] font-semibold text-gray-400 line-through">
                        4.9★ trên sàn
                      </div>
                    </div>
                  </div>

                  {/* Mini visual bar */}
                  <div className="mt-4 space-y-2.5">
                    <div>
                      <div className="mb-1 flex justify-between text-xs font-semibold">
                        <span className="text-emerald-700">Đánh giá thật</span>
                        <span className="text-gray-700">82%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full w-[82%] rounded-full bg-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs font-semibold">
                        <span className="text-[#FF6B35]">Seeding / Cày xu</span>
                        <span className="text-gray-700">18%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full w-[18%] rounded-full bg-[#FF6B35]" />
                      </div>
                    </div>
                  </div>

                  {/* Mini decorative review pills */}
                  <div className="mt-4 grid grid-cols-2 gap-2 pt-1">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 px-2.5 py-2 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate">Có ảnh & trải nghiệm</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-orange-50/80 px-2.5 py-2 text-[11px] font-semibold text-orange-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                      <span className="truncate">Đã lọc spam nhận xu</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-sm font-bold text-gray-700 shadow-2xs">
            <Loader2 className="h-5 w-5 animate-spin text-[#FF6B35]" />
            <span>Đang tải và tổng hợp đánh giá từ Shopee...</span>
          </div>
        )}

        {/* 3. TWO CLEAN TABS: Tổng quan | Danh sách đánh giá */}
        {analysis && (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-extrabold transition sm:text-sm ${
                  activeTab === "overview"
                    ? "bg-[#0D5CB6] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Tổng quan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("reviews")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-extrabold transition sm:text-sm ${
                  activeTab === "reviews"
                    ? "bg-[#0D5CB6] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <MessageSquareText className="h-4 w-4" />
                <span>
                  Bình luận ({analysis.trust_metrics.total_reviews_analyzed})
                </span>
              </button>
            </div>

            {activeTab === "overview" && (
              <div className="space-y-4">
                <TrustScoreCard
                  product={analysis.product_info}
                  metrics={analysis.trust_metrics}
                  reviews={analysis.reviews}
                  burstTimeline={analysis.burst_timeline}
                  isSaved={savedWatchlist.some(
                    (x) => x.product_id === analysis.product_info.product_id
                  )}
                  onToggleSave={handleToggleWatchlist}
                  onSelectShopProduct={(itemUrl) => {
                    setUrlInput(itemUrl);
                    handleAnalyzeUrl(
                      { preventDefault: () => {} } as React.FormEvent,
                      itemUrl
                    );
                  }}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-6">
                    <RealReviewInsights reviews={analysis.reviews} />
                  </div>
                  <div className="lg:col-span-6">
                    {(() => {
                      const realRevs = analysis.reviews.filter(
                        (r) => !r.is_seeding
                      );
                      // 1. Positive highlights from real 4-5★ reviews
                      const posThemes = [
                        {
                          label: "Chất lượng tốt, đúng mô tả",
                          kws: ["chất lượng", "đúng mô tả", "dùng tốt", "ưng ý", "hài lòng", "tốt", "đẹp", "ok"],
                        },
                        {
                          label: "Đóng gói kỹ, chắc chắn",
                          kws: ["đóng gói", "cẩn thận", "chắc chắn", "kỹ", "chống sốc"],
                        },
                        {
                          label: "Giao hàng nhanh",
                          kws: ["giao nhanh", "giao hàng nhanh", "ship nhanh", "nhận hàng nhanh"],
                        },
                        {
                          label: "Giá hợp lý, đáng tiền",
                          kws: ["giá rẻ", "hợp lý", "đáng tiền", "giá tốt", "săn sale", "giá hời"],
                        },
                      ]
                        .map((th) => {
                          const cnt = realRevs.filter(
                            (r) =>
                              r.rating >= 4 &&
                              th.kws.some((kw) =>
                                r.comment.toLowerCase().includes(kw)
                              )
                          ).length;
                          return { label: th.label, count: cnt };
                        })
                        .filter((x) => x.count > 0)
                        .sort((a, b) => b.count - a.count);

                      // 2. Real 1-4★ buyer feedbacks (non-empty text)
                      const criticalRevs = realRevs
                        .filter(
                          (r) =>
                            r.rating <= 4 &&
                            (r.is_text_review ??
                              !r.comment.trim().startsWith("[Đánh giá "))
                        )
                        .sort((a, b) => a.rating - b.rating)
                        .slice(0, 3);

                      // 3. Real buyer photos
                      const buyerPhotos: string[] = [];
                      for (const r of realRevs) {
                        if (r.media_images) {
                          for (const img of r.media_images) {
                            if (img && !buyerPhotos.includes(img)) {
                              buyerPhotos.push(img);
                            }
                          }
                        }
                        if (buyerPhotos.length >= 6) break;
                      }

                      return (
                        <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
                          <div className="space-y-4">
                            {/* Điểm khen thực tế */}
                            <div>
                              <div className="mb-2.5 flex items-center gap-2">
                                <ThumbsUp className="h-4 w-4 text-[#16A34A]" />
                                <h3 className="text-base font-extrabold text-gray-900">
                                  Điểm khen &amp; Góp ý thực tế
                                </h3>
                              </div>

                              {posThemes.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {posThemes.map((pt, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-bold text-emerald-800"
                                    >
                                      <span>✓ {pt.label}</span>
                                      <span className="rounded-md bg-white px-1.5 py-0.2 text-[11px] font-black text-[#16A34A]">
                                        {pt.count}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Góp ý 1-4★ cần lưu ý */}
                            <div className="border-t border-gray-100 pt-3">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-800">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                  Góp ý 1★–4★ cần lưu ý trước khi mua
                                </span>
                              </div>

                              {criticalRevs.length > 0 ? (
                                <div className="space-y-2">
                                  {criticalRevs.map((cr) => (
                                    <div
                                      key={cr.review_id}
                                      className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-xs"
                                    >
                                      <div className="mb-0.5 flex flex-wrap items-center gap-2 font-bold text-gray-800">
                                        <span>{cr.user_name}</span>
                                        <span className="text-amber-600">
                                          {cr.rating}★
                                        </span>
                                        {cr.variation && (
                                          <span className="font-medium text-gray-500">
                                            • {cr.variation}
                                          </span>
                                        )}
                                      </div>
                                      <p className="whitespace-pre-line leading-relaxed text-gray-700">
                                        {cr.comment}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-500">
                                  Chưa ghi nhận bình luận phàn nàn 1★–4★ có lời
                                  bình trên sản phẩm này.
                                </div>
                              )}
                            </div>

                            {/* Ảnh thực tế khách chụp */}
                            {buyerPhotos.length > 0 && (
                              <div className="border-t border-gray-100 pt-3">
                                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-700">
                                  <Camera className="h-3.5 w-3.5 text-[#0D5CB6]" />
                                  Ảnh thực tế khách mua chụp
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                  {buyerPhotos.map((imgUrl, idx) => (
                                    <a
                                      key={idx}
                                      href={imgUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={`Ảnh thực tế ${idx + 1}`}
                                        width={64}
                                        height={64}
                                        className="h-14 w-full object-cover"
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* QUÀ TẶNG KÈM TRONG ĐƠN HÀNG (NẾU CÓ) */}
                {(() => {
                  const meta = analysis.product_info.shopee_live_meta;
                  const gifts = meta?.shop_gift_items || [];
                  if (gifts.length === 0) return null;

                  return (
                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-[#EE4D2D]" />
                          <h3 className="text-base font-extrabold text-gray-900">
                            Quà tặng kèm trong đơn hàng của Shop
                          </h3>
                        </div>
                        <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-extrabold text-[#EE4D2D]">
                          {gifts.length} món quà
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {gifts.slice(0, 3).map((g) => (
                          <div
                            key={g.itemid}
                            className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/30 p-3"
                          >
                            {g.image_url && (
                              <img
                                src={g.image_url}
                                alt={g.name}
                                width={48}
                                height={48}
                                className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
                              />
                            )}
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold leading-snug text-gray-900">
                                {g.name}
                              </div>
                              <div className="text-[11px] font-semibold text-[#EE4D2D]">
                                Có trong {g.review_count} đơn hàng
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* GỢI Ý SẢN PHẨM KHÁC CÙNG GIAN HÀNG */}
                {(() => {
                  const meta = analysis.product_info.shopee_live_meta;
                  const currentItemId = String(meta?.itemid || "");
                  const shopId = meta?.shopid;
                  const candidates = (meta?.shop_top_products || []).filter(
                    (sp) =>
                      String(sp.itemid) !== currentItemId &&
                      sp.name &&
                      sp.name !== analysis.product_info.name
                  );
                  const displayItems = candidates.slice(0, 8);
                  if (displayItems.length === 0) return null;

                  return (
                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
                      <div className="mb-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-[#FF6B35]" />
                          <h3 className="text-base font-extrabold text-gray-900">
                            Sản phẩm khác cùng gian hàng
                          </h3>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">
                          {displayItems.length} sản phẩm trong shop
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {displayItems.map((sp) => {
                          const itemUrl =
                            sp.url ||
                            `https://shopee.vn/product/${shopId}/${sp.itemid}`;
                          const hasRealPrice =
                            sp.price_vnd !== undefined && sp.price_vnd > 0;
                          const ratingText = (sp.avg_rating || 4.9).toFixed(2);
                          const soldCount =
                            sp.historical_sold ||
                            Math.max(1, Math.round((sp.review_count || 1) * 3.54));

                          return (
                            <div
                              key={sp.itemid}
                              className="flex flex-col justify-between rounded-xl border border-gray-200/80 bg-gray-50/40 p-3.5"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start gap-3">
                                  {sp.image_url && (
                                    <img
                                      src={sp.image_url}
                                      alt={sp.name}
                                      width={60}
                                      height={60}
                                      className="h-15 w-15 shrink-0 rounded-xl border border-gray-200 bg-white object-cover"
                                    />
                                  )}
                                  <div className="space-y-1">
                                    {hasRealPrice && (
                                      <span className="inline-block rounded bg-orange-50 px-2 py-0.5 text-xs font-black text-[#EE4D2D]">
                                        {sp.price_vnd?.toLocaleString("vi-VN")}₫
                                      </span>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-gray-600">
                                      <span className="inline-flex items-center gap-0.5 text-amber-600">
                                        {ratingText}
                                        <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
                                      </span>
                                      <span>
                                        • {sp.review_count} đánh giá
                                      </span>
                                      <span className="text-emerald-700">
                                        • Đã bán {soldCount.toLocaleString("vi-VN")}
                                      </span>
                                    </div>
                                    {sp.variations && sp.variations.length > 0 && (
                                      <div className="text-[11px] font-medium text-gray-500">
                                        Phân loại: {sp.variations.slice(0, 2).join(", ")}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="text-xs font-bold leading-snug text-gray-900">
                                  {sp.name}
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between border-t border-gray-200/60 pt-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUrlInput(itemUrl);
                                    handleAnalyzeUrl(
                                      { preventDefault: () => {} } as React.FormEvent,
                                      itemUrl
                                    );
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-extrabold text-[#EE4D2D] hover:bg-orange-100"
                                >
                                  <span>Phân tích ngay</span>
                                </button>
                                <a
                                  href={itemUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-extrabold text-[#0D5CB6] hover:underline"
                                >
                                  <span>Xem trên Shopee</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })()}

                {/* 5. CROSS-SHOP SIMILAR PRODUCTS ACROSS THE MARKET */}
                {(() => {
                  const meta = analysis.product_info.shopee_live_meta;
                  const marketItems = (meta?.market_similar_products || []).slice(0, 8);
                  if (marketItems.length === 0) return null;

                  return (
                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
                      <div className="mb-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-[#0D5CB6]" />
                          <h3 className="text-base font-extrabold text-gray-900">
                            So sánh giá & Sản phẩm tương tự từ các gian hàng khác
                          </h3>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">
                          {marketItems.length} nơi bán trên thị trường
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {marketItems.map((mp, idx) => (
                          <div
                            key={`${mp.url}-${idx}`}
                            className="flex flex-col justify-between rounded-xl border border-gray-200/80 bg-gray-50/40 p-3.5"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start gap-3">
                                {mp.image_url && (
                                  <img
                                    src={mp.image_url}
                                    alt={mp.name}
                                    width={60}
                                    height={60}
                                    className="h-15 w-15 shrink-0 rounded-xl border border-gray-200 bg-white object-cover"
                                  />
                                )}
                                <div className="space-y-1">
                                  <span className="inline-block rounded bg-orange-50 px-2 py-0.5 text-xs font-black text-[#EE4D2D]">
                                    {mp.price_vnd.toLocaleString("vi-VN")}₫
                                  </span>
                                  <div className="text-xs font-bold text-emerald-700">
                                    Gian hàng: {mp.merchant_name}
                                  </div>
                                </div>
                              </div>

                              <div className="text-xs font-bold leading-snug text-gray-900">
                                {mp.name}
                              </div>
                            </div>

                            <div className="mt-3 border-t border-gray-200/60 pt-2.5">
                              <a
                                href={mp.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-extrabold text-[#0D5CB6] hover:underline"
                              >
                                <span>Tới gian hàng / So sánh giá</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}
              </div>
            )}

            {activeTab === "reviews" && (
              <ReviewExplorer reviews={analysis.reviews} />
            )}
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM BAR */}
      {analysis && (
        <div className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-between border-t border-gray-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-xs md:hidden">
          <div className="text-xs font-bold text-gray-700">
            Thực tế:{" "}
            <span className="text-sm font-black text-[#16A34A]">
              {analysis.trust_metrics.adjusted_rating.toFixed(2)}★
            </span>{" "}
            ({Math.round(analysis.trust_metrics.trust_score)}/100)
          </div>
          <button
            type="button"
            onClick={scrollToSearchBox}
            className="inline-flex items-center gap-1 rounded-xl bg-[#FF6B35] px-3.5 py-1.5 text-xs font-extrabold text-white"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>Sản phẩm khác</span>
          </button>
        </div>
      )}
    </div>
  );
}
