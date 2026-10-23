import type { SimResult } from "./types";
import { METRIC_DIRECTION, percentile, runMetrics, summarize, wilsonInterval, type MetricKey, type RunStatistic } from "./monteCarlo";

// ─── Targets / SLA ───────────────────────────────────────────────────────────

export interface Target {
  metric: MetricKey;
  /** "max" = must stay at or below value (wait, cost, utilization); "min" = at or above (throughput, health). */
  op: "max" | "min";
  value: number;
  enabled: boolean;
}

export const meetsTarget = (v: number | undefined, t: Target) => v !== undefined && Number.isFinite(v) && (t.op === "max" ? v <= t.value : v >= t.value);

export interface TargetShare {
  /** null = "all enabled targets at once". */
  target: Target | null;
  k: number;
  n: number;
  share: number;
  lo: number;
  hi: number;
}

/** Per-run pass/fail for each enabled target and for "all of them". */
export function runPasses(results: SimResult[], targets: Target[]): boolean[] {
  const on = targets.filter((t) => t.enabled);
  return results.map((r) => {
    const m = runMetrics(r);
    return on.every((t) => meetsTarget(m[t.metric], t));
  });
}

/** Share of runs meeting each enabled target (and all of them), with Wilson intervals. */
export function targetShares(results: SimResult[], targets: Target[], level = 0.95): TargetShare[] {
  const on = targets.filter((t) => t.enabled);
  if (!on.length || !results.length) return [];
  const rows = results.map(runMetrics);
  const n = rows.length;
  const one = (target: Target | null, k: number): TargetShare => ({ target, k, n, ...wilsonInterval(k, n, level) });
  const out = on.map((t) => one(t, rows.filter((m) => meetsTarget(m[t.metric], t)).length));
  if (on.length > 1) out.unshift(one(null, rows.filter((m) => on.every((t) => meetsTarget(m[t.metric], t))).length));
  return out;
}

// ─── Breaking-point sweep ────────────────────────────────────────────────────

export interface SweepPoint {
  multiplier: number;
  stat: RunStatistic;
  /** Share of runs meeting all enabled targets at this load (undefined when no targets). */
  meetShare?: number;
}

export interface SweepAnalysis {
  /** Index of the elbow in the "worse" direction, or null when the curve has none. */
  kneeIndex: number | null;
  /** First step where fewer than half the runs meet all targets, or null. */
  breakIndex: number | null;
  /** The highest multiplier that still "holds", or null if it fails at the lowest load. */
  holdsUpTo: number | null;
  reason: "target" | "knee" | "none" | "fails-immediately";
}

/** Evenly spaced multipliers from `from` to `to` inclusive, rounded to 2 dp. */
export function sweepSteps(from: number, to: number, steps: number): number[] {
  const n = Math.max(2, Math.round(steps));
  return Array.from({ length: n }, (_, i) => Number((from + ((to - from) * i) / (n - 1)).toFixed(2)));
}

/**
 * Knee: points normalised to [0,1] with "worse" pointing up; the knee is where the curve sits
 * furthest below the straight line from first to last point (Kneedle). Needs a clear bend (> 0.1).
 * Break: first step where fewer than half the runs meet all targets (only when targets are set).
 */
export function analyzeSweep(points: SweepPoint[], metric: MetricKey): SweepAnalysis {
  if (points.length < 2) return { kneeIndex: null, breakIndex: null, holdsUpTo: null, reason: "none" };
  const pts = [...points].sort((a, b) => a.multiplier - b.multiplier);
  const worseUp = METRIC_DIRECTION[metric] !== "up";
  const ys = pts.map((p) => (worseUp ? p.stat.mean : -p.stat.mean));
  const x0 = pts[0].multiplier;
  const xs = pts[pts.length - 1].multiplier - x0 || 1;
  const yMin = Math.min(...ys);
  const ySpan = Math.max(...ys) - yMin;

  let kneeIndex: number | null = null;
  if (ySpan > 0) {
    const yFirst = (ys[0] - yMin) / ySpan;
    const yLast = (ys[ys.length - 1] - yMin) / ySpan;
    let best = 0.1;
    pts.forEach((p, i) => {
      const xn = (p.multiplier - x0) / xs;
      const d = yFirst + (yLast - yFirst) * xn - (ys[i] - yMin) / ySpan;
      if (d > best) {
        best = d;
        kneeIndex = i;
      }
    });
  }

  const breakIndex = pts.findIndex((p) => p.meetShare !== undefined && p.meetShare < 0.5);
  if (breakIndex === 0) return { kneeIndex, breakIndex, holdsUpTo: null, reason: "fails-immediately" };
  if (breakIndex > 0) return { kneeIndex, breakIndex, holdsUpTo: pts[breakIndex - 1].multiplier, reason: "target" };
  if (kneeIndex !== null) return { kneeIndex, breakIndex: null, holdsUpTo: pts[kneeIndex].multiplier, reason: "knee" };
  return { kneeIndex: null, breakIndex: null, holdsUpTo: null, reason: "none" };
}

const ratioWords = (r: number) => (r >= 4 ? `grows ${r.toFixed(1)}×` : r >= 3 ? "more than triples" : r >= 2 ? "more than doubles" : `rises ${Math.round((r - 1) * 100)}%`);

/** One plain-English sentence for the sweep result. */
export function sweepHeadline(points: SweepPoint[], a: SweepAnalysis, metric: MetricKey, label: string, format: (v: number) => string): string {
  const pts = [...points].sort((p, q) => p.multiplier - q.multiplier);
  const last = pts[pts.length - 1];
  const x = (m: number) => `${Number(m.toFixed(2))}×`;
  if (a.reason === "fails-immediately") return `Your targets are already missed in most runs at ${x(pts[0].multiplier)} today's demand, the lowest load tested.`;
  if (a.reason === "none" || a.holdsUpTo === null) return `No breaking point up to ${x(last.multiplier)} today's demand: ${label.toLowerCase()} changes smoothly across the whole range.`;
  const at = pts.find((p) => p.multiplier === a.holdsUpTo)!;
  const why = a.reason === "target" ? "most runs miss your targets beyond that" : "that's where the curve bends";
  const worseUp = METRIC_DIRECTION[metric] !== "up";
  let tail = "";
  if (last !== at && at.stat.mean !== 0) {
    const r = last.stat.mean / at.stat.mean;
    tail = worseUp
      ? ` By ${x(last.multiplier)}, ${label.toLowerCase()} ${ratioWords(r)} (${format(at.stat.mean)} → ${format(last.stat.mean)}).`
      : ` By ${x(last.multiplier)}, ${label.toLowerCase()} only goes from ${format(at.stat.mean)} to ${format(last.stat.mean)}.`;
  }
  return `Holds up to about ${x(a.holdsUpTo)} today's demand; ${why}.${tail}`;
}

// ─── Bottlenecks and per-block utilization ───────────────────────────────────

export interface BottleneckShare {
  id: string;
  label: string;
  count: number;
  share: number;
}

export function bottleneckFrequency(results: SimResult[]): BottleneckShare[] {
  const counts = new Map<string, BottleneckShare>();
  for (const r of results) {
    if (!r.bottleneckNodeId) continue;
    const e = counts.get(r.bottleneckNodeId) ?? { id: r.bottleneckNodeId, label: r.bottleneckLabel || r.nodeStats[r.bottleneckNodeId]?.label || r.bottleneckNodeId, count: 0, share: 0 };
    e.count++;
    counts.set(r.bottleneckNodeId, e);
  }
  const n = results.length || 1;
  return [...counts.values()].map((e) => ({ ...e, share: e.count / n })).sort((a, b) => b.count - a.count);
}

export interface BlockUtilization {
  id: string;
  label: string;
  nodeType: string;
  mean: number;
  lo: number;
  hi: number;
}

/** Utilization (%) range per block across runs; only blocks that were ever busy. */
export function blockUtilization(results: SimResult[], riskQ = 0.05): BlockUtilization[] {
  const byId = new Map<string, { label: string; nodeType: string; vals: number[] }>();
  for (const r of results) {
    for (const [id, s] of Object.entries(r.nodeStats ?? {})) {
      if (typeof s?.utilization !== "number") continue;
      const e = byId.get(id) ?? { label: s.label || id, nodeType: s.nodeType, vals: [] };
      e.vals.push(s.utilization * 100);
      byId.set(id, e);
    }
  }
  return [...byId.entries()]
    .filter(([, e]) => e.vals.some((v) => v > 0))
    .map(([id, e]) => {
      const sorted = [...e.vals].sort((a, b) => a - b);
      return { id, label: e.label, nodeType: e.nodeType, mean: summarize(e.vals).mean, lo: percentile(sorted, riskQ), hi: percentile(sorted, 1 - riskQ) };
    })
    .sort((a, b) => b.mean - a.mean);
}

// ─── Export helpers ──────────────────────────────────────────────────────────

export type Cell = string | number | boolean | null | undefined;

/** RFC 4180 CSV: quotes fields containing comma, quote or newline; guards against formula injection. */
export function toCSV(rows: Record<string, Cell>[]): string {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "number" ? (Number.isFinite(v) ? String(Number(v.toPrecision(10))) : "") : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== "number") s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

/** One row per run: every metric, the bottleneck, target pass/fail, and the active conditions. */
export function perRunRows(results: SimResult[], extra: Record<string, Cell> = {}, targets: Target[] = []): Record<string, Cell>[] {
  const passes = runPasses(results, targets);
  const hasTargets = targets.some((t) => t.enabled);
  return results.map((r, i) => {
    const m = runMetrics(r);
    return {
      run: i + 1,
      completed: m.throughput,
      median_wait_s: m.avgWaitTime,
      bottleneck_utilization_pct: m.utilization,
      health_score: m.healthScore,
      total_cost: m.totalCost,
      bottleneck: r.bottleneckLabel,
      engine: r.engine ?? "pyodide",
      ...(hasTargets ? { meets_all_targets: passes[i] } : {}),
      ...extra,
    };
  });
}
