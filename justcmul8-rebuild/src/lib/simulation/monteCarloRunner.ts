import type { SimulationEngine, SimParams, SimResult } from "./types";
import { enrichSimResult } from "./analyticsEngine";

export interface MonteCarloProgress {
  completedRuns: number;
  totalRuns: number;
  statusText?: string;
}

/**
 * Runs the same SimParams N times sequentially against the given engine,
 * enriching each result with graph parameters, and reporting progress after each run.
 */
export function runMonteCarlo(
  engine: SimulationEngine,
  params: SimParams,
  runCount: number,
  onProgress: (p: MonteCarloProgress) => void
): Promise<SimResult[]> {
  return new Promise((resolve, reject) => {
    const results: SimResult[] = [];
    let settled = false;

    engine.onComplete((raw) => {
      if (settled) return;
      const enriched = enrichSimResult(raw, params.graph);
      results.push(enriched);
      onProgress({
        completedRuns: results.length,
        totalRuns: runCount,
        statusText: `Completed run ${results.length} of ${runCount}...`,
      });

      if (results.length >= runCount) {
        settled = true;
        resolve(results);
      } else {
        // Run next iteration
        engine.start(params);
      }
    });

    engine.onError((err) => {
      if (settled) return;
      settled = true;
      reject(new Error(err));
    });

    // Start first run
    onProgress({
      completedRuns: 0,
      totalRuns: runCount,
      statusText: `Starting run 1 of ${runCount}...`,
    });
    engine.start(params);
  });
}
