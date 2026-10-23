import type { SimGraph, SimNode } from "./types";

/**
 * What-if multipliers for a stress test. Applied to a deep copy of the graph, never the canvas.
 * Field names match what codeGenerator.ts reads (with the same defaults when a param is missing).
 */
export interface StressConditions {
  /** × on every source's arrivalRate (and timetable batch sizes). 1 = today's demand. */
  demand: number;
  /** Per-source override of `demand`, keyed by node id. */
  demandBySource?: Record<string, number>;
  /** × on processing time: resource serviceTimeMean, service durationMean, channel propagationDelay. */
  service: number;
  /** Servers added (+) or removed (−) on every resource. Unlimited (≤ 0) stays unlimited; never below 1. */
  capacityDelta: number;
}

export const NEUTRAL_CONDITIONS: StressConditions = { demand: 1, service: 1, capacityDelta: 0 };

export const PROCESSING_TIME_FIELD: Partial<Record<SimNode["nodeType"], { key: string; fallback: number }>> = {
  resource: { key: "serviceTimeMean", fallback: 1 },
  priority_resource: { key: "serviceTimeMean", fallback: 1 },
  service: { key: "durationMean", fallback: 1 },
  channel: { key: "propagationDelay", fallback: 0 },
};

const SERVER_TYPES = new Set<SimNode["nodeType"]>(["resource", "priority_resource"]);

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function isNeutral(c: StressConditions | undefined): boolean {
  if (!c) return true;
  const perSource = Object.values(c.demandBySource ?? {}).every((m) => m === c.demand);
  return c.demand === 1 && c.service === 1 && c.capacityDelta === 0 && perSource;
}

/** Deep copy of `graph` with the conditions applied. */
export function applyStress(graph: SimGraph, c: StressConditions | undefined): SimGraph {
  const g: SimGraph = JSON.parse(JSON.stringify(graph));
  if (!c || isNeutral(c)) return g;
  for (const node of g.nodes) {
    const p = (node.params ?? {}) as Record<string, unknown>;
    node.params = p;
    if (node.nodeType === "source") {
      const m = c.demandBySource?.[node.id] ?? c.demand;
      p.arrivalRate = num(p.arrivalRate, 1) * m;
      if (Array.isArray(p.schedule)) {
        p.schedule = (p.schedule as Array<{ simTime: number; count: number }>).map((e) => ({ ...e, count: Math.max(0, Math.round(num(e.count, 0) * m)) }));
      }
    }
    const field = PROCESSING_TIME_FIELD[node.nodeType];
    if (field) p[field.key] = num(p[field.key], field.fallback) * c.service;
    if (SERVER_TYPES.has(node.nodeType) && c.capacityDelta !== 0) {
      const cap = num(p.capacity, 1);
      if (cap > 0) p.capacity = Math.max(1, Math.round(cap + c.capacityDelta));
    }
  }
  return g;
}

const fmtX = (m: number) => `${Number(m.toFixed(2))}×`;

/** Short chip labels, e.g. ["Demand 1.5×", "Service 1.2×", "+1 server"]. Empty when neutral. */
export function describeConditions(c: StressConditions | undefined, labelOf: (id: string) => string = (id) => id): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.demand !== 1) out.push(`Demand ${fmtX(c.demand)}`);
  for (const [id, m] of Object.entries(c.demandBySource ?? {})) if (m !== c.demand) out.push(`${labelOf(id)} demand ${fmtX(m)}`);
  if (c.service !== 1) out.push(`Service time ${fmtX(c.service)}`);
  if (c.capacityDelta !== 0) out.push(`${c.capacityDelta > 0 ? "+" : "−"}${Math.abs(c.capacityDelta)} server${Math.abs(c.capacityDelta) === 1 ? "" : "s"} per station`);
  return out;
}
