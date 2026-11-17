"use client";

import React, { useState, useRef, useEffect } from "react";
import { ShieldCheck, Bookmark, Star, Trash2 } from "lucide-react";

export interface SavedProductItem {
  product_id: string;
  product_name: string;
  platform: string;
  trust_score: number;
  adjusted_rating: number;
  source_url: string;
}

interface NavbarProps {
  watchlistCount?: number;
  savedItems?: SavedProductItem[];
  onSelectSavedProduct?: (url: string) => void;
  onRemoveSavedProduct?: (productId: string) => void;
}

export default function Navbar({
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
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Minimal Logo + Name */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D5CB6] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900">
            TrustLens <span className="text-[#1A73E8]">VN</span>
          </span>
        </div>

        {/* Saved Products Button */}
        <div className="relative" ref={savedRef}>
          <button
            type="button"
            onClick={() => setSavedOpen(!savedOpen)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              watchlistCount > 0
                ? "border-blue-200 bg-blue-50 text-[#0D5CB6]"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${
                watchlistCount > 0
                  ? "fill-[#0D5CB6] text-[#0D5CB6]"
                  : "text-gray-500"
              }`}
            />
            <span>Đã lưu ({watchlistCount})</span>
          </button>

          {savedOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
              <div className="mb-2 border-b border-gray-100 pb-1.5 text-xs font-extrabold text-gray-900">
                Sản phẩm đã lưu
              </div>
              {savedItems.length === 0 ? (
                <p className="py-3 text-center text-xs text-gray-500">
                  Chưa có sản phẩm nào được lưu.
                </p>
              ) : (
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {savedItems.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-2 hover:bg-blue-50/50"
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
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                          <span className="inline-flex items-center gap-0.5 font-extrabold text-[#16A34A]">
                            {item.adjusted_rating.toFixed(2)}
                            <Star className="h-3 w-3 fill-[#16A34A] text-[#16A34A]" />
                          </span>
                          <span>•</span>
                          <span>{Math.round(item.trust_score)}/100</span>
                        </div>
                      </button>
                      {onRemoveSavedProduct && (
                        <button
                          type="button"
                          onClick={() => onRemoveSavedProduct(item.product_id)}
                          className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-[#DC2626]"
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
      </div>
    </header>
  );
}
