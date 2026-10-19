"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  BarChart3,
  Microscope,
  Bookmark,
  Star,
  Trash2,
} from "lucide-react";

export interface SavedProductItem {
  product_id: string;
  product_name: string;
  platform: string;
  trust_score: number;
  adjusted_rating: number;
  source_url: string;
}

interface NavbarProps {
  onOpenBenchmark: () => void;
  onSwitchToTechnicalTab?: () => void;
  watchlistCount?: number;
  savedItems?: SavedProductItem[];
  onSelectSavedProduct?: (url: string) => void;
  onRemoveSavedProduct?: (productId: string) => void;
}

export default function Navbar({
  onOpenBenchmark,
  onSwitchToTechnicalTab,
  watchlistCount = 0,
  savedItems = [],
  onSelectSavedProduct,
  onRemoveSavedProduct,
}: NavbarProps) {
  const [savedOpen, setSavedOpen] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) {
        setSavedOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left: Logo + Brand Name */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D5CB6] text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-gray-900 sm:text-xl">
                TrustLens <span className="text-[#1A73E8]">VN</span>
              </span>
              <span className="hidden rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0D5CB6] sm:inline-block">
                5 Mô hình Học máy
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-gray-500 sm:block">
              Hệ thống phân tích và đánh giá chất lượng bình luận thương mại điện tử
            </p>
          </div>
        </div>

        {/* Right: Direct Action Buttons (No hidden dots menu) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Saved Products Dropdown */}
          <div className="relative" ref={savedRef}>
            <button
              type="button"
              onClick={() => setSavedOpen(!savedOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                watchlistCount > 0
                  ? "border-blue-200 bg-blue-50 text-[#0D5CB6] hover:bg-blue-100"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              }`}
              title="Danh sách sản phẩm đã lưu"
            >
              <Bookmark
                className={`h-4 w-4 shrink-0 ${
                  watchlistCount > 0 ? "fill-[#0D5CB6] text-[#0D5CB6]" : "text-gray-500"
                }`}
              />
              <span className="hidden sm:inline">Đã lưu</span>
              <span className="rounded-full bg-white px-1.5 py-0.2 text-[11px] font-extrabold text-[#0D5CB6] shadow-2xs">
                {watchlistCount}
              </span>
            </button>

            {savedOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-extrabold text-gray-900">
                    Sản phẩm đã lưu ({savedItems.length})
                  </span>
                </div>
                {savedItems.length === 0 ? (
                  <p className="py-4 text-center text-xs font-medium text-gray-500">
                    Chưa có sản phẩm nào được lưu. Bạn có thể bấm nút &ldquo;Lưu theo dõi&rdquo; trên thẻ sản phẩm.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {savedItems.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 transition hover:border-blue-200 hover:bg-blue-50/40"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSavedOpen(false);
                            if (onSelectSavedProduct && item.source_url) {
                              onSelectSavedProduct(item.source_url);
                            }
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-xs font-bold text-gray-900">
                            {item.product_name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                            <span>{item.platform}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5 font-extrabold text-[#16A34A]">
                              {item.adjusted_rating.toFixed(2)}
                              <Star className="h-3 w-3 fill-[#16A34A] text-[#16A34A]" />
                            </span>
                            <span>•</span>
                            <span>Tin cậy: {Math.round(item.trust_score)}/100</span>
                          </div>
                        </button>
                        {onRemoveSavedProduct && (
                          <button
                            type="button"
                            onClick={() => onRemoveSavedProduct(item.product_id)}
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-[#DC2626]"
                            title="Bỏ lưu"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Switch to Technical Tab Button */}
          {onSwitchToTechnicalTab && (
            <button
              type="button"
              onClick={onSwitchToTechnicalTab}
              className="hidden items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#0D5CB6] md:inline-flex"
            >
              <Microscope className="h-4 w-4 text-[#16A34A]" />
              <span>Chi tiết kỹ thuật</span>
            </button>
          )}

          {/* Open 5-Model Benchmark Modal Button */}
          <button
            type="button"
            onClick={onOpenBenchmark}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D5CB6] px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition hover:bg-blue-800"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span>Bảng thực nghiệm (5 mô hình)</span>
          </button>
        </div>
      </div>
    </header>
  );
}
