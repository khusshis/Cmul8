import type { SimGraph, SimResult, NodeStats, SimLog } from "@/lib/simulation/types";

// ─── Analytic queueing results (M/M/1, M/M/c via Erlang C) ────────────────────

export function mm1(lambda: number, mu: number) {
  const rho = lambda / mu;
  return { rho, L: rho / (1 - rho), Lq: rho ** 2 / (1 - rho), W: 1 / (mu - lambda), Wq: rho / (mu - lambda) };
}

export function mmc(lambda: number, mu: number, c: number) {
  const a = lambda / mu;
  const rho = a / c;
  // Erlang B by recursion, then C = B / (1 - rho (1 - B)).
  let B = 1;
  for (let k = 1; k <= c; k++) B = (a * B) / (k + a * B);
  const C = B / (1 - rho * (1 - B));
  const Wq = C / (c * mu - lambda);
  return { rho, C, Wq, W: Wq + 1 / mu, Lq: lambda * Wq };
}

// ─── Graph builders ──────────────────────────────────────────────────────────

/** source -> queue -> resource(capacity c) -> sink. Rates/means in seconds. */
export function queueGraph(arrivalRate: number, serviceTimeMean: number, capacity = 1, withQueue = true): SimGraph {
  const nodes: SimGraph["nodes"] = [
    { id: "src", nodeType: "source", label: "Arrivals", params: { arrivalRate, distribution: "exponential" } },
    ...(withQueue ? [{ id: "q", nodeType: "queue" as const, label: "Line", params: { capacity: -1, discipline: "FIFO" } }] : []),
    { id: "res", nodeType: "resource", label: "Server", params: { capacity, serviceTimeMean, serviceDistribution: "exponential" } },
    { id: "sink", nodeType: "sink", label: "Exit", params: { collectKPIs: true } },
  ];
  const chain = nodes.map((n) => n.id);
  const edges = chain.slice(1).map((t, i) => ({ id: `e${i}`, source: chain[i], target: t }));
  return { nodes, edges };
}

export function stat(partial: Partial<NodeStats> & { nodeId: string; nodeType: NodeStats["nodeType"] }): NodeStats {
  return {
    label: partial.nodeId,
    entitiesIn: 0,
    entitiesOut: 0,
    currentDepth: 0,
    utilization: 0,
    avgWaitTime: 0,
    avgServiceTime: 0,
    ...partial,
  };
}

export function result(partial: Partial<SimResult> = {}): SimResult {
  return {
    simType: "human_queue",
    totalSimTime: 100,
    totalArrived: 10,
    totalCompleted: 10,
    bottleneckNodeId: "",
    bottleneckLabel: "",
    nodeStats: {},
    timeline: [],
    logs: [],
    ...partial,
  };
}

export function log(simTime: number, entityId: number, nodeId: string, event: SimLog["event"]): SimLog {
  return { simTime, entityId, nodeId, nodeLabel: nodeId, event };
}

/** Within +/- tol (relative). */
export function near(actual: number, expected: number, tol: number) {
  return Math.abs(actual - expected) <= Math.abs(expected) * tol;
}

/** Deterministic Math.random replacement (mulberry32) so stochastic tests are reproducible. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
