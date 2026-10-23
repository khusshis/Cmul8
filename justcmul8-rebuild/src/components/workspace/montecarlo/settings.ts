import type { ConfidenceLevel, MetricKey, RiskQ } from "@/lib/simulation/monteCarlo";
import type { StressConditions } from "@/lib/simulation/stressTransforms";
import type { Target } from "@/lib/simulation/stressAnalysis";
import { WEIGHT_PRESETS, type UtilBand, type Weights } from "@/lib/simulation/decisionScore";

export type TimeUnit = "secs" | "mins" | "hrs" | "days";
export const UNIT_SECONDS: Record<TimeUnit, number> = { secs: 1, mins: 60, hrs: 3600, days: 86400 };

export const MIN_RUNS = 5;
export const MAX_RUNS = 500;
/** Hard cap for a breaking-point sweep (steps × runs per step). */
export const MAX_SWEEP_RUNS = 600;

/** Everything a user can customise in the lab; persisted per project. */
export interface LabSettings {
  runs: number;
  mode: "fixed" | "precise";
  /** Stop when the CI half-width is ≤ this % of the mean. */
  precisionPct: number;
  precisionMetric: MetricKey;
  maxRuns: number;
  duration: { override: boolean; value: number; unit: TimeUnit };
  level: ConfidenceLevel;
  riskQ: RiskQ;
  conditions: StressConditions;
  targets: Target[];
  sweep: { from: number; to: number; steps: number; runsPerStep: number; metric: MetricKey };
  compareRuns: number;
  weights: Weights;
  weightPreset: string;
  utilBand: UtilBand;
  hiddenMetrics: MetricKey[];
}

export const DEFAULT_TARGETS: Target[] = [
  { metric: "avgWaitTime", op: "max", value: 120, enabled: false },
  { metric: "throughput", op: "min", value: 100, enabled: false },
  { metric: "utilization", op: "max", value: 85, enabled: false },
  { metric: "healthScore", op: "min", value: 70, enabled: false },
  { metric: "totalCost", op: "max", value: 1000, enabled: false },
];

export const DEFAULT_SETTINGS: LabSettings = {
  runs: 20,
  mode: "fixed",
  precisionPct: 5,
  precisionMetric: "throughput",
  maxRuns: 200,
  duration: { override: false, value: 1, unit: "hrs" },
  level: 0.95,
  riskQ: 0.05,
  conditions: { demand: 1, service: 1, capacityDelta: 0 },
  targets: DEFAULT_TARGETS,
  sweep: { from: 0.5, to: 2, steps: 7, runsPerStep: 10, metric: "avgWaitTime" },
  compareRuns: 20,
  weights: WEIGHT_PRESETS[0].weights,
  weightPreset: WEIGHT_PRESETS[0].id,
  utilBand: [70, 85],
  hiddenMetrics: [],
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Defensive merge of stored settings (older versions, hand edits) over the defaults. */
export function normalizeSettings(s: LabSettings): LabSettings {
  const d = DEFAULT_SETTINGS;
  const targets = d.targets.map((t) => ({ ...t, ...(s.targets ?? []).find((x) => x?.metric === t.metric) }));
  return {
    ...d,
    ...s,
    runs: clamp(Math.round(Number(s.runs) || d.runs), MIN_RUNS, MAX_RUNS),
    maxRuns: clamp(Math.round(Number(s.maxRuns) || d.maxRuns), MIN_RUNS, MAX_RUNS),
    duration: { ...d.duration, ...s.duration },
    conditions: { ...d.conditions, ...s.conditions },
    sweep: { ...d.sweep, ...s.sweep },
    weights: { ...d.weights, ...s.weights },
    targets,
    hiddenMetrics: Array.isArray(s.hiddenMetrics) ? s.hiddenMetrics : [],
    utilBand: Array.isArray(s.utilBand) && s.utilBand.length === 2 ? s.utilBand : d.utilBand,
  };
}
