// Run: node --test src/lib/simulation/reliabilityLab.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- loose fakes for SimResult / storage */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";

// These lib files import each other without extensions (as the Next bundler expects).
// Node's type stripping needs ".ts", so resolve it here, then import dynamically.
(nodeModule as any).registerHooks({
  resolve(spec: string, ctx: unknown, next: (s: string, c: unknown) => unknown) {
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".") && !/\.[cm]?[jt]s$/.test(spec)) return next(`${spec}.ts`, ctx);
      throw e;
    }
  },
});

const { applyStress, describeConditions, isNeutral, NEUTRAL_CONDITIONS } = await import("./stressTransforms.ts" as string);
const { analyzeSweep, sweepHeadline, sweepSteps, targetShares, runPasses, bottleneckFrequency, blockUtilization, toCSV, perRunRows } = await import("./stressAnalysis.ts" as string);
const { diffGraphs, mergeScenario, sanitizeParam, KEY_PARAMS } = await import("./scenarioDiff.ts" as string);
const { scoreScenarios, pickWinner, bandDistance, WEIGHT_PRESETS } = await import("./decisionScore.ts" as string);
const { readJSON, writeJSON, loadSettings, saveSettings, runHistory, pinHistory, scenarioLibrary } = await import("./mcStorage.ts" as string);
const { summarize } = await import("./monteCarlo.ts" as string);

const close = (a: number, e: number, tol = 1e-6) => assert.ok(Math.abs(a - e) <= tol, `expected ${e}, got ${a}`);

// ─── Stress transforms ──────────────────────────────────────────────────────

const graph = () => ({
  nodes: [
    { id: "src", nodeType: "source", label: "Door", params: { arrivalRate: 2, distribution: "exponential", schedule: [{ simTime: 0, count: 3 }] } },
    { id: "src2", nodeType: "source", label: "Phone", params: { distribution: "exponential" } }, // arrivalRate missing → engine default 1
    { id: "q", nodeType: "queue", label: "Line", params: { capacity: -1, discipline: "FIFO" } },
    { id: "r", nodeType: "resource", label: "Desk", params: { capacity: 2, serviceTimeMean: 10, serviceDistribution: "exponential" } },
    { id: "pr", nodeType: "priority_resource", label: "Triage", params: { capacity: -1, serviceTimeMean: 4 } },
    { id: "svc", nodeType: "service", label: "Walk", params: { durationMean: 30, distribution: "uniform" } },
    { id: "ch", nodeType: "channel", label: "Link", params: { propagationDelay: 0.5, delayDistribution: "deterministic", bufferCapacity: -1 } },
    { id: "out", nodeType: "sink", label: "Exit", params: { collectKPIs: true } },
  ],
  edges: [{ id: "e1", source: "src", target: "q" }, { id: "e2", source: "q", target: "r" }, { id: "e3", source: "r", target: "out" }],
});

test("applyStress scales the real engine fields per block type, on a copy", () => {
  const g = graph();
  const before = JSON.stringify(g);
  const s = applyStress(g, { demand: 1.5, service: 2, capacityDelta: 1 });
  assert.equal(JSON.stringify(g), before, "input graph must not be mutated");
  const p = (id: string) => s.nodes.find((n: any) => n.id === id).params;
  close(p("src").arrivalRate, 3);
  assert.equal(p("src").schedule[0].count, 5); // round(3 × 1.5) = 4.5 → 5
  close(p("src2").arrivalRate, 1.5); // default 1 × 1.5
  close(p("r").serviceTimeMean, 20);
  close(p("pr").serviceTimeMean, 8);
  close(p("svc").durationMean, 60);
  close(p("ch").propagationDelay, 1);
  assert.equal(p("r").capacity, 3);
  assert.equal(p("pr").capacity, -1, "unlimited stays unlimited");
  assert.equal(p("q").capacity, -1, "queues are not servers");
  assert.equal(p("ch").bufferCapacity, -1);
});

test("capacity changes stay whole numbers and never drop below 1", () => {
  const s = applyStress(graph(), { demand: 1, service: 1, capacityDelta: -5 });
  assert.equal(s.nodes.find((n: any) => n.id === "r").params.capacity, 1);
  const s2 = applyStress(graph(), { demand: 1, service: 1, capacityDelta: 1.6 });
  assert.equal(s2.nodes.find((n: any) => n.id === "r").params.capacity, 4); // round(2 + 1.6)
});

test("per-source demand overrides the global multiplier; chips describe conditions", () => {
  const c = { demand: 1.2, demandBySource: { src2: 3 }, service: 1, capacityDelta: 0 };
  const s = applyStress(graph(), c);
  close(s.nodes.find((n: any) => n.id === "src").params.arrivalRate, 2.4);
  close(s.nodes.find((n: any) => n.id === "src2").params.arrivalRate, 3);
  assert.deepEqual(describeConditions(c, (id: string) => (id === "src2" ? "Phone" : id)), ["Demand 1.2×", "Phone demand 3×"]);
  assert.deepEqual(describeConditions({ demand: 1, service: 1.25, capacityDelta: -1 }), ["Service time 1.25×", "−1 server per station"]);
  assert.equal(isNeutral(NEUTRAL_CONDITIONS), true);
  assert.equal(isNeutral({ ...NEUTRAL_CONDITIONS, demandBySource: { a: 2 } }), false);
  assert.deepEqual(describeConditions(NEUTRAL_CONDITIONS), []);
});

// ─── Sweep knee / break detection ───────────────────────────────────────────

const pt = (multiplier: number, mean: number, meetShare?: number) => ({ multiplier, stat: summarize([mean, mean]), meetShare });

test("sweep finds the knee of a hockey-stick wait curve", () => {
  const xs = sweepSteps(0.5, 2, 7);
  assert.deepEqual(xs, [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  const waits = [10, 10, 11, 12, 20, 40, 80];
  const pts = xs.map((x: number, i: number) => pt(x, waits[i]));
  const a = analyzeSweep(pts, "avgWaitTime");
  assert.equal(a.reason, "knee");
  assert.equal(a.holdsUpTo, 1.5);
  const h = sweepHeadline(pts, a, "avgWaitTime", "Median wait", (v: number) => `${v}s`);
  assert.match(h, /Holds up to about 1\.5× today's demand/);
  assert.match(h, /grows 4\.0×/);
});

test("sweep: linear curve has no knee; targets drive the break point", () => {
  const xs = sweepSteps(0.5, 2, 4);
  const linear = xs.map((x: number) => pt(x, x * 10));
  assert.equal(analyzeSweep(linear, "avgWaitTime").reason, "none");
  const withTargets = xs.map((x: number, i: number) => pt(x, x * 10, [1, 0.9, 0.4, 0.1][i]));
  const a = analyzeSweep(withTargets, "avgWaitTime");
  assert.deepEqual([a.reason, a.breakIndex, a.holdsUpTo], ["target", 2, 1]);
  const failsNow = analyzeSweep(xs.map((x: number) => pt(x, 1, 0.2)), "avgWaitTime");
  assert.equal(failsNow.reason, "fails-immediately");
  // Throughput: "worse" is down, so a plateau is not a knee in the bad direction unless it bends down.
  const tp = analyzeSweep(xs.map((x: number, i: number) => pt(x, [50, 100, 150, 200][i])), "throughput");
  assert.equal(tp.reason, "none");
});

// ─── Targets ─────────────────────────────────────────────────────────────────

const run = (completed: number, wait: number, bottleneck = "r", util = 0.5) =>
  ({
    totalCompleted: completed,
    waitTimePercentiles: { p50: wait },
    healthScore: 80,
    bottleneckNodeId: bottleneck,
    bottleneckLabel: bottleneck.toUpperCase(),
    nodeStats: { [bottleneck]: { label: bottleneck.toUpperCase(), nodeType: "resource", utilization: util }, idle: { label: "Idle", nodeType: "queue", utilization: 0 } },
  }) as any;

test("target shares with Wilson intervals, and 'all targets' row", () => {
  const results = [run(100, 50), run(90, 150), run(110, 80), run(120, 200), run(95, 60)];
  const targets = [
    { metric: "avgWaitTime", op: "max", value: 120, enabled: true },
    { metric: "throughput", op: "min", value: 100, enabled: true },
    { metric: "totalCost", op: "max", value: 1, enabled: false },
  ];
  const shares = targetShares(results, targets as any, 0.95);
  assert.equal(shares[0].target, null); // all-targets row first
  assert.deepEqual(shares.map((s: any) => s.k), [2, 3, 3]); // all: runs 1 & 3; wait: 1,3,5; throughput: 1,3,4
  close(shares[1].lo, 0.230724, 1e-5); // Wilson 3/5 at 95%
  assert.deepEqual(runPasses(results, targets as any), [true, false, true, false, false]);
  assert.deepEqual(targetShares(results, [], 0.95), []);
});

// ─── Bottlenecks / blocks ────────────────────────────────────────────────────

test("bottleneck frequency and per-block utilization ranges", () => {
  const results = [run(1, 1, "r", 0.9), run(1, 1, "r", 0.8), run(1, 1, "pr", 0.7)];
  const f = bottleneckFrequency(results);
  assert.deepEqual(f.map((x: any) => [x.id, x.count]), [["r", 2], ["pr", 1]]);
  close(f[0].share, 2 / 3);
  const b = blockUtilization(results, 0.05);
  assert.deepEqual(b.map((x: any) => x.id), ["r", "pr"]); // never-busy "idle" queue dropped
  close(b[0].mean, 85);
  close(b[0].lo, 80.5); // P5 of [80, 90]
});

test("CSV escapes quotes/commas and neutralises formula injection", () => {
  const csv = toCSV([{ a: 'say "hi", ok', b: "=SUM(A1)", c: -3, d: undefined }]);
  assert.equal(csv, 'a,b,c,d\r\n"say ""hi"", ok",\'=SUM(A1),-3,');
  const rows = perRunRows([run(10, 5)], { conditions: "Demand 1.5×" }, [{ metric: "throughput", op: "min", value: 5, enabled: true }] as any);
  assert.equal(rows[0].completed, 10);
  assert.equal(rows[0].meets_all_targets, true);
  assert.equal(rows[0].conditions, "Demand 1.5×");
});

// ─── Scenario diff / merge ───────────────────────────────────────────────────

test("diffGraphs lists added/removed blocks, param changes and link changes", () => {
  const base = graph();
  const other = graph();
  other.nodes = other.nodes.filter((n: any) => n.id !== "svc");
  (other.nodes.find((n: any) => n.id === "r") as any).params.capacity = 3;
  other.nodes.push({ id: "r2", nodeType: "resource", label: "Desk 2", params: { capacity: 1 } } as any);
  other.edges = other.edges.filter((e: any) => e.id !== "e3");
  other.edges.push({ id: "e9", source: "r", target: "r2" });
  const d = diffGraphs(base, other);
  assert.deepEqual(
    d.map((c: any) => c.kind + ":" + (c.key ?? c.label ?? `${c.from}->${c.to}`)),
    ["param:capacity", "block-added:Desk 2", "block-removed:Walk", "link-added:Desk->Desk 2", "link-removed:Desk->Exit"]
  );
  const param = d.find((c: any) => c.kind === "param");
  assert.deepEqual([param.from, param.to], [2, 3]);
  assert.deepEqual(diffGraphs(base, graph()), []);
});

test("mergeScenario replaces only the captured blocks and renames id clashes", () => {
  const canvasNodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const canvasEdges = [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c" }];
  // Scenario captured from [b, c]; user edited c and added a block whose id clashes with "a".
  const scenNodes = [{ id: "b" }, { id: "c", tweaked: true }, { id: "a" }] as any[];
  const scenEdges = [{ id: "bc", source: "b", target: "c" }, { id: "ca", source: "c", target: "a" }];
  const m = mergeScenario(canvasNodes, canvasEdges, scenNodes, scenEdges, ["b", "c"]);
  assert.deepEqual(m.nodes.map((n: any) => n.id), ["a", "b", "c", "a_s1"]);
  assert.equal((m.nodes[2] as any).tweaked, true);
  assert.deepEqual(m.edges.map((e: any) => `${e.source}>${e.target}`), ["a>b", "b>c", "c>a_s1"]);
});

test("sanitizeParam keeps unlimited, integers and minimums", () => {
  const servers = KEY_PARAMS.resource[0];
  assert.equal(sanitizeParam(servers, 2.6), 3);
  assert.equal(sanitizeParam(servers, 0), 1);
  const queueCap = KEY_PARAMS.queue[0];
  assert.equal(sanitizeParam(queueCap, -7), -1);
  assert.equal(sanitizeParam(servers, NaN), null);
});

// ─── Weighted score + winner rule ────────────────────────────────────────────

test("weighted score: normalised per metric, utilization by distance from the ideal band", () => {
  const w = { throughput: 1, avgWaitTime: 1, utilization: 1, healthScore: 0, totalCost: 0 };
  const ranked = scoreScenarios(
    [
      { id: "a", means: { throughput: 100, avgWaitTime: 60, utilization: 95 } },
      { id: "b", means: { throughput: 120, avgWaitTime: 30, utilization: 80 } },
      { id: "c", means: { throughput: 110, avgWaitTime: 45, utilization: 60 } },
    ],
    w,
    [70, 85]
  );
  assert.deepEqual(ranked.map((r: any) => r.id), ["b", "c", "a"]);
  close(ranked[0].score, 100);
  // c: throughput 1-10/max(20, 30)=2/3, wait 1-15/max(30, 15)=.5, util 1-10/max(10, 25)=.6
  close(ranked[1].score, ((2 / 3 + 0.5 + 0.6) / 3) * 100, 1e-9);
  assert.equal(bandDistance(80, [70, 85]), 0);
  assert.equal(WEIGHT_PRESETS.length, 4);
});

test("near-identical scenarios score near-equal, not 100 vs 0", () => {
  const w = { throughput: 3, avgWaitTime: 3, utilization: 2, healthScore: 2, totalCost: 0 };
  const ranked = scoreScenarios(
    [
      { id: "a", means: { throughput: 3601, avgWaitTime: 2100, utilization: 99.9, healthScore: 45.6 } },
      { id: "b", means: { throughput: 3598, avgWaitTime: 2108, utilization: 99.9, healthScore: 45.6 } },
    ],
    w,
    [70, 85]
  );
  assert.ok(ranked[1].score > 99, `runner-up should be ~100, got ${ranked[1].score}`);
});

test("winner only when the lead is significant on the top-weighted metric", () => {
  const w = { throughput: 5, avgWaitTime: 1, utilization: 0, healthScore: 0, totalCost: 0 };
  const ranked = [{ id: "b", score: 80, parts: {} }, { id: "a", score: 60, parts: {} }];
  const clearStats = { a: { throughput: { n: 20, mean: 100, stdDev: 5 } }, b: { throughput: { n: 20, mean: 120, stdDev: 5 } } };
  assert.equal(pickWinner(ranked, clearStats, w, [70, 85]).reason, "clear");
  assert.equal(pickWinner(ranked, clearStats, w, [70, 85]).winnerId, "b");
  const noisy = { a: { throughput: { n: 5, mean: 100, stdDev: 40 } }, b: { throughput: { n: 5, mean: 104, stdDev: 40 } } };
  const call = pickWinner(ranked, noisy, w, [70, 85]);
  assert.deepEqual([call.winnerId, call.reason, call.topMetric], [null, "not-significant", "throughput"]);
  const worse = { a: { throughput: { n: 20, mean: 120, stdDev: 5 } }, b: { throughput: { n: 20, mean: 100, stdDev: 5 } } };
  assert.equal(pickWinner(ranked, worse, w, [70, 85]).reason, "leader-worse-on-top");
  assert.equal(pickWinner([ranked[0]], clearStats, w, [70, 85]).reason, "single");
});

// ─── Storage helpers ─────────────────────────────────────────────────────────

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const throwingStore = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceeded"); }, removeItem() { throw new Error("x"); } };

test("storage helpers survive missing or throwing storage", () => {
  assert.equal(readJSON("k", 42, null), 42);
  assert.equal(writeJSON("k", 1, null), false);
  assert.equal(readJSON("k", 42, throwingStore), 42);
  assert.equal(writeJSON("k", 1, throwingStore), false);
  assert.deepEqual(runHistory.load("p", throwingStore), []);
  assert.deepEqual(runHistory.add("p", { id: "1", name: "x" } as any, null).map((x: any) => x.id), ["1"]); // returns new list even if unsaved
  assert.deepEqual(loadSettings("p", { a: 1 }, throwingStore), { a: 1 });
  const bad = memoryStore();
  bad.setItem("justcmul8:lab:history:p", "{not json");
  assert.deepEqual(runHistory.load("p", bad), []);
});

test("history keeps the newest 10, never drops the pinned one; rename/delete/pin", () => {
  const s = memoryStore();
  for (let i = 1; i <= 3; i++) runHistory.add("p", { id: String(i), name: `Run ${i}` } as any, s);
  pinHistory("p", "1", s);
  for (let i = 4; i <= 14; i++) runHistory.add("p", { id: String(i), name: `Run ${i}` } as any, s);
  const items = runHistory.load("p", s);
  assert.equal(items.length, 10);
  assert.ok(items.some((x: any) => x.id === "1" && x.pinned));
  assert.equal(items[0].id, "14");
  assert.equal(runHistory.rename("p", "14", "  Peak hour  ", s)[0].name, "Peak hour");
  assert.equal(runHistory.rename("p", "14", "   ", s)[0].name, "Peak hour"); // blank keeps old name
  assert.equal(runHistory.remove("p", "14", s).length, 9);
  assert.deepEqual(runHistory.load("other", s), []); // per project
  saveSettings("p", { level: 0.99 }, s);
  assert.deepEqual(loadSettings("p", { level: 0.95, runs: 20 }, s), { level: 0.99, runs: 20 });
  scenarioLibrary.add("p", { id: "s1", name: "Two desks", savedAt: "", nodes: [], edges: [] }, s);
  assert.equal(scenarioLibrary.load("p", s)[0].name, "Two desks");
});
