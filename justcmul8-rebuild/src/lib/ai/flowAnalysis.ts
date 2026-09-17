/**
 * flowAnalysis.ts — deterministic queueing arithmetic for the AI's context.
 *
 * Pure module (no React, no server imports).
 *
 * Why this exists: the assistant was asked to compute rho itself, and its prose
 * was not always self-consistent. One observed reply said "rho = 1.13 because 2
 * cashiers taking 45s each can only handle 160 customers/hour" against 360
 * arrivals/hour — the risk grade and the component figures were right, but
 * 360/160 is 2.25. No output validator can catch that, because the number is free
 * text. So we stop asking: lambda, mu and rho are computed here and handed to the
 * model as facts.
 *
 * Routing mirrors the engine (`get_next_targets` in codeGenerator.ts) exactly:
 *   - a source with routingMode "broadcast", and every broadcaster, sends the FULL
 *     rate to every outgoing link (entities are cloned)
 *   - a decision splits by its route probabilities
 *   - everything else round-robins, so N outgoing links each receive lambda / N
 */

import { readNode, type AINodeType } from "./graphOps";

export interface StationFlow {
  id: string;
  label: string;
  nodeType: string;
  /** Entities per second arriving at this block. */
  lambda: number;
  /** Parallel servers. Only meaningful for resource-like blocks. */
  capacity?: number;
  /** Seconds per entity per server. */
  serviceTimeMean?: number;
  /** Service rate per server, 1 / serviceTimeMean. */
  mu?: number;
  /** Utilisation lambda / (capacity * mu). >= 1 means the queue grows without bound. */
  rho?: number;
  /** Arrival rate at which this block reaches rho = 1: capacity / serviceTimeMean. */
  lambdaMax?: number;
  note?: string;
}

export interface FlowAnalysis {
  /** Sum of all enabled source rates, entities per second. */
  totalSourceRate: number;
  stations: StationFlow[];
  bottleneck?: { id: string; label: string; rho: number };
  /** Blocks already saturated (rho >= 1). */
  unstable: Array<{ id: string; label: string; rho: number }>;
  /**
   * False when the rate propagation did not settle, which means a feedback loop
   * returns too much of its own flow. Every lambda and rho below is then
   * meaningless and must not be quoted.
   */
  converged: boolean;
  /**
   * Factor by which every source rate can be multiplied before the first block
   * reaches rho = 1. Below 1 the model is already overloaded. Undefined when
   * nothing constrains the flow.
   */
  headroomFactor?: number;
  /** Total arrival rate at which the first block saturates. */
  sustainableSourceRate?: number;
  warnings: string[];
}

const RESOURCE_LIKE = new Set(["resource", "priority_resource"]);

function n(v: unknown, fallback: number): number {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

const round = (v: number, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

interface Parsed {
  id: string;
  nodeType: AINodeType | string;
  label: string;
  params: Record<string, any>;
}

/**
 * Propagates source rates through the graph and computes utilisation per station.
 * Handles rework loops by iterating to a fixed point; a loop whose gain is >= 1
 * diverges, which is itself reported rather than silently producing nonsense.
 */
export function analyseFlow(rawNodes: any[], rawEdges: any[]): FlowAnalysis {
  const warnings: string[] = [];
  const nodes: Parsed[] = [];
  for (const raw of rawNodes) {
    const r = readNode(raw);
    if (!r.id || typeof r.nodeType !== "string") continue;
    nodes.push({
      id: r.id,
      nodeType: r.nodeType,
      label: (typeof r.label === "string" && r.label) || r.id,
      params: (r.params as Record<string, any>) ?? {},
    });
  }
  const byId = new Map(nodes.map((x) => [x.id, x]));
  const edges = rawEdges
    .map((e: any) => ({ source: String(e?.source ?? ""), target: String(e?.target ?? "") }))
    .filter((e) => byId.has(e.source) && byId.has(e.target));

  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source) ?? [];
    list.push(e.target);
    outgoing.set(e.source, list);
  }

  // Fraction of a block's throughput that travels down each outgoing link.
  const share = (from: Parsed, to: string): number => {
    const targets = outgoing.get(from.id) ?? [];
    if (targets.length === 0) return 0;
    const duplicates =
      from.nodeType === "broadcaster" ||
      (from.nodeType === "source" && from.params.routingMode === "broadcast");
    if (duplicates) return targets.filter((t) => t === to).length;

    if (from.nodeType === "decision") {
      const routes = Array.isArray(from.params.routes) ? from.params.routes : [];
      const total = routes.reduce((a: number, r: any) => a + Math.max(0, n(r?.probability, 0)), 0);
      if (total > 0) {
        const mine = routes
          .filter((r: any) => r?.targetId === to)
          .reduce((a: number, r: any) => a + Math.max(0, n(r?.probability, 0)), 0);
        return mine / total; // normalised, matching the engine's cumulative walk
      }
      // No usable probabilities: the engine falls back to round-robin.
    }
    return targets.filter((t) => t === to).length / targets.length;
  };

  const sourceRate = (x: Parsed) =>
    x.nodeType === "source" ? Math.max(0, n(x.params.arrivalRate, 0)) : 0;
  const totalSourceRate = nodes.reduce((a, x) => a + sourceRate(x), 0);

  // Fixed-point iteration: lambda(v) = sum over incoming of lambda(u) * share(u, v).
  const lambda = new Map<string, number>();
  for (const x of nodes) lambda.set(x.id, sourceRate(x));

  // Convergence is the test, not a magnitude ceiling. A loop returning exactly
  // 100% of its flow grows by a constant each pass rather than exponentially, so
  // it never trips a ceiling — it just never settles. Reporting the value it
  // happened to reach on the last iteration would be presenting noise as fact.
  const TOLERANCE = 1e-9;
  const MAX_ITERATIONS = 500;
  let converged = false;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let maxDelta = 0;
    for (const v of nodes) {
      let next = sourceRate(v);
      for (const e of edges) {
        if (e.target !== v.id) continue;
        next += (lambda.get(e.source) ?? 0) * share(byId.get(e.source)!, v.id);
      }
      if (!Number.isFinite(next)) next = Number.MAX_SAFE_INTEGER;
      maxDelta = Math.max(maxDelta, Math.abs(next - (lambda.get(v.id) ?? 0)));
      lambda.set(v.id, next);
    }
    if (maxDelta < TOLERANCE) {
      converged = true;
      break;
    }
  }
  if (!converged) {
    warnings.push(
      "A rework or feedback loop sends back 100% or more of its own flow, so the load grows without bound and no steady arrival rate exists. The rates below are not meaningful until the fraction routed backwards is reduced. Fix the loop first."
    );
  }

  const stations: StationFlow[] = [];
  for (const x of nodes) {
    const lam = round(lambda.get(x.id) ?? 0, 6);
    const st: StationFlow = { id: x.id, label: x.label, nodeType: x.nodeType, lambda: lam };

    if (RESOURCE_LIKE.has(x.nodeType)) {
      const capacity = Math.max(1, Math.round(n(x.params.capacity, 1)));
      const serviceTimeMean = n(x.params.serviceTimeMean, 1);
      st.capacity = capacity;
      st.serviceTimeMean = serviceTimeMean;
      if (serviceTimeMean > 0) {
        st.mu = round(1 / serviceTimeMean, 6);
        st.rho = round((lam * serviceTimeMean) / capacity, 4);
        st.lambdaMax = round(capacity / serviceTimeMean, 6);
      } else {
        st.note = "serviceTimeMean is 0, so this block is instantaneous and never a constraint.";
      }
    } else if (x.nodeType === "service") {
      st.serviceTimeMean = n(x.params.durationMean, 1);
      st.note = "Unlimited concurrency: a pure delay, so it has no utilisation and cannot be a bottleneck.";
    } else if (x.nodeType === "queue") {
      const cap = n(x.params.capacity, -1);
      const patience = x.params.patienceDistribution;
      const bits: string[] = [];
      if (cap > 0) bits.push(`holds at most ${cap}; arrivals beyond that are turned away`);
      if (patience && patience !== "none") bits.push("entities renege if they wait too long, so downstream rates are an upper bound");
      if (bits.length) st.note = bits.join("; ");
    } else if (x.nodeType === "container") {
      const capacity = n(x.params.capacity, 1000);
      const fillRate = Math.max(0, n(x.params.fillRate, 1));
      if (lam > 0 && fillRate > 0) {
        const secondsToFull = capacity / (lam * fillRate);
        st.note = `Fills in about ${Math.round(secondsToFull)}s at this rate, and nothing drains it — arrivals after that are dropped.`;
      }
    } else if (x.nodeType === "channel") {
      const buffer = n(x.params.bufferCapacity, -1);
      const delay = Math.max(0, n(x.params.propagationDelay, 0));
      const inFlight = lam * delay;
      st.note =
        buffer > 0 && inFlight > buffer
          ? `About ${round(inFlight, 2)} messages are in flight but the buffer holds ${buffer}, so messages will be dropped.`
          : `About ${round(inFlight, 2)} messages in flight (rate x delay).`;
    }
    stations.push(st);
  }

  const constrained = stations.filter((s) => s.rho !== undefined && s.lambda > 0);
  const unstable = constrained
    .filter((s) => (s.rho as number) >= 1)
    .map((s) => ({ id: s.id, label: s.label, rho: s.rho as number }));

  let bottleneck: FlowAnalysis["bottleneck"];
  if (constrained.length > 0) {
    const worst = constrained.reduce((a, b) => ((b.rho as number) > (a.rho as number) ? b : a));
    bottleneck = { id: worst.id, label: worst.label, rho: worst.rho as number };
  }

  // How far every source rate can scale before the first block saturates.
  let headroomFactor: number | undefined;
  for (const s of constrained) {
    const f = 1 / (s.rho as number);
    if (headroomFactor === undefined || f < headroomFactor) headroomFactor = f;
  }

  if (!converged) {
    // Suppress anything that would read as a trustworthy figure.
    for (const s of stations) {
      s.lambda = 0;
      delete s.rho;
      delete s.mu;
      s.note = "Not computable: an unbounded feedback loop means there is no steady rate here.";
    }
    return {
      totalSourceRate: round(totalSourceRate, 6),
      stations,
      unstable: [],
      converged: false,
      warnings,
    };
  }

  return {
    totalSourceRate: round(totalSourceRate, 6),
    stations,
    bottleneck,
    unstable,
    converged: true,
    headroomFactor: headroomFactor === undefined ? undefined : round(headroomFactor, 3),
    sustainableSourceRate:
      headroomFactor === undefined ? undefined : round(totalSourceRate * headroomFactor, 6),
    warnings,
  };
}
