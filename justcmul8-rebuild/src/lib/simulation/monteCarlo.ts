import type { SimResult, SimGraph } from "./types";

export interface RunStatistic {
  mean: number;
  ciLower: number;   // 95% CI lower bound
  ciUpper: number;   // 95% CI upper bound
  stdDev: number;
  samples: number[];
}

/**
 * Standard 95% CI using normal approximation: mean ± 1.96 * (stdDev / sqrt(n))
 */
export function computeConfidenceInterval(samples: number[]): RunStatistic {
  if (!samples || samples.length === 0) {
    return { mean: 0, ciLower: 0, ciUpper: 0, stdDev: 0, samples: [] };
  }
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  if (n <= 1) {
    return { mean, ciLower: mean, ciUpper: mean, stdDev: 0, samples };
  }
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const marginOfError = 1.96 * (stdDev / Math.sqrt(n));
  return {
    mean,
    ciLower: Math.max(0, mean - marginOfError),
    ciUpper: mean + marginOfError,
    stdDev,
    samples,
  };
}

export interface MonteCarloResult {
  runCount: number;
  results: SimResult[];
  throughput: RunStatistic;
  avgWaitTime: RunStatistic;
  utilization: RunStatistic;       // mean utilization across bottleneck node per run
  healthScore: RunStatistic;
  totalCost?: RunStatistic;        // present if cost params are set
}

export function aggregateMonteCarloRuns(results: SimResult[]): MonteCarloResult {
  const throughputSamples = results.map((r) => r.totalCompleted);
  const waitSamples = results.map((r) => r.waitTimePercentiles?.p50 ?? 0);
  const utilSamples = results.map((r) => {
    const b = r.bottleneckNodeId ? r.nodeStats[r.bottleneckNodeId] : null;
    return (b?.utilization ?? 0) * 100;
  });
  const healthSamples = results.map((r) => r.healthScore ?? 0);
  const costSamples = results
    .map((r) => r.costAnalysis?.totalSystemCost)
    .filter((v): v is number => v !== undefined);

  return {
    runCount: results.length,
    results,
    throughput: computeConfidenceInterval(throughputSamples),
    avgWaitTime: computeConfidenceInterval(waitSamples),
    utilization: computeConfidenceInterval(utilSamples),
    healthScore: computeConfidenceInterval(healthSamples),
    totalCost: costSamples.length === results.length && costSamples.length > 0
      ? computeConfidenceInterval(costSamples)
      : undefined,
  };
}

export interface ScenarioSnapshot {
  id: string;
  name: string;
  graph: SimGraph;
  updatedAt: string;
}

export interface ScenarioComparisonResult {
  scenarioA: { name: string; mc: MonteCarloResult };
  scenarioB: { name: string; mc: MonteCarloResult };
  deltas: {
    throughputPct: number;    // ((B - A) / A) * 100
    avgWaitTimePct: number;   // ((B - A) / A) * 100 (negative is better)
    utilizationPct: number;   // ((B - A) / A) * 100
    healthScoreDiff: number;  // B - A points
    costSavingsPct?: number;  // ((A - B) / A) * 100 (positive is better)
    savedCost?: number;       // A.cost - B.cost
  };
}

export function compareScenarios(
  nameA: string,
  mcA: MonteCarloResult,
  nameB: string,
  mcB: MonteCarloResult
): ScenarioComparisonResult {
  const throughputA = mcA.throughput.mean || 1;
  const throughputB = mcB.throughput.mean;
  const throughputPct = ((throughputB - throughputA) / throughputA) * 100;

  const waitA = mcA.avgWaitTime.mean || 0.001;
  const waitB = mcB.avgWaitTime.mean;
  const avgWaitTimePct = ((waitB - waitA) / waitA) * 100;

  const utilA = mcA.utilization.mean || 1;
  const utilB = mcB.utilization.mean;
  const utilizationPct = ((utilB - utilA) / utilA) * 100;

  const healthScoreDiff = mcB.healthScore.mean - mcA.healthScore.mean;

  let costSavingsPct: number | undefined;
  let savedCost: number | undefined;

  if (mcA.totalCost && mcB.totalCost) {
    const costA = mcA.totalCost.mean;
    const costB = mcB.totalCost.mean;
    savedCost = costA - costB;
    costSavingsPct = costA > 0 ? ((costA - costB) / costA) * 100 : 0;
  }

  return {
    scenarioA: { name: nameA, mc: mcA },
    scenarioB: { name: nameB, mc: mcB },
    deltas: {
      throughputPct,
      avgWaitTimePct,
      utilizationPct,
      healthScoreDiff,
      costSavingsPct,
      savedCost,
    },
  };
}
