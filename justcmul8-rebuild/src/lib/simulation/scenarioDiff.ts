import type { SimGraph, SimNode } from "./types";

// ─── Key numeric params per block type (for the inline tweak table) ──────────

export interface ParamSpec {
  key: string;
  label: string;
  /** Plain-English tooltip. */
  help: string;
  /** Default the engine uses when the param is missing. */
  fallback: number;
  integer?: boolean;
  min?: number;
  /** -1 means "unlimited" for this field. */
  allowUnlimited?: boolean;
}

const SERVICE_TIME: ParamSpec = { key: "serviceTimeMean", label: "Service time", help: "Average time one server spends on one item (simulated seconds).", fallback: 1, min: 0 };
const SERVERS: ParamSpec = { key: "capacity", label: "Servers", help: "How many items this station can work on at the same time.", fallback: 1, integer: true, min: 1 };
const HOURLY: ParamSpec = { key: "hourlyCost", label: "Cost / time", help: "Cost per simulated time unit this station is busy.", fallback: 0, min: 0 };

export const KEY_PARAMS: Partial<Record<SimNode["nodeType"], ParamSpec[]>> = {
  source: [{ key: "arrivalRate", label: "Arrivals / s", help: "Average number of new items per simulated second. Higher = busier.", fallback: 1, min: 0 }],
  resource: [SERVERS, SERVICE_TIME, HOURLY],
  priority_resource: [SERVERS, SERVICE_TIME, HOURLY],
  service: [{ key: "durationMean", label: "Duration", help: "Average processing delay (simulated seconds). Everyone is served at once.", fallback: 1, min: 0 }],
  queue: [
    { key: "capacity", label: "Max queue", help: "Most items that can wait here; -1 means unlimited. Extra arrivals are turned away.", fallback: -1, integer: true, allowUnlimited: true },
    { key: "patienceTimeout", label: "Patience", help: "How long an item waits before giving up and leaving (simulated seconds).", fallback: 0, min: 0 },
  ],
  channel: [
    { key: "propagationDelay", label: "Delay", help: "Transmission delay through this channel (simulated seconds).", fallback: 0, min: 0 },
    { key: "bufferCapacity", label: "Buffer", help: "Messages the channel can hold; -1 means unlimited.", fallback: -1, integer: true, allowUnlimited: true },
  ],
  container: [
    { key: "capacity", label: "Capacity", help: "Maximum amount the tank or store can hold.", fallback: 1000, min: 0 },
    { key: "fillRate", label: "Fill rate", help: "Amount added per simulated second.", fallback: 1, min: 0 },
  ],
};

/** Clamp/round a typed value to what the field allows. Returns null for invalid input. */
export function sanitizeParam(spec: ParamSpec, v: number): number | null {
  if (!Number.isFinite(v)) return null;
  if (spec.allowUnlimited && v < 0) return -1;
  let out = spec.integer ? Math.round(v) : v;
  if (spec.min !== undefined) out = Math.max(spec.min, out);
  return out;
}

// ─── Diff ────────────────────────────────────────────────────────────────────

export type Change =
  | { kind: "block-added" | "block-removed"; nodeId: string; label: string; nodeType: string }
  | { kind: "param"; nodeId: string; label: string; key: string; from: unknown; to: unknown }
  | { kind: "renamed"; nodeId: string; from: string; to: string }
  | { kind: "link-added" | "link-removed"; from: string; to: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What differs in `other` relative to `base` (blocks matched by id, links by source→target). */
export function diffGraphs(base: SimGraph, other: SimGraph): Change[] {
  const out: Change[] = [];
  const bNodes = new Map(base.nodes.map((n) => [n.id, n]));
  const oNodes = new Map(other.nodes.map((n) => [n.id, n]));
  const label = (id: string) => oNodes.get(id)?.label || bNodes.get(id)?.label || id;

  for (const n of other.nodes) {
    const b = bNodes.get(n.id);
    if (!b) {
      out.push({ kind: "block-added", nodeId: n.id, label: n.label || n.id, nodeType: n.nodeType });
      continue;
    }
    if ((b.label || "") !== (n.label || "")) out.push({ kind: "renamed", nodeId: n.id, from: b.label, to: n.label });
    const bp = (b.params ?? {}) as Record<string, unknown>;
    const op = (n.params ?? {}) as Record<string, unknown>;
    for (const key of [...new Set([...Object.keys(bp), ...Object.keys(op)])].sort()) {
      if (!same(bp[key], op[key])) out.push({ kind: "param", nodeId: n.id, label: n.label || n.id, key, from: bp[key], to: op[key] });
    }
  }
  for (const b of base.nodes) if (!oNodes.has(b.id)) out.push({ kind: "block-removed", nodeId: b.id, label: b.label || b.id, nodeType: b.nodeType });

  const linkKey = (e: { source: string; target: string }) => `${e.source}\u0000${e.target}`;
  const bLinks = new Set(base.edges.map(linkKey));
  const oLinks = new Set(other.edges.map(linkKey));
  for (const e of other.edges) if (!bLinks.has(linkKey(e))) out.push({ kind: "link-added", from: label(e.source), to: label(e.target) });
  for (const e of base.edges) if (!oLinks.has(linkKey(e))) out.push({ kind: "link-removed", from: label(e.source), to: label(e.target) });
  return out;
}

// ─── Apply a scenario back onto the canvas ───────────────────────────────────

type IdNode = { id: string };
type IdEdge = { id: string; source: string; target: string };

/**
 * Replace the blocks a scenario was captured from (`sourceIds`) with the scenario's blocks,
 * leaving the rest of the canvas alone. Scenario blocks whose id clashes with an untouched
 * canvas block are renamed (and their links remapped). Links that now dangle are dropped.
 */
export function mergeScenario<N extends IdNode, E extends IdEdge>(
  canvasNodes: N[],
  canvasEdges: E[],
  scenarioNodes: N[],
  scenarioEdges: E[],
  sourceIds: string[]
): { nodes: N[]; edges: E[] } {
  const replaced = new Set(sourceIds);
  const kept = canvasNodes.filter((n) => !replaced.has(n.id));
  const taken = new Set(kept.map((n) => n.id));
  const rename = new Map<string, string>();
  let k = 1;
  const nodes: N[] = scenarioNodes.map((n) => {
    if (!taken.has(n.id)) {
      taken.add(n.id);
      return n;
    }
    let id = `${n.id}_s${k++}`;
    while (taken.has(id)) id = `${n.id}_s${k++}`;
    taken.add(id);
    rename.set(n.id, id);
    return { ...n, id };
  });
  const mapId = (id: string) => rename.get(id) ?? id;
  const all = [...kept, ...nodes];
  const ids = new Set(all.map((n) => n.id));
  const scenEdges = scenarioEdges.map((e) => ({ ...e, source: mapId(e.source), target: mapId(e.target) }));
  // Canvas links touching replaced blocks are re-created from the scenario; others survive if both ends exist.
  const keptEdges = canvasEdges.filter((e) => !(replaced.has(e.source) && replaced.has(e.target)));
  const seen = new Set<string>();
  const edges = [...keptEdges, ...scenEdges].filter((e) => {
    const key = `${e.source}\u0000${e.target}`;
    if (!ids.has(e.source) || !ids.has(e.target) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { nodes: [...kept, ...nodes], edges };
}
