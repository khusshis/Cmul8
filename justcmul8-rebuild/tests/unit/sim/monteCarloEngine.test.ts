/**
 * The Monte Carlo lab on real engine output: replications of the SimPy script (one seed per run,
 * like the lab's fresh random stream per run) fed through the same aggregation, comparison,
 * scoring and stress code the panel uses, checked against queueing theory and common sense.
 */
import { describe, expect, it } from "vitest";
import { aggregateMonteCarloRuns, compareMetrics, runMetrics, slimRun } from "@/lib/simulation/monteCarlo";
import { summarizeRuns } from "@/lib/simulation/runDetails";
import { lostCount } from "@/lib/simulation/analyticsEngine";
import { analyzeSweep, blockUtilization, bottleneckFrequency, targetShares, type SweepPoint } from "@/lib/simulation/stressAnalysis";
import { applyStress, NEUTRAL_CONDITIONS } from "@/lib/simulation/stressTransforms";
import { pickWinner, scoreScenarios, WEIGHT_PRESETS } from "@/lib/simulation/decisionScore";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { queueGraph } from "../helpers";
import { clinic, run } from "./clinicModel";
import { hasSimpy, runPython } from "./simpyRunner";

const batch = (graph: SimGraph, n: number, T: number, from = 1): SimResult[] =>
  Array.from({ length: n }, (_, i) => {
    const { result, stderr } = runPython(graph, T, from + i);
    if (!result) throw new Error(stderr.slice(-400));
    return enrichSimResult({ ...result, simType: "human_queue" }, graph);
  });

describe.skipIf(!hasSimpy)("Monte Carlo lab on the real engine", () => {
  // M/M/1 at 80% busy over 2000 s: 20% never wait, the rest wait Exp(mu - lambda), so the
  // median wait is ln(0.8/0.5)/0.2 = 2.35 s, and finished ~= lambda*T minus the few inside.
  const T = 2000;
  const mm1 = batch(queueGraph(0.8, 1), 25, T);
  const mc = aggregateMonteCarloRuns(mm1);

  it("runs differ (fresh randomness per run) and the summary matches the runs", () => {
    expect(new Set(mm1.map((r) => r.totalCompleted)).size).toBeGreaterThan(20);
    const done = mm1.map((r) => r.totalCompleted);
    expect(mc.throughput.mean).toBeCloseTo(done.reduce((a, b) => a + b, 0) / done.length, 6);
    expect(mc.throughput.n).toBe(25);
    expect(mc.throughput.ciLower).toBeLessThan(mc.throughput.mean);
    expect(mc.throughput.bandLo).toBeLessThanOrEqual(mc.throughput.median);
  });

  it("confidence intervals cover the theoretical values", () => {
    // Expected finished: lambda*T minus the ~L = 4 still inside at the end.
    const expected = 0.8 * T - 4;
    expect(mc.throughput.ciLower).toBeLessThan(expected * 1.01);
    expect(mc.throughput.ciUpper).toBeGreaterThan(expected * 0.99);
    expect(Math.abs(mc.avgWaitTime.mean - Math.log(1.6) / 0.2)).toBeLessThan(0.6); // "Median wait"
    expect(Math.abs(mc.utilization.mean - 80)).toBeLessThan(3); // "Bottleneck busy"
  });

  it("a run where nobody waits still reports how busy the busiest server is", () => {
    const calm = batch(queueGraph(0.05, 1, 4), 1, 500)[0]; // 4 servers, almost never a line
    expect(runMetrics(calm).utilization).toBeGreaterThan(0);
  });

  describe("comparing scenarios on the clinic", () => {
    const seeds = 12;
    const base = Array.from({ length: seeds }, (_, i) => run(clinic(2), 100 + i));
    const more = Array.from({ length: seeds }, (_, i) => run(clinic(4), 200 + i));
    const again = Array.from({ length: seeds }, (_, i) => run(clinic(2), 300 + i));
    const A = aggregateMonteCarloRuns(base), B = aggregateMonteCarloRuns(more), A2 = aggregateMonteCarloRuns(again);

    it("4 doctors is significantly better than 2 on every directional metric", () => {
      const by = Object.fromEntries(compareMetrics(A, B).map((c) => [c.key, c]));
      expect(by.throughput.better).toBe("scenario");
      expect(by.avgWaitTime.better).toBe("scenario");
      expect(by.healthScore.better).toBe("scenario");
      expect(by.utilization.better).toBeNull(); // neutral: busier isn't better or worse
    });

    it("the same model run twice is not called different", () => {
      const sig = compareMetrics(A, A2).filter((c) => c.significant && c.direction !== "neutral");
      expect(sig.map((c) => c.key)).toEqual([]);
    });

    it("the decision score picks 4 doctors as a clear winner", () => {
      const w = WEIGHT_PRESETS.find((p) => p.id === "speed")!.weights;
      const entries = [{ id: "two", means: { throughput: A.throughput.mean, avgWaitTime: A.avgWaitTime.mean, utilization: A.utilization.mean, healthScore: A.healthScore.mean } },
        { id: "four", means: { throughput: B.throughput.mean, avgWaitTime: B.avgWaitTime.mean, utilization: B.utilization.mean, healthScore: B.healthScore.mean } }];
      const ranked = scoreScenarios(entries, w, [60, 85]);
      expect(ranked[0].id).toBe("four");
      const call = pickWinner(ranked, { two: { throughput: A.throughput, avgWaitTime: A.avgWaitTime }, four: { throughput: B.throughput, avgWaitTime: B.avgWaitTime } }, w, [60, 85]);
      expect(call.winnerId).toBe("four");
    });

    it("stress outputs: bottleneck share, per-block busy %, target pass rates", () => {
      const freq = bottleneckFrequency(base);
      expect(freq[0].id).toBe("doc");
      expect(freq[0].share).toBeGreaterThan(0.9);
      const blocks = blockUtilization(base).map((b) => b.label);
      expect(blocks).toContain("Doctors");
      expect(blocks).not.toContain("Pharmacy"); // a delay block has no busy %
      const [health] = targetShares(base, [{ metric: "healthScore", op: "min", value: 70, enabled: true }]);
      const manual = base.filter((r) => (r.healthScore ?? 0) >= 70).length;
      expect(health.k).toBe(manual);
      expect(health.lo).toBeLessThanOrEqual(health.share);
      expect(health.hi).toBeGreaterThanOrEqual(health.share);
    });
  });

  it("quiet batch runs (no live ticks) give exactly the same result as watched runs", () => {
    const g = queueGraph(0.8, 1);
    const watched = runPython(g, 500, 9).result;
    const quiet = runPython(g, 500, 9, true).result;
    expect(quiet.totalCompleted).toBe(watched.totalCompleted);
    expect(quiet.nodeStats.res.avgWaitTime).toBe(watched.nodeStats.res.avgWaitTime);
    expect(quiet.timeline.length).toBe(watched.timeline.length);
  });

  it("slimmed runs keep every number the lab shows", () => {
    const full = mm1[0];
    const slim = slimRun(full);
    expect(slim.logs).toEqual([]);
    expect(slim.entityJourneys).toBeUndefined();
    expect(runMetrics(slim)).toEqual(runMetrics(full));
    expect(slim.aiDiagnosis).toEqual(full.aiDiagnosis);
  });

  it("'across all runs' matches the single-run results, averaged", () => {
    const runs = Array.from({ length: 8 }, (_, i) => slimRun(run(clinic(2), 400 + i)));
    const d = summarizeRuns(runs, "human_queue");
    const avg = (f: (r: SimResult) => number) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    expect(d.arrived.mean).toBeCloseTo(avg((r) => r.totalArrived), 6);
    expect(d.lost.mean).toBeCloseTo(avg(lostCount), 6);
    expect(d.arrived.lo).toBeLessThanOrEqual(d.arrived.mean);
    expect(d.arrived.hi).toBeGreaterThanOrEqual(d.arrived.mean);
    expect(d.kpis.map((k) => k.label)).toEqual(["Avg Wait Time", "Staff Utilization", "Total Served", "Queue Length", "Avg Service Time"]);
    expect(d.kpis.find((k) => k.key === "totalCompleted")!.value.mean).toBeCloseTo(avg((r) => r.totalCompleted), 6);
    const doc = d.stations.find((s) => s.id === "doc")!;
    expect(doc.bottleneckShare).toBeGreaterThan(0.9);
    expect(doc.busy!.mean).toBeCloseTo(avg((r) => r.nodeStats.doc.utilization * 100), 6);
    expect(d.stations.find((s) => s.id === "pharm")!.busy).toBeUndefined(); // delay block: no busy %
    expect(d.stations.find((s) => s.id === "qdoc")!.lost.mean).toBeGreaterThan(0);
    expect(d.topRec!.share).toBeGreaterThan(0.5);
    expect(d.topRec!.title).toMatch(/Doctor/);
  });

  it("the demand sweep finds the breaking point below the theoretical limit", () => {
    // Base demand 0.5 on one server with mean 1: it saturates at 2x demand.
    const points: SweepPoint[] = [0.6, 1, 1.4, 1.7, 1.9, 2.2].map((m) => {
      const rs = batch(applyStress(queueGraph(0.5, 1), { ...NEUTRAL_CONDITIONS, demand: m }), 6, 1500, 50);
      return { multiplier: m, stat: aggregateMonteCarloRuns(rs).avgWaitTime };
    });
    for (let i = 1; i < points.length; i++) expect(points[i].stat.mean).toBeGreaterThanOrEqual(points[i - 1].stat.mean * 0.9);
    const a = analyzeSweep(points, "avgWaitTime");
    expect(a.holdsUpTo).not.toBeNull();
    expect(a.holdsUpTo!).toBeGreaterThanOrEqual(1.4);
    expect(a.holdsUpTo!).toBeLessThanOrEqual(2);
  });
});
