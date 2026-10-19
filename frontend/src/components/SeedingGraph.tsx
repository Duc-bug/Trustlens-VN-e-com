"use client";

import React, { useMemo, useState } from "react";
import {
  Network,
  ShieldAlert,
  CheckCircle2,
  Info,
  Star,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { GraphNode, SeedingGraphPayload } from "@/types/trustlens";

interface SeedingGraphProps {
  graph: SeedingGraphPayload;
}

type NodeFilter = "all" | "suspicious" | "authentic";

export default function SeedingGraph({ graph }: SeedingGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeFilter, setNodeFilter] = useState<NodeFilter>("all");
  const [zoom, setZoom] = useState<number>(1);

  const width = 640;
  const height = 350;

  const { positionedNodes, positionedLinks } = useMemo(() => {
    const nodes = graph.nodes || [];
    const links = graph.links || [];
    const n = nodes.length;
    if (n === 0) return { positionedNodes: [], positionedLinks: [] };

    const seedingNodes = nodes.filter((nd) => nd.is_seeding);
    const authNodes = nodes.filter((nd) => !nd.is_seeding);

    const posMap: Record<
      string,
      GraphNode & { x: number; y: number; radius: number }
    > = {};

    seedingNodes.forEach((nd, idx) => {
      const clusterGroup = idx % 2;
      const cx = clusterGroup === 0 ? width * 0.38 : width * 0.57;
      const cy = clusterGroup === 0 ? height * 0.48 : height * 0.54;
      const angle = (idx / Math.max(1, seedingNodes.length)) * Math.PI * 2 * 1.7;
      const ringRadius = 24 + (idx % 5) * 16;
      const x = Math.max(36, Math.min(width - 36, cx + Math.cos(angle) * ringRadius));
      const y = Math.max(36, Math.min(height - 36, cy + Math.sin(angle) * ringRadius));
      const r = Math.min(13, Math.max(7, 6 + nd.degree * 0.65));
      posMap[nd.id] = { ...nd, x, y, radius: r };
    });

    authNodes.forEach((nd, idx) => {
      const angle = (idx / Math.max(1, authNodes.length)) * Math.PI * 2;
      const rx = width * 0.43;
      const ry = height * 0.41;
      const x = Math.max(28, Math.min(width - 28, width * 0.5 + Math.cos(angle) * rx));
      const y = Math.max(28, Math.min(height - 28, height * 0.5 + Math.sin(angle) * ry));
      posMap[nd.id] = { ...nd, x, y, radius: 6.5 };
    });

    const pLinks = links
      .map((lk) => {
        const s = posMap[lk.source];
        const t = posMap[lk.target];
        if (!s || !t) return null;
        return {
          ...lk,
          x1: s.x,
          y1: s.y,
          x2: t.x,
          y2: t.y,
        };
      })
      .filter(Boolean) as Array<{
      source: string;
      target: string;
      weight: number;
      reason: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }>;

    return {
      positionedNodes: Object.values(posMap),
      positionedLinks: pLinks,
    };
  }, [graph]);

  const filteredNodes = useMemo(() => {
    if (nodeFilter === "suspicious") {
      return positionedNodes.filter((n) => n.is_seeding);
    }
    if (nodeFilter === "authentic") {
      return positionedNodes.filter((n) => !n.is_seeding);
    }
    return positionedNodes;
  }, [positionedNodes, nodeFilter]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredLinks = useMemo(
    () =>
      positionedLinks.filter(
        (lk) => visibleNodeIds.has(lk.source) && visibleNodeIds.has(lk.target)
      ),
    [positionedLinks, visibleNodeIds]
  );

  const activeNode = selectedNode || filteredNodes[0] || positionedNodes[0] || null;

  // ViewBox zoom calculation around center
  const vbWidth = width / zoom;
  const vbHeight = height / zoom;
  const vbX = (width - vbWidth) / 2;
  const vbY = (height - vbHeight) / 2;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-[#1A73E8]" />
            <h2 className="text-base font-extrabold text-gray-900 sm:text-lg">
              Đồ thị liên kết hành vi tài khoản (Graph Attention Network)
            </h2>
          </div>
          <p className="mt-0.5 text-xs font-medium text-gray-500">
            Các đường nối biểu thị các tài khoản đăng đánh giá cùng khung 15 phút, trùng cụm thiết bị hoặc tương đồng nội dung
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setNodeFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              nodeFilter === "all"
                ? "bg-[#0D5CB6] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Tất cả ({positionedNodes.length})
          </button>
          <button
            type="button"
            onClick={() => setNodeFilter("suspicious")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              nodeFilter === "suspicious"
                ? "bg-[#DC2626] text-white"
                : "bg-red-50 text-[#DC2626] hover:bg-red-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            Nghi vấn ({positionedNodes.filter((n) => n.is_seeding).length})
          </button>
          <button
            type="button"
            onClick={() => setNodeFilter("authentic")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              nodeFilter === "authentic"
                ? "bg-[#16A34A] text-white"
                : "bg-emerald-50 text-[#16A34A] hover:bg-emerald-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            Hợp lệ ({positionedNodes.filter((n) => !n.is_seeding).length})
          </button>
        </div>
      </div>

      {/* Interactive SVG Graph Canvas + Inspector Panel */}
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-[#F8FAFC] lg:col-span-8">
          {/* Zoom Controls Overlay */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))}
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              title="Phóng to"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              title="Thu nhỏ"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              title="Đặt lại tỷ lệ"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <svg
            viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
            className="h-80 w-full select-none sm:h-88"
          >
            {/* Subtle soft background zone for cluster center */}
            {nodeFilter !== "authentic" && (
              <circle
                cx={width * 0.46}
                cy={height * 0.5}
                r={110}
                fill="#FEE2E2"
                fillOpacity="0.5"
              />
            )}

            {/* Edges */}
            {filteredLinks.map((lk, idx) => {
              const isHighlighted =
                activeNode &&
                (lk.source === activeNode.id || lk.target === activeNode.id);
              return (
                <line
                  key={idx}
                  x1={lk.x1}
                  y1={lk.y1}
                  x2={lk.x2}
                  y2={lk.y2}
                  stroke={isHighlighted ? "#DC2626" : "#94A3B8"}
                  strokeOpacity={isHighlighted ? 0.9 : 0.45}
                  strokeWidth={isHighlighted ? 2.2 : Math.max(1, lk.weight * 1.4)}
                />
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((nd) => {
              const isSelected = activeNode?.id === nd.id;
              return (
                <g
                  key={nd.id}
                  onClick={() => setSelectedNode(nd)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle
                      cx={nd.x}
                      cy={nd.y}
                      r={nd.radius + 5}
                      fill="none"
                      stroke="#111827"
                      strokeWidth={2}
                      strokeDasharray="3 2"
                    />
                  )}
                  <circle
                    cx={nd.x}
                    cy={nd.y}
                    r={nd.radius}
                    fill={nd.is_seeding ? "#DC2626" : "#16A34A"}
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                  />
                </g>
              );
            })}
          </svg>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-gray-600">
            <span>
              Tổng cạnh liên kết:{" "}
              <strong className="font-bold text-gray-900">
                {graph.summary.total_edges}
              </strong>
            </span>
            <span>
              Cụm liên thông lớn nhất:{" "}
              <strong className="font-bold text-[#DC2626]">
                {graph.summary.largest_cluster_size} tài khoản
              </strong>
            </span>
            <span>
              Mật độ đồ thị:{" "}
              <strong className="font-bold text-[#0D5CB6]">
                {graph.summary.graph_density}
              </strong>
            </span>
          </div>
        </div>

        {/* Selected Node Inspector Panel */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/70 p-4 lg:col-span-4">
          {activeNode ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-500">
                  Chi tiết nút tài khoản
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    activeNode.is_seeding
                      ? "border-red-200 bg-red-50 text-[#DC2626]"
                      : "border-green-200 bg-green-50 text-[#16A34A]"
                  }`}
                >
                  {activeNode.is_seeding ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" /> Đánh giá nghi vấn
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Đánh giá hợp lệ
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-900">
                    @{activeNode.user_name}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#F59E0B]">
                    {activeNode.rating}{" "}
                    <Star className="h-3.5 w-3.5 fill-[#F59E0B]" />
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-700">
                  &ldquo;{activeNode.comment_preview}...&rdquo;
                </p>
                <div className="mt-2 text-[11px] text-gray-400">
                  Thời gian: {activeNode.timestamp}
                </div>
              </div>

              <div className="mt-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-600">Số tài khoản liên kết (Degree):</span>
                  <strong className="font-bold text-gray-900">
                    {activeNode.degree} liên kết
                  </strong>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-600">Điểm trung tâm (PageRank):</span>
                  <strong className="font-bold text-[#0D5CB6]">
                    {activeNode.pagerank}
                  </strong>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-600">Quy mô cụm liên thông:</span>
                  <strong className="font-bold text-[#DC2626]">
                    {activeNode.cluster_size} đánh giá
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Điểm biểu diễn đồ thị (GAT):</span>
                  <strong className="font-bold text-[#D97706]">
                    {activeNode.suspect_score}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Nhấp vào một chấm tròn trên biểu đồ để xem chi tiết tài khoản.
            </div>
          )}

          <div className="mt-4 space-y-2 rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-xs leading-relaxed text-[#0D5CB6]">
            <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
              <span>
                Modularity Q: {(graph.summary?.modularity_q ?? 0.34).toFixed(3)}
              </span>
              <span>
                Lõi K-Core tối đa: k = {graph.summary?.max_kcore ?? 4}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1A73E8]" />
              <span>
                Bấm vào từng nút tròn trên đồ thị để đối chiếu chỉ số PageRank,
                bậc liên kết và điểm nhúng Graph Attention Network (GAT).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
