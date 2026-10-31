/**
 * The production engine: the SimPy script generateSimPyScript() emits (the same text the
 * Pyodide worker runs), executed under local CPython + SimPy and checked against
 * M/M/1 and M/M/c (Erlang C) theory. Skipped when python/simpy are not installed.
 */
import { describe, expect, it } from "vitest";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { mm1, mmc, queueGraph } from "../helpers";
import { hasSimpy, runPython } from "./simpyRunner";

describe.skipIf(!hasSimpy)("SimPy engine (generated script) vs queueing theory", () => {
  it("M/M/1 rho=0.8: utilisation +/-4%, Wq +/-15%", () => {
    const th = mm1(0.8, 1);
    const { result, stderr } = runPython(queueGraph(0.8, 1), 40_000, 3);
    expect(result, stderr).toBeTruthy();
    const res = result.nodeStats.res;
    expect(Math.abs(res.utilization - th.rho) / th.rho).toBeLessThan(0.04);
    expect(Math.abs(res.avgWaitTime - th.Wq) / th.Wq).toBeLessThan(0.15);
    expect(result.totalCompleted).toBeLessThanOrEqual(result.totalArrived);
  });

  it("M/M/3 rho=0.8: per-server utilisation +/-4%, Erlang-C Wq +/-15%", () => {
    const th = mmc(2.4, 1, 3);
    const { result, stderr } = runPython(queueGraph(2.4, 1, 3), 40_000, 4);
    expect(result, stderr).toBeTruthy();
    const res = result.nodeStats.res;
    expect(Math.abs(res.utilization - th.rho) / th.rho).toBeLessThan(0.04);
    expect(Math.abs(res.avgWaitTime - th.Wq) / th.Wq).toBeLessThan(0.15);
  });

  // One Queue block feeding three 1-server tellers is ONE shared line, i.e. M/M/3. Picking a teller
  // round-robin on arrival made it three M/M/1 lines (Wq ~ 4x higher at this load).
  it("a queue feeding 3 single servers pools them: Erlang-C Wq +/-15%, counts balance", () => {
    const th = mmc(2.4, 1, 3);
    const g = queueGraph(2.4, 1);
    const tellers = ["t1", "t2", "t3"];
    g.nodes = [
      ...g.nodes.filter((n) => n.id !== "res"),
      ...tellers.map((id) => ({ id, nodeType: "resource" as const, label: id, params: { capacity: 1, serviceTimeMean: 1, serviceDistribution: "exponential" } })),
    ];
    g.edges = [
      { id: "a", source: "src", target: "q" },
      ...tellers.flatMap((id) => [{ id: `q${id}`, source: "q", target: id }, { id: `${id}s`, source: id, target: "sink" }]),
    ];
    const { result, stderr } = runPython(g, 40_000, 4);
    expect(result, stderr).toBeTruthy();
    expect(Math.abs(result.nodeStats.q.avgWaitTime - th.Wq) / th.Wq).toBeLessThan(0.15);
    for (const id of tellers) {
      const s = result.nodeStats[id];
      expect(s.entitiesIn - s.entitiesOut, id).toBe(s.currentDepth);
    }
  });

  it("overloaded M/M/1 (rho=2) completes ~mu*T and builds a backlog", () => {
    const { result } = runPython(queueGraph(2, 1), 2000, 5);
    expect(result.totalCompleted / 2000).toBeGreaterThan(0.9);
    expect(result.totalCompleted / 2000).toBeLessThan(1.05);
    expect(result.totalArrived - result.totalCompleted).toBeGreaterThan(1500);
  });

  it("every registry starter template runs to completion", () => {
    for (const cfg of Object.values(SIM_TYPE_REGISTRY)) {
      for (const sc of cfg.subScenarios) {
        const graph: SimGraph = { nodes: sc.nodes as any, edges: sc.edges };
        const { result, stderr } = runPython(graph, 600, 1);
        expect(result, `${cfg.id} / ${sc.label}: ${stderr.slice(-400)}`).toBeTruthy();
        expect(result.totalSimTime, `${cfg.id} / ${sc.label}`).toBeGreaterThan(0);
      }
    }
  });

  // SECURITY: generateSimPyScript uses String.replace(pattern, string), which expands
  // "$`", "$'" and "$&" inside the replacement. A block label containing "$`" pastes the
  // template prefix (ending in r""") into the JSON literal, closing the Python string, so
  // the rest of the label runs as Python in every collaborator's Pyodide worker.
  it("a block label cannot inject Python into the generated script", () => {
    const g = queueGraph(0.5, 1);
    g.nodes[0].label = "$` if print('JC8_'+'INJECTED') else '{}');#"; // marker only appears if the code runs
    const { stdout } = runPython(g, 50, 1);
    expect(stdout).not.toContain("JC8_INJECTED");
  });
});

// ─── Engine fixes: decision arrows, breakdowns, priority, queue rules, bursts, tanks ───

type N = SimGraph["nodes"][number];
function chain(nodes: N[], links: [string, string][]): SimGraph {
  return { nodes, edges: links.map(([source, target], i) => ({ id: `e${i}`, source, target })) };
}
const src = (id: string, arrivalRate: number, extra: Record<string, unknown> = {}): N =>
  ({ id, nodeType: "source", label: id, params: { arrivalRate, distribution: "exponential", ...extra } });
const sink = (id: string): N => ({ id, nodeType: "sink", label: id, params: {} });
const server = (id: string, params: Record<string, unknown> = {}, nodeType: N["nodeType"] = "resource"): N =>
  ({ id, nodeType, label: id, params: { capacity: 1, serviceTimeMean: 1, serviceDistribution: "exponential", ...params } });
const line = (id: string, params: Record<string, unknown> = {}): N =>
  ({ id, nodeType: "queue", label: id, params: { capacity: -1, discipline: "FIFO", ...params } });
const decision = (id: string, routes: unknown[] = []): N => ({ id, nodeType: "decision", label: id, params: { routes } });

/** Two classes (standard / urgent) wait in separate lines for one server; per-line waits come back. */
function twoClassWaits(resNode: N, discipline = "FIFO", seed = 2) {
  const g = chain(
    [src("std", 0.6), src("vip", 0.3, { priorityLevel: "urgent" }), line("qStd", { discipline }), line("qVip", { discipline }), resNode, sink("out")],
    [["std", "qStd"], ["vip", "qVip"], ["qStd", resNode.id], ["qVip", resNode.id], [resNode.id, "out"]]
  );
  const { result, stderr } = runPython(g, 20_000, seed);
  expect(result, stderr).toBeTruthy();
  return { std: result.nodeStats.qStd.avgWaitTime, vip: result.nodeStats.qVip.avgWaitTime, result };
}

describe.skipIf(!hasSimpy)("SimPy engine: decision arrows, breakdowns, priority, queue rules", () => {
  it("a Decision wired only with arrows (no routes) splits evenly instead of stopping", () => {
    const g = chain([src("s", 2), decision("d"), sink("a"), sink("b")], [["s", "d"], ["d", "a"], ["d", "b"]]);
    const { result, stderr } = runPython(g, 3000, 3);
    expect(result, stderr).toBeTruthy();
    const a = result.nodeStats.a.entitiesIn, b = result.nodeStats.b.entitiesIn;
    expect(a + b).toBe(result.totalArrived);
    expect(a / (a + b)).toBeGreaterThan(0.47);
    expect(a / (a + b)).toBeLessThan(0.53);
  });

  it("an arrow with no route takes the probability the explicit routes leave", () => {
    const g = chain([src("s", 2), decision("d", [{ targetId: "a", probability: 0.2 }]), sink("a"), sink("b")], [["s", "d"], ["d", "a"], ["d", "b"]]);
    const { result } = runPython(g, 3000, 4);
    const a = result.nodeStats.a.entitiesIn, b = result.nodeStats.b.entitiesIn;
    expect(a + b).toBe(result.totalArrived);
    expect(a / (a + b)).toBeGreaterThan(0.17);
    expect(a / (a + b)).toBeLessThan(0.23);
  });

  it("explicit routes that cover every arrow keep their probabilities", () => {
    const g = chain(
      [src("s", 2), decision("d", [{ targetId: "a", probability: 0.25 }, { targetId: "b", probability: 0.75 }]), sink("a"), sink("b")],
      [["s", "d"], ["d", "a"], ["d", "b"]]
    );
    const { result } = runPython(g, 3000, 5);
    const a = result.nodeStats.a.entitiesIn, b = result.nodeStats.b.entitiesIn;
    expect(a / (a + b)).toBeGreaterThan(0.22);
    expect(a / (a + b)).toBeLessThan(0.28);
  });

  it("breakdowns (MTBF 20s, repair 5s) cut a saturated server's throughput to ~80% availability", () => {
    // Finite line keeps the backlog (and the run time) bounded while the server stays saturated.
    const g = (p: Record<string, unknown>) => chain([src("s", 3), line("q", { capacity: 20 }), server("res", p), sink("out")], [["s", "q"], ["q", "res"], ["res", "out"]]);
    const T = 20_000;
    const base = runPython(g({}), T, 6).result;
    const { result: broken, stderr } = runPython(g({ meanTimeBetweenFailures: 20, repairTimeMean: 5 }), T, 6);
    expect(broken, stderr).toBeTruthy();
    expect(base.nodeStats.res.breakdownCount).toBeUndefined();
    const ratio = broken.totalCompleted / base.totalCompleted;
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(0.85);
    expect(broken.nodeStats.res.breakdownCount).toBeGreaterThan(500);
    const down = broken.nodeStats.res.totalDowntime ?? 0;
    expect(down / T).toBeGreaterThan(0.17);
    expect(down / T).toBeLessThan(0.23);
    // An interrupted job resumes, it is not lost and its full service time is recorded once.
    expect(Math.abs(broken.nodeStats.res.avgServiceTime - 1)).toBeLessThan(0.05);
  });

  it("a priority server serves urgent arrivals ahead of the standard line", () => {
    const { std, vip } = twoClassWaits(server("res", {}, "priority_resource"));
    expect(vip).toBeLessThan(std * 0.25);
  });

  it("'VIP & Urgent First' lines make a plain server prioritise; FIFO lines do not", () => {
    const pri = twoClassWaits(server("res"), "PRIORITY");
    expect(pri.vip).toBeLessThan(pri.std * 0.25);
    const fifo = twoClassWaits(server("res"), "FIFO");
    expect(fifo.vip / fifo.std).toBeGreaterThan(0.75);
    expect(fifo.vip / fifo.std).toBeLessThan(1.33);
  });

  it("a server that only breaks down keeps FIFO lines first-come (tiers ignored)", () => {
    const { std, vip } = twoClassWaits(server("res", { meanTimeBetweenFailures: 200, repairTimeMean: 5 }));
    expect(vip / std).toBeGreaterThan(0.75);
    expect(vip / std).toBeLessThan(1.33);
  });

  it("a preemptive server interrupts standard work for urgent arrivals and resumes it", () => {
    const { std, vip, result } = twoClassWaits(server("res", { isPreemptive: true }, "priority_resource"));
    // Urgent class sees an M/M/1 of its own: Wq = 0.3 / (1 * 0.7) ~ 0.43s.
    expect(vip).toBeLessThan(0.6);
    expect(std).toBeGreaterThan(vip * 5);
    expect(result.logs.some((l) => l.event === "preempted")).toBe(true);
    expect(Math.abs(result.nodeStats.res.avgServiceTime - 1)).toBeLessThan(0.05);
  });

  it("LIFO lines serve the newest arrival first; FIFO never reorders", () => {
    const inversions = (discipline: string) => {
      const g = chain([src("s", 0.9), line("q", { discipline }), server("res"), sink("out")], [["s", "q"], ["q", "res"], ["res", "out"]]);
      const { result } = runPython(g, 1500, 8);
      const queued = new Map<number, number>(), started: [number, number][] = [];
      for (const l of result.logs) {
        if (l.nodeId !== "res") continue;
        if (l.event === "queued") queued.set(l.entityId, l.simTime);
        if (l.event === "service_start") started.push([l.entityId, l.simTime]);
      }
      let inv = 0;
      for (let i = 1; i < started.length; i++) if (queued.get(started[i][0])! < queued.get(started[i - 1][0])!) inv++;
      return inv;
    };
    expect(inversions("FIFO")).toBe(0);
    expect(inversions("LIFO")).toBeGreaterThan(50);
  });

  it("a Waiting Line with capacity turns arrivals away once full", () => {
    const g = chain([src("s", 2), line("q", { capacity: 5 }), server("res"), sink("out")], [["s", "q"], ["q", "res"], ["res", "out"]]);
    const { result } = runPython(g, 2000, 9);
    const q = result.nodeStats.q;
    const dropped = q.droppedCount ?? 0;
    expect(dropped).toBeGreaterThan(500);
    expect(Math.max(...result.timeline.map((t) => t.depth.q))).toBeLessThanOrEqual(5);
    expect(result.totalArrived).toBe(result.totalCompleted + dropped + q.currentDepth + result.nodeStats.res.currentDepth);
  });

  it("'Rush Hour / Burst Spikes' arrives in groups at the same average rate", () => {
    const g = (distribution: string) => chain([src("s", 2, { distribution }), sink("out")], [["s", "out"]]);
    const T = 3000;
    const burst = runPython(g("burst"), T, 10).result;
    const plain = runPython(g("exponential"), T, 10).result;
    expect(Math.abs(burst.totalArrived / (2 * T) - 1)).toBeLessThan(0.1);
    const distinctTimes = (r: SimResult) => new Set(r.logs.filter((l) => l.event === "arrived").map((l) => l.simTime)).size;
    const arrivals = (r: SimResult) => r.logs.filter((l) => l.event === "arrived").length;
    expect(distinctTimes(burst) / arrivals(burst)).toBeLessThan(0.35);   // ~1/5 with groups of 5
    expect(distinctTimes(plain) / arrivals(plain)).toBeGreaterThan(0.95);
  });

  it("a tank with a drain rate empties and stops overflowing", () => {
    const g = (drainRate?: number) => chain(
      [src("s", 1, { distribution: "deterministic" }), { id: "tank", nodeType: "container", label: "tank", params: { capacity: 100, initialLevel: 0, fillRate: 10, drainRate } }, sink("out")],
      [["s", "tank"], ["tank", "out"]]
    );
    const full = runPython(g(), 1000, 11).result.nodeStats.tank;
    const drained = runPython(g(12), 1000, 11).result.nodeStats.tank;
    expect(full.droppedCount).toBeGreaterThan(900);
    expect(drained.droppedCount).toBe(0);
    expect(drained.level).toBeLessThan(100);
  });
});
