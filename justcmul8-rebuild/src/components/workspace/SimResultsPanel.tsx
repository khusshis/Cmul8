"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Line,
  ComposedChart,
} from "recharts";
import {
  Activity,
  Users,
  Clock,
  AlertTriangle,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Scale,
  TrendingUp,
  Table2,
  User,
  ScrollText,
  Sparkles,
  Maximize,
  Minimize2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Flame,
  Layers,
  BarChart2,
  LineChart as LineChartIcon,
} from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import { useCountUp } from "@/lib/hooks/useCountUp";

import DeepAnalyticsTab from "./results-dashboard/DeepAnalyticsTab";
import TimelineTab from "./results-dashboard/TimelineTab";
import BlocksTab from "./results-dashboard/BlocksTab";
import EntityTracerTab from "./results-dashboard/EntityTracerTab";
import LogsTab from "./results-dashboard/LogsTab";

interface SimResultsPanelProps {
  result: SimResult;
  simType: SimTypeId;
  onClose: () => void;
  onExpand: () => void;
}

// ─── Ultra-Sleek Floating Pill Tooltip ─────────────────────────
function UltraModernTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="pointer-events-none z-50 bg-[#0F172A]/95 backdrop-blur-xl border border-white/20 p-3 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.4)] text-white text-[12px] space-y-1.5 min-w-[140px]">
      <div className="font-extrabold text-gray-300 border-b border-white/10 pb-1 text-[10.5px] uppercase tracking-wider flex items-center justify-between">
        <span>{label}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-pulse" />
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
            {typeof item.value === "number" ? item.value.toFixed(1) : item.value}
            {item.unit || "s"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Animated Number Helper ────────────────────────────────────
function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const animated = useCountUp(value, 800, decimals);
  return (
    <span>
      {animated}
      {suffix}
    </span>
  );
}

export default function SimResultsPanel({
  result: rawResult,
  simType,
  onClose,
  onExpand,
}: SimResultsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState<number>(450);
  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "timeline" | "blocks" | "entities" | "logs"
  >("overview");
  const [chartViewMode, setChartViewMode] = useState<"curve" | "bars">("curve");

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(450);

  // Ensure result has deep mathematical enrichments
  const result = useMemo(() => {
    if (!rawResult) return null;
    return enrichSimResult(rawResult);
  }, [rawResult]);

  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;

  // Drag-to-resize handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (collapsed) setCollapsed(false);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const maxHeight = Math.min(window.innerHeight * 0.9, 920);
    const minHeight = 220;
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY));
    setHeight(newHeight);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // Double click drag handle to toggle quick height preset
  const handleDoubleClickHandle = () => {
    setHeight((prev) => (prev > 500 ? 420 : 680));
  };

  if (!result) return null;

  const statsEntries = Object.entries(result.nodeStats);
  const efficiencyRate =
    result.totalArrived > 0
      ? Math.round((result.totalCompleted / result.totalArrived) * 100)
      : 100;

  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;
  const healthScore = result.healthScore ?? 85;
  const waitP = result.waitTimePercentiles;
  const cycleP = result.cycleTimePercentiles;

  // Build percentile data for spectrum chart (using plain English labels & fallback values)
  const percentileData = [
    { name: "Normal Day", wait: waitP?.p50 ?? 0, total: Math.max(0.1, cycleP?.p50 ?? 0) },
    { name: "Slight Rush", wait: waitP?.p75 ?? 0, total: Math.max(0.1, cycleP?.p75 ?? 0) },
    { name: "Peak Busy", wait: waitP?.p90 ?? 0, total: Math.max(0.1, cycleP?.p90 ?? 0) },
    { name: "Heavy Delay", wait: waitP?.p95 ?? 0, total: Math.max(0.1, cycleP?.p95 ?? 0) },
    { name: "Worst-Case", wait: waitP?.p99 ?? 0, total: Math.max(0.1, cycleP?.p99 ?? 0) },
  ];

  // Calculate maximum active workload
  const maxWip = useMemo(() => {
    return Math.max(
      1,
      ...(result.timeline?.map((t) => {
        const depthObj = t.depth || {};
        return t.wip ?? Object.values(depthObj).reduce((a, b) => a + b, 0);
      }) || [1])
    );
  }, [result.timeline]);

  // Build WIP timeline data
  const wipTimelineData =
    result.timeline?.map((t) => {
      const depthObj = t.depth || {};
      const sumWip = t.wip ?? Object.values(depthObj).reduce((a, b) => a + b, 0);
      return {
        simTime: `${Math.round(t.simTime)}s`,
        wip: sumWip,
        completed: t.completed,
      };
    }) || [];

  return (
    <div
      style={{
        height: collapsed ? "48px" : `${height}px`,
        maxHeight: "88vh",
      }}
      className="flex-shrink-0 border-t bg-white/95 backdrop-blur-2xl border-indigo-100/80 shadow-[0_-10px_40px_rgba(87,66,255,0.08)] transition-[height] duration-75 flex flex-col z-40 relative min-h-0 w-full"
    >
      {/* ── Interactive Ultra-Sleek Resize Bar ── */}
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClickHandle}
        className="w-full h-4 -top-2 absolute left-0 right-0 z-50 cursor-row-resize flex items-center justify-center group hover:bg-[#5742FF]/10 transition-colors select-none"
        title="Drag up/down to resize • Double-click to toggle height"
      >
        <div className="w-24 h-1.5 rounded-full bg-indigo-200/90 group-hover:bg-[#5742FF] group-hover:w-36 group-hover:shadow-[0_0_14px_rgba(87,66,255,0.6)] transition-all" />
      </div>

      {/* ── Top Header Navigation Bar ── */}
      <div className="flex items-center justify-between px-5 h-[48px] bg-white/80 border-b border-indigo-50/90 select-none shrink-0 gap-3">
        {/* Left: 1-Click Status Badge with Pulsing Light */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setCollapsed((c) => !c)}
        >
          <div className="relative flex items-center justify-center">
            {healthScore < 80 && (
              <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-amber-400 opacity-40" />
            )}
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black shadow-xs ${
                healthScore >= 80
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : healthScore >= 60
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-rose-50 text-rose-600 border border-rose-200"
              }`}
            >
              {healthScore >= 80 ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-black text-gray-900 tracking-tight group-hover:text-[#5742FF] transition-colors">
              {healthScore >= 80
                ? "Smooth Flow (Grade A)"
                : healthScore >= 60
                ? "Minor Congestion (Grade B)"
                : "Traffic Jam Alert (Grade C)"}
            </span>
            <span className="text-[11px] font-semibold text-gray-400 hidden sm:inline">
              • <AnimatedNumber value={result.totalCompleted} /> / <AnimatedNumber value={result.totalArrived} /> finished ({efficiencyRate}%)
            </span>
          </div>
        </div>

        {/* Middle: Modern Animated Pill Tabs */}
        {!collapsed && (
          <div className="hidden md:flex items-center gap-1 bg-[#F1F0FB] rounded-full p-1 border border-indigo-100/60 overflow-x-auto max-w-[620px] scrollbar-none">
            {[
              { id: "overview", label: "Executive Grid", icon: Activity },
              { id: "analytics", label: "Flow Balance", icon: Scale },
              { id: "timeline", label: "Line Buildup", icon: TrendingUp },
              { id: "blocks", label: "Station Telemetry", icon: Table2 },
              { id: "entities", label: "Journey Tracer", icon: User },
              { id: "logs", label: "Live Event Logs", icon: ScrollText },
            ].map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`relative px-3.5 py-1 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeResultsTabPill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5742FF] to-[#7C3AED] shadow-[0_3px_12px_rgba(87,66,255,0.35)]"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <t.icon size={12} className="relative z-10" />
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Quick Actions & Window Controls */}
        <div className="flex items-center gap-2">
          {!collapsed && (
            <button
              onClick={() => setHeight((h) => (h > 480 ? 420 : 680))}
              className="p-1.5 rounded-xl text-gray-400 hover:text-[#5742FF] hover:bg-indigo-50/80 transition-all"
              title={height > 480 ? "Compact height" : "Expand height"}
            >
              {height > 480 ? <Minimize2 size={15} /> : <Maximize size={15} />}
            </button>
          )}

          <button
            onClick={onExpand}
            className="flex items-center gap-1.5 text-[11.5px] font-extrabold px-3.5 py-1.5 rounded-xl text-[#5742FF] bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-[#5742FF] hover:to-[#7C3AED] hover:text-white border border-indigo-200/60 shadow-xs transition-all duration-200"
          >
            <Maximize2 size={12} />
            <span className="hidden sm:inline">Analytics Suite</span>
          </button>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
            title="Close results"
          >
            ✕
          </button>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-7 h-7 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
            title={collapsed ? "Expand Panel" : "Collapse Panel"}
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* ── Main Panel Content (Internal Smooth Scroll) ── */}
      {!collapsed && (
        <div
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden p-4 sm:p-5 bg-gradient-to-b from-[#FAF9FF] to-[#F3F2FC] custom-scrollbar"
          style={{
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
        >
          <AnimatePresence mode="wait">
            {/* VIEW 1: EXECUTIVE GRID (Modern, High-Density Visual Experience) */}
            {activeTab === "overview" && (
              <motion.div
                key="tab-overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 pb-12"
              >
                {/* ── 1. Hero AI Diagnosis Banner ── */}
                <div
                  className={`rounded-2xl p-4 border relative overflow-hidden backdrop-blur-md shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    healthScore >= 80
                      ? "bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-200/80"
                      : healthScore >= 60
                      ? "bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-amber-200/80"
                      : "bg-gradient-to-r from-rose-500/10 via-red-500/5 to-transparent border-rose-200/80"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-[20px] shadow-sm ${
                        healthScore >= 80
                          ? "bg-emerald-100 text-emerald-700"
                          : healthScore >= 60
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {healthScore >= 80 ? "🚀" : healthScore >= 60 ? "⚠️" : "🛑"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[14.5px] font-black text-gray-900 leading-tight">
                          {result.aiDiagnosis?.title || (healthScore >= 80 ? "Optimal Operational Flow" : "Congestion Bottleneck Detected")}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            healthScore >= 80
                              ? "bg-emerald-100 text-emerald-800"
                              : healthScore >= 60
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {healthScore >= 80 ? "Grade A" : healthScore >= 60 ? "Grade B" : "Grade C"}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-gray-600 mt-1 leading-relaxed max-w-3xl">
                        {result.aiDiagnosis?.summary ||
                          `Processed ${result.totalCompleted} out of ${result.totalArrived} entities with ${
                            bottleneck ? `delay concentration at ${bottleneck.label}` : "smooth queue drainage"
                          }.`}
                      </p>
                    </div>
                  </div>

                  {bottleneck && (
                    <div className="bg-white/90 border border-amber-200/90 rounded-2xl p-3 shadow-xs flex items-center gap-3 shrink-0 self-start md:self-auto">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                        <Flame size={16} />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                          Slowest Station
                        </span>
                        <span className="text-[13px] font-black text-gray-900">
                          {bottleneck.label} ({Math.round((bottleneck.utilization || 0) * 100)}% busy)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 2. The 4 Modern Frosted KPI Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Card 1: Completed Yield */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-2xl bg-white/90 border border-indigo-100/70 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(87,66,255,0.12)] hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Completion Yield
                      </span>
                      <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <CheckCircle2 size={15} />
                      </div>
                    </div>
                    <div className="my-2.5">
                      <div className="text-[26px] font-black text-gray-900 leading-none tabular-nums">
                        <AnimatedNumber value={result.totalCompleted} />{" "}
                        <span className="text-[13px] font-bold text-gray-400">/ {result.totalArrived}</span>
                      </div>
                      {/* Gradient Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mt-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${efficiencyRate}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-emerald-600">{efficiencyRate}% Finished</span>
                      <span className="text-gray-400">{result.totalArrived - result.totalCompleted} in-flight</span>
                    </div>
                  </motion.div>

                  {/* Card 2: Typical Wait */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-2xl bg-white/90 border border-indigo-100/70 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(87,66,255,0.12)] hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Typical Wait Time
                      </span>
                      <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Clock size={15} />
                      </div>
                    </div>
                    <div className="my-2.5">
                      <div className="text-[26px] font-black text-gray-900 leading-none tabular-nums">
                        <AnimatedNumber value={waitP?.p50 ?? 0} decimals={1} suffix="s" />
                      </div>
                      <div className="text-[11.5px] font-extrabold text-amber-700 mt-1.5 flex items-center gap-1">
                        <span>Rush Delay:</span>
                        <span className="bg-amber-100/80 px-1.5 py-0.5 rounded font-black">
                          {(waitP?.p95 ?? 0).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-400">
                      Door-to-Door: {(cycleP?.p50 ?? 0).toFixed(1)}s
                    </div>
                  </motion.div>

                  {/* Card 3: Slowest Station */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-2xl bg-white/90 border border-indigo-100/70 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(87,66,255,0.12)] hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Choke Point
                      </span>
                      <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <Flame size={15} />
                      </div>
                    </div>
                    <div className="my-2.5">
                      <div className="text-[18px] font-black text-gray-900 leading-tight truncate">
                        {bottleneck ? bottleneck.label : "Even Distribution"}
                      </div>
                      <div className="text-[12px] font-extrabold text-rose-600 mt-1">
                        {bottleneck ? `${Math.round((bottleneck.utilization || 0) * 100)}% Station Load` : "Zero bottlenecks"}
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-400 truncate">
                      {bottleneck ? `Queue Wait: ${bottleneck.avgWaitTime.toFixed(1)}s` : "Smooth across all steps"}
                    </div>
                  </motion.div>

                  {/* Card 4: AI Smart Fix */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-2xl bg-white/90 border border-indigo-100/70 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(87,66,255,0.12)] hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                        Smart AI Tip
                      </span>
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center font-bold">
                        <Sparkles size={15} />
                      </div>
                    </div>
                    <div className="my-2">
                      <h5 className="text-[13.5px] font-black text-gray-900 line-clamp-1">
                        {result.aiDiagnosis?.recommendations?.[0]?.title || "Speed is Balanced"}
                      </h5>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 leading-snug">
                        {result.aiDiagnosis?.recommendations?.[0]?.action || "Simulated flow easily processes current arrival rate."}
                      </p>
                    </div>
                    <div className="text-[10.5px] font-extrabold text-[#5742FF] truncate">
                      Impact: {result.aiDiagnosis?.recommendations?.[0]?.impact || "High stability"}
                    </div>
                  </motion.div>
                </div>

                {/* ── 3. Visual Interactive Flow Rail (Station Chain) ── */}
                <div className="rounded-2xl bg-white/90 border border-indigo-100/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-[#5742FF]" />
                      <span className="text-[12px] font-black uppercase tracking-wider text-gray-800">
                        Station Flow Pipeline
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-400">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal (&lt;60%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Moderate (60-85%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Congested (&gt;85%)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                    {/* Inflow Start Node */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="px-4 py-3 rounded-2xl bg-blue-50/90 border border-blue-200/80 text-center shrink-0 shadow-2xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">
                          Inflow Entrance
                        </span>
                        <span className="text-[14px] font-black text-gray-900">{result.totalArrived} Arrived</span>
                      </div>
                      <ArrowRight size={15} className="text-indigo-300 shrink-0" />
                    </div>

                    {/* All Intermediate Stations with Dynamic Cards */}
                    {statsEntries.map(([id, s], i) => {
                      const util = s.utilization !== undefined ? Math.round(s.utilization * 100) : null;
                      const isChoke = result.bottleneckNodeId === id;
                      const statusColor =
                        util === null
                          ? "bg-gray-50 border-gray-200"
                          : util > 85
                          ? "bg-rose-50/90 border-rose-200 shadow-[0_2px_10px_rgba(244,63,94,0.15)]"
                          : util > 60
                          ? "bg-amber-50/90 border-amber-200"
                          : "bg-emerald-50/90 border-emerald-200";

                      const dotColor =
                        util === null
                          ? "bg-gray-400"
                          : util > 85
                          ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                          : util > 60
                          ? "bg-amber-500"
                          : "bg-emerald-500";

                      return (
                        <div key={id} className="flex items-center gap-2.5 shrink-0">
                          <motion.div
                            whileHover={{ scale: 1.03 }}
                            className={`px-4 py-2.5 rounded-2xl border ${statusColor} text-center min-w-[135px] transition-all`}
                          >
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                              <span className="text-[12px] font-black text-gray-900 truncate max-w-[105px]">
                                {s.label}
                              </span>
                            </div>
                            <div className="text-[11px] font-extrabold text-gray-600">
                              {util !== null ? `${util}% Busy` : "Router"}
                            </div>
                            <div className="text-[10px] font-medium text-gray-400 mt-0.5">
                              {(s.avgWaitTime ?? 0).toFixed(1)}s Queue
                            </div>
                          </motion.div>
                          {i < statsEntries.length - 1 && (
                            <ArrowRight size={15} className="text-indigo-300 shrink-0" />
                          )}
                        </div>
                      );
                    })}

                    {/* Exit Complete Node */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <ArrowRight size={15} className="text-indigo-300 shrink-0" />
                      <div className="px-4 py-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-center shrink-0 shadow-2xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">
                          Exit Completed
                        </span>
                        <span className="text-[14px] font-black text-gray-900">{result.totalCompleted} Done</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 4. Two Ultra-Sleek Glass Interactive Charts ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chart 1: Active Workload Flow Curve */}
                  <div className="rounded-2xl bg-white/95 border border-indigo-100/70 p-4 shadow-sm flex flex-col h-[240px]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[12px] font-black text-gray-900 uppercase tracking-wider">
                          Active Workload Over Simulation Clock
                        </span>
                        <span className="text-[10.5px] font-medium text-gray-400 block">
                          Flat curve = stable equilibrium • Upward slope = queue accumulation
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#5742FF] text-[10.5px] font-black">
                          Peak: {maxWip} active
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={wipTimelineData as any[]} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                          <defs>
                            <linearGradient id="neonWipGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                              <stop offset="60%" stopColor="#8B5CF6" stopOpacity={0.12} />
                              <stop offset="100%" stopColor="#6366F1" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#F1F0FB" vertical={false} />
                          <XAxis
                            dataKey="simTime"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                          />
                          <Tooltip
                            cursor={{ stroke: "#6366F1", strokeWidth: 1.5, strokeDasharray: "4 4" }}
                            content={<UltraModernTooltip />}
                          />
                          <Area
                            type="monotone"
                            dataKey="wip"
                            name="Active Inside"
                            stroke="#6366F1"
                            strokeWidth={3}
                            fill="url(#neonWipGrad)"
                            dot={false}
                            activeDot={{ r: 6, fill: "#6366F1", stroke: "#FFFFFF", strokeWidth: 2.5 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Wait Time Spectrum Percentiles */}
                  <div className="rounded-2xl bg-white/95 border border-indigo-100/70 p-4 shadow-sm flex flex-col h-[240px]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[12px] font-black text-gray-900 uppercase tracking-wider">
                          Wait Time Distribution Spectrum
                        </span>
                        <span className="text-[10.5px] font-medium text-gray-400 block">
                          Comparing typical customer wait vs peak unlucky spike
                        </span>
                      </div>

                      {/* View Mode Switcher (Smooth Curve vs Modern Bars) */}
                      <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/50">
                        <button
                          onClick={() => setChartViewMode("curve")}
                          className={`p-1 rounded-md text-[10px] font-bold transition-all ${
                            chartViewMode === "curve"
                              ? "bg-white text-[#5742FF] shadow-xs"
                              : "text-gray-500 hover:text-gray-900"
                          }`}
                          title="Smooth Spline Curve"
                        >
                          <LineChartIcon size={12} />
                        </button>
                        <button
                          onClick={() => setChartViewMode("bars")}
                          className={`p-1 rounded-md text-[10px] font-bold transition-all ${
                            chartViewMode === "bars"
                              ? "bg-white text-[#5742FF] shadow-xs"
                              : "text-gray-500 hover:text-gray-900"
                          }`}
                          title="Rounded Gradient Bars"
                        >
                          <BarChart2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartViewMode === "curve" ? (
                          <AreaChart data={percentileData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                            <defs>
                              <linearGradient id="spectrumAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.45} />
                                <stop offset="60%" stopColor="#A855F7" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke="#F1F0FB" vertical={false} />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                            />
                            <Tooltip
                              cursor={{ stroke: "#8B5CF6", strokeWidth: 1.5, strokeDasharray: "4 4" }}
                              content={<UltraModernTooltip />}
                            />
                            <Area
                              type="natural"
                              dataKey="total"
                              name="Total Door-to-Door"
                              stroke="#8B5CF6"
                              strokeWidth={3}
                              fill="url(#spectrumAreaGrad)"
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
                        ) : (
                          <BarChart
                            data={percentileData}
                            margin={{ top: 10, right: 10, bottom: 0, left: -25 }}
                            barGap={6}
                          >
                            <defs>
                              <linearGradient id="barGradWait" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366F1" />
                                <stop offset="100%" stopColor="#818CF8" />
                              </linearGradient>
                              <linearGradient id="barGradTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" />
                                <stop offset="100%" stopColor="#C084FC" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke="#F1F0FB" vertical={false} />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(99, 102, 241, 0.04)", radius: 10 }}
                              content={<UltraModernTooltip />}
                            />
                            <Bar
                              dataKey="wait"
                              name="Line Wait"
                              fill="url(#barGradWait)"
                              radius={[8, 8, 0, 0]}
                              maxBarSize={28}
                            />
                            <Bar
                              dataKey="total"
                              name="Total Door-to-Door"
                              fill="url(#barGradTotal)"
                              radius={[8, 8, 0, 0]}
                              maxBarSize={28}
                            />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW 2: LINE FLOW CHECK TAB */}
            {activeTab === "analytics" && (
              <motion.div key="tab-analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                <DeepAnalyticsTab result={result} simType={simType} />
              </motion.div>
            )}

            {/* VIEW 3: QUEUE BUILDUP TAB */}
            {activeTab === "timeline" && (
              <motion.div key="tab-timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                <TimelineTab result={result} />
              </motion.div>
            )}

            {/* VIEW 4: ALL STATIONS TAB */}
            {activeTab === "blocks" && (
              <motion.div key="tab-blocks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                <BlocksTab result={result} />
              </motion.div>
            )}

            {/* VIEW 5: PERSON / ITEM JOURNEY TAB */}
            {activeTab === "entities" && (
              <motion.div key="tab-entities" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                <EntityTracerTab result={result} simType={simType} />
              </motion.div>
            )}

            {/* VIEW 6: LIVE ACTIVITY LOG TAB */}
            {activeTab === "logs" && (
              <motion.div key="tab-logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                <LogsTab result={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
