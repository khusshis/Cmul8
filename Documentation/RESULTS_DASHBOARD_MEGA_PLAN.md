# JustCmul8 — Advanced Results Dashboard: Mega Implementation Plan

**Prepared for:** Antigravity, executing sequentially, one numbered step at a time.
**Scope:** Upgrade simulation results from the current compact bottom strip into a full, advanced, animated "Results Dashboard" — while keeping the compact strip as a fast at-a-glance view. This plan follows the same execution discipline as `MEGA_IMPLEMENTATION_PLAN.md`: read the real current code first, never invent library choices without checking what's already installed, ship in small verifiable increments.

---

## 0. Ground truth — what exists today, and the library decision

I read the live file `src/components/workspace/SimResultsPanel.tsx` (237 lines, this is the version already built in the previous plan's Task 3.1 — domain-aware `kpiMetrics`-driven charts, confirmed working, zero regressions). This file is **not being replaced** — it stays exactly as-is as the fast "glance strip" docked at the bottom of the workspace. This plan adds a second, richer view on top of it: a full-screen **Advanced Results Dashboard** opened on demand.

**Library decision — do not add new chart/animation dependencies.** Checked `package.json`:
```
"recharts": "^3.9.2"
"framer-motion": "^12.42.2"
```
Both are already installed and already modern (Recharts 3.x supports `AreaChart`, `ComposedChart`, `RadialBarChart`, `Treemap`, stacked series, and built-in per-series animation via `isAnimationActive`/`animationDuration`/`animationEasing`; Framer Motion 12 covers every entrance/stagger/counter animation this plan needs). Adding a second charting library (Nivo, Visx, Chart.js) or a counter library (`react-countup`) would duplicate capability already present and bloat the bundle for no visible gain — this plan builds the "advanced" feel entirely from these two libraries plus one small hand-written hook (`useCountUp`, ~15 lines, Task 1.2). Do not deviate from this without flagging it first, per the project's operating loop.

**Data already available, unused today** — this plan's "advanced" feel comes largely from finally visualizing data the engine already produces but the compact panel never shows:
- `SimResult.timeline: Array<{ simTime: number; completed: number; depth: Record<string, number> }>` (`types.ts`) — a full time series of throughput and per-node queue depth over the whole run. **Currently rendered nowhere.** This becomes the Timeline tab (Phase 3).
- `SimResult.logs: SimLog[]` (`types.ts` line 272+, fields `simTime`, `entityId`, `nodeId`, `nodeLabel`, `event`) — a full discrete-event log. **Currently rendered nowhere.** This becomes the Logs tab (Phase 3).
- `NodeStats.breakdownCount`, `totalDowntime`, `renegeCount`, `droppedCount`, `lateCount`, `avgLatency` — domain-specific stats already computed by the engine, already declared in `kpiMetrics` registry entries for the domains that use them (vehicle breakdowns, network drops, etc.), but the current compact panel only ever renders whatever chart types the metric declares (bar/line/pie/kpi_card) at small size — this plan's Blocks tab (Phase 3) surfaces every stat field per block, not just the ones with a registry chart entry.

**Where this plugs in:** `src/app/dashboard/project/[id]/page.tsx` line 584 renders `<SimResultsPanel result={simResult} simType={...} onClose={...} />`. This plan adds one new prop (`onExpand`) to that component and one new sibling component (`AdvancedResultsDashboard`) rendered alongside it, opened by a new button inside the compact panel's header.

---

## Phase 1: Data Layer & Shared Utilities

### Task 1.1 — Export a shared chart-data builder (currently private to the compact panel)

**File:** `src/components/workspace/SimResultsPanel.tsx`

Step 1. The `buildChartData` function (current lines 42–56) is presently a local, unexported function. The new dashboard needs the exact same metric→chart-data mapping logic (so the compact strip and the full dashboard never disagree about what a chart shows). Change its declaration from `function buildChartData(...)` to `export function buildChartData(...)`. Do not change its internal logic — it's already correct (confirmed working from the prior plan's Task 3.1 regression check).
Step 2. No other change to this file in this task. The dashboard trigger button is added in Phase 4, once the dashboard itself exists.

### Task 1.2 — Animated count-up hook

**New file:** `src/lib/hooks/useCountUp.ts`

Step 1. Create:
```ts
"use client";
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, durationMs = 900, decimals = 0): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf: number;

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = fromRef.current + (target - fromRef.current) * eased;
      setValue(parseFloat(current.toFixed(decimals)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, decimals]);

  return value;
}
```
Step 2. This hook animates **from whatever the value currently is** to the new `target` whenever `target` changes (via `fromRef` capturing the last rendered `value`) — so if a user re-runs a simulation and the dashboard is already open, numbers animate from their old value to the new one instead of resetting to 0 first. This is a deliberate UX choice: resetting to zero on every re-render would look broken on live updates, not "advanced."
Step 3. Ease-out cubic (`1 - Math.pow(1 - progress, 3)`) is used instead of linear so the count-up decelerates near the target — this is the standard "premium" counter feel; do not swap to linear.

### Task 1.3 — Chart data selectors for the Timeline tab

**New file:** `src/lib/simulation/timelineSelectors.ts`

Step 1. Create:
```ts
import type { SimResult } from "./types";

export interface ThroughputPoint {
  simTime: number;
  completed: number;
  completedPerMin: number;
}

export function buildThroughputSeries(result: SimResult): ThroughputPoint[] {
  const { timeline } = result;
  return timeline.map((point, i) => {
    const prev = timeline[i - 1];
    const dt = prev ? point.simTime - prev.simTime : point.simTime;
    const dCompleted = prev ? point.completed - prev.completed : point.completed;
    return {
      simTime: Math.round(point.simTime),
      completed: point.completed,
      completedPerMin: dt > 0 ? parseFloat(((dCompleted / dt) * 60).toFixed(2)) : 0,
    };
  });
}

export interface DepthSeriesPoint {
  simTime: number;
  [nodeLabel: string]: number;
}

export function buildDepthSeries(result: SimResult): { series: DepthSeriesPoint[]; nodeLabels: string[] } {
  const labelByNodeId: Record<string, string> = {};
  for (const [id, stat] of Object.entries(result.nodeStats)) {
    labelByNodeId[id] = stat.label;
  }
  const nodeLabelSet = new Set<string>();
  const series: DepthSeriesPoint[] = result.timeline.map((point) => {
    const row: DepthSeriesPoint = { simTime: Math.round(point.simTime) };
    for (const [nodeId, depth] of Object.entries(point.depth)) {
      const label = labelByNodeId[nodeId] || nodeId;
      nodeLabelSet.add(label);
      row[label] = depth;
    }
    return row;
  });
  return { series, nodeLabels: Array.from(nodeLabelSet) };
}
```
Step 2. `buildThroughputSeries` derives a "completed per minute" rate from the cumulative `completed` counter already in `timeline` — this is a new derived metric, not stored anywhere, giving the Timeline tab both a cumulative curve and a rate curve from the same source data.
Step 3. `buildDepthSeries` reshapes `timeline[].depth` (a `Record<nodeId, number>`) into a wide format keyed by **label**, not raw `nodeId` — required because Recharts' stacked `<Area>`/`<Line>` series need one `dataKey` per named line, and raw node IDs (`node_3`) would be unreadable in a legend. This is exactly why `labelByNodeId` is built first.

---

## Phase 2: Dashboard Shell & Navigation

### Task 2.1 — Full-screen dashboard shell component

**New file:** `src/components/workspace/AdvancedResultsDashboard.tsx`

Step 1. Create the shell (tabs + entrance animation + close button), with placeholder tab bodies to be filled in by Phase 3's tasks:
```tsx
"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LayoutGrid, TrendingUp, Table2, ScrollText, Download } from "lucide-react";
import type { SimResult } from "@/lib/simulation/types";
import type { SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import OverviewTab from "./results-dashboard/OverviewTab";
import TimelineTab from "./results-dashboard/TimelineTab";
import BlocksTab from "./results-dashboard/BlocksTab";
import LogsTab from "./results-dashboard/LogsTab";

export type DashboardTab = "overview" | "timeline" | "blocks" | "logs";

const TABS: { id: DashboardTab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "timeline", label: "Timeline", icon: TrendingUp },
  { id: "blocks", label: "Blocks", icon: Table2 },
  { id: "logs", label: "Event Log", icon: ScrollText },
];

export default function AdvancedResultsDashboard({
  open, onClose, result, simType, projectId,
}: {
  open: boolean;
  onClose: () => void;
  result: SimResult | null;
  simType: SimTypeId;
  projectId: string;
}) {
  const [tab, setTab] = useState<DashboardTab>("overview");
  const simConfig = SIM_TYPE_REGISTRY[simType];

  if (!result) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full h-full max-w-[1400px] bg-[var(--color-bg)] rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-4 px-6 h-[68px] bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <div>
                <h1 className="text-[16px] font-extrabold text-[var(--color-text-primary)] tracking-tight leading-tight">
                  Simulation Results
                </h1>
                <p className="text-[11.5px] text-[var(--color-text-secondary)] leading-tight">
                  {simConfig.label} • {result.totalSimTime.toFixed(1)}s simulated
                </p>
              </div>
              <div className="flex-1" />

              {/* Tab switcher */}
              <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] rounded-full p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="relative px-4 py-2 rounded-full text-[12.5px] font-bold flex items-center gap-1.5 transition-colors"
                    style={{ color: tab === t.id ? "var(--color-surface)" : "var(--color-text-secondary)" }}
                  >
                    {tab === t.id && (
                      <motion.div
                        layoutId="dashboard-tab-pill"
                        className="absolute inset-0 rounded-full bg-[var(--color-text-primary)]"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <t.icon size={13} className="relative z-10" />
                    <span className="relative z-10">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="w-px h-8 bg-[var(--color-border)] mx-1" />

              <a
                href={`/api/projects/${projectId}/export?format=csv`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--color-border)] text-[12.5px] font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Download size={13} /> Export
              </a>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="p-6"
                >
                  {tab === "overview" && <OverviewTab result={result} simType={simType} />}
                  {tab === "timeline" && <TimelineTab result={result} />}
                  {tab === "blocks" && <BlocksTab result={result} />}
                  {tab === "logs" && <LogsTab result={result} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```
Step 2. Note the `layoutId="dashboard-tab-pill"` on the active tab's background — this is Framer Motion's shared-layout animation: switching tabs makes the dark pill **slide** from the old active tab to the new one instead of just appearing/disappearing. This is one of the highest-value, lowest-effort "advanced feel" animations in this whole plan; do not simplify it into a plain conditional class.
Step 3. Create the new subfolder `src/components/workspace/results-dashboard/` — all four tab components (Phase 3's Tasks 3.1–3.4) live here, keeping `AdvancedResultsDashboard.tsx` itself as a thin shell rather than one giant file.
Step 4. This component intentionally duplicates the "fixed inset-0, backdrop-blur, spring entrance" pattern from `src/components/ui/Modal.tsx` rather than extending `Modal` to support full-screen mode — `Modal` is deliberately kept as a small, centered dialog primitive (used by `ShareExportModal`), and this dashboard is a distinct, full-viewport "workspace" surface with its own header/tab-bar chrome that doesn't fit `Modal`'s title-bar-plus-content shape. Do not refactor `Modal.tsx` to add a `fullScreen` prop for this — that would couple two components with genuinely different jobs.

---

## Phase 3: The Four Tabs

### Task 3.1 — Overview tab: animated hero KPIs + domain-aware metric grid + bottleneck spotlight

**New file:** `src/components/workspace/results-dashboard/OverviewTab.tsx`

Step 1. Create:
```tsx
"use client";
import React from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle2, Gauge, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend, LineChart, Line,
} from "recharts";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { buildChartData } from "../SimResultsPanel";
import { useCountUp } from "@/lib/hooks/useCountUp";

const THEME_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5"];

function HeroStat({ icon: Icon, label, value, decimals = 0, suffix = "", color, delay }: {
  icon: any; label: string; value: number; decimals?: number; suffix?: string; color: string; delay: number;
}) {
  const animated = useCountUp(value, 1000, decimals);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] p-5 flex flex-col gap-3"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
        <Icon size={17} />
      </div>
      <div>
        <div className="text-[26px] font-extrabold text-[var(--color-text-primary)] leading-none tabular-nums">
          {animated}{suffix}
        </div>
        <div className="text-[11.5px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mt-1.5">{label}</div>
      </div>
    </motion.div>
  );
}

export default function OverviewTab({ result, simType }: { result: SimResult; simType: SimTypeId }) {
  const simConfig = SIM_TYPE_REGISTRY[simType];
  const statsEntries = Object.entries(result.nodeStats);
  const efficiencyRate = result.totalArrived > 0 ? Math.round((result.totalCompleted / result.totalArrived) * 100) : 0;

  const utilizationEntries = statsEntries.filter(([, s]) => s.utilization !== undefined);
  const avgUtilization = utilizationEntries.length > 0
    ? Math.round((utilizationEntries.reduce((sum, [, s]) => sum + (s.utilization ?? 0), 0) / utilizationEntries.length) * 100)
    : 0;

  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;

  return (
    <div className="space-y-6">
      {/* Hero KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeroStat icon={Users} label={`${simConfig.entityName}s Arrived`} value={result.totalArrived} color="var(--color-info)" delay={0} />
        <HeroStat icon={CheckCircle2} label={`${simConfig.entityName}s Completed`} value={result.totalCompleted} color="var(--color-success)" delay={0.05} />
        <HeroStat icon={Gauge} label="Efficiency" value={efficiencyRate} suffix="%" color="var(--color-warning)" delay={0.1} />
        <HeroStat icon={Gauge} label="Avg Utilization" value={avgUtilization} suffix="%" color="var(--color-accent)" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bottleneck spotlight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-[var(--radius-card)] p-5 flex flex-col items-center text-center gap-3 relative overflow-hidden"
          style={{ background: bottleneck ? "var(--color-accent-soft)" : "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          {bottleneck && (
            <motion.div
              className="absolute inset-0 rounded-[var(--radius-card)]"
              style={{ boxShadow: "0 0 0 0 var(--color-error)" }}
              animate={{ boxShadow: ["0 0 0 0 rgba(217,70,63,0.25)", "0 0 0 14px rgba(217,70,63,0)"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <AlertTriangle size={22} className="text-[var(--color-error)] relative z-10" />
          <div className="relative z-10">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-error)]">Bottleneck</div>
            <div className="text-[15px] font-extrabold text-[var(--color-text-primary)] mt-1">
              {bottleneck ? bottleneck.label : "None detected"}
            </div>
            {bottleneck && (
              <div className="text-[12px] text-[var(--color-text-secondary)] mt-1">
                {Math.round((bottleneck.utilization ?? 0) * 100)}% utilized · {bottleneck.avgWaitTime.toFixed(1)}s avg wait
              </div>
            )}
          </div>
          {bottleneck && (
            <div className="w-24 h-24 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: Math.round((bottleneck.utilization ?? 0) * 100) }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" fill="var(--color-error)" cornerRadius={8} background={{ fill: "var(--color-surface)" }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Domain-aware metric grid — reuses the exact same builder as the compact panel */}
        {simConfig.kpiMetrics.filter((m) => m.chartType !== "kpi_card").slice(0, 2).map((metric, i) => {
          const data = buildChartData(metric, statsEntries as any);
          if (data.length === 0) return null;
          return (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              className="rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] p-4 flex flex-col"
            >
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-2">
                {metric.label} ({metric.unit})
              </div>
              <div className="flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={700} animationEasing="ease-out">
                      {data.map((_, idx) => <Cell key={idx} fill={THEME_COLORS[idx % THEME_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```
Step 2. `HeroStat` calling `useCountUp` per card means each of the four hero numbers animates independently and staggers in via the `delay` prop (0, 0.05, 0.1, 0.15s) — combined with the entrance `y: 14 → 0` motion, this reads as a deliberate cascading reveal rather than four numbers popping in at once.
Step 3. The bottleneck card's pulsing `boxShadow` animation (`animate={{ boxShadow: [...] }}, repeat: Infinity`) is a CSS box-shadow "sonar ping" — cheap to render (no layout thrash, pure paint), and only rendered when a bottleneck actually exists (`{bottleneck && (...)}`), so a healthy simulation with no bottleneck shows a calm, static "None detected" card instead of a pointless animation.
Step 4. The radial gauge (`RadialBarChart` with `innerRadius="70%" outerRadius="100%"`, `startAngle={90} endAngle={-270}`) draws a circular progress ring for the bottleneck's utilization — this is the one clearly "new visual language" element that distinguishes the advanced dashboard from the compact strip's flat bars.
Step 5. Note the import `import { buildChartData } from "../SimResultsPanel";` — this depends on Task 1.1's export having landed first. Do not attempt this task before Task 1.1.

### Task 3.2 — Timeline tab: throughput area chart + stacked queue-depth chart

**New file:** `src/components/workspace/results-dashboard/TimelineTab.tsx`

Step 1. Create:
```tsx
"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { SimResult } from "@/lib/simulation/types";
import { buildThroughputSeries, buildDepthSeries } from "@/lib/simulation/timelineSelectors";

const SERIES_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5", "#db2777", "#059669"];

export default function TimelineTab({ result }: { result: SimResult }) {
  const throughput = buildThroughputSeries(result);
  const { series: depthSeries, nodeLabels } = buildDepthSeries(result);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] p-5"
      >
        <div className="text-[12px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">
          Cumulative Completions
        </div>
        <p className="text-[11.5px] text-[var(--color-text-secondary)] mb-4">
          How many entities finished the process, over the course of the simulated run.
        </p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughput} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="simTime" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} label={{ value: "Sim time (s)", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--color-text-secondary)" }} />
              <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="completed" stroke="var(--color-info)" strokeWidth={2.5} fill="url(#completedGradient)" animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] p-5"
      >
        <div className="text-[12px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">
          Queue Depth Over Time
        </div>
        <p className="text-[11.5px] text-[var(--color-text-secondary)] mb-4">
          How full each waiting line / buffer was at every point in the run — spikes reveal exactly when congestion happened.
        </p>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={depthSeries} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="simTime" tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {nodeLabels.map((label, i) => (
                <Area
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stackId="depth"
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fillOpacity={0.5}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
```
Step 2. The gradient `<linearGradient id="completedGradient">` fading from 35% to 0% opacity is what gives the throughput chart its "modern SaaS dashboard" look (soft area fill rather than a flat solid block) — this specific fade pattern should be reused if any future chart in this dashboard needs an area fill; don't invent a second gradient id naming scheme.
Step 3. The queue-depth chart uses `stackId="depth"` on every `<Area>` so multiple queues render as a single stacked area (total congestion at a glance) rather than overlapping/occluding each other — this only makes sense when queue depths are meaningfully additive (they are, since they represent physically distinct waiting lines); do not stack unrelated metrics this way elsewhere.
Step 4. If `result.timeline` is empty (an edge case — e.g., a simulation that completes instantly with `tickIntervalSeconds` never firing), both charts should render an empty state instead of a blank chart canvas. Add a guard at the top of the component: `if (throughput.length === 0) return <EmptyState message="No timeline data was recorded for this run." />;` — build this tiny `EmptyState` inline in the same file (icon + centered gray text, no need for a separate file for one 6-line component), then skip rendering both chart cards.

### Task 3.3 — Blocks tab: sortable, searchable, sparkline-enhanced table

**New file:** `src/components/workspace/results-dashboard/BlocksTab.tsx`

Step 1. Create:
```tsx
"use client";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SimResult } from "@/lib/simulation/types";
import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";

type SortKey = "label" | "nodeType" | "entitiesIn" | "entitiesOut" | "utilization" | "avgWaitTime";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "label", label: "Block" },
  { key: "nodeType", label: "Type" },
  { key: "entitiesIn", label: "In" },
  { key: "entitiesOut", label: "Out" },
  { key: "utilization", label: "Util %" },
  { key: "avgWaitTime", label: "Avg Wait" },
];

export default function BlocksTab({ result }: { result: SimResult }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("utilization");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    let entries = Object.entries(result.nodeStats);
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(([, s]) => s.label.toLowerCase().includes(q) || s.nodeType.toLowerCase().includes(q));
    }
    entries.sort(([, a], [, b]) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return entries;
  }, [result.nodeStats, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full pl-9 pr-3 py-2 rounded-full border border-[var(--color-border)] text-[13px] bg-[var(--color-bg)] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
        <span className="text-[11.5px] text-[var(--color-text-secondary)]">{rows.length} block{rows.length !== 1 ? "s" : ""}</span>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {COLUMNS.map((col) => (
              <th key={col.key} className="text-left font-bold py-2.5 px-4 text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors" onClick={() => toggleSort(col.key)}>
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, s], i) => {
            const isBottleneck = result.bottleneckNodeId === id;
            const util = s.utilization !== undefined ? Math.round(s.utilization * 100) : null;
            return (
              <motion.tr
                key={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                style={{ background: isBottleneck ? "var(--color-accent-soft)" : undefined }}
              >
                <td className="py-2.5 px-4 font-bold text-[var(--color-text-primary)]">
                  {s.label}
                  {isBottleneck && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-error)] text-white">BOTTLENECK</span>}
                </td>
                <td className="py-2.5 px-4 text-[var(--color-text-secondary)]">{NODE_LABELS[s.nodeType as any] || s.nodeType}</td>
                <td className="py-2.5 px-4 font-mono text-[var(--color-info)]">{s.entitiesIn}</td>
                <td className="py-2.5 px-4 font-mono text-[var(--color-success)]">{s.entitiesOut}</td>
                <td className="py-2.5 px-4">
                  {util !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: util > 80 ? "var(--color-error)" : util > 50 ? "var(--color-warning)" : "var(--color-success)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${util}%` }}
                          transition={{ duration: 0.6, delay: Math.min(i * 0.03, 0.4) }}
                        />
                      </div>
                      <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{util}%</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="py-2.5 px-4 font-mono text-[var(--color-text-secondary)]">{s.avgWaitTime ? `${s.avgWaitTime.toFixed(1)}s` : "—"}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```
Step 2. The utilization column renders as an inline animated progress bar (`motion.div` width animating from 0 to `${util}%`) rather than plain text — this is the single highest-impact "easy to read at a glance" upgrade over the compact panel's plain-text percentage, since a bar makes relative comparison across rows immediate without reading numbers.
Step 3. Row entrance stagger is capped at `Math.min(i * 0.03, 0.4)` seconds — for simulations with many blocks (20+), an uncapped per-row stagger would make the table take multiple seconds to finish appearing, which reads as slow rather than polished; capping at 400ms total means even a 50-row table finishes its entrance quickly.
Step 4. Sorting defaults to `utilization` descending on first render — the single most useful default sort for spotting problem blocks immediately, matching this dashboard's stated goal of being "easy to read."

### Task 3.4 — Event Log tab: filterable, color-coded log feed

**New file:** `src/components/workspace/results-dashboard/LogsTab.tsx`

Step 1. Create:
```tsx
"use client";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SimResult, SimLog } from "@/lib/simulation/types";

const EVENT_COLORS: Record<string, string> = {
  arrived: "var(--color-info)",
  queued: "var(--color-warning)",
  completed: "var(--color-success)",
  renege: "var(--color-error)",
  breakdown: "var(--color-error)",
  dropped: "var(--color-error)",
};

function colorFor(event: string): string {
  return EVENT_COLORS[event] || "var(--color-text-secondary)";
}

const PAGE_SIZE = 100;

export default function LogsTab({ result }: { result: SimResult }) {
  const [filter, setFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const eventTypes = useMemo(() => Array.from(new Set(result.logs.map((l) => l.event))), [result.logs]);
  const filtered = useMemo(
    () => (filter === "all" ? result.logs : result.logs.filter((l) => l.event === filter)),
    [result.logs, filter]
  );
  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className="px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors"
          style={{
            background: filter === "all" ? "var(--color-text-primary)" : "var(--color-surface)",
            color: filter === "all" ? "var(--color-surface)" : "var(--color-text-secondary)",
            borderColor: "var(--color-border)",
          }}
        >
          All ({result.logs.length})
        </button>
        {eventTypes.map((ev) => (
          <button
            key={ev}
            onClick={() => setFilter(ev)}
            className="px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors flex items-center gap-1.5"
            style={{
              background: filter === ev ? colorFor(ev) : "var(--color-surface)",
              color: filter === ev ? "white" : "var(--color-text-secondary)",
              borderColor: "var(--color-border)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: filter === ev ? "white" : colorFor(ev) }} />
            {ev} ({result.logs.filter((l) => l.event === ev).length})
          </button>
        ))}
      </div>

      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto divide-y divide-[var(--color-border)]">
          {visible.map((log, i) => (
            <motion.div
              key={`${log.simTime}-${log.entityId}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.008, 0.3) }}
              className="flex items-center gap-3 px-4 py-2 text-[12.5px] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <span className="font-mono text-[var(--color-text-secondary)] w-16 flex-shrink-0">{log.simTime.toFixed(1)}s</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorFor(log.event) }} />
              <span className="font-bold flex-shrink-0" style={{ color: colorFor(log.event) }}>{log.event}</span>
              <span className="text-[var(--color-text-secondary)]">entity #{log.entityId}</span>
              <span className="text-[var(--color-text-secondary)]">→</span>
              <span className="font-medium text-[var(--color-text-primary)]">{log.nodeLabel}</span>
            </motion.div>
          ))}
        </div>
        {filtered.length > visibleCount && (
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="w-full py-3 text-[12.5px] font-bold text-[var(--color-accent)] hover:bg-[var(--color-surface-sunken)] transition-colors border-t border-[var(--color-border)]"
          >
            Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more of {filtered.length}
          </button>
        )}
      </div>
    </div>
  );
}
```
Step 2. **This is a "load more" pager, not a virtualized list** — for typical simulation runs (hundreds to low thousands of log entries) this is sufficient and far simpler than pulling in a virtualization library. If real usage shows logs regularly exceeding ~5,000 entries and the "Load more" button becomes a bad experience (very large `filtered.length`), that's the trigger to revisit with `react-window` — do not pre-emptively add virtualization now; that would be solving a problem not yet observed. Note this explicitly in the module doc (Task 4.4) as a known, deliberate scaling limit.
Step 3. `visibleCount` resets are not wired to `filter` changes in this version — switching filters keeps whatever `visibleCount` was already reached. This is intentional: if a user has loaded 300 rows of "all" and switches to a filter with only 40 matching rows, they see all 40 immediately rather than being reset to a 100-row cap that would hide nothing anyway (`visible = filtered.slice(0, visibleCount)` already naturally shows everything when `filtered.length < visibleCount`). No extra reset logic needed.
Step 4. Colors are looked up from a small `EVENT_COLORS` map with a sensible fallback (`var(--color-text-secondary)`) for any event name not explicitly listed — `SimLog.event` has more variants than the 6 mapped here (check the full union type at `types.ts` line 277+ for the complete list, e.g. `"broke_down"`, `"repaired"`, `"interrupted"` etc. depending on exact naming); do not treat an unmapped event as a bug, the fallback gray is the correct default for lower-priority event types that don't need their own color.

---

## Phase 4: Integration & Polish

### Task 4.1 — Wire the "View Full Report" trigger into the compact panel

**File:** `src/components/workspace/SimResultsPanel.tsx`

Step 1. Add a new prop to `SimResultsPanelProps` (current lines 15–19):
```ts
interface SimResultsPanelProps {
  result: SimResult;
  simType: SimTypeId;
  onClose: () => void;
  onExpand: () => void;
}
```
Step 2. Destructure it in the function signature (current line 35): `export default function SimResultsPanel({ result, simType, onClose, onExpand }: SimResultsPanelProps) {`.
Step 3. Add an "Expand" button next to the existing close button in the header row (current lines 103–108). Insert it immediately before that `<button onClick={(e) => { e.stopPropagation(); onClose(); }} ...>`:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); onExpand(); }}
  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-[var(--color-info)] bg-[var(--color-info)]/10 hover:bg-[var(--color-info)]/20 transition-colors"
>
  <Maximize2 size={11} /> Full Report
</button>
```
Add `Maximize2` to the existing `lucide-react` import (current line 7): `import { ChevronDown, ChevronUp, Activity, Users, Clock, AlertTriangle, Maximize2 } from "lucide-react";`.
Step 4. This button must call `e.stopPropagation()` — the header row's own `onClick` (line 75) toggles `collapsed`, and without stopping propagation, clicking "Full Report" would also collapse the strip underneath the now-open dashboard. This mirrors the exact same guard already used by the adjacent close button one line below it.

### Task 4.2 — Mount the dashboard from the workspace page

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. Add state near the other UI-state variables (alongside `shareModalOpen` from the previous plan): `const [dashboardOpen, setDashboardOpen] = useState(false);`
Step 2. Import the new component: `import AdvancedResultsDashboard from "@/components/workspace/AdvancedResultsDashboard";`
Step 3. Locate the existing `<SimResultsPanel result={simResult} simType={...} onClose={...} />` render (line 584) and add the new prop: `onExpand={() => setDashboardOpen(true)}`.
Step 4. Render the dashboard once, near where `ShareExportModal` is rendered (end of the component's JSX):
```tsx
<AdvancedResultsDashboard
  open={dashboardOpen}
  onClose={() => setDashboardOpen(false)}
  result={simResult}
  simType={(project?.sim_type as SimTypeId) || "human_queue"}
  projectId={project?.id || ""}
/>
```
Step 5. The dashboard's own `if (!result) return null;` guard (Task 2.1, Step 1) means it's safe to always mount this component unconditionally here — it simply renders nothing until both `simResult` exists and `dashboardOpen` is true. Do not wrap this render in an extra `{simResult && (...)}` conditional in the page itself; that would be redundant with the guard already inside the component.

### Task 4.3 — Respect the existing Export & Share flow instead of duplicating it

Step 1. The dashboard header's "Export" button (Task 2.1) links directly to `/api/projects/${projectId}/export?format=csv` — the exact same route built in the previous plan's Task 2.2. Do not build a second export code path inside the dashboard; this is a plain `<a href>` download link reusing the existing, already-tested endpoint.
Step 2. Do not add a "Share" button inside the dashboard itself — sharing is a project-level action (one link per project, per the previous plan's Task 3.4), not a per-results-view action, and already has its own entry point in the main toolbar. Keeping it out of this dashboard avoids two different UI locations claiming to do the same thing.

### Task 4.4 — Documentation

Step 1. Append a new subsection to `Documentation/09-module-07-kpi-dashboard.md` (the existing module doc governing the Results/KPI module) titled "Advanced Results Dashboard (this plan)" — do not create a new numbered module doc file for this; the Advanced Dashboard is an enhancement to Module 7, not a new module in the 11-module roadmap.
Step 2. Document: Purpose (the "why" — surfacing `timeline`/`logs` data that existed but was never shown), Files owned (the new `results-dashboard/` folder plus `AdvancedResultsDashboard.tsx`, `useCountUp.ts`, `timelineSelectors.ts`), the deliberate choice not to add new chart/animation libraries (Task 0's reasoning), and the deliberate scaling limit on the Logs tab (Task 3.4 Step 2 — pager not virtualization, revisit only if usage shows a real need).

### Task 4.5 — Final sweep

Step 1. Confirm every new file in `src/components/workspace/results-dashboard/` and `AdvancedResultsDashboard.tsx` itself uses only `var(--color-*)` / `var(--radius-*)` / `var(--shadow-*)` tokens for anything that isn't a Recharts series color — the `THEME_COLORS`/`SERIES_COLORS`/`EVENT_COLORS` arrays are the one deliberate exception (chart series need concrete hex values, not CSS custom properties, for Recharts' `fill`/`stroke` props in some contexts) — do not attempt to force those into `var(--color-*)` references if doing so breaks a chart's rendering; verify visually in the browser, since Recharts sometimes handles CSS variables fine in `stroke`/`fill` string props and sometimes doesn't depending on the exact chart primitive — check each chart renders its intended color before considering this task done.
Step 2. Run `npx tsc --noEmit -p .` from the previous plan's regression discipline — confirm the error count/set is unchanged from the last known-good baseline (41 pre-existing errors, none in any file this plan touches). If any new file in this plan introduces a new error, fix it before moving on; do not carry a growing error count forward silently.
Step 3. Manually open the dashboard after a real simulation run and click through all four tabs — confirm: hero numbers count up on first open, the bottleneck card pulses only when a bottleneck exists, the tab-switch pill slides (not snaps) between tabs, the Blocks table's utilization bars animate in and sorting/searching both work, the Timeline tab's two charts render real data matching what the compact strip's numbers imply, and the Logs tab's filter chips correctly narrow the list with working "Load more" pagination.
Step 4. Confirm the dashboard is usable at a reasonably small browser window (e.g. 1024px wide, a common laptop-in-a-side-panel width) — the `grid-cols-2 md:grid-cols-4` hero row and `grid-cols-1 lg:grid-cols-3` overview row (Task 3.1) are already responsive breakpoints; verify they actually collapse correctly rather than overflowing at that width, since this is a data-dense internal tool page, not a marketing page, and is more likely to be used in a smaller viewport than the rest of the app.

---

## Execution order summary
1. Task 1.1 (export `buildChartData`) — trivial, unblocks Task 3.1.
2. Tasks 1.2 + 1.3 (the count-up hook and timeline selectors) — pure utilities, no UI yet, easy to unit-sanity-check in isolation before anything renders.
3. Task 2.1 (dashboard shell with placeholder tabs) — get the modal opening/closing and tab-switching animation right before filling in real content; this is the part most worth getting visually right early since every tab reuses this chrome.
4. Tasks 3.1 → 3.2 → 3.3 → 3.4 in order — Overview first (it's the default tab and sets the visual tone), then Timeline (newest data being surfaced), then Blocks (highest information density), then Logs (largest dataset, pagination-sensitive).
5. Tasks 4.1 + 4.2 together — wire the trigger and mount point; this is the first point the dashboard is reachable from the actual app, not just visible in isolation.
6. Task 4.3 — confirm no duplicate export/share logic was accidentally introduced.
7. Tasks 4.4 + 4.5 — docs and final sweep, including the manual four-tab click-through, which is the real acceptance test for this entire plan.
