"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  BarChart3,
  MoreHorizontal,
  Microscope,
  Bookmark,
} from "lucide-react";

interface NavbarProps {
  onOpenBenchmark: () => void;
  onOpenExtractorModal?: () => void;
  onSwitchToTechnicalTab?: () => void;
  watchlistCount?: number;
  crawlMode?: string;
}

export default function Navbar({
  onOpenBenchmark,
  onSwitchToTechnicalTab,
  watchlistCount = 0,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left: Minimal Logo + Name Only (A.1) */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D5CB6] text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-gray-900">
            TrustLens <span className="text-[#1A73E8]">VN</span>
          </span>
        </div>

        {/* Right: Small Status Dot + "⋯" Dropdown Menu (A.1) */}
        <div className="flex items-center gap-3" ref={menuRef}>

          {watchlistCount > 0 && (
            <span
              className="hidden items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#0D5CB6] sm:inline-flex"
              title="Sản phẩm đã lưu theo dõi"
            >
              <Bookmark className="h-3.5 w-3.5 fill-[#0D5CB6]" />
              {watchlistCount}
            </span>
          )}

          {/* "⋯" Menu Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-100 focus:outline-none"
              aria-label="Tùy chọn nâng cao"
              title="Tùy chọn nâng cao"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenBenchmark();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:text-[#0D5CB6]"
                >
                  <BarChart3 className="h-4 w-4 text-[#1A73E8]" />
                  <span>Bảng benchmark (5 mô hình)</span>
                </button>

                {onSwitchToTechnicalTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSwitchToTechnicalTab();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:text-[#0D5CB6]"
                  >
                    <Microscope className="h-4 w-4 text-[#16A34A]" />
                    <span>Chi tiết kỹ thuật (SHAP &amp; Đồ thị)</span>
                  </button>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </header >
  );
}
