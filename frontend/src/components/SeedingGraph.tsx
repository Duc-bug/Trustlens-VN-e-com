"use client";

import React, { useMemo, useState } from "react";
import { Network, ShieldAlert, CheckCircle2, Info, Star } from "lucide-react";
import { GraphNode, SeedingGraphPayload } from "@/types/trustlens";

interface SeedingGraphProps {
  graph: SeedingGraphPayload;
}

export default function SeedingGraph({ graph }: SeedingGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const width = 620;
  const height = 340;

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
      const cx = clusterGroup === 0 ? width * 0.36 : width * 0.56;
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

  const activeNode = selectedNode || positionedNodes[0] || null;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-[#1A73E8]" />
            <h2 className="text-lg font-bold text-gray-900">
              Cụm tài khoản nghi vấn liên kết ngầm (Đồ thị hành vi)
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Các đường nối thể hiện những tài khoản đăng bài cùng khung 15 phút, trùng cụm thiết bị hoặc giống văn mẫu
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="flex items-center gap-2 text-[#DC2626]">
            <span className="h-3 w-3 rounded-full bg-[#DC2626]" />
            Nghi seeding ({positionedNodes.filter((n) => n.is_seeding).length})
          </span>
          <span className="flex items-center gap-2 text-[#16A34A]">
            <span className="h-3 w-3 rounded-full bg-[#16A34A]" />
            Người mua thật ({positionedNodes.filter((n) => !n.is_seeding).length})
          </span>
        </div>
      </div>

      {/* Interactive SVG Graph Canvas */}
      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-[#F8FAFC] xl:col-span-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-80 w-full select-none"
          >
            {/* Subtle soft background zone for cluster center */}
            <circle
              cx={width * 0.45}
              cy={height * 0.5}
              r={110}
              fill="#FEE2E2"
              fillOpacity="0.55"
            />

            {/* Edges */}
            {positionedLinks.map((lk, idx) => {
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
            {positionedNodes.map((nd) => {
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
              Tổng liên kết nghi vấn:{" "}
              <strong className="font-bold text-gray-900">{graph.summary.total_edges}</strong>
            </span>
            <span>
              Quy mô cụm lớn nhất:{" "}
              <strong className="font-bold text-[#DC2626]">
                {graph.summary.largest_cluster_size} tài khoản
              </strong>
            </span>
            <span>
              Mật độ liên kết:{" "}
              <strong className="font-bold text-[#0D5CB6]">{graph.summary.graph_density}</strong>
            </span>
          </div>
        </div>

        {/* Selected Node Inspector Panel */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/70 p-4">
          {activeNode ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-500">
                  Chi tiết tài khoản (chọn nút để xem)
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
                      <ShieldAlert className="h-3.5 w-3.5" /> Nghi seeding ({activeNode.seeding_probability}%)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Người mua thật
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-900">@{activeNode.user_name}</span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#F59E0B]">
                    {activeNode.rating} <Star className="h-3.5 w-3.5 fill-[#F59E0B]" />
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700 line-clamp-3">
                  &ldquo;{activeNode.comment_preview}...&rdquo;
                </p>
                <div className="mt-2 text-xs text-gray-400">
                  Thời gian: {activeNode.timestamp}
                </div>
              </div>

              <div className="mt-3.5 space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-600">Số tài khoản liên kết:</span>
                  <strong className="font-bold text-gray-900">{activeNode.degree} liên kết</strong>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-600">Điểm ảnh hưởng (PageRank):</span>
                  <strong className="font-bold text-[#0D5CB6]">{activeNode.pagerank}</strong>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-600">Quy mô nhóm liên thông:</span>
                  <strong className="font-bold text-[#DC2626]">{activeNode.cluster_size} review</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Điểm bất thường cụm (GAT):</span>
                  <strong className="font-bold text-[#D97706]">{activeNode.suspect_score}</strong>
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
                Modularity Q:{" "}
                {(graph.summary?.modularity_q ?? 0.34).toFixed(3)}
              </span>
              <span>
                Lõi K-Core tối đa: k = {graph.summary?.max_kcore ?? 4}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1A73E8]" />
              <span>
                Các chấm <strong>màu đỏ</strong> tập trung ở tâm biểu thị nhóm
                tài khoản có dấu hiệu phối hợp đánh giá cùng lúc hoặc dùng chung
                kịch bản (Supervised GAT + Louvain Community).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
