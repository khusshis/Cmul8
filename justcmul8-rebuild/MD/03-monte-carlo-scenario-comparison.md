# Feature: Monte Carlo Multi-Run & Scenario Comparison

## Status before this feature
**Not started (0%).** Confirmed by grep: no matches for "monte carlo" or "confidence interval" in `src/`. Every existing usage of the word "scenario" refers to `StarterGraph` template scenarios (`simTypeRegistry.ts`), not statistical runs. `handleRun()` in `page.tsx:266` calls `engineRef.current.start()` exactly once — there is no loop, no aggregation, no stats layer.

## What this feature does
Two related capabilities, built together because they share the same "run N times" infrastructure:
1. **Monte Carlo Multi-Run** — run the same graph N times (20/50/100), aggregate KPIs across runs, and show a mean ± 95% confidence interval band on the charts instead of a single noisy line. This is the single most important feature for academic credibility — professors will ask "you ran this once with a random seed, how do you know that's representative?" and this answers it directly.
2. **Scenario A/B Comparison** — store two named graph snapshots (Baseline vs Optimized) and run Monte Carlo on both, then show them side-by-side.

---

## Why the current engine architecture needs a wrapper, not a rewrite

The simulation engine (`PyodideSimEngine` in `src/lib/simulation/pyodideEngine.ts`) is fundamentally single-run: `start()` kicks off exactly one Python SimPy execution inside the worker and resolves via `onComplete`. The correct approach is **not** to modify the engine — it's to add an orchestrator layer above it that calls `start()` N times sequentially, waits for each `onComplete`, collects results, and only then triggers the aggregation math. This keeps the existing single-run flow (used by every other tab) completely untouched.

---

## Implementation plan

### Step 1 — Statistics helper functions

New file: `src/lib/simulation/monteCarlo.ts`

```ts
import type { SimResult } from "./types";

export interface RunStatistic {
  mean: number;
  ciLower: number;   // 95% CI lower bound
  ciUpper: number;   // 95% CI upper bound
  stdDev: number;
  samples: number[];
}

/** Standard 95% CI using the normal approximation: mean ± 1.96 * (stdDev / sqrt(n)) */
export function computeConfidenceInterval(samples: number[]): RunStatistic {
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const stdDev = Math.sqrt(variance);
  const marginOfError = 1.96 * (stdDev / Math.sqrt(n));
  return { mean, ciLower: mean - marginOfError, ciUpper: mean + marginOfError, stdDev, samples };
}

export interface MonteCarloResult {
  runCount: number;
  results: SimResult[];
  throughput: RunStatistic;
  avgWaitTime: RunStatistic;
  utilization: RunStatistic;       // mean utilization across bottleneck node per run
  healthScore: RunStatistic;
  totalCost?: RunStatistic;        // present if cost params are set (see MD 01)
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
    totalCost: costSamples.length === results.length ? computeConfidenceInterval(costSamples) : undefined,
  };
}
```

### Step 2 — Run orchestrator (sequential N-run loop)

New file: `src/lib/simulation/monteCarloRunner.ts`

This wraps the *existing* `SimulationEngine` interface — it does not touch `PyodideSimEngine` internals. It creates its own engine instances (cheap — `PyodideSimEngine` reuses the persistent worker) or, simpler and safer, reuses one engine instance and calls `start()` repeatedly, awaiting each `onComplete` before starting the next run (SimPy scripts use Python's `random` module with no fixed seed today — verify in `codeGenerator.ts`'s `PYTHON_TEMPLATE`; if there's no explicit `random.seed(...)` call, each run is naturally independent, which is exactly what Monte Carlo needs — do NOT add a fixed seed, that would make every run identical and defeat the purpose):

```ts
import type { SimulationEngine, SimParams, SimResult } from "./types";
import { enrichSimResult } from "./analyticsEngine";

export interface MonteCarloProgress {
  completedRuns: number;
  totalRuns: number;
}

/**
 * Runs the same SimParams N times sequentially against the given engine,
 * enriching each result, and reporting progress after each run.
 * Reuses the caller's existing engine instance (e.g. engineRef.current from page.tsx)
 * rather than spinning up new Pyodide workers — those are expensive to boot (WASM load).
 */
export function runMonteCarlo(
  engine: SimulationEngine,
  params: SimParams,
  runCount: number,
  onProgress: (p: MonteCarloProgress) => void
): Promise<SimResult[]> {
  return new Promise((resolve, reject) => {
    const results: SimResult[] = [];

    function runOne() {
      const onComplete = (raw: SimResult) => {
        results.push(enrichSimResult(raw));
        onProgress({ completedRuns: results.length, totalRuns: runCount });
        if (results.length >= runCount) {
          cleanup();
          resolve(results);
        } else {
          runOne();
        }
      };
      const onError = (err: string) => {
        cleanup();
        reject(new Error(err));
      };

      // NOTE: SimulationEngine.onComplete/.onError use Set<callback> (see types.ts) — they
      // ADD listeners, they don't replace them. Calling engine.start() N times without
      // removing old listeners will cause each prior run's callback to also fire again.
      // Since PyodideSimEngine doesn't expose an "off" method, the practical fix is to wrap
      // a ONE-SHOT dispatcher here: register a single onComplete/onError pair before the loop
      // starts (not inside runOne), and have it decide what to do based on how many results
      // are collected so far. Restructure as shown in Step 2b below.
      engine.start(params);
    }

    function cleanup() {}
    runOne();
  });
}
```

**Step 2b — the listener-accumulation problem, solved properly.** Because `onTickCallbacks`/`onCompleteCallbacks`/`onErrorCallbacks` in `PyodideSimEngine` (`src/lib/simulation/pyodideEngine.ts:16-19`) are `Set`s that callers add to via `onTick()`/`onComplete()`/`onError()` and there is no corresponding `off()`/`removeListener()` method, the correct implementation registers **exactly one** `onComplete` handler before the loop begins, and that handler's own closure tracks progress and decides whether to fire `start()` again:

```ts
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
      if (settled) return; // ignore stray completions after we've resolved/rejected
      results.push(enrichSimResult(raw));
      onProgress({ completedRuns: results.length, totalRuns: runCount });
      if (results.length >= runCount) {
        settled = true;
        resolve(results);
      } else {
        engine.start(params);
      }
    });

    engine.onError((err) => {
      if (settled) return;
      settled = true;
      reject(new Error(err));
    });

    engine.start(params);
  });
}
```

**Caveat this creates:** because the caller (`page.tsx`) already has its own `onComplete`/`onError` listeners registered on `engineRef.current` for the normal single-run flow (`page.tsx:110-134`), those listeners will ALSO fire during every Monte Carlo run (saving N spurious `simulation_runs` rows, flashing `setSimTick`/`setSimResult` state N times). Two ways to handle this — pick one explicitly, don't leave it ambiguous:
- **(Recommended, simplest)** Instantiate a *second, dedicated* `PyodideSimEngine` for Monte Carlo runs (`new PyodideSimEngine()` + `.init()`), separate from `engineRef.current`. Costs one extra WASM boot (~1-2s, one time, on first Monte Carlo click) but completely avoids cross-talk with the main single-run UI state. Store it in a new `monteCarloEngineRef = useRef<PyodideSimEngine | null>(null)` in `page.tsx`, lazily created on first use.
- (Alternative) Add a `suppressNormalHandlers` boolean ref that the main `onComplete` handler checks and early-returns on while a Monte Carlo batch is in flight. More fragile — prefer the dedicated-engine approach.

### Step 3 — UI: a "Run Monte Carlo" control + progress + results panel

New component: `src/components/workspace/MonteCarloPanel.tsx`

Trigger point: add a button next to the existing Run/Pause/Stop controls in `page.tsx` toolbar (near `handleRun` at line 266), e.g. "🎲 Run 20x (Monte Carlo)" that opens a modal/panel. On confirm:

```tsx
const [mcRunning, setMcRunning] = useState(false);
const [mcProgress, setMcProgress] = useState<{ completedRuns: number; totalRuns: number } | null>(null);
const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
const monteCarloEngineRef = useRef<PyodideSimEngine | null>(null);

async function handleRunMonteCarlo(runCount: number) {
  if (!monteCarloEngineRef.current) {
    const engine = new PyodideSimEngine();
    engine.init();
    monteCarloEngineRef.current = engine;
  }
  const simGraph = graphToSimNodes(nodes, edges);
  setMcRunning(true);
  setMcProgress({ completedRuns: 0, totalRuns: runCount });
  try {
    const results = await runMonteCarlo(
      monteCarloEngineRef.current,
      { graph: simGraph, simType: project!.sim_type as SimTypeId, durationSeconds: totalDurationSeconds, speedMultiplier: speed, tickIntervalSeconds: tickInterval },
      runCount,
      (p) => setMcProgress(p)
    );
    setMcResult(aggregateMonteCarloRuns(results));
  } catch (err) {
    toast.error(String(err), "Monte Carlo Run Failed");
  } finally {
    setMcRunning(false);
  }
}
```

Render results with a recharts `ComposedChart` — an `Area` for the CI band plus a `Line` for the mean, following the same visual language as the rest of the dashboard (Indigo `#5742FF` accent, `ResponsiveContainer`):

```tsx
<ResponsiveContainer width="100%" height={260}>
  <ComposedChart data={mcResult.throughput.samples.map((v, i) => ({ run: i + 1, value: v }))}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
    <XAxis dataKey="run" tick={{ fontSize: 11 }} label={{ value: "Run #", position: "insideBottom", fontSize: 11 }} />
    <YAxis tick={{ fontSize: 11 }} />
    <Tooltip />
    <ReferenceLine y={mcResult.throughput.mean} stroke="#5742FF" strokeDasharray="4 4" label="Mean" />
    <ReferenceArea y1={mcResult.throughput.ciLower} y2={mcResult.throughput.ciUpper} fill="#5742FF" fillOpacity={0.08} />
    <Line type="monotone" dataKey="value" stroke="#5742FF" strokeWidth={2} dot={{ r: 3 }} />
  </ComposedChart>
</ResponsiveContainer>
```

(`ComposedChart`, `ReferenceLine`, `ReferenceArea` are all part of the `recharts` package already installed — import from `"recharts"` alongside the other chart components already used in `ExecutiveTab.tsx`.)

### Step 4 — Scenario A/B Comparison

Store two graph snapshots in component state:

```ts
const [scenarioA, setScenarioA] = useState<{ label: string; graph: SimGraph } | null>(null); // "Baseline"
const [scenarioB, setScenarioB] = useState<{ label: string; graph: SimGraph } | null>(null); // "Optimized"
```

UI: two buttons — "Save as Baseline" and "Save as Optimized" — that snapshot `graphToSimNodes(nodes, edges)` into state (this mirrors exactly how `graphToSimNodes` is already used at `handleRun()`, `page.tsx:285`, so no new graph-serialization logic is needed). Then a "Compare A vs B" button runs Monte Carlo (or a single run, user's choice) on both graphs sequentially using the same `runMonteCarlo`/dedicated engine from Step 2, and renders a side-by-side `CostRoiTab`-style pair of stat cards plus one shared `BarChart` with two series (`Baseline`, `Optimized`) for each KPI (throughput, wait time, cost if available).

This directly answers the pitch's example question: *"What happens to queue length if we increase server capacity from 2 to 3?"* — the user just edits the Resource node's capacity between snapshot A and snapshot B.

---

## Files touched
- `src/lib/simulation/monteCarlo.ts` — new, pure statistics functions
- `src/lib/simulation/monteCarloRunner.ts` — new, N-run orchestrator
- `src/components/workspace/MonteCarloPanel.tsx` — new, UI for triggering + viewing runs
- `src/app/dashboard/project/[id]/page.tsx` — new `monteCarloEngineRef`, new toolbar button, new modal mount point
- Optionally a new dashboard tab `ScenarioCompareTab.tsx` under `results-dashboard/`, following the same tab-registration pattern documented in `MD/02-kpi-cost-roi-dashboard.md`

## Dependencies
None required, but pairs well with `MD/01-cost-roi-calculator.md` (cost CI bands) if implemented first.

## Definition of done
- [ ] Clicking "Run Monte Carlo (20x)" runs the simulation 20 times sequentially without duplicating rows in `simulation_runs` (verify the dedicated-engine approach from Step 2b prevents the normal `page.tsx` onComplete handler from firing during MC runs).
- [ ] Results show a mean value and a visibly non-zero CI band (unless the system is perfectly deterministic, which it shouldn't be given SimPy's random sampling).
- [ ] Scenario A/B comparison lets the user change one parameter (e.g. Resource capacity 2→3), re-run, and see both bars/values side by side.
