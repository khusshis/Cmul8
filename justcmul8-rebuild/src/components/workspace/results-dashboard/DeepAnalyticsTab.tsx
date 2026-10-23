"use client";

import React from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, ReferenceLine } from "recharts";
import { Scale, PieChart as PieIcon, BarChart3, CheckCircle2, AlertCircle, Users, Gauge, Timer, Activity, Lightbulb } from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import MetricCard, { HelpTip } from "@/components/ui/MetricCard";
import ChartCard, { EmptyState, StatRow } from "@/components/ui/ChartCard";
import ChartTooltip from "@/components/ui/ChartTooltip";
import { AXIS, GRID, STATE_COLORS, TONES, axisLabel, fmtRate, fmtSeconds, isNum, niceMaxFloat } from "@/components/ui/chartTheme";

const PCT_ROWS = [
  { key: "p50", short: "Typical", long: "Typical visit: half of everyone was faster" },
  { key: "p75", short: "Slow 25%", long: "The slowest 25% took at least" },
  { key: "p90", short: "Slow 10%", long: "The slowest 10% took at least" },
  { key: "p95", short: "Slow 5%", long: "The slowest 5% took at least" },
  { key: "p99", short: "Slow 1%", long: "The unluckiest 1% took at least" },
] as const;

export default function DeepAnalyticsTab({
  result,
}: {
  result: SimResult;
  simType: SimTypeId;
}) {
  const littlesLaw = result.littlesLaw;
  const waitPercentiles = result.waitTimePercentiles;
  const cyclePercentiles = result.cycleTimePercentiles;
  const resourceStates = result.resourceStates || {};

  const percentileChartData = PCT_ROWS.map((r) => ({
    name: r.short,
    wait: waitPercentiles?.[r.key] ?? 0,
    total: cyclePercentiles?.[r.key] ?? 0,
  }));
  const longLabel = (short: string | number) => PCT_ROWS.find((r) => r.short === short)?.long ?? String(short);

  const resourceStateData = Object.entries(resourceStates).map(([nodeId, state]) => ({
    name: result.nodeStats[nodeId]?.label || nodeId,
    busyPct: Math.round((state.busyRatio || 0) * 100),
    starvedPct: Math.round((state.starvedRatio || 0) * 100),
    blockedPct: Math.round((state.blockedRatio || 0) * 100),
  }));

  // Gap between the measured and the expected (λ·W) number inside. Small gap = steady flow.
  const gap = littlesLaw?.discrepancyPercent;
  const gapTone = !isNum(gap) ? "neutral" : gap < 10 ? "good" : gap < 25 ? "warn" : "bad";
  const stable = !!littlesLaw?.isStable;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Flow & balance ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        aria-labelledby="flow-balance-title"
        className="rounded-[24px] border border-ln-ecebf7 bg-surface p-4 shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)] sm:p-6"
      >
        <div className="flex flex-col gap-3 border-b border-ln-f1f0fa pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sf-f3f1ff text-fg-5742ff"><Scale size={16} aria-hidden /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h3 id="flow-balance-title" className="text-[15px] font-extrabold tracking-tight text-fg-161622">Flow & balance check</h3>
                <HelpTip
                  align="start"
                  label="About the balance check"
                  text="Based on Little's Law: average number inside = arrival speed × time inside. When the measured number matches that expectation, the system is in a steady state. A big gap means lines are still growing."
                />
              </div>
              <p className="text-[12.5px] text-slate-600">If work arrives faster than stations can finish it, lines grow without end.</p>
            </div>
          </div>
          {littlesLaw && (
            <span
              className="inline-flex w-max shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold"
              style={{
                background: stable ? TONES.good.tint : TONES.warn.tint,
                color: stable ? TONES.good.text : TONES.warn.text,
                borderColor: stable ? "var(--color-ln-bdebd6)" : "var(--color-ln-fcd9a0)",
              }}
            >
              {stable ? <CheckCircle2 size={15} aria-hidden /> : <AlertCircle size={15} aria-hidden />}
              {stable ? "Balanced: lines are steady" : "Unbalanced: lines are growing"}
            </span>
          )}
        </div>

        {littlesLaw ? (
          <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              size="sm"
              icon={Users}
              tone="brand"
              label="Inside on average"
              value={littlesLaw.timeWeightedWIP_L}
              decimals={1}
              caption="in the system at any moment"
              help="The average number of people or items inside the whole system, measured over the run."
            />
            <MetricCard
              size="sm"
              icon={Activity}
              tone="info"
              label="Arrival speed"
              value={fmtRate(littlesLaw.lambdaArrivalRate)}
              unit="/ s"
              caption="arrivals per second"
              help="How fast new work came in, on average."
              delay={0.04}
            />
            <MetricCard
              size="sm"
              icon={Timer}
              tone="warn"
              label="Door-to-door time"
              value={littlesLaw.averageCycleTimeW}
              format={fmtSeconds}
              caption="from entry to exit"
              help="The average total time from arriving to leaving, including all waiting and service."
              delay={0.08}
            />
            <MetricCard
              size="sm"
              icon={Gauge}
              tone={gapTone}
              label="Flow stability"
              value={gapTone === "good" ? "Steady" : gapTone === "warn" ? "Drifting" : gapTone === "bad" ? "Backing up" : "—"}
              caption={isNum(gap) ? `Expected vs measured differ by ${gap.toFixed(0)}%` : undefined}
              help="Compares the number inside we'd expect from arrival speed × time inside with the number actually measured. Under 10% is steady; over 25% means a backlog is forming."
              delay={0.12}
            />
          </div>
        ) : (
          <EmptyState compact icon={Scale} title="Balance check not available" hint="This run didn't record enough arrivals and exits to compare. Try a longer run." />
        )}
      </motion.section>

      {/* ── Percentiles + workload ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <ChartCard
          className="lg:col-span-7"
          icon={BarChart3}
          title="Wait time: typical vs unlucky"
          description={
            waitPercentiles
              ? <>A typical visit waits <b className="text-fg-161622">{fmtSeconds(waitPercentiles.p50)}</b>; the unluckiest 1% wait <b className="text-fg-161622">{fmtSeconds(waitPercentiles.p99)}</b>. Read left to right: each step is a slower slice of visits.</>
              : "How long visits take, from typical to worst case."
          }
          help="Averages hide bad days. Each point shows how long a slice of visits took: 'Slow 10%' means 1 in 10 visits took at least this long."
          legend={[
            { label: "Total time (door to door)", color: "var(--color-sf-5742ff)" },
            { label: "Time spent waiting in line", color: "var(--color-sf-e69f00)", dashed: true },
            ...(isNum(waitPercentiles?.mean) ? [{ label: "Average wait", color: "var(--color-ln-475569)", dashed: true }] : []),
          ]}
          empty={!waitPercentiles && !cyclePercentiles}
          emptyTitle="No wait times recorded"
          emptyHint="Nobody finished a visit in this run, so there is nothing to compare yet."
          delay={0.08}
          footer={
            <StatRow
              items={[
                { label: "Wait variation", value: `±${fmtSeconds(waitPercentiles?.stdDev)}` },
                { label: "Middle-half spread", value: fmtSeconds(waitPercentiles?.iqr) },
                { label: "Longest wait", value: fmtSeconds(waitPercentiles?.max), tone: "bad" },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={percentileChartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="deep-total-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-sf-5742ff)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-sf-5742ff)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="deep-wait-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-sf-e69f00)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-sf-e69f00)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: 10.5 }} />
              <YAxis {...AXIS} domain={[0, niceMaxFloat]} tickFormatter={fmtSeconds} width={56} label={axisLabel("Time")} />
              <Tooltip
                cursor={{ stroke: "var(--color-sf-5742ff)", strokeWidth: 1, strokeDasharray: "4 4" }}
                content={<ChartTooltip valueFormatter={(v) => fmtSeconds(v)} labelFormatter={longLabel} />}
              />
              {isNum(waitPercentiles?.mean) && waitPercentiles!.mean > 0 && (
                <ReferenceLine y={waitPercentiles!.mean} stroke="var(--color-ln-475569)" strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: `avg wait ${fmtSeconds(waitPercentiles!.mean)}`, position: "insideTopLeft", fill: "var(--color-fg-475569)", fontSize: 10.5, fontWeight: 700 }} />
              )}
              <Area type="monotone" dataKey="total" name="Total time" stroke="var(--color-sf-5742ff)" strokeWidth={2.5} fill="url(#deep-total-grad)" activeDot={{ r: 5, fill: "var(--color-sf-5742ff)", stroke: "var(--color-sf-ffffff)", strokeWidth: 2 }} />
              <Area type="monotone" dataKey="wait" name="Waiting in line" stroke="var(--color-sf-e69f00)" strokeWidth={2} strokeDasharray="5 4" fill="url(#deep-wait-grad)" activeDot={{ r: 4, fill: "var(--color-sf-e69f00)", stroke: "var(--color-sf-ffffff)", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-5"
          icon={PieIcon}
          title="Where staff & machine time went"
          description="Working, sitting idle waiting for work, or frozen because the next line is full."
          legend={[
            { label: "Working", color: STATE_COLORS.busy },
            { label: "Idle", color: STATE_COLORS.idle },
            { label: "Frozen (blocked)", color: STATE_COLORS.blocked },
          ]}
          height={null}
          empty={resourceStateData.length === 0}
          emptyTitle="No staff or machines in this model"
          emptyHint="Add a Resource or Service block to see how its time was spent."
          delay={0.12}
          footer={
            <p className="flex items-start gap-2 rounded-xl bg-sf-f6f4ff p-3 text-[12px] leading-relaxed text-fg-2e2470">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-fg-5742ff" aria-hidden />
              <span>If a station sits idle more than 40% of the time while lines are long elsewhere, the step before it is too slow and is starving it of work.</span>
            </p>
          }
        >
          <ul className="custom-scrollbar max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
            {resourceStateData.map((res, i) => (
              <li key={i} className="rounded-2xl border border-ln-f1f0fa bg-sf-fbfaff p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px] font-bold text-fg-161622">
                  <span className="min-w-0 truncate" title={res.name}>{res.name}</span>
                  <span className="shrink-0 tabular-nums text-fg-4331e0">{res.busyPct}% working</span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${res.name}: working ${res.busyPct}%, idle ${res.starvedPct}%, frozen ${res.blockedPct}%`}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${res.busyPct}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.04 }} style={{ backgroundColor: STATE_COLORS.busy }} className="h-full" />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${res.starvedPct}%` }} transition={{ duration: 0.7, delay: 0.15 + i * 0.04 }} style={{ backgroundColor: STATE_COLORS.idle }} className="h-full" />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${res.blockedPct}%` }} transition={{ duration: 0.7, delay: 0.2 + i * 0.04 }} style={{ backgroundColor: STATE_COLORS.blocked }} className="h-full" />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] font-semibold tabular-nums text-slate-600">
                  <span>Idle {res.starvedPct}%</span>
                  <span>Frozen {res.blockedPct}%</span>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
