import { METRIC_DIRECTION, welchFromStats, type MeanSummary, type MetricKey } from "./monteCarlo";

export type Weights = Record<MetricKey, number>;

export const WEIGHT_PRESETS: { id: string; label: string; help: string; weights: Weights }[] = [
  { id: "balanced", label: "Balanced", help: "Every metric counts about the same.", weights: { throughput: 3, avgWaitTime: 3, utilization: 2, healthScore: 2, totalCost: 3 } },
  { id: "speed", label: "Speed first", help: "Finishing more work, faster, matters most.", weights: { throughput: 5, avgWaitTime: 4, utilization: 1, healthScore: 1, totalCost: 1 } },
  { id: "cost", label: "Cost first", help: "The cheapest setup that still works wins.", weights: { throughput: 2, avgWaitTime: 1, utilization: 2, healthScore: 1, totalCost: 5 } },
  { id: "experience", label: "Customer experience", help: "Short waits and a healthy system matter most.", weights: { throughput: 2, avgWaitTime: 5, utilization: 1, healthScore: 3, totalCost: 1 } },
];

/** Utilization's ideal range in %, since busier isn't simply better or worse. */
export type UtilBand = [number, number];

/** How far a utilization value sits outside the ideal band (0 inside it). */
export const bandDistance = (u: number, [lo, hi]: UtilBand) => Math.max(0, lo - u, u - hi);

export interface ScoreEntry {
  id: string;
  means: Partial<Record<MetricKey, number>>;
}

export interface ScoredEntry {
  id: string;
  /** 0–100, weighted average of per-metric scores. */
  score: number;
  /** Per-metric 0–1 score (1 = best of the scenarios on that metric). */
  parts: Partial<Record<MetricKey, number>>;
}

/**
 * Gaps smaller than this share of a metric's size don't use the full 0–1 range, so two
 * near-identical scenarios score ~100 and ~99 instead of 100 and 0 (plain min–max
 * normalisation stretches run-to-run noise into a fake landslide).
 */
const MIN_SCALE_SHARE = 0.25;
/** Same idea for utilization, in percentage points away from the ideal band. */
const MIN_UTIL_SCALE = 25;

/**
 * Normalise each metric across scenarios (best = 1, a gap of max(actual spread, 25% of the
 * metric's size) = 0), utilization by distance from the ideal band, then take the weighted
 * average. Metrics missing from any scenario, or with weight 0, are skipped.
 */
export function scoreScenarios(entries: ScoreEntry[], weights: Weights, band: UtilBand): ScoredEntry[] {
  const keys = (Object.keys(weights) as MetricKey[]).filter((k) => weights[k] > 0 && entries.every((e) => Number.isFinite(e.means[k])));
  const parts = entries.map(() => ({}) as Partial<Record<MetricKey, number>>);
  for (const k of keys) {
    // Higher "goodness" is better for every metric after this transform.
    const good = entries.map((e) => {
      const v = e.means[k]!;
      if (k === "utilization") return -bandDistance(v, band);
      return METRIC_DIRECTION[k] === "down" ? -v : v;
    });
    const best = Math.max(...good);
    const span = best - Math.min(...good);
    const floor = k === "utilization" ? MIN_UTIL_SCALE : MIN_SCALE_SHARE * Math.max(...good.map(Math.abs));
    const scale = Math.max(span, floor);
    good.forEach((g, i) => (parts[i][k] = scale > 0 ? 1 - (best - g) / scale : 1));
  }
  const total = keys.reduce((a, k) => a + weights[k], 0);
  return entries
    .map((e, i) => ({ id: e.id, parts: parts[i], score: total > 0 ? (keys.reduce((a, k) => a + weights[k] * parts[i][k]!, 0) / total) * 100 : 0 }))
    .sort((a, b) => b.score - a.score);
}

export interface WinnerCall {
  winnerId: string | null;
  leaderId: string | null;
  runnerUpId: string | null;
  topMetric: MetricKey | null;
  reason: "clear" | "single" | "not-significant" | "leader-worse-on-top" | "tie";
}

/**
 * Only call a clear winner when the leader beats the runner-up on the most heavily weighted
 * metric by a statistically significant margin (Welch, at `level`). Otherwise it's "close".
 */
export function pickWinner(
  ranked: ScoredEntry[],
  stats: Record<string, Partial<Record<MetricKey, MeanSummary>>>,
  weights: Weights,
  band: UtilBand,
  level = 0.95
): WinnerCall {
  const [leader, runner] = ranked;
  if (!leader) return { winnerId: null, leaderId: null, runnerUpId: null, topMetric: null, reason: "tie" };
  if (!runner) return { winnerId: leader.id, leaderId: leader.id, runnerUpId: null, topMetric: null, reason: "single" };
  const usable = (Object.keys(weights) as MetricKey[]).filter((k) => weights[k] > 0 && stats[leader.id]?.[k] && stats[runner.id]?.[k]);
  const topMetric = usable.sort((a, b) => weights[b] - weights[a])[0] ?? null;
  const base = { leaderId: leader.id, runnerUpId: runner.id, topMetric };
  if (!topMetric || leader.score - runner.score < 1e-9) return { ...base, winnerId: null, reason: "tie" };
  const a = stats[runner.id][topMetric]!;
  const b = stats[leader.id][topMetric]!;
  const t = welchFromStats(a, b, level);
  if (!t.significant) return { ...base, winnerId: null, reason: "not-significant" };
  const leaderBetter =
    topMetric === "utilization"
      ? bandDistance(b.mean, band) < bandDistance(a.mean, band)
      : METRIC_DIRECTION[topMetric] === "down"
        ? b.mean < a.mean
        : b.mean > a.mean;
  return leaderBetter ? { ...base, winnerId: leader.id, reason: "clear" } : { ...base, winnerId: null, reason: "leader-worse-on-top" };
}
