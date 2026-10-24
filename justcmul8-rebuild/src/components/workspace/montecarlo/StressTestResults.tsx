"use client";

import React, { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Repeat, ShieldAlert, Timer, Target as TargetIcon, BarChart3, Activity, Lightbulb } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Area, Line, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import ChartCard from "@/components/ui/ChartCard";
import { GRID, AXIS } from "@/components/ui/chartTheme";
import { metricsOf, riskBandLabel, runMetrics, summarize, welchFromStats, type MetricKey, type MonteCarloResult, type RunStatistic } from "@/lib/simulation/monteCarlo";
import { runPasses, targetShares, type Target } from "@/lib/simulation/stressAnalysis";
import type { HistoryEntry } from "@/lib/simulation/mcStorage";
import { BRAND, Chips, FAIL_COLOR, HelpTip, PASS_COLOR, RangeBar, deltaText, focusRing, levelText, niceTicks, pctText, useElementWidth, type MetricMeta } from "./shared";

interface Props {
  mc: MonteCarloResult;
  meta: Record<MetricKey, MetricMeta>;
  entity: string;
  runLength: string;
  conditions: string[];
  targets: Target[];
  pinned: HistoryEntry | null;
  /** Wraps the main chart, for PNG export. */
  chartRef?: React.Ref<HTMLDivElement>;
}

function StressTestResults({ mc, meta, entity, runLength, conditions, targets, pinned, chartRef }: Props) {
  const keys = metricsOf(mc);
  const [picked, setSelected] = useState<MetricKey>("throughput");
  const selected = keys.includes(picked) ? picked : "throughput"; // cost may vanish on a re-run
  const stat = mc[selected]!;
  const m = meta[selected];
  const level = stat.level;
  const band = riskBandLabel(stat.riskQ);
  const middle = Math.round((1 - 2 * stat.riskQ) * 100);

  const activeTargets = useMemo(() => targets.filter((t) => t.enabled && keys.includes(t.metric)), [targets, keys]);
  const shares = useMemo(() => targetShares(mc.results, activeTargets, level), [mc, activeTargets, level]);
  const passes = useMemo(() => (activeTargets.length ? runPasses(mc.results, activeTargets) : null), [mc, activeTargets]);
  const allShare = shares[0];
  const selTarget = activeTargets.find((t) => t.metric === selected);

  const engines = new Set(mc.results.map((r) => r.engine ?? "pyodide"));
  const engineLabel = engines.size > 1 ? "Mixed engines" : engines.has("legacy") ? "Built-in engine" : "SimPy (Python)";
  const deterministic = keys.every((k) => (mc[k]?.stdDev ?? 0) === 0);
  const t = mc.throughput;
  const relPrecision = t.mean > 0 ? ((t.ciUpper - t.ciLower) / 2 / t.mean) * 100 : 0;
  const ent = entity.toLowerCase();

  return (
    <div className="space-y-5">
      {/* ── Risk hero ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        aria-label="Risk summary"
        className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-sf-5742ff via-sf-6a4cff to-sf-8b5cf6 p-5 text-white shadow-[0_18px_40px_-14px_rgba(87,66,255,0.55)] sm:p-6"
      >
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
              <ShieldAlert size={13} /> Risk outlook
            </p>
            <p className="mt-2 text-[20px] font-black leading-tight tracking-tight sm:text-[24px]">
              {allShare ? (
                <>Meets {activeTargets.length > 1 ? "all your targets" : "your target"} in <span className="tabular-nums">{pctText(allShare.share)}</span> of runs.</>
              ) : (
                <>A typical run completes <span className="tabular-nums">{meta.throughput.format(t.mean)}</span> {ent}s.</>
              )}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/85">
              {allShare && (
                <>
                  We&apos;re {levelText(level)} sure the true rate is between <b className="tabular-nums">{pctText(allShare.lo)}</b> and <b className="tabular-nums">{pctText(allShare.hi)}</b>.{" "}
                </>
              )}
              {middle} out of 100 runs finished between <b className="tabular-nums">{meta.throughput.format(t.bandLo)}</b> and{" "}
              <b className="tabular-nums">{meta.throughput.format(t.bandHi)}</b> {ent}s; the worst run managed <b className="tabular-nums">{meta.throughput.format(t.min)}</b>.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
              <Timer size={13} /> Waiting risk
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/90">
              The median wait was <b className="tabular-nums">{meta.avgWaitTime.format(mc.avgWaitTime.bandLo)}</b> to{" "}
              <b className="tabular-nums">{meta.avgWaitTime.format(mc.avgWaitTime.bandHi)}</b> on {middle}% of runs, and{" "}
              <b className="tabular-nums">{meta.avgWaitTime.format(mc.avgWaitTime.max)}</b> on the worst one.
            </p>
            <p className="mt-2 text-[12px] text-white/75">
              Bottleneck busy {meta.utilization.format(mc.utilization.mean)} on average
              {mc.utilization.bandHi >= 95 ? ", and fully maxed out on bad runs." : "."}
            </p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-2 text-[11.5px] font-bold">
          <Chip icon={Repeat}>{mc.runCount} runs</Chip>
          <Chip icon={Timer}>Each run = {runLength} simulated</Chip>
          <Chip icon={Cpu}>Engine: {engineLabel}</Chip>
          <Chip icon={Activity}>{levelText(level)} confidence · {band} band</Chip>
          {conditions.length > 0 && <Chips items={conditions} tone="light" />}
        </div>
      </motion.section>

      {deterministic ? (
        <Notice>
          Every run gave exactly the same result. Your blocks use fixed (deterministic) timings, so there is no randomness for a
          stress test to explore. Switch an arrival or service time to Exponential or Normal to see real run-to-run variation.
        </Notice>
      ) : relPrecision > 5 && mc.runCount < 100 ? (
        <Notice>
          The average {ent} count is known to about ±{relPrecision.toFixed(0)}%. For a tighter answer, run more iterations or turn on
          &quot;Run until precise&quot;: the band shrinks roughly with the square root of the run count (4× the runs halves it).
        </Notice>
      ) : null}

      {/* ── Metric cards (also the chart's metric selector) ── */}
      <div className={`grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 ${keys.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {keys.map((k, i) => (
          <MetricTile
            key={k}
            stat={mc[k]!}
            meta={meta[k]}
            active={k === selected}
            onSelect={() => setSelected(k)}
            delay={0.05 * i}
            target={activeTargets.find((x) => x.metric === k)}
            share={shares.find((s) => s.target?.metric === k)?.share}
            pinned={pinned?.metrics[k]}
          />
        ))}
      </div>

      {/* ── Distribution + convergence ── */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div ref={chartRef} className="min-w-0">
          <ChartCard
            icon={BarChart3}
            title={`How the ${mc.runCount} runs spread out`}
            description={`${m.label}: each bar counts runs that landed in that range.`}
            help={`Taller bars mean more runs ended up there. The solid line is the average. The shaded strip is the ${levelText(level)} confidence band for the average: we're ${levelText(level)} sure the long-run average lies inside it. Individual runs scatter much wider than that band, and that's normal.`}
            height={null}
            legend={[
              { label: "Runs in range", color: BRAND },
              { label: "Average", color: BRAND, dashed: false },
              { label: `${band} (middle ${middle}% of runs)`, color: "var(--color-ln-9ca3af)", dashed: true },
              ...(selTarget ? [{ label: `Target ${selTarget.op === "max" ? "≤" : "≥"} ${m.format(selTarget.value)}`, color: FAIL_COLOR, dashed: true }] : []),
            ]}
          >
            <Histogram stat={stat} meta={m} target={selTarget} />
          </ChartCard>
        </div>
        <ChartCard
          icon={TargetIcon}
          title="Is it settling down?"
          description={passes ? "Running average after each run. Dots: green = met all targets, red = missed." : "Running average after each run, with its confidence band."}
          help="Each dot is one run. The line is the average of all runs so far. As more runs come in, the band narrows: that's the estimate getting more trustworthy. A flat line inside a thin band means more runs won't change the answer much."
          height={230}
        >
          <Convergence mc={mc} metric={selected} stat={stat} meta={m} passes={passes} />
        </ChartCard>
      </div>
    </div>
  );
}

export default memo(StressTestResults);

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Chip({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
      <Icon size={12} aria-hidden /> {children}
    </span>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-indigo-100 bg-sf-f4f2ff px-4 py-3 text-[12.5px] font-medium text-indigo-950/80">
      <Lightbulb size={15} className="mt-0.5 shrink-0 text-fg-5742ff" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

function MetricTile({ stat, meta, active, onSelect, delay, target, share, pinned }: {
  stat: RunStatistic;
  meta: MetricMeta;
  active: boolean;
  onSelect: () => void;
  delay: number;
  target?: Target;
  share?: number;
  pinned?: HistoryEntry["metrics"][string];
}) {
  const Icon = meta.icon;
  const vs = pinned ? welchFromStats(pinned, stat, stat.level) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className={`group relative rounded-[20px] border bg-surface p-4 transition-all focus-within:z-20 hover:z-20 motion-reduce:transition-none ${
        active
          ? "border-ln-5742ff/50 shadow-[0_10px_28px_-10px_rgba(87,66,255,0.45)]"
          : "border-ln-ecebf7 shadow-[0_4px_20px_-8px_rgba(87,66,255,0.10)] hover:-translate-y-0.5 hover:border-indigo-200 motion-reduce:hover:translate-y-0"
      }`}
    >
      <div aria-hidden className={`pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-sf-5742ff/[0.06] to-transparent transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
      {/* Whole card selects the chart metric; the (i) sits above it. */}
      <button type="button" onClick={onSelect} aria-pressed={active} aria-label={`Show distribution of ${meta.label}`} className={`absolute inset-0 z-0 rounded-[20px] ${focusRing}`} />
      <div className="pointer-events-none relative">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-sf-5742ff text-white" : "bg-sf-5742ff/10 text-fg-5742ff"}`}>
            <Icon size={14} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-wider text-gray-500">{meta.label}</span>
          <span className="pointer-events-auto relative z-10">
            <HelpTip text={meta.help} label={`About ${meta.label}`} />
          </span>
        </div>
        <p className="mt-3 text-[26px] font-black leading-none tracking-tight text-gray-900 tabular-nums">{meta.format(stat.mean)}</p>
        <p className="mt-1.5 text-[11.5px] font-bold text-fg-4331e0 tabular-nums">
          {levelText(stat.level)} band {meta.format(stat.ciLower)} – {meta.format(stat.ciUpper)}
          {stat.ciClamped && <span title={`Band cut at the limit: this metric ${meta.boundNote}.`}>*</span>}
        </p>
        <div className="mt-3">
          <RangeBar stat={stat} target={target?.value} />
        </div>
        <p className="mt-1.5 text-[10.5px] font-medium text-gray-500 tabular-nums">
          {riskBandLabel(stat.riskQ)} of runs: {meta.format(stat.bandLo)} – {meta.format(stat.bandHi)}
        </p>
        {target && share !== undefined && (
          <p className="mt-1 text-[11px] font-bold tabular-nums" style={{ color: share >= 0.9 ? PASS_COLOR : share >= 0.5 ? "var(--color-fg-b45309)" : FAIL_COLOR }}>
            {target.op === "max" ? "≤" : "≥"} {meta.format(target.value)} in {pctText(share)} of runs
          </p>
        )}
        {vs && (
          <p className={`mt-1 text-[11px] font-bold tabular-nums ${vs.significant ? "text-fg-4331e0" : "text-gray-500"}`}>
            vs pinned: {deltaText(vs.diff, vs.pct, meta)} · {vs.significant ? "real change" : "within noise"}
          </p>
        )}
        {stat.ciClamped && <p className="mt-0.5 text-[10px] text-gray-500">* band cut off where it would pass a hard limit ({meta.boundNote})</p>}
      </div>
    </motion.div>
  );
}

// ─── Histogram (hand-drawn SVG) ──────────────────────────────────────────────

const H = 240;
const PAD = { l: 34, r: 14, t: 26, b: 30 };

function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Histogram({ stat, meta, target }: { stat: RunStatistic; meta: MetricMeta; target?: Target }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const bins = useMemo(() => {
    const n = stat.samples.length;
    const k = Math.min(14, Math.max(5, Math.ceil(Math.sqrt(n))));
    const span = stat.max - stat.min;
    // All runs identical: one bin centred on the value.
    const lo = span > 0 ? stat.min : stat.min - 1;
    const step = span > 0 ? span / k : 2 / k;
    const out = Array.from({ length: k }, (_, i) => ({ x0: lo + i * step, x1: lo + (i + 1) * step, count: 0, fail: 0 }));
    for (const v of stat.samples) {
      const b = out[Math.min(k - 1, Math.max(0, Math.floor((v - lo) / step)))];
      b.count++;
      if (target && !(target.op === "max" ? v <= target.value : v >= target.value)) b.fail++;
    }
    return out;
  }, [stat, target]);

  // Extend the axis to include the target line if it sits outside the data.
  const lo = Math.min(bins[0].x0, target?.value ?? Infinity);
  const hi = Math.max(bins[bins.length - 1].x1, target?.value ?? -Infinity);
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const iw = Math.max(0, width - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const x = (v: number) => PAD.l + ((v - lo) / (hi - lo || 1)) * iw;
  const y = (c: number) => PAD.t + ih - (c / maxCount) * ih;
  const yTicks = niceTicks(0, maxCount, Math.min(4, maxCount)).filter((v) => Number.isInteger(v));
  const xTicks = niceTicks(lo, hi, width < 420 ? 3 : 5);
  const meanX = x(stat.mean);
  const labelW = 22 + `avg ${meta.format(stat.mean)}`.length * 6.2;
  const summary = `Histogram of ${meta.label} over ${stat.n} runs. Average ${meta.format(stat.mean)}, ${levelText(stat.level)} band ${meta.format(stat.ciLower)} to ${meta.format(stat.ciUpper)}, ${riskBandLabel(stat.riskQ)} ${meta.format(stat.bandLo)} to ${meta.format(stat.bandHi)}.${target ? ` Target ${target.op === "max" ? "at most" : "at least"} ${meta.format(target.value)}.` : ""}`;

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={summary} className="overflow-visible">
          <defs>
            <linearGradient id="mc-hist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-sf-8b7dff)" />
              <stop offset="100%" stopColor={BRAND} />
            </linearGradient>
            <pattern id="mc-fail" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={FAIL_COLOR} fillOpacity={0.75} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-sf-ffffff)" strokeOpacity={0.5} strokeWidth="2" />
            </pattern>
          </defs>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-ln-ecebf7)" strokeDasharray="3 6" />
              <text x={PAD.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fill="var(--color-fg-64748b)" className="text-[10.5px] font-semibold tabular-nums">{v}</text>
            </g>
          ))}
          <text x={PAD.l - 8} y={PAD.t - 12} textAnchor="end" fill="var(--color-fg-64748b)" className="text-[10px] font-bold">runs</text>
          {target && (
            <rect
              x={target.op === "max" ? x(target.value) : PAD.l}
              y={PAD.t}
              width={Math.max(0, target.op === "max" ? width - PAD.r - x(target.value) : x(target.value) - PAD.l)}
              height={ih}
              fill={FAIL_COLOR}
              fillOpacity={0.05}
            />
          )}
          <rect x={x(stat.ciLower)} y={PAD.t} width={Math.max(2, x(stat.ciUpper) - x(stat.ciLower))} height={ih} fill={BRAND} fillOpacity={0.12} rx={3} />
          {bins.map((b, i) => {
            const bx = x(b.x0) + 1;
            const bw = Math.max(1, x(b.x1) - x(b.x0) - 2);
            const op = hover === null || hover === i ? 1 : 0.45;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {b.count > 0 && <path d={barPath(bx, y(b.count), bw, PAD.t + ih - y(b.count), 4)} fill="url(#mc-hist)" opacity={op} />}
                {b.fail > 0 && <path d={barPath(bx, y(b.fail), bw, PAD.t + ih - y(b.fail), b.fail === b.count ? 4 : 0)} fill="url(#mc-fail)" opacity={op} />}
                <rect x={bx} y={PAD.t} width={bw} height={ih} fill="transparent" />
              </g>
            );
          })}
          {[stat.bandLo, stat.bandHi].map((v, i) => (
            <g key={i}>
              <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-ln-9ca3af)" strokeDasharray="3 3" />
              <text x={x(v)} y={PAD.t - 4} textAnchor="middle" fill="var(--color-fg-64748b)" className="text-[9.5px] font-bold">
                {i === 0 ? `P${Math.round(stat.riskQ * 100)}` : `P${Math.round((1 - stat.riskQ) * 100)}`}
              </text>
            </g>
          ))}
          {target && <line x1={x(target.value)} x2={x(target.value)} y1={PAD.t - 6} y2={PAD.t + ih} stroke={FAIL_COLOR} strokeWidth={2} strokeDasharray="5 3" />}
          <line x1={meanX} x2={meanX} y1={PAD.t - 6} y2={PAD.t + ih} stroke={BRAND} strokeWidth={2} />
          <g transform={`translate(${Math.min(Math.max(meanX, PAD.l + labelW / 2), width - PAD.r - labelW / 2)},${PAD.t - 16})`}>
            <rect x={-labelW / 2} y={-9} width={labelW} height={18} rx={9} fill={BRAND} />
            <text textAnchor="middle" dy="0.34em" fill="#fff" className="text-[10.5px] font-black tabular-nums">avg {meta.format(stat.mean)}</text>
          </g>
          <line x1={PAD.l} x2={width - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="var(--color-ln-d1d5db)" />
          {xTicks.map((v) => (
            <text key={v} x={x(v)} y={H - 10} textAnchor="middle" fill="var(--color-fg-64748b)" className="text-[10.5px] font-semibold tabular-nums">{meta.format(v)}</text>
          ))}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-sf-161622/95 px-3 py-2 text-[11.5px] text-white shadow-lg backdrop-blur"
          style={{ left: Math.min(Math.max(x((bins[hover].x0 + bins[hover].x1) / 2), 90), width - 90), top: Math.max(0, y(bins[hover].count) - 62) }}
        >
          <p className="font-black tabular-nums">{bins[hover].count} of {stat.n} runs</p>
          <p className="text-white/70 tabular-nums">{meta.format(bins[hover].x0)} – {meta.format(bins[hover].x1)}</p>
          {target && <p className="text-white/70 tabular-nums">{bins[hover].fail} missed the target</p>}
        </div>
      )}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead><tr><th>Range</th><th>Runs</th>{target && <th>Missed target</th>}</tr></thead>
        <tbody>
          {bins.map((b, i) => (
            <tr key={i}><td>{meta.format(b.x0)} – {meta.format(b.x1)}</td><td>{b.count}</td>{target && <td>{b.fail}</td>}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Convergence (running mean + narrowing band, pass/fail dots) ─────────────

function Convergence({ mc, metric, stat, meta, passes }: { mc: MonteCarloResult; metric: MetricKey; stat: RunStatistic; meta: MetricMeta; passes: boolean[] | null }) {
  const data = useMemo(() => {
    const vals = mc.results.map((r) => runMetrics(r)[metric]);
    const seen: number[] = [];
    return vals.flatMap((value, i) => {
      if (value === undefined || !Number.isFinite(value)) return [];
      seen.push(value);
      const s = summarize(seen, undefined, { level: stat.level });
      return [{ run: i + 1, value, mean: s.mean, band: seen.length > 1 ? [s.ciLower, s.ciUpper] : [s.mean, s.mean], pass: passes ? passes[i] : null }];
    });
  }, [mc, metric, stat.level, passes]);
  return (
    <div className="h-full w-full" role="img" aria-label={`Running average of ${meta.label} across ${stat.n} runs, ending at ${meta.format(stat.mean)}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="mc-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis {...AXIS} dataKey="run" type="number" domain={[1, Math.max(2, mc.runCount)]} allowDecimals={false} label={{ value: "run #", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "var(--color-fg-64748b)" }} />
          <YAxis {...AXIS} domain={["auto", "auto"]} width={58} tickFormatter={(v: number) => meta.format(v)} />
          <Tooltip
            cursor={{ stroke: "var(--color-ln-c7c2ff)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              if (!p) return null;
              return (
                <div className="pointer-events-none rounded-xl border border-white/10 bg-sf-161622/95 px-3 py-2.5 text-[12px] text-white shadow-[0_14px_36px_-10px_rgba(16,24,40,.55)] backdrop-blur">
                  <p className="mb-1 border-b border-white/10 pb-1 text-[11px] font-bold text-white/70">Run {p.run}{p.pass !== null && (p.pass ? " · met targets" : " · missed a target")}</p>
                  <p className="tabular-nums">This run: <b>{meta.format(p.value)}</b></p>
                  <p className="tabular-nums">Average so far: <b>{meta.format(p.mean)}</b></p>
                  {p.run > 1 && <p className="text-white/60 tabular-nums">Band: {meta.format(p.band[0])} – {meta.format(p.band[1])}</p>}
                </div>
              );
            }}
          />
          <Area dataKey="band" stroke="none" fill="url(#mc-band)" isAnimationActive={false} />
          <ReferenceLine y={stat.mean} stroke={BRAND} strokeOpacity={0.35} strokeDasharray="4 4" />
          <Scatter
            dataKey="value"
            isAnimationActive={false}
            shape={(props: { cx?: number; cy?: number; payload?: { pass: boolean | null } }) => {
              const pass = props.payload?.pass;
              const fill = pass === null || pass === undefined ? "var(--color-sf-b3adda)" : pass ? PASS_COLOR : FAIL_COLOR;
              return pass === false ? (
                <rect x={(props.cx ?? 0) - 3} y={(props.cy ?? 0) - 3} width={6} height={6} fill={fill} stroke="var(--color-sf-ffffff)" strokeWidth={1} />
              ) : (
                <circle cx={props.cx} cy={props.cy} r={3.2} fill={fill} stroke="var(--color-sf-ffffff)" strokeWidth={1} />
              );
            }}
          />
          <Line dataKey="mean" stroke={BRAND} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
