"use client";

import React, { useMemo } from "react";
import { Layers, TrendingUp, Gauge, Users, Activity, Timer } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import type { SimResult } from "@/lib/simulation/types";
import { buildThroughputSeries, buildDepthSeries } from "@/lib/simulation/timelineSelectors";
import ChartCard from "@/components/ui/ChartCard";
import ChartTooltip from "@/components/ui/ChartTooltip";
import MetricCard from "@/components/ui/MetricCard";
import { AXIS, GRID, axisLabel, downsample, fmtCount, fmtSeconds, maxOf, niceMax, seriesColor } from "@/components/ui/chartTheme";

const MAX_POINTS = 240;
const timeLabel = (t: string | number) => `At ${fmtSeconds(Number(t))}`;

export default function TimelineTab({ result }: { result: SimResult }) {
  const timeline = useMemo(() => result.timeline ?? [], [result.timeline]);

  const wipSeries = useMemo(
    () =>
      downsample(
        timeline.map((t) => ({
          simTime: t.simTime,
          wip: t.wip ?? Object.values(t.depth || {}).reduce((a, b) => a + b, 0),
          completed: t.completed,
        })),
        MAX_POINTS,
        "wip"
      ),
    [timeline]
  );

  const throughput = useMemo(() => downsample(buildThroughputSeries({ ...result, timeline }), MAX_POINTS, "completedPerMin"), [result, timeline]);

  const { depthSeries, nodeLabels } = useMemo(() => {
    const { series, nodeLabels } = buildDepthSeries({ ...result, timeline });
    // Stations missing from a sample had nothing queued; fill 0 so stacked areas don't break.
    const filled = series.map((row) => {
      const out = { ...row };
      for (const l of nodeLabels) if (typeof out[l] !== "number") out[l] = 0;
      return out;
    });
    return { depthSeries: downsample(filled, MAX_POINTS), nodeLabels };
  }, [result, timeline]);

  const wipValues = wipSeries.map((p) => p.wip);
  const peakWip = maxOf(wipValues);
  const avgWip = result.littlesLaw?.timeWeightedWIP_L ?? (wipValues.length ? wipValues.reduce((a, b) => a + b, 0) / wipValues.length : 0);
  const rates = throughput.map((p) => p.completedPerMin);
  const avgRate = (result.totalCompleted / Math.max(1, result.totalSimTime)) * 60;
  const noTimeline = timeline.length === 0;

  const xAxis = (
    <XAxis dataKey="simTime" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtSeconds} tickCount={6} {...AXIS} />
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Summary ── */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-4">
        <MetricCard
          size="sm"
          icon={Users}
          tone="brand"
          label="Peak inside"
          value={peakWip}
          caption="most in the system at once"
          trend={wipValues.length > 1 ? downsample(wipValues, 40) : undefined}
          help="The highest number of people or items inside the whole system at any moment."
        />
        <MetricCard
          size="sm"
          icon={Gauge}
          tone="info"
          label="Average inside"
          value={avgWip}
          decimals={1}
          caption="typical load during the run"
          help="On average, this many people or items were inside at any moment."
          delay={0.04}
        />
        <MetricCard
          size="sm"
          icon={Activity}
          tone="good"
          label="Finishing speed"
          value={avgRate}
          decimals={1}
          unit="/ min"
          caption="average leaving per minute"
          trend={rates.length > 1 ? downsample(rates, 40) : undefined}
          help="How many finished per minute, averaged over the run. The line shows how it changed over time."
          delay={0.08}
        />
      </div>

      <ChartCard
        icon={TrendingUp}
        title="Load inside the system over time"
        description="The shaded area is how many were inside at each moment. Flat means steady; a climb that never comes down means a backlog."
        legend={[
          { label: "Inside now (left axis)", color: "#5742FF" },
          { label: "Finished so far (right axis)", color: "#009E73" },
          { label: "Average inside", color: "#475569", dashed: true },
        ]}
        height={280}
        empty={noTimeline}
        emptyTitle="No timeline recorded"
        emptyHint="This run finished too quickly to sample. Try a longer simulation time."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={wipSeries} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="tl-wip-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5742FF" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#5742FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            {xAxis}
            <YAxis yAxisId="wip" {...AXIS} domain={[0, niceMax]} allowDecimals={false} tickFormatter={fmtCount} width={48} label={axisLabel("Inside")} />
            <YAxis yAxisId="done" orientation="right" {...AXIS} domain={[0, niceMax]} allowDecimals={false} tickFormatter={fmtCount} width={48} label={axisLabel("Finished", "right")} />
            <Tooltip cursor={{ stroke: "#5742FF", strokeWidth: 1, strokeDasharray: "4 4" }} content={<ChartTooltip labelFormatter={timeLabel} valueFormatter={(v) => Math.round(v).toLocaleString()} />} />
            {avgWip > 0 && <ReferenceLine yAxisId="wip" y={avgWip} stroke="#475569" strokeDasharray="5 4" />}
            <Area yAxisId="wip" type="monotone" dataKey="wip" name="Inside now" stroke="#5742FF" strokeWidth={2.5} fill="url(#tl-wip-grad)" dot={false} activeDot={{ r: 5, fill: "#5742FF", stroke: "#fff", strokeWidth: 2 }} />
            <Line yAxisId="done" type="monotone" dataKey="completed" name="Finished so far" stroke="#009E73" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#009E73", stroke: "#fff", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
        <ChartCard
          icon={Layers}
          title="Line length at each station"
          description="Each colour is one station's waiting line, stacked. A band that keeps getting thicker is where work is piling up."
          legend={nodeLabels.map((l, i) => ({ label: l, color: seriesColor(i) }))}
          height={260}
          empty={noTimeline || nodeLabels.length === 0}
          emptyTitle="No waiting lines recorded"
          emptyHint="Add a Queue block in front of a busy station to see lines build up here."
          delay={0.06}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={depthSeries} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
              <defs>
                {nodeLabels.map((_, i) => (
                  <linearGradient key={i} id={`tl-depth-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={seriesColor(i)} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={seriesColor(i)} stopOpacity={0.15} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid {...GRID} />
              {xAxis}
              <YAxis {...AXIS} domain={[0, niceMax]} allowDecimals={false} tickFormatter={fmtCount} width={48} label={axisLabel("In line")} />
              <Tooltip cursor={{ stroke: "#5742FF", strokeWidth: 1, strokeDasharray: "4 4" }} content={<ChartTooltip labelFormatter={timeLabel} valueFormatter={(v) => `${Math.round(v).toLocaleString()} waiting`} />} />
              {nodeLabels.map((label, i) => (
                <Area key={label} type="monotone" dataKey={label} name={label} stackId="depth" stroke={seriesColor(i)} strokeWidth={1.5} fill={`url(#tl-depth-${i})`} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={Timer}
          title="Finishing speed over time"
          description="How many finished per minute in each slice of the run. Dips show moments the system slowed down."
          legend={[
            { label: "Finished per minute", color: "#009E73" },
            { label: "Run average", color: "#475569", dashed: true },
          ]}
          height={260}
          empty={noTimeline}
          emptyTitle="No timeline recorded"
          delay={0.1}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughput} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="tl-rate-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#009E73" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#009E73" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              {xAxis}
              <YAxis {...AXIS} domain={[0, niceMax]} tickFormatter={fmtCount} width={48} label={axisLabel("Per minute")} />
              <Tooltip cursor={{ stroke: "#009E73", strokeWidth: 1, strokeDasharray: "4 4" }} content={<ChartTooltip labelFormatter={timeLabel} valueFormatter={(v) => `${v.toFixed(1)} / min`} />} />
              {avgRate > 0 && <ReferenceLine y={avgRate} stroke="#475569" strokeDasharray="5 4" ifOverflow="extendDomain" />}
              <Area type="monotone" dataKey="completedPerMin" name="Finished per minute" stroke="#009E73" strokeWidth={2} fill="url(#tl-rate-grad)" dot={false} activeDot={{ r: 4, fill: "#009E73", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
