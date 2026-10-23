import type { SimResult } from "./types";

// ─── Distributions ───────────────────────────────────────────────────────────

/** ln Γ(x), Lanczos approximation (g=7, n=9); accurate to ~1e-15 for x > 0. */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta (Numerical Recipes `betacf`, modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p-value P(|T| ≥ |t|) for Student's t with `df` (may be fractional) degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  if (Number.isNaN(t) || !(df > 0)) return NaN;
  if (!Number.isFinite(t)) return 0;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Confidence levels the lab offers. Drives every interval and the significance threshold (α = 1 − level). */
export type ConfidenceLevel = 0.9 | 0.95 | 0.99;
export const CONFIDENCE_LEVELS: ConfidenceLevel[] = [0.9, 0.95, 0.99];

/** Two-sided critical value t* with P(|T| > t*) = 1 − level. Bisection on the exact CDF, so any df works. */
export function tCritical(df: number, level: number = 0.95): number {
  if (!(df > 0)) return NaN;
  const alpha = 1 - level;
  let lo = 0;
  let hi = 1e4;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const tCritical95 = (df: number) => tCritical(df, 0.95);

/** Standard-normal two-sided critical values for the offered levels. */
export function zCritical(level: number): number {
  return level >= 0.99 ? 2.5758293035489 : level >= 0.95 ? 1.9599639845401 : 1.6448536269515;
}

/** Wilson score interval for a proportion k/n (well behaved at 0%, 100% and small n). */
export function wilsonInterval(k: number, n: number, level: number = 0.95): { share: number; lo: number; hi: number } {
  if (n <= 0) return { share: NaN, lo: NaN, hi: NaN };
  const z = zCritical(level);
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { share: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

// ─── Per-metric summary ──────────────────────────────────────────────────────

/** Risk band = the middle share of runs shown as the "bad day / good day" range. q = tail size. */
export type RiskQ = 0.01 | 0.05 | 0.1;
export const RISK_BANDS: { q: RiskQ; label: string }[] = [
  { q: 0.05, label: "P5–P95" },
  { q: 0.1, label: "P10–P90" },
  { q: 0.01, label: "P1–P99" },
];
export const riskBandLabel = (q: number) => `P${Math.round(q * 100)}–P${Math.round((1 - q) * 100)}`;

export interface StatOptions {
  level?: number;
  riskQ?: number;
}

export interface RunStatistic {
  n: number;
  mean: number;
  stdDev: number;     // sample standard deviation (n-1)
  /** Confidence level used for ciLower/ciUpper. */
  level: number;
  ciLower: number;    // CI of the MEAN (Student-t), clamped to the metric's physical bounds
  ciUpper: number;
  /** True when the raw t-interval crossed a physical bound (e.g. below 0) and was clamped. */
  ciClamped: boolean;
  median: number;
  /** Tail size of the risk band (0.05 → P5–P95). */
  riskQ: number;
  /** Low / high percentile of individual runs: the "bad day / good day" range. */
  bandLo: number;
  bandHi: number;
  min: number;
  max: number;
  samples: number[];
}

/** Linear-interpolated percentile (same as numpy's default). `sorted` must be ascending. */
export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Mean, spread and a Student-t confidence interval for the mean.
 * `bounds` = the range the metric can physically take (counts and times can't be negative,
 * utilization can't exceed 100%). The CI is clamped to it and `ciClamped` says so.
 */
export function summarize(raw: number[], bounds: [number, number] = [-Infinity, Infinity], opts: StatOptions = {}): RunStatistic {
  // A missing value (NaN / undefined coerced) must not poison the mean or fake significance.
  const samples = raw.filter((v) => Number.isFinite(v));
  const level = opts.level ?? 0.95;
  const riskQ = opts.riskQ ?? 0.05;
  const n = samples.length;
  if (n === 0) {
    return { n: 0, mean: 0, stdDev: 0, level, ciLower: 0, ciUpper: 0, ciClamped: false, median: 0, riskQ, bandLo: 0, bandHi: 0, min: 0, max: 0, samples: [] };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const stdDev = n > 1 ? Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  // n = 1: the interval is unknowable, so report the point; the UI says "need ≥ 2 runs".
  const margin = n > 1 ? tCritical(n - 1, level) * (stdDev / Math.sqrt(n)) : 0;
  const rawLo = mean - margin;
  const rawHi = mean + margin;
  const ciLower = Math.max(bounds[0], rawLo);
  const ciUpper = Math.min(bounds[1], rawHi);
  return {
    n,
    mean,
    stdDev,
    level,
    ciLower,
    ciUpper,
    ciClamped: ciLower !== rawLo || ciUpper !== rawHi,
    median: percentile(sorted, 0.5),
    riskQ,
    bandLo: percentile(sorted, riskQ),
    bandHi: percentile(sorted, 1 - riskQ),
    min: sorted[0],
    max: sorted[n - 1],
    samples,
  };
}

/** Half-width of the CI as a % of |mean|. Infinity when n < 2 or the mean is 0 with spread. */
export function relativeHalfWidth(samples: number[], level: number = 0.95): number {
  const n = samples.length;
  if (n < 2) return Infinity;
  const s = summarize(samples);
  if (s.stdDev === 0) return 0;
  return s.mean === 0 ? Infinity : ((tCritical(n - 1, level) * s.stdDev) / Math.sqrt(n) / Math.abs(s.mean)) * 100;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export type MetricKey = "throughput" | "avgWaitTime" | "utilization" | "healthScore" | "totalCost";
export const METRIC_KEYS: MetricKey[] = ["throughput", "avgWaitTime", "utilization", "healthScore", "totalCost"];

/** Which direction is better. Utilization is a trade-off (busy staff vs. queue risk), so it's neutral. */
export const METRIC_DIRECTION: Record<MetricKey, "up" | "down" | "neutral"> = {
  throughput: "up",
  avgWaitTime: "down",
  utilization: "neutral",
  healthScore: "up",
  totalCost: "down",
};

export const METRIC_BOUNDS: Record<MetricKey, [number, number]> = {
  throughput: [0, Infinity],
  avgWaitTime: [0, Infinity],
  utilization: [0, 100],
  healthScore: [0, 100],
  totalCost: [0, Infinity],
};

/** One run's headline numbers. Cost is undefined when the model has no cost settings. */
export function runMetrics(r: SimResult): Record<MetricKey, number | undefined> {
  return {
    throughput: Number.isFinite(r.totalCompleted) ? r.totalCompleted : NaN,
    avgWaitTime: r.waitTimePercentiles?.p50 ?? 0,
    utilization: (r.bottleneckNodeId ? r.nodeStats[r.bottleneckNodeId]?.utilization ?? 0 : 0) * 100,
    healthScore: r.healthScore ?? 0,
    totalCost: r.costAnalysis?.totalSystemCost,
  };
}

export interface MonteCarloResult {
  runCount: number;
  results: SimResult[];
  /** Items completed in one simulated run (a count over the run, not a rate). */
  throughput: RunStatistic;
  /** MEDIAN (p50) wait per run, in simulated seconds. Field name kept for compatibility; it is not a mean. */
  avgWaitTime: RunStatistic;
  /** Utilization (%) of whichever station was the bottleneck in that run. */
  utilization: RunStatistic;
  healthScore: RunStatistic;
  totalCost?: RunStatistic;        // present only when every run has cost data and some cost is set
}

export function aggregateMonteCarloRuns(results: SimResult[], opts: StatOptions = {}): MonteCarloResult {
  const rows = results.map(runMetrics);
  // Missing values become NaN and are dropped by summarize (so n can be < runCount for that metric).
  const col = (k: MetricKey) => summarize(rows.map((r) => r[k] ?? NaN), METRIC_BOUNDS[k], opts);
  const costs = rows.map((r) => r.totalCost).filter((v): v is number => v !== undefined);
  return {
    runCount: results.length,
    results,
    throughput: col("throughput"),
    avgWaitTime: col("avgWaitTime"),
    utilization: col("utilization"),
    healthScore: col("healthScore"),
    // All-zero cost means no cost parameters on the canvas: hide it rather than show "$0".
    totalCost: costs.length === results.length && costs.some((c) => c !== 0) ? summarize(costs, METRIC_BOUNDS.totalCost, opts) : undefined,
  };
}

/** The metrics present in a result (cost only when the model has cost settings). */
export const metricsOf = (mc: MonteCarloResult): MetricKey[] => METRIC_KEYS.filter((k) => mc[k] !== undefined);

// ─── Welch's t-test ──────────────────────────────────────────────────────────

export interface DifferenceTest {
  /** meanB − meanA */
  diff: number;
  /** CI of (meanB − meanA) at `level`, Welch–Satterthwaite. */
  ciLower: number;
  ciUpper: number;
  t: number;
  df: number;
  /** Two-sided p-value. NaN when either side has < 2 runs. */
  pValue: number;
  /** p < 1 − level */
  significant: boolean;
  /** % change relative to A, or null when A's mean is 0 (show the absolute change instead). */
  pct: number | null;
  level: number;
}

export type MeanSummary = { n: number; mean: number; stdDev: number };

/** Welch's t-test from summary statistics, so stored aggregates (run history) can be compared too. */
export function welchFromStats(sa: MeanSummary, sb: MeanSummary, level: number = 0.95): DifferenceTest {
  const diff = sb.mean - sa.mean;
  const pct = sa.mean !== 0 && Number.isFinite(diff) ? (diff / Math.abs(sa.mean)) * 100 : null;
  const finite = [sa.mean, sb.mean, sa.stdDev, sb.stdDev].every(Number.isFinite);
  if (sa.n < 2 || sb.n < 2 || !finite) {
    return { diff, ciLower: NaN, ciUpper: NaN, t: NaN, df: NaN, pValue: NaN, significant: false, pct, level };
  }
  const va = sa.stdDev ** 2 / sa.n;
  const vb = sb.stdDev ** 2 / sb.n;
  const se = Math.sqrt(va + vb);
  if (se === 0) {
    // Both sides are deterministic (every run identical): any difference is exact.
    const df = sa.n + sb.n - 2;
    return { diff, ciLower: diff, ciUpper: diff, t: diff === 0 ? 0 : Math.sign(diff) * Infinity, df, pValue: diff === 0 ? 1 : 0, significant: diff !== 0, pct, level };
  }
  const df = (va + vb) ** 2 / ((va * va) / (sa.n - 1) + (vb * vb) / (sb.n - 1));
  const t = diff / se;
  const pValue = tTwoSidedP(t, df);
  const margin = tCritical(df, level) * se;
  return { diff, ciLower: diff - margin, ciUpper: diff + margin, t, df, pValue, significant: pValue < 1 - level, pct, level };
}

export function welchTest(a: number[], b: number[], level: number = 0.95): DifferenceTest {
  return welchFromStats(summarize(a), summarize(b), level);
}

// ─── Scenario comparison (N scenarios vs a baseline) ─────────────────────────

export interface MetricComparison extends DifferenceTest {
  key: MetricKey;
  direction: "up" | "down" | "neutral";
  /** Which side is better on this metric; null if not significant or the metric is neutral. */
  better: "baseline" | "scenario" | null;
}

/** Compare one scenario's metrics against the baseline's. */
export function compareMetrics(base: MonteCarloResult, other: MonteCarloResult, level: number = 0.95): MetricComparison[] {
  return METRIC_KEYS.filter((k) => base[k] && other[k]).map((key): MetricComparison => {
    const test = welchFromStats(base[key]!, other[key]!, level);
    const direction = METRIC_DIRECTION[key];
    let better: MetricComparison["better"] = null;
    if (test.significant && direction !== "neutral" && test.diff !== 0) {
      better = (test.diff > 0) === (direction === "up") ? "scenario" : "baseline";
    }
    return { key, direction, better, ...test };
  });
}

export interface ScenarioRun {
  id: string;
  name: string;
  color: string;
  mc: MonteCarloResult;
}

export interface ScenarioComparisonResult {
  baselineId: string;
  level: number;
  scenarios: ScenarioRun[];
  /** Per non-baseline scenario id: its metrics vs the baseline. */
  vsBaseline: Record<string, MetricComparison[]>;
}

export function compareScenarios(scenarios: ScenarioRun[], baselineId: string, level: number = 0.95): ScenarioComparisonResult {
  const base = scenarios.find((s) => s.id === baselineId) ?? scenarios[0];
  const vsBaseline: Record<string, MetricComparison[]> = {};
  for (const s of scenarios) if (s.id !== base.id) vsBaseline[s.id] = compareMetrics(base.mc, s.mc, level);
  return { baselineId: base.id, level, scenarios, vsBaseline };
}
