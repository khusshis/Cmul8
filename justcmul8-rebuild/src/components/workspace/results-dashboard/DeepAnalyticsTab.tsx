"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Scale,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
} from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";

const STATE_COLORS = {
  busy: "#6366F1",
  starved: "#F59E0B",
  blocked: "#EF4444",
};

function SleekAnalyticsTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="pointer-events-none z-50 bg-[#0F172A]/95 backdrop-blur-xl border border-white/20 p-3 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.4)] text-white text-[12px] space-y-1.5 min-w-[140px]">
      <div className="font-extrabold text-gray-300 border-b border-white/10 pb-1 text-[10.5px] uppercase tracking-wider flex items-center justify-between">
        <span>{label}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
      </div>
      {payload.map((item: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-[11.5px]">
          <span className="flex items-center gap-1.5 text-gray-400 font-medium">
            <span
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ backgroundColor: item.color || item.fill }}
            />
            {item.name}
          </span>
          <span className="font-black text-white tabular-nums">
            {typeof item.value === "number" ? item.value.toFixed(1) : item.value}s
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DeepAnalyticsTab({
  result,
  simType,
}: {
  result: SimResult;
  simType: SimTypeId;
}) {
  const littlesLaw = result.littlesLaw;
  const waitPercentiles = result.waitTimePercentiles;
  const cyclePercentiles = result.cycleTimePercentiles;
  const resourceStates = result.resourceStates || {};

  // Build percentile chart data with friendly labels
  const percentileChartData = [
    { name: "Normal Day", wait: waitPercentiles?.p50 ?? 0, total: cyclePercentiles?.p50 ?? 0 },
    { name: "Slight Rush", wait: waitPercentiles?.p75 ?? 0, total: cyclePercentiles?.p75 ?? 0 },
    { name: "Peak Busy", wait: waitPercentiles?.p90 ?? 0, total: cyclePercentiles?.p90 ?? 0 },
    { name: "Heavy Delay", wait: waitPercentiles?.p95 ?? 0, total: cyclePercentiles?.p95 ?? 0 },
    { name: "Worst-Case 1%", wait: waitPercentiles?.p99 ?? 0, total: cyclePercentiles?.p99 ?? 0 },
  ];

  // Build resource state breakdown data
  const resourceStateData = Object.entries(resourceStates).map(([nodeId, state]) => {
    const nodeLabel = result.nodeStats[nodeId]?.label || nodeId;
    return {
      name: nodeLabel.length > 14 ? nodeLabel.substring(0, 14) + "…" : nodeLabel,
      busyPct: Math.round(state.busyRatio * 100),
      starvedPct: Math.round(state.starvedRatio * 100),
      blockedPct: Math.round(state.blockedRatio * 100),
    };
  });

  return (
    <div className="space-y-6">
      {/* ── Top Section: Flow & Balance Check Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[24px] bg-white/95 border border-indigo-100/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] p-6 overflow-hidden relative"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale size={18} className="text-[#5742FF]" />
              <h3 className="text-[16px] font-black text-gray-900 tracking-tight">
                System Flow & Balance Check
              </h3>
            </div>
            <p className="text-[12.5px] text-gray-500">
              The Golden Rule of Lines: If people arrive faster than stations can serve them, lines will grow forever.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-extrabold flex items-center gap-1.5 ${
                littlesLaw?.isStable
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {littlesLaw?.isStable ? (
                <>
                  <CheckCircle2 size={15} /> 🟢 Lines Moving Smoothly (Balanced)
                </>
              ) : (
                <>
                  <AlertCircle size={15} /> 🔴 Lines Backing Up (Unbalanced)
                </>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#FAF9FF] border border-indigo-50 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Active Inside
            </span>
            <span className="text-[24px] font-black text-[#5742FF] tabular-nums">
              {littlesLaw?.timeWeightedWIP_L ?? 0}
            </span>
            <span className="text-[11px] text-gray-500 block mt-1">people inside on average</span>
          </div>

          <div className="bg-[#FAF9FF] border border-indigo-50 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Arrival Speed
            </span>
            <span className="text-[24px] font-black text-gray-900 tabular-nums">
              {littlesLaw?.lambdaArrivalRate ?? 0}
            </span>
            <span className="text-[11px] text-gray-500 block mt-1">arrivals per second</span>
          </div>

          <div className="bg-[#FAF9FF] border border-indigo-50 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Door-to-Door Time
            </span>
            <span className="text-[24px] font-black text-gray-900 tabular-nums">
              {littlesLaw?.averageCycleTimeW ?? 0}s
            </span>
            <span className="text-[11px] text-gray-500 block mt-1">entry to exit time</span>
          </div>

          <div className="bg-[#FAF9FF] border border-indigo-50 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Flow Stability
            </span>
            <span
              className={`text-[24px] font-black tabular-nums ${
                (littlesLaw?.discrepancyPercent ?? 0) < 10
                  ? "text-emerald-600"
                  : (littlesLaw?.discrepancyPercent ?? 0) < 25
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {(littlesLaw?.discrepancyPercent ?? 0) < 15 ? "100% Balanced" : "Line Buildup"}
            </span>
            <span className="text-[11px] text-gray-500 block mt-1">
              {(littlesLaw?.discrepancyPercent ?? 0) < 15 ? "No traffic jams" : "Arrivals exceed pace"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Middle Section: Typical vs Worst-Case Wait & Staff Working Time ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Typical vs Worst-Case Delays (7 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-7 rounded-[24px] bg-white/95 border border-indigo-100/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[#5742FF]" />
              <h3 className="text-[15px] font-black text-gray-900 tracking-tight">
                Wait Times: Normal Customer vs. Unlucky Delays
              </h3>
            </div>
            <span className="text-[11px] font-bold text-gray-400">Seconds</span>
          </div>
          <p className="text-[12px] text-gray-500 mb-6">
            Averages hide bad days! A normal customer only waits {((waitPercentiles?.p50 ?? 0)).toFixed(1)}s, while the unlucky 1% endure {((waitPercentiles?.p99 ?? 0)).toFixed(1)}s during sudden rush spikes.
          </p>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={percentileChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="spectrumAreaGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="60%" stopColor="#A855F7" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#F1F0FB" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }} />
                <Tooltip cursor={{ stroke: "#8B5CF6", strokeWidth: 1.5, strokeDasharray: "4 4" }} content={<SleekAnalyticsTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area
                  type="natural"
                  dataKey="total"
                  name="Total Door-to-Door"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  fill="url(#spectrumAreaGrad2)"
                  activeDot={{ r: 6, fill: "#8B5CF6", stroke: "#FFFFFF", strokeWidth: 2.5 }}
                />
                <Area
                  type="natural"
                  dataKey="wait"
                  name="Queue Wait"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 text-center">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Wait Variation</span>
              <div className="text-[14px] font-extrabold text-gray-900">
                ±{(waitPercentiles?.stdDev ?? 0).toFixed(1)}s
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Typical Spread</span>
              <div className="text-[14px] font-extrabold text-gray-900">
                {(waitPercentiles?.iqr ?? 0).toFixed(1)}s
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Longest Single Wait</span>
              <div className="text-[14px] font-extrabold text-red-600">
                {(waitPercentiles?.max ?? 0).toFixed(1)}s
              </div>
            </div>
          </div>
        </motion.div>

        {/* Staff & Machine Busy %: Busy vs Idle vs Blocked (5 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-5 rounded-[24px] bg-white/95 border border-indigo-100/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PieIcon size={18} className="text-[#5742FF]" />
              <h3 className="text-[15px] font-black text-gray-900 tracking-tight">
                Staff & Counter Workload Breakdown
              </h3>
            </div>
            <p className="text-[12px] text-gray-500 mb-4">
              Where is time spent? Actively serving people, waiting idle for the next person, or frozen because the line ahead is full.
            </p>

            <div className="space-y-3.5 mt-2">
              {resourceStateData.map((res, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="flex items-center justify-between text-[12.5px] font-extrabold text-gray-900 mb-1.5">
                    <span>{res.name}</span>
                    <span className="text-[#5742FF]">{res.busyPct}% Working</span>
                  </div>

                  {/* Multi-segment progress bar */}
                  <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden flex">
                    <div
                      style={{ width: `${res.busyPct}%`, backgroundColor: STATE_COLORS.busy }}
                      title={`Working: ${res.busyPct}%`}
                      className="h-full transition-all"
                    />
                    <div
                      style={{ width: `${res.starvedPct}%`, backgroundColor: STATE_COLORS.starved }}
                      title={`Idle (Waiting): ${res.starvedPct}%`}
                      className="h-full transition-all"
                    />
                    <div
                      style={{ width: `${res.blockedPct}%`, backgroundColor: STATE_COLORS.blocked }}
                      title={`Frozen (Line Ahead Full): ${res.blockedPct}%`}
                      className="h-full transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] font-bold text-gray-500 mt-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#6366F1]" /> Working {res.busyPct}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Idle {res.starvedPct}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Frozen {res.blockedPct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11.5px] text-indigo-900 mt-4">
            💡 <strong>Helpful Insight</strong>: If staff are sitting idle (&gt;40%) but lines are long elsewhere, the earlier station is too slow and starving them of work.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
