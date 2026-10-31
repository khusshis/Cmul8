"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid, ReferenceLine } from "recharts";
import {
  Activity,
  Clock,
  AlertTriangle,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Flame,
  Layers,
  BarChart2,
  LineChart as LineChartIcon,
  TrendingUp,
  Timer,
  X,
  Info,
  Lightbulb,
  Sparkles,
  Loader2,
} from "lucide-react";
import { requestOptimizer } from "@/lib/ai/requestOptimizer";
import type { OptimizerRecommendation } from "@/app/api/ai/optimize/route";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import { resolveKpiMetrics } from "@/lib/simulation/resolveKpiMetrics";
import MetricCard from "@/components/ui/MetricCard";
import ChartCard from "@/components/ui/ChartCard";
import ChartTooltip from "@/components/ui/ChartTooltip";
import TabStrip, { tabPanelProps } from "@/components/ui/TabStrip";
import { AXIS, GRID, TONES, downsample, fmtCount, fmtSeconds, maxOf, niceMax, niceMaxFloat } from "@/components/ui/chartTheme";

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

// Kept for backwards compatibility; the shared versions live in components/ui/chartTheme.
export { fmtSeconds as formatTimeFriendly, fmtCount as formatCompactNumber } from "@/components/ui/chartTheme";

type PanelTab = "overview" | "analytics" | "timeline" | "blocks" | "entities" | "logs";

const TABS: { id: PanelTab; label: string; intro: string }[] = [
  { id: "overview", label: "Summary", intro: "The key results at a glance: how many finished, typical wait, and where the slowdown is." },
  { id: "analytics", label: "Detailed Charts", intro: "Checks the flow is balanced and compares a typical wait with the unlucky worst cases." },
  { id: "timeline", label: "Queue Timeline", intro: "How load and line lengths changed over the run. Lines that keep climbing mean a backlog." },
  { id: "blocks", label: "Station Details", intro: "Every station's counts in a sortable table. Use Details for one station's full numbers." },
  { id: "entities", label: "Customer Trips", intro: "Pick one person or item to see each station it visited and how long it waited." },
  { id: "logs", label: "Event History", intro: "Every event in time order. Filter, search, copy or export to CSV." },
];

const PCT_LABELS: Record<string, string> = {
  Fastest: "The fastest 25% of visits took at most",
  Typical: "Typical visit: half of everyone was faster",
  "Slow 25%": "The slowest 25% took at least",
  "Slow 10%": "The slowest 10% took at least",
  "Slow 1%": "The unluckiest 1% took at least",
};

export default function SimResultsPanel({
  result: rawResult,
  simType,
  onClose,
  onExpand,
}: SimResultsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState<number>(450);
  const [activeTab, setActiveTab] = useState<PanelTab>("overview");
  const [chartViewMode, setChartViewMode] = useState<"curve" | "bars">("curve");
  const [aiRec, setAiRec] = useState<{ for: SimResult; rec: OptimizerRecommendation } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(450);

  // Ensure result has deep mathematical enrichments
  const result = useMemo(() => {
    if (!rawResult) return null;
    return enrichSimResult(rawResult);
  }, [rawResult]);

  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;

  // NOTE: these hooks must run unconditionally on every render (Rules of Hooks), before the
  // `if (!result) return null` guard below, and are null-safe while `result` hasn't arrived yet.
  // WIP timeline (downsampled to <= 180 points, keeping the peak and the last point).
  const wipChartData = useMemo(() => {
    if (!result || !result.timeline || result.timeline.length === 0) return [];
    const raw = result.timeline.map((t) => ({
      simTime: t.simTime,
      wip: t.wip !== undefined ? t.wip : Object.values(t.depth || {}).reduce((a, b) => a + b, 0),
      completed: t.completed,
    }));
    return downsample(raw, 180, "wip");
  }, [result]);

  // Peak active workload. Reduce instead of Math.max(...) so very long timelines can't overflow the stack.
  const maxWip = useMemo(() => {
    if (!result) return 1;
    if (result.timeline && result.timeline.length > 0) {
      return Math.max(1, maxOf(result.timeline.map((t) => (t.wip !== undefined ? t.wip : Object.values(t.depth || {}).reduce((a, b) => a + b, 0)))));
    }
    return Math.max(1, result.totalArrived - result.totalCompleted);
  }, [result]);

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
    setHeight(Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY)));
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
  const handleDoubleClickHandle = () => setHeight((prev) => (prev > 500 ? 420 : 680));

  // Keyboard resize for the drag handle (it is a separator).
  const handleResizeKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const maxHeight = Math.min(window.innerHeight * 0.9, 920);
    setHeight((h) => Math.max(220, Math.min(maxHeight, h + (e.key === "ArrowUp" ? 40 : -40))));
  };

  if (!result) return null;

  const statsEntries = Object.entries(result.nodeStats);
  const efficiencyRate = result.totalArrived > 0 ? Math.round((result.totalCompleted / result.totalArrived) * 100) : 100;
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;
  const healthScore = result.healthScore;
  const waitP = result.waitTimePercentiles;
  const cycleP = result.cycleTimePercentiles;
  const resolvedKpis = resolveKpiMetrics(simConfig.kpiMetrics, result);
  // An AI answer only applies to the run it was asked about.
  const aiTop = aiRec?.for === rawResult ? aiRec.rec : null;
  const topRec = aiTop ?? result.aiDiagnosis?.recommendations?.[0];
  const askAi = async () => {
    setAiLoading(true);
    const recs = await requestOptimizer(result, simType);
    if (recs?.[0]) setAiRec({ for: rawResult, rec: recs[0] });
    setAiLoading(false);
  };
  const avgWip = result.littlesLaw?.timeWeightedWIP_L;

  const healthTone = healthScore === undefined ? TONES.brand : healthScore >= 80 ? TONES.good : healthScore >= 60 ? TONES.warn : TONES.bad;
  const grade = healthScore === undefined ? null : healthScore >= 80 ? "A" : healthScore >= 60 ? "B" : "C";
  const headline =
    healthScore === undefined ? "Simulation complete" : healthScore >= 80 ? "Smooth flow" : healthScore >= 60 ? "Minor congestion" : "Traffic jam alert";

  // Percentile spectrum (plain-English labels, real values: no fake floor).
  const percentileData = [
    { name: "Fastest", wait: waitP?.p25 ?? 0, total: cycleP?.p25 ?? 0 },
    { name: "Typical", wait: waitP?.p50 ?? 0, total: cycleP?.p50 ?? 0 },
    { name: "Slow 25%", wait: waitP?.p75 ?? 0, total: cycleP?.p75 ?? 0 },
    { name: "Slow 10%", wait: waitP?.p90 ?? 0, total: cycleP?.p90 ?? 0 },
    { name: "Slow 1%", wait: waitP?.p99 ?? 0, total: cycleP?.p99 ?? 0 },
  ];
  const pctTooltip = <ChartTooltip valueFormatter={(v) => fmtSeconds(v)} labelFormatter={(l) => PCT_LABELS[String(l)] ?? String(l)} />;
  const activeIntro = TABS.find((t) => t.id === activeTab)!.intro;

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50";

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{ height: collapsed ? "52px" : `${height}px`, maxHeight: "88vh" }}
        className="relative z-40 flex min-h-0 w-full flex-shrink-0 flex-col border-t border-ln-e7e3ff bg-surface/95 shadow-[0_-10px_40px_rgba(87,66,255,0.08)] backdrop-blur-2xl transition-[height] duration-75"
        aria-label="Simulation results"
        role="region"
      >
        {/* ── Resize handle ── */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize results panel"
          aria-valuenow={Math.round(height)}
          aria-valuemin={220}
          aria-valuemax={920}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClickHandle}
          onKeyDown={handleResizeKey}
          className="group absolute -top-2 left-0 right-0 z-50 flex h-4 w-full cursor-row-resize select-none items-center justify-center transition-colors hover:bg-sf-5742ff/10 focus-visible:bg-sf-5742ff/10 focus-visible:outline-none"
          title="Drag (or use arrow keys) to resize • Double-click to toggle height"
        >
          <div className="h-1.5 w-24 rounded-full bg-indigo-200/90 transition-all group-hover:w-36 group-hover:bg-sf-5742ff group-focus-visible:w-36 group-focus-visible:bg-sf-5742ff" />
        </div>

        {/* ── Header ── */}
        <div className="flex h-[52px] shrink-0 select-none items-center justify-between gap-3 border-b border-ln-f1f0fa bg-surface/90 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50"
          >
            <span className="relative flex shrink-0 items-center justify-center">
              {healthScore !== undefined && healthScore < 80 && (
                <span className="absolute inline-flex h-7 w-7 animate-ping rounded-full opacity-30 motion-reduce:animate-none" style={{ background: healthTone.solid }} />
              )}
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: healthTone.tint, color: healthTone.text }}>
                {healthScore === undefined ? <Activity size={16} aria-hidden /> : healthScore >= 80 ? <ShieldCheck size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
              </span>
            </span>
            <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-2">
              <span className="flex items-center gap-1.5 truncate text-[13.5px] font-black tracking-tight text-fg-161622 group-hover:text-fg-4331e0">
                {headline}
                {grade && (
                  <span className="rounded-md px-1.5 py-px text-[10.5px] font-black" style={{ background: healthTone.tint, color: healthTone.text }}>
                    Grade {grade}
                  </span>
                )}
                {result.engine === "legacy" && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-px text-[10px] font-extrabold text-amber-800" title="Calculated with a quick approximation instead of the full simulator">
                    Approximate
                  </span>
                )}
              </span>
              <span className="truncate text-[11.5px] font-semibold text-slate-600 tabular-nums">
                {result.totalCompleted.toLocaleString()} of {result.totalArrived.toLocaleString()} finished ({efficiencyRate}%)
              </span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {!collapsed && (
              <button
                onClick={() => setHeight((h) => (h > 480 ? 420 : 680))}
                className={`${iconBtn} hidden sm:flex`}
                aria-label={height > 480 ? "Make panel shorter" : "Make panel taller"}
                title={height > 480 ? "Compact height" : "Expand height"}
              >
                {height > 480 ? <Minimize2 size={15} /> : <Maximize size={15} />}
              </button>
            )}
            <button
              onClick={onExpand}
              aria-label="Open full analytics"
              className="flex h-8 items-center gap-1.5 rounded-xl border border-ln-8d80ff bg-linear-to-b from-sf-6a57ff to-sf-5742ff px-2.5 text-[12px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(87,66,255,.8)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 focus-visible:ring-offset-2 sm:px-3.5"
            >
              <Maximize2 size={13} aria-hidden />
              <span className="hidden sm:inline">Full analytics</span>
            </button>
            <button onClick={() => setCollapsed((c) => !c)} className={iconBtn} aria-label={collapsed ? "Expand results panel" : "Collapse results panel"} title={collapsed ? "Expand" : "Collapse"}>
              {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            <button onClick={onClose} className={iconBtn} aria-label="Close results" title="Close results">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ── Tabs + intro ── */}
        {!collapsed && (
          <div className="shrink-0 border-b border-ln-f1f0fa bg-sf-faf9ff px-3 py-2 sm:px-5">
            <TabStrip tabs={TABS} value={activeTab} onChange={setActiveTab} layoutId="results-panel-tabs" label="Result sections" />
            <p className="mt-1.5 hidden items-start gap-1.5 text-[12px] leading-snug text-slate-600 sm:flex">
              <Info size={13} className="mt-0.5 shrink-0 text-fg-5742ff" aria-hidden />
              <span>{activeIntro}</span>
            </p>
          </div>
        )}

        {/* ── Content ── */}
        {!collapsed && (
          <div
            className="custom-scrollbar min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden bg-linear-to-b from-sf-faf9ff to-sf-f3f2fc p-3 sm:p-5"
            style={{ overscrollBehavior: "contain" }}
            {...tabPanelProps("results-panel-tabs", activeTab)}
          >
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div
                  key="tab-overview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pb-12"
                >
                  {/* 1. Diagnosis banner */}
                  <div
                    className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-[20px] border p-4 md:flex-row md:items-center"
                    style={{ background: `linear-gradient(100deg, ${healthTone.tint}, var(--color-sf-ffffff) 70%)`, borderColor: healthTone.ring }}
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-sm" style={{ color: healthTone.text }}>
                        {healthScore === undefined ? <Activity size={20} aria-hidden /> : healthScore >= 80 ? <ShieldCheck size={20} aria-hidden /> : <AlertTriangle size={20} aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-black leading-tight text-fg-161622">
                          {result.aiDiagnosis?.title || (healthScore !== undefined && healthScore < 60 ? "Bottleneck detected" : "Run summary")}
                        </h4>
                        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-700">
                          {result.aiDiagnosis?.summary ||
                            `Finished ${result.totalCompleted.toLocaleString()} of ${result.totalArrived.toLocaleString()} ${simConfig.entityName.toLowerCase()}s, ${
                              bottleneck ? `with most of the delay at ${bottleneck.label}` : "and lines cleared smoothly"
                            }.`}
                        </p>
                      </div>
                    </div>
                    {healthScore !== undefined && (
                      <div className="flex shrink-0 items-center gap-3 self-start rounded-2xl border border-surface bg-surface/85 px-4 py-2.5 shadow-sm md:self-auto">
                        <div className="text-right">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Health</div>
                          <div className="text-[22px] font-black leading-none tabular-nums" style={{ color: healthTone.text }}>
                            {healthScore}
                            <span className="text-[12px] font-bold text-slate-500">/100</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. KPI cards */}
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      size="sm"
                      icon={CheckCircle2}
                      tone={efficiencyRate >= 90 ? "good" : efficiencyRate >= 70 ? "warn" : "bad"}
                      label={`${simConfig.entityName}s finished`}
                      value={result.totalCompleted}
                      unit={`/ ${result.totalArrived.toLocaleString()}`}
                      caption={`${efficiencyRate}% done · ${Math.max(0, result.totalArrived - result.totalCompleted).toLocaleString()} still inside`}
                      progress={efficiencyRate}
                      help="How many made it all the way through, out of everyone who arrived."
                    />
                    <MetricCard
                      size="sm"
                      icon={Clock}
                      tone="warn"
                      label="Typical wait in line"
                      value={waitP?.p50 ?? 0}
                      format={fmtSeconds}
                      caption={<>Slowest 5% wait <b className="text-fg-161622">{fmtSeconds(waitP?.p95)}</b>+ · visit {fmtSeconds(cycleP?.p50)}</>}
                      range={waitP && waitP.max > 0 ? { min: 0, max: waitP.max, value: waitP.p50, marker: waitP.p95 } : undefined}
                      help="Half of everyone waited less than this. The bar runs from no wait to the longest wait; the tick marks where the slowest 5% begin."
                      delay={0.04}
                    />
                    <MetricCard
                      size="sm"
                      icon={Flame}
                      tone={bottleneck ? "bad" : "good"}
                      label="Biggest bottleneck"
                      value={bottleneck ? bottleneck.label : "None"}
                      caption={bottleneck ? `${Math.round((bottleneck.utilization || 0) * 100)}% busy · ${fmtSeconds(bottleneck.avgWaitTime)} average wait` : "Every station keeps up"}
                      help="The station holding everything else up the most. Adding capacity here usually helps the whole system."
                      delay={0.08}
                    />
                    {/* AI suggestion: brand-filled so it reads as an action, not a number */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12, duration: 0.4 }}
                      className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-ln-8d80ff bg-linear-to-br from-sf-6a57ff via-sf-5742ff to-sf-4531e5 p-3.5 text-white shadow-[0_18px_40px_-22px_rgba(87,66,255,.9)]"
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1px, transparent 1.5px)", backgroundSize: "16px 16px", maskImage: "linear-gradient(160deg,#000,transparent 70%)", WebkitMaskImage: "linear-gradient(160deg,#000,transparent 70%)" }} />
                      <div className="relative flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15"><Lightbulb size={16} aria-hidden /></span>
                        {aiTop ? (
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-white/80">AI suggestion</span>
                        ) : (
                          <button
                            onClick={askAi}
                            disabled={aiLoading}
                            title="Have the AI optimizer analyse this run (uses credits)"
                            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white/25 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                          >
                            {aiLoading ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
                            {aiLoading ? "Analysing…" : "Ask AI"}
                          </button>
                        )}
                      </div>
                      <h5 className="relative mt-2.5 line-clamp-2 text-[14px] font-black leading-snug">{topRec?.title || "Flow is balanced"}</h5>
                      <p className="relative mt-1 line-clamp-2 text-[12px] leading-snug text-white/85">{topRec?.action || "The current setup keeps up with the arrival rate."}</p>
                      <button
                        onClick={onExpand}
                        className="relative mt-auto flex w-full items-start gap-1 rounded pt-2.5 text-left text-[12px] font-bold text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      >
                        <span className="line-clamp-2 min-w-0">{topRec?.impact ? `Impact: ${topRec.impact}` : "See all suggestions"}</span>
                        <ArrowRight size={13} className="mt-0.5 shrink-0" aria-hidden />
                      </button>
                    </motion.div>
                  </div>

                  {/* Domain KPIs */}
                  {resolvedKpis.length > 0 && (
                    <section aria-labelledby="panel-domain-kpis">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 id="panel-domain-kpis" className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-slate-600">{simConfig.label} metrics</h3>
                        <span className="rounded-full bg-sf-efedff px-2 py-0.5 text-[10.5px] font-bold text-fg-4331e0">{resolvedKpis.length} tracked</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                        {resolvedKpis.map((kpi, idx) => (
                          <MetricCard
                            key={kpi.key + idx}
                            size="sm"
                            icon={TrendingUp}
                            tone="brand"
                            label={kpi.label}
                            value={kpi.displayValue}
                            caption={kpi.series && kpi.series.length > 0 ? kpi.series.map((s) => `${s.name}: ${s.value}`).join(" · ") : kpi.unit || undefined}
                            delay={idx * 0.03}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 3. Station pipeline */}
                  <section aria-labelledby="panel-pipeline" className="rounded-[20px] border border-ln-ecebf7 bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers size={15} className="text-fg-5742ff" aria-hidden />
                        <h3 id="panel-pipeline" className="text-[12.5px] font-black uppercase tracking-wider text-fg-161622">Station pipeline</h3>
                      </div>
                      <ul className="flex flex-wrap items-center gap-3 text-[11.5px] font-semibold text-slate-600">
                        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TONES.good.solid }} aria-hidden /> Smooth (&lt;60% busy)</li>
                        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TONES.warn.solid }} aria-hidden /> Busy (60–85%)</li>
                        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TONES.bad.solid }} aria-hidden /> Jammed (&gt;85%)</li>
                      </ul>
                    </div>

                    <ol className="custom-scrollbar flex items-stretch gap-2 overflow-x-auto pb-2">
                      <li className="flex shrink-0 items-center gap-2">
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-center">
                          <span className="block text-[10.5px] font-black uppercase tracking-wider text-sky-800">Arrivals</span>
                          <span className="text-[14px] font-black tabular-nums text-fg-161622">{result.totalArrived.toLocaleString()}</span>
                        </div>
                        <ArrowRight size={15} className="shrink-0 text-indigo-300" aria-hidden />
                      </li>

                      {statsEntries.map(([id, s], i) => {
                        const isServer = ["resource", "priority_resource", "service"].includes(s.nodeType);
                        const isWaitingNode = ["queue", "store"].includes(s.nodeType);
                        // "% busy" only means something for servers; queues are judged by how many are stuck in them.
                        const util = isServer && s.utilization !== undefined ? Math.round(s.utilization * 100) : null;
                        const backlog = s.currentDepth ?? 0;
                        const isChoke = result.bottleneckNodeId === id;
                        const severity: "bad" | "warn" | "ok" | "none" =
                          isServer && util !== null
                            ? util > 85 ? "bad" : util > 60 ? "warn" : "ok"
                            : isWaitingNode
                            ? backlog >= 50 ? "bad" : backlog >= 10 ? "warn" : "ok"
                            : "none";
                        const tone = severity === "bad" ? TONES.bad : severity === "warn" ? TONES.warn : severity === "ok" ? TONES.good : TONES.neutral;

                        const headlineText = isServer
                          ? util !== null ? `${util}% busy` : "Server"
                          : isWaitingNode
                          ? `${backlog.toLocaleString()} still waiting`
                          : s.nodeType === "source"
                          ? `${(s.entitiesOut ?? 0).toLocaleString()} sent`
                          : s.nodeType === "sink"
                          ? `${(s.entitiesIn ?? 0).toLocaleString()} received`
                          : "Router";

                        return (
                          <li key={id} className="flex shrink-0 items-center gap-2">
                            <div
                              className={`min-w-[148px] rounded-2xl border px-3.5 py-2.5 text-center transition-shadow hover:shadow-[0_10px_24px_-14px_var(--ring)] ${isChoke ? "ring-2 ring-rose-400/40" : ""}`}
                              style={{ background: severity === "none" ? "var(--color-sf-f8fafc)" : tone.tint, borderColor: severity === "none" ? "var(--color-ln-e2e8f0)" : tone.ring, ["--ring" as string]: tone.ring }}
                            >
                              <div className="mb-0.5 flex items-center justify-center gap-1.5">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.solid }} aria-hidden />
                                <span className="max-w-[118px] truncate text-[12.5px] font-black text-fg-161622" title={s.label}>{s.label}</span>
                              </div>
                              <div className="text-[11.5px] font-extrabold" style={{ color: severity === "none" ? "var(--color-fg-475569)" : tone.text }}>{headlineText}</div>
                              {/* Only steps where people actually queue have a "line"; arrival/exit/router don't. */}
                              {(isServer || isWaitingNode) && <div className="mt-0.5 text-[11px] font-medium text-slate-600" title="Average wait of those who got served; anyone still in line at the end isn't counted">{fmtSeconds(s.avgWaitTime ?? 0)} avg wait</div>}
                              {/* A server's depth is in service + waiting; the waiting part is the backlog left at the end of the run. */}
                              {isServer && backlog > (s.capacity ?? 1) && (
                                <div className="mt-0.5 text-[11px] font-bold" style={{ color: tone.text }}>{(backlog - (s.capacity ?? 1)).toLocaleString()} still in line</div>
                              )}
                            </div>
                            {i < statsEntries.length - 1 && <ArrowRight size={15} className="shrink-0 text-indigo-300" aria-hidden />}
                          </li>
                        );
                      })}

                      <li className="flex shrink-0 items-center gap-2">
                        <ArrowRight size={15} className="shrink-0 text-indigo-300" aria-hidden />
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center">
                          <span className="block text-[10.5px] font-black uppercase tracking-wider text-emerald-800">Finished</span>
                          <span className="text-[14px] font-black tabular-nums text-fg-161622">{result.totalCompleted.toLocaleString()}</span>
                        </div>
                      </li>
                    </ol>
                  </section>

                  {/* 4. Charts */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ChartCard
                      icon={TrendingUp}
                      title="Load inside over time"
                      description="Flat = steady flow. A rise that never falls = lines backing up."
                      actions={<span className="rounded-md bg-sf-efedff px-2 py-0.5 text-[11px] font-bold tabular-nums text-fg-4331e0">Peak {maxWip.toLocaleString()}</span>}
                      height={190}
                      empty={wipChartData.length === 0}
                      emptyTitle="No timeline recorded"
                      emptyHint="Try a longer simulation time."
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={wipChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="panel-wip-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-sf-5742ff)" stopOpacity={0.34} />
                              <stop offset="100%" stopColor="var(--color-sf-5742ff)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...GRID} />
                          <XAxis dataKey="simTime" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtSeconds} tickCount={5} {...AXIS} />
                          <YAxis {...AXIS} domain={[0, niceMax]} allowDecimals={false} tickFormatter={fmtCount} width={40} />
                          <Tooltip
                            cursor={{ stroke: "var(--color-sf-5742ff)", strokeWidth: 1, strokeDasharray: "4 4" }}
                            content={<ChartTooltip labelFormatter={(l) => `At ${fmtSeconds(Number(l))}`} valueFormatter={(v) => `${Math.round(v).toLocaleString()} inside`} />}
                          />
                          {avgWip !== undefined && avgWip > 0 && (
                            <ReferenceLine y={avgWip} stroke="var(--color-ln-475569)" strokeDasharray="5 4" label={{ value: "avg", position: "insideTopRight", fill: "var(--color-fg-475569)", fontSize: 10.5, fontWeight: 700 }} />
                          )}
                          <Area type="monotone" dataKey="wip" name="Inside now" stroke="var(--color-sf-5742ff)" strokeWidth={2.5} fill="url(#panel-wip-grad)" dot={false} activeDot={{ r: 5, fill: "var(--color-sf-5742ff)", stroke: "var(--color-sf-ffffff)", strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard
                      icon={Timer}
                      title="Wait time: typical to worst case"
                      description="Left is a quick visit, right is the unlucky 1%. The gap shows how uneven the experience is."
                      legend={[
                        { label: "Total visit", color: "var(--color-sf-5742ff)" },
                        { label: "Waiting in line", color: "var(--color-sf-e69f00)", dashed: chartViewMode === "curve" },
                      ]}
                      actions={
                        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5" role="group" aria-label="Chart style">
                          {([["curve", LineChartIcon, "Show as curve"], ["bars", BarChart2, "Show as bars"]] as const).map(([mode, Icon, lbl]) => (
                            <button
                              key={mode}
                              onClick={() => setChartViewMode(mode)}
                              aria-label={lbl}
                              aria-pressed={chartViewMode === mode}
                              title={lbl}
                              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 ${chartViewMode === mode ? "bg-surface text-fg-4331e0 shadow-sm dark:bg-white/10" : "text-slate-500 hover:text-slate-900"}`}
                            >
                              <Icon size={14} />
                            </button>
                          ))}
                        </div>
                      }
                      height={190}
                      empty={!waitP && !cycleP}
                      emptyTitle="No wait times recorded"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        {chartViewMode === "curve" ? (
                          <AreaChart data={percentileData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id="panel-pct-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-sf-5742ff)" stopOpacity={0.32} />
                                <stop offset="100%" stopColor="var(--color-sf-5742ff)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID} />
                            <XAxis dataKey="name" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: 10.5 }} />
                            <YAxis {...AXIS} domain={[0, niceMaxFloat]} tickFormatter={fmtSeconds} width={50} />
                            <Tooltip cursor={{ stroke: "var(--color-sf-5742ff)", strokeWidth: 1, strokeDasharray: "4 4" }} content={pctTooltip} />
                            <Area type="monotone" dataKey="total" name="Total visit" stroke="var(--color-sf-5742ff)" strokeWidth={2.5} fill="url(#panel-pct-grad)" activeDot={{ r: 5, fill: "var(--color-sf-5742ff)", stroke: "var(--color-sf-ffffff)", strokeWidth: 2 }} />
                            <Area type="monotone" dataKey="wait" name="Waiting in line" stroke="var(--color-sf-e69f00)" strokeWidth={2} fill="none" strokeDasharray="5 4" />
                          </AreaChart>
                        ) : (
                          <BarChart data={percentileData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
                            <defs>
                              <linearGradient id="panel-bar-total" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-sf-6a57ff)" />
                                <stop offset="100%" stopColor="var(--color-sf-5742ff)" stopOpacity={0.75} />
                              </linearGradient>
                              <linearGradient id="panel-bar-wait" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-sf-f2b440)" />
                                <stop offset="100%" stopColor="var(--color-sf-e69f00)" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID} />
                            <XAxis dataKey="name" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: 10.5 }} />
                            <YAxis {...AXIS} domain={[0, niceMaxFloat]} tickFormatter={fmtSeconds} width={50} />
                            <Tooltip cursor={{ fill: "rgba(87,66,255,0.05)" }} content={pctTooltip} />
                            <Bar dataKey="wait" name="Waiting in line" fill="url(#panel-bar-wait)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                            <Bar dataKey="total" name="Total visit" fill="url(#panel-bar-total)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </motion.div>
              )}

              {activeTab === "analytics" && (
                <motion.div key="tab-analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                  <DeepAnalyticsTab result={result} simType={simType} />
                </motion.div>
              )}
              {activeTab === "timeline" && (
                <motion.div key="tab-timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                  <TimelineTab result={result} />
                </motion.div>
              )}
              {activeTab === "blocks" && (
                <motion.div key="tab-blocks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                  <BlocksTab result={result} />
                </motion.div>
              )}
              {activeTab === "entities" && (
                <motion.div key="tab-entities" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                  <EntityTracerTab result={result} simType={simType} />
                </motion.div>
              )}
              {activeTab === "logs" && (
                <motion.div key="tab-logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-12">
                  <LogsTab result={result} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
