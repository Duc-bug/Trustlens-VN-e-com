"use client";

import React, { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";

import Navbar from "@/components/Navbar";
import TrustScoreCard from "@/components/TrustScoreCard";
import RealReviewInsights from "@/components/RealReviewInsights";
import BurstChart from "@/components/BurstChart";
import ReviewExplorer from "@/components/ReviewExplorer";

import { AnalysisResponse } from "@/types/trustlens";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_SHOPEE_URL = "https://shopee.vn/product/147191228/51614723927";

export default function HomePage() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [urlInput, setUrlInput] = useState<string>(DEFAULT_SHOPEE_URL);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    async function initLiveCrawl() {
      setLoading(true);
      try {
        const liveRes = await fetch(`${API_BASE}/api/analyze-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: DEFAULT_SHOPEE_URL,
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

  async function handleAnalyzeUrl(e: React.FormEvent) {
    e.preventDefault();
    const targetUrl = urlInput.trim();
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

  return (
    <div className="min-h-screen bg-[#F6F7FB] pb-12 text-gray-900">
      {/* 1. HEADER */}
      <Navbar />

      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-5 sm:px-6">
        {/* 2. URL INPUT FORM */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs sm:p-5">
          <form
            onSubmit={handleAnalyzeUrl}
            className="flex flex-col gap-2.5 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Nhập đường dẫn sản phẩm Shopee cần phân tích (ví dụ: https://shopee.vn/product/147191228/51614723927)..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2.5 pl-10 pr-4 text-sm font-medium text-gray-900 placeholder-gray-400 transition focus:border-[#1A73E8] focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6B35] px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#e85a25] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <span>Phân tích chi tiết</span>
              )}
            </button>
          </form>

          {statusBanner && (
            <div className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-[#DC2626]">
              {statusBanner}
            </div>
          )}
        </section>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-sm font-bold text-gray-700 shadow-2xs">
            <Loader2 className="h-5 w-5 animate-spin text-[#FF6B35]" />
            <span>
              Đang tải dữ liệu và phân tích chi tiết từng đánh giá sản phẩm...
            </span>
          </div>
        )}

        {/* 3. FULL DIRECT REPORT (NO TABS HIDING CONTENT, NO TRUNCATION) */}
        {analysis && (
          <div className="space-y-5">
            <TrustScoreCard
              product={analysis.product_info}
              metrics={analysis.trust_metrics}
              reviews={analysis.reviews}
              burstTimeline={analysis.burst_timeline}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <RealReviewInsights reviews={analysis.reviews} />
              </div>
              <div className="lg:col-span-6">
                <BurstChart data={analysis.burst_timeline} />
              </div>
            </div>

            <ReviewExplorer reviews={analysis.reviews} />
          </div>
        )}
      </main>
    </div>
  );
}
