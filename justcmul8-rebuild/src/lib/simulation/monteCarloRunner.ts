import type { SimParams, SimResult } from "./types";

export interface MonteCarloProgress {
  completedRuns: number;
  totalRuns: number;
  statusText?: string;
}

/**
 * The slice of a SimulationEngine a batch needs. onComplete/onError may return an
 * unsubscribe function (PyodideSimEngine does); engines that don't are still safe
 * because a settled batch ignores late callbacks.
 */
export interface BatchEngine {
  start(params: SimParams): void;
  stop(): void;
  /**
   * Hard reset (terminate the worker). Used on cancel when available: a synchronous worker
   * queues "stop" behind the in-flight run, whose late result would otherwise be counted as
   * run 1 of the next batch. The engine must re-initialise itself on the next start().
   */
  destroy?(): void;
  onComplete(cb: (result: SimResult) => void): (() => void) | void;
  onError(cb: (error: string) => void): (() => void) | void;
}

// One batch per engine at a time: a second batch would receive the first one's results.
const busyEngines = new WeakSet<BatchEngine>();

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Runs the same SimParams `runCount` times back-to-back on `engine` and resolves with the
 * raw results (callers enrich them). Each run draws fresh random numbers in the engine,
 * so the spread across runs is the model's natural variability.
 * `runCount` is the maximum; `stopWhen` (checked after each run) can end the batch early,
 * e.g. once the confidence interval is tight enough. `map` transforms each raw result
 * (callers pass enrichSimResult) before it is stored and before `stopWhen` sees it.
 * Rejects with an AbortError when `signal` aborts, and with the engine's error message
 * (prefixed by the failing run number) if any run fails.
 */
export function runMonteCarlo(
  engine: BatchEngine,
  params: SimParams,
  runCount: number,
  opts: {
    onProgress?: (p: MonteCarloProgress) => void;
    signal?: AbortSignal;
    map?: (raw: SimResult) => SimResult;
    stopWhen?: (results: SimResult[]) => boolean;
  } = {}
): Promise<SimResult[]> {
  const { onProgress, signal, map, stopWhen } = opts;
  return new Promise((resolve, reject) => {
    if (busyEngines.has(engine)) {
      reject(new Error("Another batch is already running. Wait for it to finish or cancel it first."));
      return;
    }
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    busyEngines.add(engine);

    const results: SimResult[] = [];
    let settled = false;
    const unsubs: Array<(() => void) | void> = [];

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      busyEngines.delete(engine);
      unsubs.forEach((u) => typeof u === "function" && u());
      signal?.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve(results);
    };

    const startNext = () => {
      try {
        engine.start(params);
      } catch (e) {
        finish(new Error(`Run ${results.length + 1} of ${runCount} failed: ${e instanceof Error ? e.message : String(e)}`));
      }
    };

    function onAbort() {
      if (engine.destroy) engine.destroy();
      else engine.stop();
      finish(new DOMException("Cancelled", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort);

    unsubs.push(
      engine.onComplete((raw) => {
        if (settled) return;
        const runNo = results.length + 1;
        try {
          results.push(map ? map(raw) : raw);
          onProgress?.({ completedRuns: results.length, totalRuns: runCount, statusText: `Completed run ${results.length} of ${runCount}` });
          if (results.length >= runCount || stopWhen?.(results)) finish(null);
          else startNext();
        } catch (e) {
          finish(new Error(`Run ${runNo} of ${runCount} could not be processed: ${e instanceof Error ? e.message : String(e)}`));
        }
      }),
      engine.onError((err) => {
        finish(new Error(`Run ${results.length + 1} of ${runCount} failed: ${err}`));
      })
    );

    onProgress?.({ completedRuns: 0, totalRuns: runCount, statusText: `Starting run 1 of ${runCount}` });
    startNext();
  });
}
