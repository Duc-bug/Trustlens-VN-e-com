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
} from "lucide-react";

import Navbar from "@/components/Navbar";
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
    shortLabel: "Son Dưỡng Laneige",
    url: "https://shopee.vn/product/147191228/51614723927",
  },
  {
    platform: "Shopee",
    shortLabel: "La Roche-Posay B5",
    url: "https://shopee.vn/Serum-La-Roche-Posay-Hyalu-B5-i.37251700.184066860",
  },
  {
    platform: "Shopee",
    shortLabel: "Guardian Cetaphil",
    url: "https://shopee.vn/Sua-Rua-Mat-Cetaphil-Guardian-i.152872415.2956724103",
  },
];

interface RecentHistoryItem {
  product_id: string;
  product_name: string;
  platform: string;
  trust_score: number;
  adjusted_rating: number;
  source_url: string;
}

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
  const [recentHistory, setRecentHistory] = useState<RecentHistoryItem[]>([]);
  const [savedWatchlist, setSavedWatchlist] = useState<string[]>([]);

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Load recent history & watchlist from localStorage
  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem("trustlens_recent_history_real");
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          setRecentHistory(parsed.filter((item) => item.source_url));
        }
      }
      const rawWatchlist = localStorage.getItem("trustlens_watchlist");
      if (rawWatchlist) {
        setSavedWatchlist(JSON.parse(rawWatchlist));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const pushToRecentHistory = (data: AnalysisResponse) => {
    try {
      const item: RecentHistoryItem = {
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
    const pid = analysis.product_info.product_id;
    setSavedWatchlist((prev) => {
      const exists = prev.includes(pid);
      const next = exists ? prev.filter((id) => id !== pid) : [...prev, pid];
      try {
        localStorage.setItem("trustlens_watchlist", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Initial load: 100% Live Crawl from Shopee (No Sample / Demo Data)
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

  // Analyze URL (100% Real Live Crawl — No Synthetic Fallback)
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

  // Top verified real reviews vs suspicious seeding reviews for Overview side-by-side comparison
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
      {/* 1. MINIMAL HEADER */}
      <Navbar
        onOpenBenchmark={() => setBenchmarkOpen(true)}
        onOpenExtractorModal={() => setExtractorOpen(true)}
        onSwitchToTechnicalTab={() => setActiveTab("technical")}
        watchlistCount={savedWatchlist.length}
        crawlMode={analysis?.product_info?.crawl_mode}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-5 sm:px-6">
        {/* 2. STREAMLINED HERO SEARCH BOX */}
        <section className="rounded-3xl border border-gray-200/90 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 sm:text-xl">
                Kiểm tra đánh giá sản phẩm Shopee
              </h1>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                Dán đường dẫn sản phẩm bất kỳ để tổng hợp đánh giá thực tế và kiểm tra bằng 5 mô hình học máy
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-[#EE4D2D]">
              <span className="h-2 w-2 rounded-full bg-[#EE4D2D]" />
              <span>Shopee Việt Nam</span>
            </div>
          </div>

          {/* Main URL Input + Orange CTA Button */}
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

          {/* Bottom Strip: Quick Links & Recent History */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500">
                Thử nhanh:
              </span>
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
                    className={`rounded-xl border px-3 py-1 text-xs font-bold transition ${
                      isSelected
                        ? "border-[#1A73E8] bg-blue-50 text-[#0D5CB6]"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-[#1A73E8] hover:bg-blue-50 hover:text-[#0D5CB6]"
                    }`}
                  >
                    {sample.shortLabel}
                  </button>
                );
              })}
            </div>

            {recentHistory.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-gray-400">
                  <History className="h-3.5 w-3.5" />
                  Đã xem gần đây:
                </span>
                {recentHistory.slice(0, 3).map((h) => (
                  <button
                    key={h.product_id}
                    type="button"
                    onClick={(e) => {
                      setUrlInput(h.source_url);
                      handleAnalyzeUrl(e, h.source_url);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:border-[#1A73E8] hover:text-[#0D5CB6]"
                  >
                    <span className="max-w-[130px] truncate">
                      {h.product_name}
                    </span>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.2 font-extrabold text-[#16A34A]">
                      {h.adjusted_rating.toFixed(2)}★
                    </span>
                  </button>
                ))}
              </div>
            )}
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
