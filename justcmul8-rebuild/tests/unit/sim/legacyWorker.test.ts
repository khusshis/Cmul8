/**
 * The fallback TypeScript engine (legacyWorker.ts), driven in-process: the worker module
 * only needs a `self` with postMessage/onmessage, so we provide one and feed it messages.
 * Math.random is seeded so every run is reproducible.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SimParams, SimResult, SimTick, SimGraph } from "@/lib/simulation/types";
import { mm1, mmc, queueGraph, seededRandom } from "../helpers";

async function runLegacy(graph: SimGraph, durationSeconds: number, seed = 7, tickIntervalSeconds = durationSeconds / 100) {
  vi.resetModules();
  vi.spyOn(Math, "random").mockImplementation(seededRandom(seed));
  const ticks: SimTick[] = [];
  const done = new Promise<SimResult>((resolve, reject) => {
    (globalThis as any).self = {
      postMessage(msg: any) {
        if (msg.type === "tick") ticks.push(msg.data);
        else if (msg.type === "complete") resolve(msg.data);
        else if (msg.type === "error") reject(new Error(msg.message));
      },
    };
  });
  await import("@/lib/simulation/legacyWorker");
  const params: SimParams = { graph, simType: "human_queue", durationSeconds, speedMultiplier: 0, tickIntervalSeconds };
  (globalThis as any).self.onmessage({ data: { type: "start", params } });
  const result = await done;
  return { result, ticks };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).self;
});

describe("legacyWorker (fallback engine)", () => {
  it("runs to the requested duration and conserves entities", async () => {
    const { result, ticks } = await runLegacy(queueGraph(0.5, 1), 2000);
    expect(result.totalSimTime).toBe(2000);
    expect(result.totalArrived).toBeGreaterThan(900);
    expect(result.totalCompleted).toBeLessThanOrEqual(result.totalArrived);
    expect(result.totalArrived - result.totalCompleted).toBeLessThan(20);
    expect(ticks.length).toBeGreaterThanOrEqual(100);
    expect(result.nodeStats.sink.entitiesIn).toBe(result.totalCompleted);
  });

  it("M/M/1 rho=0.5: utilisation and queue wait match theory (+/-12%)", async () => {
    const th = mm1(0.5, 1);
    const { result } = await runLegacy(queueGraph(0.5, 1), 40_000, 11);
    expect(result.nodeStats.res.utilization).toBeGreaterThan(th.rho * 0.88);
    expect(result.nodeStats.res.utilization).toBeLessThan(th.rho * 1.12);
    expect(result.nodeStats.res.avgWaitTime).toBeGreaterThan(th.Wq * 0.88);
    expect(result.nodeStats.res.avgWaitTime).toBeLessThan(th.Wq * 1.12);
    expect(result.nodeStats.res.avgServiceTime).toBeGreaterThan(0.95);
    expect(result.nodeStats.res.avgServiceTime).toBeLessThan(1.05);
  });

  it("M/M/c (c=2, rho=0.8): queue wait matches Erlang C (+/-15%)", async () => {
    const th = mmc(1.6, 1, 2);
    const { result } = await runLegacy(queueGraph(1.6, 1, 2), 40_000, 5);
    expect(result.nodeStats.res.avgWaitTime).toBeGreaterThan(th.Wq * 0.85);
    expect(result.nodeStats.res.avgWaitTime).toBeLessThan(th.Wq * 1.15);
  });

  // Guards the busyStart-per-node bookkeeping: multi-server utilisation must be per server.
  it("M/M/c (c=3, rho=0.5): per-server utilisation is ~0.5 (+/-10%)", async () => {
    const { result } = await runLegacy(queueGraph(1.5, 1, 3), 40_000, 5);
    expect(result.nodeStats.res.utilization).toBeGreaterThan(0.45);
    expect(result.nodeStats.res.utilization).toBeLessThan(0.55);
  });

  // BUG: runChunk() drains the log buffer on every tick, then buildResult() drains it
  // again, so the final SimResult.logs is always empty (Entity Tracer / Logs tab blank).
  it("final result carries the event log", async () => {
    const { result } = await runLegacy(queueGraph(0.5, 1), 500);
    expect(result.logs.length).toBeGreaterThan(0);
  });

  // BUG: the timeline array is declared but never appended to.
  it("final result carries a timeline for the throughput / WIP charts", async () => {
    const { result } = await runLegacy(queueGraph(0.5, 1), 500);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("decision block splits by route probability", async () => {
    const graph: SimGraph = {
      nodes: [
        { id: "src", nodeType: "source", label: "S", params: { arrivalRate: 2, distribution: "exponential" } },
        { id: "d", nodeType: "decision", label: "D", params: { routes: [{ targetId: "a", probability: 0.25 }, { targetId: "b", probability: 0.75 }] } },
        { id: "a", nodeType: "sink", label: "A", params: {} },
        { id: "b", nodeType: "sink", label: "B", params: {} },
      ],
      edges: [
        { id: "e1", source: "src", target: "d" },
        { id: "e2", source: "d", target: "a" },
        { id: "e3", source: "d", target: "b" },
      ],
    };
    const { result } = await runLegacy(graph, 5000, 3);
    const share = result.nodeStats.a.entitiesIn / result.totalCompleted;
    expect(share).toBeGreaterThan(0.22);
    expect(share).toBeLessThan(0.28);
    expect(result.totalCompleted).toBe(result.nodeStats.a.entitiesIn + result.nodeStats.b.entitiesIn);
  });

  it("decision block with arrows but no routes splits evenly over its arrows", async () => {
    const graph: SimGraph = {
      nodes: [
        { id: "src", nodeType: "source", label: "S", params: { arrivalRate: 2, distribution: "exponential" } },
        { id: "d", nodeType: "decision", label: "D", params: {} },
        { id: "a", nodeType: "sink", label: "A", params: {} },
        { id: "b", nodeType: "sink", label: "B", params: {} },
      ],
      edges: [
        { id: "e1", source: "src", target: "d" },
        { id: "e2", source: "d", target: "a" },
        { id: "e3", source: "d", target: "b" },
      ],
    };
    const { result } = await runLegacy(graph, 5000, 3);
    const share = result.nodeStats.a.entitiesIn / result.totalCompleted;
    expect(share).toBeGreaterThan(0.47);
    expect(share).toBeLessThan(0.53);
  });

  it("source maxEntities caps arrivals", async () => {
    const g = queueGraph(5, 0.01);
    (g.nodes[0].params as any).maxEntities = 25;
    const { result } = await runLegacy(g, 1000);
    expect(result.totalArrived).toBe(25);
  });

  it("store / channel / broadcaster / service / container graphs run without error", async () => {
    const graph: SimGraph = {
      nodes: [
        { id: "src", nodeType: "source", label: "S", params: { arrivalRate: 1, distribution: "exponential" } },
        { id: "svc", nodeType: "service", label: "Svc", params: { durationMean: 0.5, distribution: "exponential" } },
        { id: "st", nodeType: "store", label: "Store", params: { capacity: 50 } },
        { id: "ch", nodeType: "channel", label: "Ch", params: { propagationDelay: 0.2, delayDistribution: "deterministic", bufferCapacity: -1 } },
        { id: "bc", nodeType: "broadcaster", label: "B", params: { bufferCapacity: -1 } },
        { id: "k1", nodeType: "sink", label: "K1", params: {} },
        { id: "k2", nodeType: "sink", label: "K2", params: {} },
      ],
      edges: [
        { id: "1", source: "src", target: "svc" },
        { id: "2", source: "svc", target: "st" },
        { id: "3", source: "st", target: "ch" },
        { id: "4", source: "ch", target: "bc" },
        { id: "5", source: "bc", target: "k1" },
        { id: "6", source: "bc", target: "k2" },
      ],
    };
    const { result } = await runLegacy(graph, 500);
    expect(result.totalArrived).toBeGreaterThan(0);
    expect(result.nodeStats.k1.entitiesIn).toBe(result.nodeStats.k2.entitiesIn); // broadcast copies to both
  });
});
