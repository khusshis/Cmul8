/**
 * What the single-run results show (arrivals, people left behind, KPI cards, a per-station table,
 * the suggested fix), summarised across every run of a Monte Carlo batch: the average plus the
 * range the middle runs fell in.
 */
import type { NodeStats, SimResult, SimTypeId } from "./types";
import { SIM_TYPE_REGISTRY } from "./simTypeRegistry";
import { resolveKpiMetrics } from "./resolveKpiMetrics";
import { hasUtilization, isServerNode, lostCount, stillInsideCount } from "./analyticsEngine";
import { percentile } from "./monteCarlo";

export interface Spread {
  mean: number;
  /** riskQ / 1 − riskQ percentiles across runs (the "typical range"). */
  lo: number;
  hi: number;
  n: number;
}

export function spread(values: number[], riskQ = 0.05): Spread {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  return { mean: v.reduce((a, b) => a + b, 0) / v.length, lo: percentile(v, riskQ), hi: percentile(v, 1 - riskQ), n: v.length };
}

export interface StationSummary {
  id: string;
  label: string;
  nodeType: string;
  arrived: Spread;
  finished: Spread;
  avgWait: Spread;
  /** Busy % (fill % for tanks); undefined where it isn't meaningful. */
  busy?: Spread;
  /** Waiting at the end of the run (a server's in-service share excluded). */
  inLine: Spread;
  lost: Spread;
  /** Share of runs where this station was the bottleneck. */
  bottleneckShare: number;
}

export interface RunDetails {
  arrived: Spread;
  finishedPct: Spread;
  stillInside: Spread;
  lost: Spread;
  typicalVisit: Spread;
  slowWait: Spread;
  avgInside: Spread;
  kpis: { key: string; label: string; unit: string; isPct: boolean; value: Spread }[];
  stations: StationSummary[];
  /** The suggestion that came up most often as a run's top suggestion. */
  topRec: { title: string; action: string; impact: string; share: number } | null;
}

const waitingAtEnd = (s: NodeStats) =>
  s.nodeType === "queue" || s.nodeType === "store"
    ? s.currentDepth
    : isServerNode(s)
      ? Math.max(0, s.currentDepth - Math.max(1, s.capacity ?? 1))
      : 0;

export function summarizeRuns(results: SimResult[], simType: SimTypeId, riskQ = 0.05): RunDetails {
  const sp = (f: (r: SimResult) => number) => spread(results.map(f), riskQ);
  const config = SIM_TYPE_REGISTRY[simType] ?? SIM_TYPE_REGISTRY.human_queue;

  // KPI cards: resolve per run, then summarise each card's headline value.
  const perRun = results.map((r) => resolveKpiMetrics(config.kpiMetrics, r));
  const kpis = (perRun[0] ?? []).map((k, i) => ({
    key: k.key,
    label: k.label,
    unit: k.unit,
    isPct: k.key === "utilization" || k.unit === "%",
    value: spread(perRun.map((ks) => ks[i]?.value ?? NaN), riskQ),
  })).filter((k) => k.value.n > 0);

  // Stations: every block that ever appears, in the order of the first run.
  const ids = [...new Set(results.flatMap((r) => Object.keys(r.nodeStats ?? {})))];
  const stations = ids.map((id) => {
    const runs = results.map((r) => r.nodeStats?.[id]).filter((s): s is NodeStats => !!s);
    const s0 = runs[0];
    const of = (f: (s: NodeStats) => number) => spread(runs.map(f), riskQ);
    return {
      id,
      label: s0?.label ?? id,
      nodeType: s0?.nodeType ?? "",
      arrived: of((s) => s.entitiesIn),
      finished: of((s) => s.entitiesOut),
      avgWait: of((s) => s.avgWaitTime),
      busy: s0 && hasUtilization(s0) ? of((s) => s.utilization * 100) : undefined,
      inLine: of(waitingAtEnd),
      lost: of((s) => (s.droppedCount ?? 0) + (s.renegeCount ?? 0)),
      bottleneckShare: results.length ? results.filter((r) => r.bottleneckNodeId === id).length / results.length : 0,
    };
  });

  // Most frequent top suggestion. Titles carry run-specific numbers ("2 → 5"), so group on the
  // fix target, or the title with digits blanked, and show the run nearest the group's middle.
  const groups = new Map<string, SimResult[]>();
  for (const r of results) {
    const rec = r.aiDiagnosis?.recommendations?.[0] as ({ fix?: { nodeId: string } } & { title: string }) | undefined;
    if (!rec) continue;
    const key = rec.fix?.nodeId ? `fix:${rec.fix.nodeId}` : rec.title.replace(/[\d.,]+/g, "#");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  let topRec: RunDetails["topRec"] = null;
  if (best) {
    const mid = [...best].sort((a, b) => a.totalCompleted - b.totalCompleted)[Math.floor(best.length / 2)];
    const rec = mid.aiDiagnosis!.recommendations[0];
    topRec = { title: rec.title, action: rec.action, impact: rec.impact, share: best.length / results.length };
  }

  return {
    arrived: sp((r) => r.totalArrived),
    finishedPct: sp((r) => (r.totalArrived > 0 ? (r.totalCompleted / r.totalArrived) * 100 : 100)),
    stillInside: sp(stillInsideCount),
    lost: sp(lostCount),
    typicalVisit: sp((r) => r.cycleTimePercentiles?.p50 ?? NaN),
    slowWait: sp((r) => r.waitTimePercentiles?.p95 ?? NaN),
    avgInside: sp((r) => r.littlesLaw?.timeWeightedWIP_L ?? NaN),
    kpis,
    stations,
    topRec,
  };
}
