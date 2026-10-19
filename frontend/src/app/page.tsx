"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Loader2,
  LayoutDashboard,
  MessageSquareText,
  ArrowUp,
  X,
} from "lucide-react";

import Navbar, { SavedProductItem } from "@/components/Navbar";
import TrustScoreCard from "@/components/TrustScoreCard";
import RealReviewInsights from "@/components/RealReviewInsights";
import BurstChart from "@/components/BurstChart";
import ReviewExplorer from "@/components/ReviewExplorer";

import { AnalysisResponse } from "@/types/trustlens";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const QUICK_REAL_LINKS = [
  {
    shortLabel: "Son Dưỡng Laneige",
    url: "https://shopee.vn/product/147191228/51614723927",
  },
  {
    shortLabel: "Serum La Roche-Posay B5",
    url: "https://shopee.vn/Serum-La-Roche-Posay-Hyalu-B5-i.37251700.184066860",
  },
  {
    shortLabel: "Sữa Rửa Mặt Cetaphil",
    url: "https://shopee.vn/Sua-Rua-Mat-Cetaphil-Guardian-i.152872415.2956724103",
  },
];

type ActiveTab = "overview" | "reviews";

export default function HomePage() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [urlInput, setUrlInput] = useState<string>(QUICK_REAL_LINKS[0].url);
  const [loading, setLoading] = useState<boolean>(true);
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

  useEffect(() => {
    async function initLiveCrawl() {
      setLoading(true);
      try {
        const liveRes = await fetch(`${API_BASE}/api/analyze-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: QUICK_REAL_LINKS[0].url,
            max_reviews: 2500,
          }),
        });

        if (liveRes.ok) {
          const aData: AnalysisResponse = await liveRes.json();
          setAnalysis(aData);
        }
      } catch {
        setStatusBanner(
          "Không kết nối được tới máy chủ phân tích (Port 8000)."
        );
      } finally {
        setLoading(false);
      }
    }
    initLiveCrawl();
  }, []);

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
        "Không kết nối được tới máy chủ phân tích (Port 8000)."
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

          {/* Compact Quick Links */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-gray-400">
              Chọn nhanh:
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
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    isSelected
                      ? "border-[#1A73E8] bg-blue-50 text-[#0D5CB6]"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-white"
                  }`}
                >
                  {sample.shortLabel}
                </button>
              );
            })}
          </div>

          {statusBanner && (
            <div className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-[#DC2626]">
              {statusBanner}
            </div>
          )}
        </section>

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
                    <BurstChart data={analysis.burst_timeline} />
                  </div>
                </div>
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
