"use client";

import React from "react";
import { motion } from "framer-motion";
import { Activity, Layers, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { SimResult } from "@/lib/simulation/types";
import { buildThroughputSeries, buildDepthSeries } from "@/lib/simulation/timelineSelectors";
import { formatCompactNumber } from "../SimResultsPanel";

const SERIES_COLORS = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#0EA5E9", "#EC4899"];

function SleekTimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="pointer-events-none z-50 bg-[#0F172A]/95 backdrop-blur-xl border border-white/20 p-3 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.4)] text-white text-[12px] space-y-1.5 min-w-[140px]">
      <div className="font-extrabold text-gray-300 border-b border-white/10 pb-1 text-[10.5px] uppercase tracking-wider">
        t = {label}
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
            {typeof item.value === "number" ? Math.round(item.value) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TimelineTab({ result }: { result: SimResult }) {
  const throughput = buildThroughputSeries(result);
  const { series: depthSeries, nodeLabels } = buildDepthSeries(result);

  // Build WIP timeline series
  const wipSeries = result.timeline?.map((t) => {
    const depthObj = t.depth || {};
    const sumWip = t.wip ?? Object.values(depthObj).reduce((a, b) => a + b, 0);
    return {
      simTime: `${Math.round(t.simTime)}s`,
      wip: sumWip,
      completed: t.completed,
    };
  }) || [];

  return (
    <div className="space-y-6">
      {/* ── Active Workload Flow Curve ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[22px] bg-white/95 border border-indigo-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-6"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#5742FF]" />
            <h3 className="text-[15px] font-black text-gray-900 tracking-tight">
              Total In-Flight Load & Completion Rate
            </h3>
          </div>
          <span className="text-[11px] font-bold text-gray-400">Live Simulation Clock</span>
        </div>
        <p className="text-[12px] text-gray-500 mb-6">
          Shows how many items/people were actively in the system vs. how many successfully finished every second.
        </p>

        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={(wipSeries.length > 0 ? wipSeries : throughput) as any[]} margin={{ top: 10, right: 15, bottom: 0, left: -5 }}>
              <defs>
                <linearGradient id="wipGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#F1F0FB" vertical={false} />
              <XAxis dataKey="simTime" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }} />
              <YAxis
                domain={[0, (dataMax: number) => (dataMax <= 4 ? Math.max(1, Math.ceil(dataMax)) : Math.ceil(dataMax * 1.1))]}
                allowDecimals={false}
                tickFormatter={formatCompactNumber}
                width={40}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip cursor={{ stroke: "#6366F1", strokeWidth: 1.5, strokeDasharray: "4 4" }} content={<SleekTimelineTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Area
                type="monotone"
                dataKey="wip"
                name="Active Inside"
                stroke="#6366F1"
                strokeWidth={2.5}
                fill="url(#wipGradient)"
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Total Finished"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#completedGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Station Queue Buildup Over Time ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-[22px] bg-white/95 border border-indigo-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-6"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#5742FF]" />
            <h3 className="text-[15px] font-black text-gray-900 tracking-tight">
              Station Line Buildup & Queue Lengths Over Time
            </h3>
          </div>
          <span className="text-[11px] font-bold text-gray-400">Queue Heights</span>
        </div>
        <p className="text-[12px] text-gray-500 mb-6">
          Displays how individual waiting lines grew and cleared out throughout the simulation.
        </p>

        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={depthSeries} margin={{ top: 10, right: 15, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F1F0FB" vertical={false} />
              <XAxis dataKey="simTime" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }} />
              <YAxis
                domain={[0, (dataMax: number) => (dataMax <= 4 ? Math.max(1, Math.ceil(dataMax)) : Math.ceil(dataMax * 1.1))]}
                allowDecimals={false}
                tickFormatter={formatCompactNumber}
                width={40}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip cursor={{ stroke: "#8B5CF6", strokeWidth: 1.5, strokeDasharray: "4 4" }} content={<SleekTimelineTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              {nodeLabels.map((label, i) => (
                <Area
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stackId="depth"
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fillOpacity={0.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
