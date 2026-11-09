"use client";

import React from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D5CB6] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-gray-900">
              TrustLens <span className="text-[#1A73E8]">VN</span>
            </span>
            <span className="ml-2.5 hidden rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#0D5CB6] sm:inline-block">
              Hệ thống Phân tích &amp; Nhận diện Đánh giá Shopee Chi tiết
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-[#16A34A]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Hiển thị đầy đủ 100% nội dung &amp; lý do chẩn đoán</span>
        </div>
      </div>
    </header>
  );
}
