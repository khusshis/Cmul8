"use client";

import React from "react";
import { motion } from "framer-motion";
import { GitFork, ArrowRight, AlertTriangle, CheckCircle2, Flame, ShieldAlert, CornerDownRight } from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";

export default function FlowHeatmapTab({
  result,
  simType,
}: {
  result: SimResult;
  simType: SimTypeId;
}) {
  const nodeStatsEntries = Object.entries(result.nodeStats);

  // Compute congestion heat index (0 to 100) per node
  const nodesWithHeat = nodeStatsEntries.map(([nodeId, stat]) => {
    let heat = 0;
    const util = stat.utilization || 0;
    const renege = stat.renegeCount || 0;
    const wait = stat.avgWaitTime || 0;

    if (stat.nodeType === "queue" || stat.nodeType === "store") {
      heat = Math.min(100, Math.round((stat.currentDepth * 15) + (renege * 20) + (wait * 5)));
    } else if (stat.nodeType === "resource" || stat.nodeType === "service" || stat.nodeType === "priority_resource") {
      heat = Math.min(100, Math.round(util * 100));
    } else {
      heat = stat.entitiesIn > 0 ? 10 : 0;
    }

    return {
      nodeId,
      stat,
      heat,
    };
  });

  const isBottleneck = (nodeId: string) => result.bottleneckNodeId === nodeId;

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 rounded-[22px] bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/70 border border-indigo-100/80">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <h3 className="text-[16px] font-black text-gray-900">
              System Flow Dynamics & Congestion Heatmap
            </h3>
          </div>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            Real-time heat rating of all blocks in the network: identifies choke points, queue accumulation, and branch discharge splits.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-bold text-gray-600 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Free Flow (&lt;50)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate (50-80)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Choked (&gt;80)
          </span>
        </div>
      </div>

      {/* ── Grid of Node Flow Heat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodesWithHeat.map(({ nodeId, stat, heat }, i) => {
          const bottleneck = isBottleneck(nodeId);
          const heatColor =
            heat > 80 ? "#EF4444" : heat > 50 ? "#F59E0B" : "#10B981";
          const heatBg =
            heat > 80 ? "bg-red-50/50" : heat > 50 ? "bg-amber-50/50" : "bg-emerald-50/30";

          return (
            <motion.div
              key={nodeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-[20px] bg-white border p-5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:shadow-md transition-all ${
                bottleneck
                  ? "border-red-300 ring-2 ring-red-400/20"
                  : "border-gray-100 hover:border-indigo-200"
              }`}
            >
              {/* Top Row: Label & Heat Badge */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[14.5px] text-gray-900 tracking-tight">
                      {stat.label}
                    </span>
                    {bottleneck && (
                      <span className="text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600 text-white">
                        BOTTLENECK
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {NODE_LABELS[stat.nodeType as keyof typeof NODE_LABELS] || stat.nodeType}
                  </span>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-xl font-black text-[12px] flex items-center gap-1 ${heatBg}`}
                  style={{ color: heatColor }}
                >
                  <Flame size={12} /> {heat}
                  <span className="text-[9px] font-bold text-gray-400 uppercase">/100</span>
                </div>
              </div>

              {/* Middle Section: Inflow vs Outflow Metric */}
              <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100 text-center">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Inflow</span>
                  <span className="text-[16px] font-black text-gray-800 tabular-nums">
                    {stat.entitiesIn}
                  </span>
                </div>
                <div className="border-l border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Outflow</span>
                  <span className="text-[16px] font-black text-emerald-600 tabular-nums">
                    {stat.entitiesOut}
                  </span>
                </div>
              </div>

              {/* Bottom Metrics Bar */}
              <div className="space-y-1.5 text-[11.5px] text-gray-600 pt-2 border-t border-gray-100">
                {stat.utilization !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Utilization</span>
                    <span className="font-extrabold text-gray-900">
                      {Math.round(stat.utilization * 100)}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Avg Wait Time</span>
                  <span className="font-extrabold text-gray-900">
                    {(stat.avgWaitTime ?? 0).toFixed(2)}s
                  </span>
                </div>
                {(stat.renegeCount ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-red-600 font-bold">
                    <span>Reneged / Lost</span>
                    <span>{stat.renegeCount} entities</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
