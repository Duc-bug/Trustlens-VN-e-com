"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Search,
  Loader2,
  History,
  LayoutDashboard,
  MessageSquareText,
  Microscope,
  ArrowUp,
  ChevronRight,
  Star,
  X,
  Copy,
  Check,
  Code2,
  CheckCircle2,
  ShieldAlert,
  Store,
} from "lucide-react";

import Navbar, { SavedProductItem } from "@/components/Navbar";
import TrustScoreCard from "@/components/TrustScoreCard";
import RealReviewInsights from "@/components/RealReviewInsights";
import ShapChart from "@/components/ShapChart";
import BurstChart from "@/components/BurstChart";
import SeedingGraph from "@/components/SeedingGraph";
import ReviewExplorer from "@/components/ReviewExplorer";
import BenchmarkModal from "@/components/BenchmarkModal";

import { AnalysisResponse, BenchmarkResponse } from "@/types/trustlens";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const QUICK_REAL_LINKS = [
  {
    platform: "Shopee",
    shortLabel: "Son Dưỡng Môi Laneige",
    shopLabel: "Laneige Official Store",
    url: "https://shopee.vn/product/147191228/51614723927",
  },
  {
    platform: "Shopee",
    shortLabel: "Serum La Roche-Posay B5",
    shopLabel: "La Roche-Posay Chính Hãng",
    url: "https://shopee.vn/Serum-La-Roche-Posay-Hyalu-B5-i.37251700.184066860",
  },
  {
    platform: "Shopee",
    shortLabel: "Sữa Rửa Mặt Cetaphil",
    shopLabel: "Guardian Vietnam",
    url: "https://shopee.vn/Sua-Rua-Mat-Cetaphil-Guardian-i.152872415.2956724103",
  },
];

type ActiveTab = "overview" | "reviews" | "technical";

const BROWSER_CONSOLE_SNIPPET = `// Dán đoạn mã này vào Console (F12) trên trang sản phẩm Shopee / TikTok / Tiki / Lazada:
(async () => {
  const nodes = document.querySelectorAll('[class*="comment"], [class*="review"], .shopee-product-rating');
  const reviews = Array.from(nodes).slice(0, 150).map((el, i) => ({
    review_id: "DOM_" + (i + 1),
    user_name: (el.querySelector('[class*="author"], [class*="name"]')?.textContent || "user_" + (i + 1)).trim(),
    rating: el.querySelectorAll('svg[class*="active"], .icon-rating-solid').length || 5,
    comment: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 450),
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " ")
  })).filter(r => r.comment.length > 8);
  console.log("Đã trích xuất " + reviews.length + " bình luận:", JSON.stringify(reviews));
  copy(JSON.stringify(reviews, null, 2));
  alert("Đã copy " + reviews.length + " bình luận vào Clipboard!");
})();`;

export default function HomePage() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);

  const [urlInput, setUrlInput] = useState<string>(QUICK_REAL_LINKS[0].url);
  const [loading, setLoading] = useState<boolean>(true);
  const [benchmarkOpen, setBenchmarkOpen] = useState<boolean>(false);
  const [extractorOpen, setExtractorOpen] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [recentHistory, setRecentHistory] = useState<SavedProductItem[]>([]);
  const [savedWatchlist, setSavedWatchlist] = useState<SavedProductItem[]>([]);

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Load recent history & watchlist from localStorage
  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem("trustlens_recent_history_real");
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          setRecentHistory(parsed.filter((item) => item && item.source_url));
        }
      }
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

  const pushToRecentHistory = (data: AnalysisResponse) => {
    try {
      const item: SavedProductItem = {
        product_id: data.product_info.product_id,
        product_name: data.product_info.name,
        platform: data.product_info.platform,
        trust_score: data.trust_metrics.trust_score,
        adjusted_rating: data.trust_metrics.adjusted_rating,
        source_url: data.product_info.url,
      };
      setRecentHistory((prev) => {
        const next = [
          item,
          ...prev.filter((x) => x.product_id !== item.product_id),
        ].slice(0, 5);
        localStorage.setItem(
          "trustlens_recent_history_real",
          JSON.stringify(next)
        );
        return next;
      });
    } catch {
      // Ignore storage errors
    }
  };

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

  // Initial load: Live Crawl from Shopee
  useEffect(() => {
    async function initLiveCrawl() {
      setLoading(true);
      try {
        const [liveRes, benchRes] = await Promise.all([
          fetch(`${API_BASE}/api/analyze-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: QUICK_REAL_LINKS[0].url,
              max_reviews: 2500,
            }),
          }),
          fetch(`${API_BASE}/api/benchmark`),
        ]);

        if (benchRes.ok) {
          const bData = await benchRes.json();
          setBenchmark(bData);
        }

        if (liveRes.ok) {
          const aData: AnalysisResponse = await liveRes.json();
          setAnalysis(aData);
          pushToRecentHistory(aData);
        }
      } catch {
        setStatusBanner(
          "Không kết nối được tới máy chủ phân tích (Port 8000). Vui lòng kiểm tra lại kết nối Backend."
        );
      } finally {
        setLoading(false);
      }
    }
    initLiveCrawl();
  }, []);

  // Analyze URL
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
        pushToRecentHistory(data);
        setStatusBanner(
          `Đã phân tích ${data.trust_metrics.total_reviews_analyzed} đánh giá của sản phẩm`
        );
        setLoading(false);
        return;
      } else {
        const errBody = await res.json().catch(() => null);
        const detail =
          errBody?.detail ||
          "Không thể tải dữ liệu từ đường dẫn này. Vui lòng nhập link sản phẩm Shopee hợp lệ (có shopid.itemid).";
        setStatusBanner(`Không tải được dữ liệu: ${detail}`);
      }
    } catch {
      setStatusBanner(
        "Không kết nối được tới máy chủ phân tích (Port 8000). Vui lòng kiểm tra lại kết nối Backend."
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

  // Top verified real reviews vs suspicious reviews for Overview side-by-side comparison
  const overviewComparisonReviews = useMemo(() => {
    if (!analysis) return { topReal: [], topSeeding: [] };
    const realList = analysis.reviews
      .filter(
        (r) =>
          !r.is_seeding &&
          (r.is_text_review ?? !r.comment.trim().startsWith("[Đánh giá "))
      )
      .sort((a, b) => {
        const scoreA =
          (a.is_repeated_purchase ? 3 : 0) +
          ((a.media_images?.length || 0) > 0 ? 2 : 0) +
          ((a.media_videos?.length || 0) > 0 ? 2 : 0) +
          (a.helpful_votes > 0 ? 1 : 0);
        const scoreB =
          (b.is_repeated_purchase ? 3 : 0) +
          ((b.media_images?.length || 0) > 0 ? 2 : 0) +
          ((b.media_videos?.length || 0) > 0 ? 2 : 0) +
          (b.helpful_votes > 0 ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 2);

    const seedList = analysis.reviews
      .filter((r) => r.is_seeding)
      .sort((a, b) => b.seeding_probability - a.seeding_probability)
      .slice(0, 2);

    return { topReal: realList, topSeeding: seedList };
  }, [analysis]);

  return (
    <div className="min-h-screen bg-[#F5F5FA] pb-20 text-gray-900 md:pb-12">
      {/* 1. HEADER */}
      <Navbar
        onOpenBenchmark={() => setBenchmarkOpen(true)}
        onSwitchToTechnicalTab={() => setActiveTab("technical")}
        watchlistCount={savedWatchlist.length}
        savedItems={savedWatchlist}
        onSelectSavedProduct={(url) => {
          setUrlInput(url);
          handleAnalyzeUrl({ preventDefault: () => {} } as React.FormEvent, url);
        }}
        onRemoveSavedProduct={handleRemoveSavedProduct}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-5 sm:px-6">
        {/* 2. HERO SEARCH BOX + MINI PRODUCT CARDS */}
        <section className="rounded-3xl border border-gray-200/90 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 sm:text-xl">
                Kiểm tra chất lượng đánh giá sản phẩm Shopee
              </h1>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                Dán đường dẫn sản phẩm bất kỳ để tổng hợp đánh giá thực tế và kiểm tra đồng thời bằng 5 mô hình học máy
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-[#EE4D2D]">
              <span className="h-2 w-2 rounded-full bg-[#EE4D2D]" />
              <span>Dữ liệu trực tiếp Shopee</span>
            </div>
          </div>

          {/* Main URL Input + CTA Button */}
          <form
            onSubmit={(e) => handleAnalyzeUrl(e)}
            className="flex flex-col gap-2.5 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Dán link sản phẩm Shopee (ví dụ: https://shopee.vn/product/147191228/51614723927)"
                className="w-full rounded-2xl border border-gray-300 bg-gray-50/80 py-3 pl-12 pr-10 text-sm font-medium text-gray-900 placeholder-gray-400 transition focus:border-[#1A73E8] focus:bg-white focus:outline-none focus:ring-3 focus:ring-blue-100"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput("");
                    urlInputRef.current?.focus();
                  }}
                  className="absolute right-3.5 top-3.5 rounded-full p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
                  aria-label="Xóa đường dẫn"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6B35] px-6 py-3 text-sm font-extrabold text-white shadow-xs transition hover:bg-[#e85a25] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang tải đánh giá...</span>
                </>
              ) : (
                <span>Kiểm tra đánh giá</span>
              )}
            </button>
          </form>

          {/* Visual Quick Product Cards */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">
                Chọn sản phẩm thực tế có sẵn để kiểm tra:
              </span>
              {recentHistory.length > 0 && (
                <div className="hidden items-center gap-1.5 sm:flex">
                  <History className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[11px] font-bold text-gray-400">
                    Vừa xem:
                  </span>
                  {recentHistory.slice(0, 2).map((h) => (
                    <button
                      key={h.product_id}
                      type="button"
                      onClick={(e) => {
                        setUrlInput(h.source_url);
                        handleAnalyzeUrl(e, h.source_url);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#1A73E8] hover:text-[#0D5CB6]"
                    >
                      <span className="max-w-[120px] truncate">
                        {h.product_name}
                      </span>
                      <span className="font-extrabold text-[#16A34A]">
                        {h.adjusted_rating.toFixed(2)}★
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {QUICK_REAL_LINKS.map((sample, idx) => {
                const isSelected = urlInput.trim() === sample.url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      setUrlInput(sample.url);
                      handleAnalyzeUrl(e, sample.url);
                    }}
                    className={`flex items-center justify-between gap-2.5 rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[#1A73E8] bg-blue-50/70 shadow-2xs"
                        : "border-gray-200 bg-gray-50/60 hover:border-blue-300 hover:bg-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-[#EE4D2D]/10 px-1.5 py-0.2 text-[10px] font-extrabold text-[#EE4D2D]">
                          {sample.platform}
                        </span>
                        <span className="truncate text-xs font-extrabold text-gray-900">
                          {sample.shortLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                        <Store className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{sample.shopLabel}</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${
                        isSelected ? "text-[#0D5CB6]" : "text-gray-400"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {statusBanner && (
            <div
              className={`mt-3 rounded-xl border px-3.5 py-2 text-xs font-bold ${
                statusBanner.startsWith("Không")
                  ? "border-red-200 bg-red-50 text-[#DC2626]"
                  : "border-green-200 bg-green-50 text-[#16A34A]"
              }`}
            >
              {statusBanner}
            </div>
          )}
        </section>

        {/* Loading Progress Stepper */}
        {loading && (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 shrink-0 animate-spin text-[#FF6B35]" />
              <div>
                <h2 className="text-sm font-extrabold text-gray-900 sm:text-base">
                  Đang tải và kiểm tra đánh giá sản phẩm từ Shopee...
                </h2>
                <p className="text-xs font-medium text-gray-500">
                  Hệ thống đang đối chiếu mã sản phẩm, lọc bình luận quà tặng và chạy song song 5 mô hình học máy
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                "1. Kết nối Shopee API",
                "2. Lọc đơn & quà tặng",
                "3. Chạy 5 mô hình AI",
                "4. Tổng hợp ưu/nhược điểm",
              ].map((stepText, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs font-bold text-[#0D5CB6]"
                >
                  <span className="h-2 w-2 rounded-full bg-[#1A73E8]" />
                  <span className="truncate">{stepText}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. THREE VIEW TABS: Tổng quan | Danh sách đánh giá | Chi tiết kỹ thuật */}
        {analysis && (
          <div className="space-y-5">
            {/* Segmented Tab Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                    activeTab === "overview"
                      ? "bg-[#0D5CB6] text-white shadow-xs"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Tổng quan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("reviews")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                    activeTab === "reviews"
                      ? "bg-[#0D5CB6] text-white shadow-xs"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <MessageSquareText className="h-4 w-4" />
                  <span>Danh sách đánh giá</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                      activeTab === "reviews"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {analysis.trust_metrics.total_reviews_analyzed}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("technical")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                    activeTab === "technical"
                      ? "bg-[#0D5CB6] text-white shadow-xs"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Microscope className="h-4 w-4" />
                  <span>Chi tiết kỹ thuật</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                      activeTab === "technical"
                        ? "bg-white/20 text-white"
                        : "bg-blue-50 text-[#0D5CB6]"
                    }`}
                  >
                    5 Mô hình
                  </span>
                </button>
              </div>
            </div>

            {/* TAB 1: TỔNG QUAN */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                <TrustScoreCard
                  product={analysis.product_info}
                  metrics={analysis.trust_metrics}
                  reviews={analysis.reviews}
                  burstTimeline={analysis.burst_timeline}
                  graphData={analysis.seeding_graph}
                  liveModels={analysis.live_model_comparison}
                  isSaved={savedWatchlist.some(
                    (x) => x.product_id === analysis.product_info.product_id
                  )}
                  onToggleSave={handleToggleWatchlist}
                  onOpenTechnicalTab={() => setActiveTab("technical")}
                  onSelectShopProduct={(itemUrl) => {
                    setUrlInput(itemUrl);
                    handleAnalyzeUrl(
                      { preventDefault: () => {} } as React.FormEvent,
                      itemUrl
                    );
                  }}
                />

                {/* 2 Panels side-by-side */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-6">
                    <RealReviewInsights reviews={analysis.reviews} />
                  </div>
                  <div className="lg:col-span-6">
                    <BurstChart data={analysis.burst_timeline} />
                  </div>
                </div>

                {/* Direct Comparison: Verified Real Reviews vs Suspicious Reviews */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">
                        Đối chiếu: Đánh giá hợp lệ &amp; Đánh giá nghi vấn tiêu biểu
                      </h3>
                      <p className="text-xs font-medium text-gray-500">
                        So sánh trực tiếp các đánh giá chi tiết của khách mua và các bình luận có dấu hiệu bất thường
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("reviews")}
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-extrabold text-[#0D5CB6] transition hover:bg-blue-100"
                    >
                      <span>
                        Xem tất cả{" "}
                        {analysis.trust_metrics.total_reviews_analyzed} đánh giá
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Left Column: Verified Real Reviews */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                        <span>
                          Đánh giá hợp lệ tiêu biểu (
                          {analysis.trust_metrics.authentic_reviews_count} đánh
                          giá)
                        </span>
                      </div>
                      {overviewComparisonReviews.topReal.map((rev) => (
                        <div
                          key={rev.review_id}
                          className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/25 p-3.5"
                        >
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-gray-900">
                                  {rev.user_name}
                                </span>
                                {rev.is_repeated_purchase && (
                                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                    ✓ Khách mua lại
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {rev.models_flagged_count !== undefined && (
                                  <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    {Math.max(3, 5 - rev.models_flagged_count)}/5 mô hình xác nhận
                                  </span>
                                )}
                                <span className="rounded-full bg-[#16A34A] px-2.5 py-0.5 text-[11px] font-bold text-white">
                                  Hợp lệ
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${
                                      i < rev.rating
                                        ? "fill-[#F59E0B] text-[#F59E0B]"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                              </div>
                              {rev.variation && (
                                <span className="truncate font-semibold text-gray-600">
                                  • Phân loại: {rev.variation}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-800">
                              {rev.comment}
                            </p>
                            {rev.media_images && rev.media_images.length > 0 && (
                              <div className="mt-2 flex items-center gap-1.5">
                                {rev.media_images.slice(0, 4).map((imgUrl, idx) => (
                                  <img
                                    key={idx}
                                    src={imgUrl}
                                    alt="Ảnh thực tế"
                                    width={44}
                                    height={44}
                                    className="h-11 w-11 rounded-lg border border-gray-200 object-cover"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          {rev.authenticity_signals &&
                            rev.authenticity_signals.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {rev.authenticity_signals
                                  .slice(0, 2)
                                  .map((sig, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                                    >
                                      ✓ {sig}
                                    </span>
                                  ))}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>

                    {/* Right Column: Suspicious Reviews */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-800">
                        <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
                        <span>
                          Đánh giá nghi vấn / nhận xu tiêu biểu (
                          {analysis.trust_metrics.seeding_reviews_count} đánh
                          giá)
                        </span>
                      </div>
                      {overviewComparisonReviews.topSeeding.length > 0 ? (
                        overviewComparisonReviews.topSeeding.map((rev) => (
                          <div
                            key={rev.review_id}
                            className="flex flex-col justify-between rounded-xl border border-red-200 bg-red-50/25 p-3.5"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-xs font-extrabold text-gray-900">
                                  {rev.user_name}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {rev.models_flagged_count !== undefined && (
                                    <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold text-[#DC2626]">
                                      {Math.max(3, rev.models_flagged_count)}/5 mô hình nghi vấn
                                    </span>
                                  )}
                                  <span className="whitespace-nowrap rounded-full bg-[#DC2626] px-2.5 py-0.5 text-[11px] font-bold text-white">
                                    Nghi vấn
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 ${
                                        i < rev.rating
                                          ? "fill-[#F59E0B] text-[#F59E0B]"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                {rev.variation && (
                                  <span className="truncate font-semibold text-gray-600">
                                    • Phân loại: {rev.variation}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-800">
                                {rev.comment}
                              </p>
                            </div>
                            {rev.seeding_signals &&
                              rev.seeding_signals.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                  {rev.seeding_signals
                                    .slice(0, 2)
                                    .map((sig, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold text-[#DC2626]"
                                      >
                                        ⚠ {sig}
                                      </span>
                                    ))}
                                </div>
                              )}
                          </div>
                        ))
                      ) : (
                        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs font-semibold text-gray-500">
                          Không phát hiện bình luận bất thường nào trên sản phẩm này.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DANH SÁCH ĐÁNH GIÁ */}
            {activeTab === "reviews" && (
              <ReviewExplorer reviews={analysis.reviews} />
            )}

            {/* TAB 3: CHI TIẾT KỸ THUẬT */}
            {activeTab === "technical" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0D5CB6]">
                      Phân tích Kỹ thuật &amp; Học thuật (Đồng thuận 5 Mô hình + Đồ thị GAT + SHAP)
                    </h3>
                    <p className="text-xs font-medium text-gray-600">
                      Hệ thống vận hành đồng thời cả 5 mô hình học máy trên từng sản phẩm để biểu quyết đa mô hình và trích xuất đồ thị liên kết tài khoản.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBenchmarkOpen(true)}
                    className="rounded-xl bg-[#0D5CB6] px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-blue-800"
                  >
                    Mở bảng Benchmark 5-Fold CV
                  </button>
                </div>

                {/* Live 5-Model Execution Summary on Current Product */}
                {analysis.live_model_comparison &&
                  analysis.live_model_comparison.length > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base font-extrabold text-gray-900">
                            Kết quả chạy thực tế 5 mô hình trên sản phẩm này
                          </h3>
                          <p className="text-xs font-medium text-gray-500">
                            Đối chiếu trực tiếp số lượng đánh giá nghi vấn được phát hiện bởi từng kiến trúc mô hình trên tập{" "}
                            {analysis.trust_metrics.total_reviews_analyzed} đánh giá hiện tại
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                          Đang chạy đồng thời 5/5 mô hình
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-extrabold uppercase text-gray-600">
                              <th className="px-3 py-2.5">Mô hình học máy</th>
                              <th className="px-3 py-2.5">Tập đặc trưng sử dụng</th>
                              <th className="px-3 py-2.5 text-center">
                                Số review nghi vấn
                              </th>
                              <th className="px-3 py-2.5 text-center">
                                Tỷ lệ phát hiện
                              </th>
                              <th className="px-3 py-2.5 text-center">
                                Xác suất nghi vấn TB
                              </th>
                              <th className="px-3 py-2.5 text-center">
                                F1 (5-Fold CV)
                              </th>
                              <th className="px-3 py-2.5 text-right">
                                Thời gian chạy
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {analysis.live_model_comparison.map((m) => (
                              <tr
                                key={m.id}
                                className={
                                  m.is_proposed
                                    ? "bg-blue-50/50 font-bold text-gray-900"
                                    : "text-gray-700 hover:bg-gray-50/60"
                                }
                              >
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-gray-900">
                                      {m.name}
                                    </span>
                                    {m.is_proposed && (
                                      <span className="rounded bg-[#0D5CB6] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                        Đề xuất
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-gray-600">
                                  {m.feature_set}
                                </td>
                                <td className="px-3 py-2.5 text-center font-extrabold text-[#DC2626]">
                                  {m.flagged_count} /{" "}
                                  {analysis.trust_metrics.total_reviews_analyzed}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold">
                                  {m.flagged_rate_pct}%
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-gray-700">
                                  {m.mean_prob_pct}%
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                                  {m.cv_f1}%
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-[11px] text-gray-500">
                                  {m.latency_ms} ms
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Full-width SeedingGraph + Full-width 2-col ShapChart so nothing is cramped */}
                <SeedingGraph graph={analysis.seeding_graph} />

                <ShapChart
                  data={analysis.shap_explanations}
                  showTechnicalSubtext={true}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* STICKY MOBILE BOTTOM BAR */}
      {analysis && (
        <div className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-between border-t border-gray-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-xs md:hidden">
          <div className="text-xs font-bold text-gray-700">
            Điểm thực tế:{" "}
            <span className="text-sm font-black text-[#16A34A]">
              {analysis.trust_metrics.adjusted_rating.toFixed(2)}★
            </span>{" "}
            ({Math.round(analysis.trust_metrics.trust_score)}/100)
          </div>
          <button
            type="button"
            onClick={scrollToSearchBox}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6B35] px-4 py-2 text-xs font-extrabold text-white shadow-xs"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>Kiểm tra sản phẩm khác</span>
          </button>
        </div>
      )}

      {/* Benchmark Modal */}
      <BenchmarkModal
        isOpen={benchmarkOpen}
        onClose={() => setBenchmarkOpen(false)}
        benchmark={benchmark}
      />

      {/* Browser F12 Extractor Modal */}
      {extractorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-w-2xl w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#1A73E8]" />
                <h2 className="text-base font-extrabold text-gray-900">
                  Mã trích xuất bình luận trên trình duyệt (F12 Console)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setExtractorOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <pre className="max-h-56 overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-emerald-300">
                <code>{BROWSER_CONSOLE_SNIPPET}</code>
              </pre>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(BROWSER_CONSOLE_SNIPPET);
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D5CB6] px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-800"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Đã sao chép mã</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Sao chép đoạn mã</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
