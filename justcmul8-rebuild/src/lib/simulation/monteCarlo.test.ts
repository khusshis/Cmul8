// Run: node --test src/lib/simulation/monteCarlo.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- loose fakes for engine/SimResult */
// Reference numbers come from scipy 1.18 (stats.t.ppf, stats.ttest_ind(equal_var=False), numpy.percentile).
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs the .ts file directly; the extension is required there.
import { tCritical, tCritical95, tTwoSidedP, summarize, welchTest, welchFromStats, compareScenarios, aggregateMonteCarloRuns, wilsonInterval, relativeHalfWidth } from "./monteCarlo.ts";
// @ts-expect-error -- see above.
import { runMonteCarlo, isAbortError } from "./monteCarloRunner.ts";

const close = (actual: number, expected: number, tol = 1e-4) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);

test("Student-t 95% critical values match scipy", () => {
  const ref: Array<[number, number]> = [
    [1, 12.706205], [2, 4.302653], [5, 2.570582], [10, 2.228139],
    [19, 2.093024], [30, 2.042272], [49, 2.009575], [1000, 1.962339], [5.882352941, 2.458824],
  ];
  for (const [df, t] of ref) close(tCritical95(df), t);
  close(tCritical(10, 0.9), 1.812461);
  close(tCritical(10, 0.99), 3.169273);
});

test("Wilson interval matches the textbook / scipy values", () => {
  const w = wilsonInterval(8, 10, 0.95);
  close(w.share, 0.8);
  close(w.lo, 0.490162);
  close(w.hi, 0.943318);
  close(wilsonInterval(0, 10).lo, 0);
  close(wilsonInterval(0, 10).hi, 0.277533);
  close(wilsonInterval(10, 10).lo, 0.722467);
  close(wilsonInterval(87, 100, 0.9).lo, 0.804806);
  close(wilsonInterval(45, 50, 0.99).hi, 0.966009);
  assert.ok(Number.isNaN(wilsonInterval(0, 0).share));
});

test("NaN never reads as significant; missing samples are dropped", () => {
  assert.ok(Number.isNaN(tTwoSidedP(NaN, 5)));
  const r = welchTest([1, 2, NaN, 4], [5, 6, 7, 8]);
  // NaN dropped → compares [1,2,4] vs [5..8]: a real, finite test.
  assert.ok(Number.isFinite(r.pValue));
  const bad = welchFromStats({ n: 4, mean: NaN, stdDev: 1 }, { n: 4, mean: 6, stdDev: 1 });
  assert.ok(Number.isNaN(bad.pValue));
  assert.equal(bad.significant, false);
  const s = summarize([1, NaN, 3, Infinity]);
  assert.deepEqual([s.n, s.mean], [2, 2]);
  const agg = aggregateMonteCarloRuns([fakeResult(10, 1), { ...fakeResult(12, 1), totalCompleted: undefined }]);
  assert.deepEqual([agg.throughput.n, agg.throughput.mean], [1, 10]);
});

test("relative half-width for run-until-precise", () => {
  // mean 11, sd 1.2472, n 10: half-width 0.892207 → 8.111%
  close(relativeHalfWidth([10, 12, 9, 11, 13, 10, 12, 11, 10, 12]), 8.11097, 1e-3);
  assert.equal(relativeHalfWidth([5, 5, 5]), 0);
  assert.equal(relativeHalfWidth([5]), Infinity);
});

test("two-sided t p-values match scipy", () => {
  close(tTwoSidedP(3.5, 4), 0.024896163, 1e-7);
  close(tTwoSidedP(0.5, 40), 0.619814735, 1e-7);
  assert.equal(tTwoSidedP(0, 7), 1);
});

test("summarize: t-based CI, percentiles, clamping", () => {
  const s = summarize([10, 12, 9, 11, 13, 10, 12, 11, 10, 12], [0, Infinity]);
  close(s.mean, 11);
  close(s.stdDev, 1.247219129);
  close(s.ciLower, 10.107793183);
  close(s.ciUpper, 11.892206817);
  close(s.bandLo, 9.45);
  close(s.bandHi, 12.55);
  const s10 = summarize([10, 12, 9, 11, 13, 10, 12, 11, 10, 12], [0, Infinity], { level: 0.9, riskQ: 0.1 });
  close(s10.ciUpper, 11 + 1.833113 * (1.247219129 / Math.sqrt(10)));
  assert.equal(s10.riskQ, 0.1);
  close(s.median, 11);
  assert.equal(s.ciClamped, false);

  // Small mean, big spread: raw interval dips below 0 and must be clamped (and flagged).
  const w = summarize([0, 0, 0, 5], [0, Infinity]);
  assert.equal(w.ciLower, 0);
  assert.equal(w.ciClamped, true);

  const one = summarize([7]);
  assert.deepEqual([one.mean, one.ciLower, one.ciUpper, one.stdDev], [7, 7, 7, 0]);
  assert.equal(summarize([]).n, 0);
});

test("Welch t-test matches scipy ttest_ind(equal_var=False)", () => {
  const r1 = welchTest([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  close(r1.t, 1.897366596);
  close(r1.df, 5.882352941);
  close(r1.pValue, 0.107531195, 1e-6);
  close(r1.ciLower, -0.887741644);
  close(r1.ciUpper, 6.887741644);
  assert.equal(r1.significant, false);

  const r2 = welchTest([19.2, 21.5, 20.1, 18.7, 22.3, 20.9, 19.8, 21.1], [23.4, 22.8, 24.9, 21.7, 25.3, 23.1]);
  close(r2.t, 4.416509103);
  close(r2.df, 10.227621650);
  close(r2.pValue, 0.001232358, 1e-6);
  close(r2.ciLower, 1.532464574);
  close(r2.ciUpper, 4.634202093);
  assert.equal(r2.significant, true);
});

test("Welch edge cases: deterministic runs, too few runs, zero baseline", () => {
  const same = welchTest([5, 5, 5], [5, 5, 5]);
  assert.deepEqual([same.pValue, same.significant], [1, false]);
  const exact = welchTest([5, 5, 5], [6, 6, 6]);
  assert.deepEqual([exact.pValue, exact.significant, exact.ciLower, exact.ciUpper], [0, true, 1, 1]);

  const few = welchTest([1], [2, 3]);
  assert.ok(Number.isNaN(few.pValue));
  assert.equal(few.significant, false);

  const zero = welchTest([0, 0, 0], [1, 2, 3]);
  assert.equal(zero.pct, null); // no fake % from a 0 baseline
  close(zero.diff, 2);
  close(welchTest([10, 10], [12, 12]).pct!, 20);
});

const fakeResult = (completed: number, wait: number, cost?: number) =>
  ({
    simType: "human_queue",
    totalSimTime: 100,
    totalArrived: completed,
    totalCompleted: completed,
    bottleneckNodeId: "r",
    bottleneckLabel: "R",
    nodeStats: { r: { utilization: 0.5 } },
    timeline: [],
    logs: [],
    healthScore: 80,
    waitTimePercentiles: { p50: wait },
    costAnalysis: cost === undefined ? undefined : { totalSystemCost: cost, breakdown: [], costPerCompletedEntity: 0 },
  }) as any;

test("compareScenarios (N vs baseline) marks the better side by metric direction", () => {
  const A = aggregateMonteCarloRuns([10, 11, 9, 10, 12].map((c, i) => fakeResult(c, 30 + i, 100 + i)));
  const B = aggregateMonteCarloRuns([20, 21, 19, 22, 20].map((c, i) => fakeResult(c, 60 + i, 50 + i)));
  const C = aggregateMonteCarloRuns([10, 11, 9, 10, 12].map((c, i) => fakeResult(c, 30 + i, 100 + i)));
  const cmp = compareScenarios(
    [{ id: "a", name: "A", color: "#000", mc: A }, { id: "b", name: "B", color: "#111", mc: B }, { id: "c", name: "C", color: "#222", mc: C }],
    "a"
  );
  assert.equal(cmp.baselineId, "a");
  assert.deepEqual(Object.keys(cmp.vsBaseline).sort(), ["b", "c"]);
  const by = Object.fromEntries(cmp.vsBaseline.b.map((m: any) => [m.key, m]));
  assert.equal(by.throughput.better, "scenario"); // more completed is better
  assert.equal(by.avgWaitTime.better, "baseline"); // longer wait is worse
  assert.equal(by.totalCost.better, "scenario"); // lower cost is better
  assert.equal(by.utilization.better, null); // neutral metric, identical anyway
  assert.ok(cmp.vsBaseline.c.every((m: any) => !m.significant)); // identical to baseline
  assert.equal(A.utilization.mean, 50);
});

// ─── Runner ─────────────────────────────────────────────────────────────────

/** Minimal engine: completes (or fails) asynchronously after each start(). */
function fakeEngine(opts: { failOn?: number } = {}) {
  const complete = new Set<(r: any) => void>();
  const error = new Set<(e: string) => void>();
  let starts = 0;
  let stops = 0;
  return {
    get starts() { return starts; },
    get stops() { return stops; },
    get listeners() { return complete.size + error.size; },
    start() {
      const n = ++starts;
      setTimeout(() => {
        if (n === opts.failOn) error.forEach((cb) => cb("boom"));
        else complete.forEach((cb) => cb({ totalCompleted: n }));
      }, 1);
    },
    stop() { stops++; },
    onComplete(cb: (r: any) => void) { complete.add(cb); return () => complete.delete(cb); },
    onError(cb: (e: string) => void) { error.add(cb); return () => error.delete(cb); },
  };
}

const params = {} as any;

test("runMonteCarlo collects N results, reports progress, unsubscribes", async () => {
  const eng = fakeEngine();
  const seen: number[] = [];
  const results = await runMonteCarlo(eng, params, 4, { onProgress: (p: any) => seen.push(p.completedRuns) });
  assert.deepEqual(results.map((r: any) => r.totalCompleted), [1, 2, 3, 4]);
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
  assert.equal(eng.listeners, 0);
});

test("runMonteCarlo propagates engine errors with the run number", async () => {
  const eng = fakeEngine({ failOn: 3 });
  await assert.rejects(runMonteCarlo(eng, params, 5), /Run 3 of 5 failed: boom/);
  assert.equal(eng.listeners, 0);
  // The engine is free again after a failure.
  const ok = await runMonteCarlo(fakeEngine(), params, 1);
  assert.equal(ok.length, 1);
});

test("runMonteCarlo cancels via AbortSignal and stops the engine", async () => {
  const eng = fakeEngine();
  const ac = new AbortController();
  const p = runMonteCarlo(eng, params, 100, {
    signal: ac.signal,
    onProgress: (pr: any) => pr.completedRuns === 2 && ac.abort(),
  });
  await assert.rejects(p, (e: unknown) => isAbortError(e));
  assert.equal(eng.stops, 1);
  assert.equal(eng.listeners, 0);
  assert.ok(eng.starts <= 3);

  const pre = new AbortController();
  pre.abort();
  await assert.rejects(runMonteCarlo(fakeEngine(), params, 3, { signal: pre.signal }), (e: unknown) => isAbortError(e));
});

test("runMonteCarlo refuses a second concurrent batch on the same engine (no cross-talk)", async () => {
  const eng = fakeEngine();
  const first = runMonteCarlo(eng, params, 3);
  await assert.rejects(runMonteCarlo(eng, params, 3), /already running/);
  const r = await first;
  assert.deepEqual(r.map((x: any) => x.totalCompleted), [1, 2, 3]); // untouched by the refused batch
  // Sequential batches each get only their own results.
  const second = await runMonteCarlo(eng, params, 2);
  assert.deepEqual(second.map((x: any) => x.totalCompleted), [4, 5]);
  assert.equal(eng.listeners, 0);
});

test("cancel destroys the engine so a late in-flight result can't leak into the next batch", async () => {
  // Worker-like fake: "stop" is ignored (it would queue behind the synchronous run); only
  // destroy() (terminate) kills the in-flight run. Each run completes 5 ms after start.
  let pending: ReturnType<typeof setTimeout> | null = null;
  const complete = new Set<(r: any) => void>();
  let label = "OLD";
  const eng = {
    destroyed: 0,
    start() { const tag = label; pending = setTimeout(() => complete.forEach((cb) => cb({ tag })), 5); },
    stop() { /* queued behind the run: no effect */ },
    destroy() { this.destroyed++; if (pending) clearTimeout(pending); pending = null; },
    onComplete(cb: (r: any) => void) { complete.add(cb); return () => complete.delete(cb); },
    onError() { return () => {}; },
  };
  const ac = new AbortController();
  const first = runMonteCarlo(eng, params, 3, { signal: ac.signal });
  setTimeout(() => ac.abort(), 1); // abort while run 1 is in flight
  await assert.rejects(first, (e: unknown) => isAbortError(e));
  assert.equal(eng.destroyed, 1);
  label = "NEW";
  const second = await runMonteCarlo(eng, params, 3);
  assert.deepEqual(second.map((r: any) => r.tag), ["NEW", "NEW", "NEW"]);
});

test("stopWhen ends a batch early and map transforms each result", async () => {
  const eng = fakeEngine();
  const r = await runMonteCarlo(eng, params, 50, {
    map: (x: any) => ({ ...x, doubled: x.totalCompleted * 2 }),
    stopWhen: (rs: any[]) => rs.length >= 4,
  });
  assert.deepEqual(r.map((x: any) => x.doubled), [2, 4, 6, 8]);
  assert.equal(eng.listeners, 0);
});
