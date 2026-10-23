"use client";

import React, { memo, useMemo } from "react";
import { Boxes, Crown, History, Pin, PinOff, Target as TargetIcon, Trash2, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Scatter } from "recharts";
import ChartCard, { EmptyState } from "@/components/ui/ChartCard";
import { GRID, AXIS, axisLabel } from "@/components/ui/chartTheme";
import { metricsOf, riskBandLabel, type MetricKey, type MonteCarloResult } from "@/lib/simulation/monteCarlo";
import { bottleneckFrequency, blockUtilization, targetShares, type SweepAnalysis, type SweepPoint, type Target } from "@/lib/simulation/stressAnalysis";
import type { HistoryEntry } from "@/lib/simulation/mcStorage";
import type { UtilBand } from "@/lib/simulation/decisionScore";
import { BRAND, Chips, FAIL_COLOR, PASS_COLOR, focusRing, inputCls, levelText, pctText, type MetricMeta } from "./shared";

// ─── Targets ─────────────────────────────────────────────────────────────────

export const TargetsView = memo(function TargetsView({ mc, targets, meta, level }: { mc: MonteCarloResult; targets: Target[]; meta: Record<MetricKey, MetricMeta>; level: number }) {
  const keys = metricsOf(mc);
  const active = targets.filter((t) => t.enabled && keys.includes(t.metric));
  const shares = useMemo(() => targetShares(mc.results, active, level), [mc, active, level]);
  if (!active.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-indigo-200 bg-white/70">
        <EmptyState icon={TargetIcon} title="No targets set" hint="Open Customize → Targets to say what 'good enough' means (for example median wait ≤ 2 min). We'll show how often each run meets it." />
      </div>
    );
  }
  return (
    <ChartCard
      icon={TargetIcon}
      title="How often you hit your targets"
      description={`Share of runs meeting each target, with the ${levelText(level)} range for the true rate.`}
      help="Each run either meets a target or it doesn't. The big number is the share of runs that met it. The bar shows the range the true long-run rate most likely falls in (a Wilson interval), which is wider when you have fewer runs."
      height={null}
    >
      <ul className="divide-y divide-[#F1F0FA]">
        {shares.map((s) => {
          const label = s.target ? `${meta[s.target.metric].label} ${s.target.op === "max" ? "≤" : "≥"} ${meta[s.target.metric].format(s.target.value)}` : "All targets at once";
          const tone = s.share >= 0.9 ? PASS_COLOR : s.share >= 0.5 ? "#B45309" : FAIL_COLOR;
          const Icon = s.share >= 0.5 ? CheckCircle2 : XCircle;
          return (
            <li key={label} className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_90px_minmax(160px,1.2fr)]">
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ color: tone }} aria-hidden />
                <span className={`text-[13px] ${s.target ? "font-bold text-gray-800" : "font-black text-gray-900"}`}>{label}</span>
              </div>
              <div className="text-[22px] font-black tabular-nums" style={{ color: tone }}>
                {pctText(s.share)}
                <span className="ml-1 text-[11px] font-bold text-gray-500">{s.k}/{s.n}</span>
              </div>
              <div>
                <div className="relative h-2.5 rounded-full bg-gray-100" aria-hidden>
                  <div className="absolute inset-y-0 rounded-full opacity-30" style={{ left: `${s.lo * 100}%`, width: `${(s.hi - s.lo) * 100}%`, background: tone }} />
                  <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${s.share * 100}%`, background: tone }} />
                </div>
                <p className="mt-1 text-[10.5px] font-semibold text-gray-500 tabular-nums">True rate likely {pctText(s.lo)} – {pctText(s.hi)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
});

// ─── Blocks ──────────────────────────────────────────────────────────────────

export const BlocksView = memo(function BlocksView({ mc, riskQ, utilBand }: { mc: MonteCarloResult; riskQ: number; utilBand: UtilBand }) {
  const freq = useMemo(() => bottleneckFrequency(mc.results), [mc]);
  const blocks = useMemo(() => blockUtilization(mc.results, riskQ), [mc, riskQ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        icon={Crown}
        title="Who is the bottleneck?"
        description="How often each block was the slowest link in a run."
        help="In every run, the simulation names the block that held up flow the most. If one block wins nearly every run, that's where an extra server or faster process pays off first. A split means the bottleneck moves around with random swings."
        height={null}
        empty={freq.length === 0}
        emptyTitle="No bottleneck recorded"
        emptyHint="These runs didn't report a bottleneck block."
      >
        <ul className="space-y-2.5">
          {freq.map((f, i) => (
            <li key={f.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate font-bold text-gray-800">{f.label}</span>
                <span className="shrink-0 font-black tabular-nums text-gray-900">{pctText(f.share)} <span className="text-[11px] font-bold text-gray-500">({f.count} runs)</span></span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${f.share * 100}%`, background: i === 0 ? BRAND : "#A79CFF" }} />
              </div>
            </li>
          ))}
        </ul>
      </ChartCard>
      <ChartCard
        icon={Boxes}
        title="How busy each block gets"
        description={`Average busy % with the ${riskBandLabel(riskQ)} range across runs. Green zone = your ideal ${utilBand[0]}–${utilBand[1]}%.`}
        help="Each bar shows how much of the time a block was working. The dot is the average; the bar is the range most runs fell in. Blocks above the green zone risk long queues on bad days; blocks below it have spare capacity you may be paying for."
        height={null}
        empty={blocks.length === 0}
        emptyTitle="No busy blocks"
        emptyHint="No block reported utilization in these runs."
      >
        <ul className="space-y-3">
          {blocks.map((b) => (
            <li key={b.id} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3">
              <span className="truncate text-[12.5px] font-bold text-gray-800" title={b.label}>{b.label}</span>
              <div className="relative h-3" aria-label={`${b.label}: average ${b.mean.toFixed(0)}%, range ${b.lo.toFixed(0)} to ${b.hi.toFixed(0)}%`} role="img">
                <div className="absolute inset-y-0 rounded-sm bg-emerald-100" style={{ left: `${utilBand[0]}%`, width: `${utilBand[1] - utilBand[0]}%` }} />
                <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gray-200/80" />
                <div className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full" style={{ left: `${b.lo}%`, width: `max(3px, ${b.hi - b.lo}%)`, background: b.hi > utilBand[1] ? "#E11D48" : BRAND, opacity: 0.55 }} />
                <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${Math.min(100, b.mean)}%`, background: b.mean > utilBand[1] ? "#E11D48" : BRAND }} />
              </div>
              <span className="w-12 text-right text-[12px] font-black tabular-nums text-gray-900">{b.mean.toFixed(0)}%</span>
            </li>
          ))}
          <li className="ml-[calc(min(140px,30%)+12px)] mr-[60px] flex justify-between text-[10px] font-semibold text-gray-500" aria-hidden>
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </li>
        </ul>
      </ChartCard>
    </div>
  );
});

// ─── Breaking point ──────────────────────────────────────────────────────────

export interface SweepResult {
  points: SweepPoint[];
  metric: MetricKey;
  analysis: SweepAnalysis;
  headline: string;
  conditions: string[];
  hasTargets: boolean;
}

export const BreakingPointView = memo(function BreakingPointView({ sweep, meta, target }: { sweep: SweepResult; meta: Record<MetricKey, MetricMeta>; target?: Target }) {
  const m = meta[sweep.metric];
  const data = sweep.points.map((p) => ({ x: p.multiplier, mean: p.stat.mean, band: [p.stat.ciLower, p.stat.ciUpper], share: p.meetShare }));
  const level = sweep.points[0]?.stat.level ?? 0.95;
  const { analysis } = sweep;
  return (
    <div className="space-y-4">
      <div className={`rounded-[20px] border p-4 sm:p-5 ${analysis.reason === "none" ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-gray-600">
          <TrendingUp size={13} aria-hidden /> Breaking point
        </p>
        <p className="mt-1.5 text-[16px] font-black leading-snug text-gray-900 sm:text-[18px]">{sweep.headline}</p>
        {sweep.conditions.length > 0 && <div className="mt-2"><Chips items={sweep.conditions} /></div>}
      </div>
      <ChartCard
        icon={TrendingUp}
        title={`${m.label} as demand grows`}
        description={`Average at each load (× today's arrival rate) with its ${levelText(level)} band.`}
        help="Each point re-runs your model with every Start Point's arrival rate multiplied by the number on the bottom axis. A flat line means the system copes; a sharp upturn is where queues start to snowball. The marked line is the highest load that still holds up."
        legend={[
          { label: "Average", color: BRAND },
          ...(analysis.holdsUpTo !== null ? [{ label: "Holds up to", color: "#B45309", dashed: true }] : []),
          ...(target ? [{ label: "Your target", color: FAIL_COLOR, dashed: true }] : []),
        ]}
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 14 }}>
            <defs>
              <linearGradient id="mc-sweep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis {...AXIS} dataKey="x" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => `${v}×`} label={{ value: "Demand (× today)", position: "insideBottom", offset: -8, fontSize: 10.5, fill: "#64748B", fontWeight: 700 }} />
            <YAxis {...AXIS} width={62} tickFormatter={(v: number) => m.format(v)} label={axisLabel(m.label)} />
            <Tooltip
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return (
                  <div className="pointer-events-none rounded-xl border border-white/10 bg-[#161622]/95 px-3 py-2.5 text-[12px] text-white shadow-lg backdrop-blur">
                    <p className="mb-1 border-b border-white/10 pb-1 text-[11px] font-bold text-white/70">{p.x}× today&apos;s demand</p>
                    <p className="tabular-nums">Average: <b>{m.format(p.mean)}</b></p>
                    <p className="text-white/60 tabular-nums">Band: {m.format(p.band[0])} – {m.format(p.band[1])}</p>
                    {p.share !== undefined && <p className="tabular-nums">Runs meeting targets: <b>{pctText(p.share)}</b></p>}
                  </div>
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill="url(#mc-sweep)" isAnimationActive={false} />
            {target && <ReferenceLine y={target.value} stroke={FAIL_COLOR} strokeDasharray="5 3" />}
            {analysis.holdsUpTo !== null && <ReferenceLine x={analysis.holdsUpTo} stroke="#B45309" strokeDasharray="5 3" label={{ value: "holds up to", position: "top", fontSize: 10.5, fill: "#B45309", fontWeight: 700 }} />}
            <Line dataKey="mean" stroke={BRAND} strokeWidth={2.2} dot={false} isAnimationActive={false} />
            <Scatter dataKey="mean" fill={BRAND} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className={`overflow-x-auto ${"rounded-[20px] border border-[#ECEBF7] bg-white"}`}>
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <caption className="sr-only">Breaking-point sweep, step by step</caption>
          <thead className="border-b border-[#F1F0FA] text-[10.5px] font-black uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2.5">Demand</th>
              <th className="px-4 py-2.5">{m.label}</th>
              <th className="px-4 py-2.5">{levelText(level)} band</th>
              {sweep.hasTargets && <th className="px-4 py-2.5">Runs meeting targets</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F6F5FC] tabular-nums">
            {sweep.points.map((p, i) => (
              <tr key={p.multiplier} className={i === analysis.breakIndex || (analysis.reason === "knee" && i === analysis.kneeIndex) ? "bg-amber-50/70" : ""}>
                <td className="px-4 py-2 font-black text-gray-900">{p.multiplier}×</td>
                <td className="px-4 py-2 font-bold text-gray-800">{m.format(p.stat.mean)}</td>
                <td className="px-4 py-2 text-gray-600">{m.format(p.stat.ciLower)} – {m.format(p.stat.ciUpper)}</td>
                {sweep.hasTargets && <td className="px-4 py-2 font-bold" style={{ color: (p.meetShare ?? 1) >= 0.5 ? PASS_COLOR : FAIL_COLOR }}>{pctText(p.meetShare ?? NaN)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ─── History ─────────────────────────────────────────────────────────────────

export function HistoryView({ entries, meta, onRename, onDelete, onPin }: {
  entries: HistoryEntry[];
  meta: Record<MetricKey, MetricMeta>;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string | null) => void;
}) {
  if (!entries.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-indigo-200 bg-white/70">
        <EmptyState icon={History} title="No saved batches yet" hint="Every stress test you run is kept here (the last 10, on this device). Pin one as your reference to see 'vs pinned' changes on new runs." />
      </div>
    );
  }
  return (
    <ChartCard icon={History} title="Run history" description="Your last 10 batches on this device. Pin one to compare new runs against it." help="Only summary numbers are stored (averages, spreads and ranges), never every individual run, and only in this browser. Pinning a batch adds a 'vs pinned' line to each metric card, with a significance check." height={null}>
      <ul className="divide-y divide-[#F1F0FA]">
        {entries.map((e) => (
          <li key={e.id} className={`flex flex-wrap items-center gap-3 py-3 ${e.pinned ? "rounded-xl bg-[#F4F2FF] px-3" : ""}`}>
            <div className="min-w-0 flex-1">
              <input
                defaultValue={e.name}
                aria-label="Batch name"
                onBlur={(ev) => ev.target.value !== e.name && onRename(e.id, ev.target.value)}
                onKeyDown={(ev) => ev.key === "Enter" && (ev.currentTarget as HTMLInputElement).blur()}
                className={`${inputCls} w-full max-w-[280px] border-transparent bg-transparent px-1 font-black hover:border-gray-200`}
              />
              <p className="mt-0.5 px-1 text-[11px] font-semibold text-gray-500">
                {new Date(e.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {e.runCount} runs · {levelText(e.level)} confidence
              </p>
              {e.conditions.length > 0 && <div className="mt-1 px-1"><Chips items={e.conditions} /></div>}
            </div>
            <dl className="flex gap-4 text-[11.5px]">
              {(["throughput", "avgWaitTime"] as MetricKey[]).map((k) =>
                e.metrics[k] ? (
                  <div key={k}>
                    <dt className="font-bold text-gray-500">{meta[k].label}</dt>
                    <dd className="font-black tabular-nums text-gray-900">{meta[k].format(e.metrics[k].mean)}</dd>
                  </div>
                ) : null
              )}
            </dl>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => onPin(e.pinned ? null : e.id)} aria-pressed={!!e.pinned} aria-label={e.pinned ? `Unpin ${e.name}` : `Pin ${e.name} as reference`} title={e.pinned ? "Unpin" : "Pin as reference"} className={`flex h-8 w-8 items-center justify-center rounded-lg border ${e.pinned ? "border-[#5742FF] bg-[#5742FF] text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-[#F4F2FF]"} ${focusRing}`}>
                {e.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button type="button" onClick={() => onDelete(e.id)} aria-label={`Delete ${e.name}`} title="Delete" className={`flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
