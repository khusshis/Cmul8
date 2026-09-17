/**
 * graphOps.ts — validation and NON-DESTRUCTIVE application of AI canvas edits.
 *
 * Pure module (no React, no server imports) so the API route and the chat panel
 * share one source of truth.
 *
 * Why this exists: the chat panel used to replace the ENTIRE canvas with whatever
 * graph the model returned, for every action type. A model answering "increase
 * the arrival rate" with only the one node it touched wiped the user's model with
 * no undo. Here every incremental action is a merge against the live canvas:
 * nodes absent from the model's reply are never deleted unless the action is an
 * explicit delete.
 */

export const NODE_TYPES = [
  "source", "queue", "resource", "service", "decision", "sink", "container",
  "store", "event_trigger", "priority_resource", "channel", "broadcaster",
  "any_of", "all_of", "interrupter",
] as const;
export type AINodeType = (typeof NODE_TYPES)[number];

export const ACTION_TYPES = [
  "REPLACE_GRAPH", "ADD_NODES", "UPDATE_NODES", "CONNECT_NODES",
  "DELETE_NODES", "AUTO_LAYOUT", "NONE",
] as const;
export type AIActionType = (typeof ACTION_TYPES)[number];

const DISTRIBUTIONS = ["exponential", "uniform", "normal", "deterministic", "poisson"];
const PATIENCE_DISTRIBUTIONS = ["none", "uniform", "exponential", "deterministic"];
const QUEUE_DISCIPLINES = ["FIFO", "LIFO", "PRIORITY"];

/** Minimal simulation-level node, as the model reads and writes it. */
export interface AINode {
  id: string;
  nodeType: AINodeType;
  label: string;
  params: Record<string, any>;
  /** Optional hint from the model. Dagre overrides it on a full rebuild. */
  position?: { x: number; y: number };
}
export interface AIEdge {
  id: string;
  source: string;
  target: string;
}

/** A node patch: only the fields present are changed; params are shallow-merged. */
export interface AINodePatch {
  id: string;
  nodeType?: AINodeType;
  label?: string;
  params?: Record<string, any>;
  /** Only used when the patch creates a new block. */
  position?: { x: number; y: number };
}

/** Normalised, validated operation set. This is the contract the client applies. */
export interface AIGraphOps {
  actionType: AIActionType;
  /** REPLACE_GRAPH only. */
  replaceGraph?: { nodes: AINode[]; edges: AIEdge[] };
  upsertNodes: AINodePatch[];
  addEdges: AIEdge[];
  deleteNodeIds: string[];
  deleteEdgeIds: string[];
}

export interface ApplyResult {
  nodes: any[];
  edges: any[];
  changed: boolean;
  /** True when the whole canvas should be re-laid-out (new graph / explicit layout). */
  needsFullLayout: boolean;
  newNodeIds: string[];
  warnings: string[];
}

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function num(v: unknown): number | undefined {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function isNodeType(v: unknown): v is AINodeType {
  return typeof v === "string" && (NODE_TYPES as readonly string[]).includes(v);
}

/** Accepts both the flat simulation shape and the ReactFlow `{ data: {...} }` shape. */
export function readNode(raw: any): {
  id?: string; nodeType?: unknown; label?: unknown; params?: unknown;
  position?: { x: number; y: number };
} {
  if (!raw || typeof raw !== "object") return {};
  const px = num(raw.position?.x);
  const py = num(raw.position?.y);
  return {
    id: str(raw.id),
    nodeType: raw.data?.nodeType ?? raw.nodeType ?? raw.type,
    label: raw.data?.label ?? raw.label,
    params: raw.data?.params ?? raw.params,
    position: px !== undefined && py !== undefined ? { x: px, y: py } : undefined,
  };
}

// ─── Parameter sanitation ─────────────────────────────────────────────────────

/**
 * Clamps numeric params into the ranges the SimPy engine accepts and replaces
 * unknown enum values with safe defaults. Unknown keys are preserved: the model
 * must never silently strip parameters a user configured by hand.
 */
export function sanitizeParams(
  nodeType: AINodeType,
  params: Record<string, any> | undefined,
  label: string,
  warnings: string[]
): Record<string, any> {
  const p: Record<string, any> = { ...(params && typeof params === "object" ? params : {}) };
  const warn = (msg: string) => warnings.push(`${label}: ${msg}`);

  const enumOr = (key: string, allowed: string[], fallback: string) => {
    if (p[key] === undefined) return;
    if (!allowed.includes(p[key])) {
      warn(`unsupported ${key} "${p[key]}", using "${fallback}"`);
      p[key] = fallback;
    }
  };
  const positive = (key: string, fallback: number) => {
    if (p[key] === undefined) return;
    const n = num(p[key]);
    if (n === undefined || n <= 0) {
      warn(`${key} must be > 0, using ${fallback}`);
      p[key] = fallback;
    } else p[key] = n;
  };
  const nonNegative = (key: string, fallback: number) => {
    if (p[key] === undefined) return;
    const n = num(p[key]);
    if (n === undefined || n < 0) {
      warn(`${key} must be >= 0, using ${fallback}`);
      p[key] = fallback;
    } else p[key] = n;
  };
  const integerAtLeast1 = (key: string, fallback: number) => {
    if (p[key] === undefined) return;
    const n = num(p[key]);
    if (n === undefined || n < 1) {
      warn(`${key} must be a whole number >= 1, using ${fallback}`);
      p[key] = fallback;
    } else p[key] = Math.round(n);
  };
  /** -1 means unlimited; otherwise a whole number >= 1. */
  const capacityOrUnlimited = (key: string) => {
    if (p[key] === undefined) return;
    const n = num(p[key]);
    if (n === undefined || (n !== -1 && n < 1)) {
      warn(`${key} must be -1 (unlimited) or >= 1, using unlimited`);
      p[key] = -1;
    } else p[key] = n === -1 ? -1 : Math.round(n);
  };

  switch (nodeType) {
    case "source":
      // 0 is legal: the engine treats it as "source disabled".
      nonNegative("arrivalRate", 1);
      enumOr("distribution", DISTRIBUTIONS, "exponential");
      if (p.maxEntities !== undefined) {
        const n = num(p.maxEntities);
        if (n === undefined || n < 1) delete p.maxEntities;
        else p.maxEntities = Math.round(n);
      }
      break;
    case "queue":
      capacityOrUnlimited("capacity");
      enumOr("discipline", QUEUE_DISCIPLINES, "FIFO");
      enumOr("patienceDistribution", PATIENCE_DISTRIBUTIONS, "none");
      positive("patienceTimeout", 5);
      nonNegative("patienceMin", 1);
      nonNegative("patienceMax", 3);
      if (num(p.patienceMin) !== undefined && num(p.patienceMax) !== undefined && p.patienceMin > p.patienceMax) {
        [p.patienceMin, p.patienceMax] = [p.patienceMax, p.patienceMin];
      }
      break;
    case "resource":
    case "priority_resource":
      integerAtLeast1("capacity", 1);
      positive("serviceTimeMean", 1);
      enumOr("serviceDistribution", DISTRIBUTIONS, "exponential");
      break;
    case "service":
      nonNegative("durationMean", 1);
      enumOr("distribution", DISTRIBUTIONS, "exponential");
      break;
    case "container":
      positive("capacity", 1000);
      nonNegative("initialLevel", 0);
      positive("fillRate", 1);
      if (num(p.capacity) !== undefined && num(p.initialLevel) !== undefined && p.initialLevel > p.capacity) {
        warn(`initialLevel exceeds capacity, clamped to ${p.capacity}`);
        p.initialLevel = p.capacity;
      }
      break;
    case "store":
      capacityOrUnlimited("capacity");
      break;
    case "channel":
      nonNegative("propagationDelay", 0);
      capacityOrUnlimited("bufferCapacity");
      enumOr("delayDistribution", DISTRIBUTIONS, "deterministic");
      break;
    case "broadcaster":
      capacityOrUnlimited("bufferCapacity");
      break;
    case "decision":
      if (p.routes !== undefined && !Array.isArray(p.routes)) {
        warn("routes must be a list, reset");
        p.routes = [];
      }
      break;
  }
  return p;
}

// ─── Normalisation of the model's raw JSON ────────────────────────────────────

function toAINode(raw: any, warnings: string[]): AINode | null {
  const r = readNode(raw);
  if (!r.id) {
    warnings.push("Skipped a station with no id.");
    return null;
  }
  const label = str(r.label) ?? r.id;
  if (!isNodeType(r.nodeType)) {
    // Never guess: silently turning an unknown type into "resource" (the old
    // behaviour) builds a model the user did not ask for.
    warnings.push(`Skipped "${label}": unknown block type "${String(r.nodeType)}".`);
    return null;
  }
  return {
    id: r.id,
    nodeType: r.nodeType,
    label,
    params: sanitizeParams(r.nodeType, r.params as any, label, warnings),
    position: r.position,
  };
}

function toPatch(raw: any, warnings: string[]): AINodePatch | null {
  const r = readNode(raw);
  if (!r.id) return null;
  const patch: AINodePatch = { id: r.id };
  if (r.nodeType !== undefined) {
    if (isNodeType(r.nodeType)) patch.nodeType = r.nodeType;
    else warnings.push(`Ignored unknown block type "${String(r.nodeType)}" for "${r.id}".`);
  }
  const label = str(r.label);
  if (label) patch.label = label;
  if (r.params && typeof r.params === "object") patch.params = r.params as Record<string, any>;
  if (r.position) patch.position = r.position;
  return patch;
}

function toEdge(raw: any): AIEdge | null {
  const source = str(raw?.source);
  const target = str(raw?.target);
  if (!source || !target) return null;
  return { id: str(raw?.id) ?? `e-${source}-${target}`, source, target };
}

function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Maps whatever the model calls the action onto the supported set.
 *
 * "EXPLAIN_OR_DIAGNOSE" is listed among the agent's actions in the megaprompt but
 * is absent from its own JSON enum, so a model may well emit it. It means
 * "answer without touching the canvas", i.e. NONE. Anything unrecognised also
 * falls back to NONE, which is the only safe default: it changes nothing.
 */
export function coerceActionType(v: unknown): AIActionType {
  const raw = typeof v === "string" ? v.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  if ((ACTION_TYPES as readonly string[]).includes(raw)) return raw as AIActionType;
  if (raw === "EXPLAIN_OR_DIAGNOSE" || raw === "EXPLAIN" || raw === "DIAGNOSE" || raw === "ANALYZE") {
    return "NONE";
  }
  return "NONE";
}

/**
 * Does the user actually want the whole model thrown away?
 *
 * Deliberately narrow. Bare verbs like "make", "new" or "build" appear in ordinary
 * tweaks ("make the desk faster", "add a new counter"), so matching those would
 * let a partial reply wipe the canvas — the exact failure this guard exists to
 * stop. Either an explicit rebuild phrase, or a creation verb whose object is the
 * whole model.
 */
const REBUILD_PHRASE =
  /\b(rebuild|re-?design|start over|from scratch|scrap (it|this|that)|reset (the )?(canvas|model|graph)|replace (the )?(whole |entire )?(canvas|model|graph|everything))\b/i;
const CREATE_WHOLE_MODEL =
  /\b(create|build|design|generate|make|model)\b[^.!?]{0,60}\b(simulation|model|system|workflow|network|pipeline|line|plaza|shop|store|factory|warehouse)\b/i;

function wantsRebuild(prompt: string) {
  return REBUILD_PHRASE.test(prompt) || CREATE_WHOLE_MODEL.test(prompt);
}

/**
 * Converts whatever JSON the model produced into a validated op set.
 *
 * Accepts both the explicit op fields (addNodes / updateNodes / …) and the legacy
 * `graph` field, interpreting `graph` according to the action type so that a
 * partial graph can never delete work.
 */
export function normalizeAIResponse(
  raw: any,
  currentNodeCount: number,
  userPrompt: string
): { ops: AIGraphOps; warnings: string[] } {
  const warnings: string[] = [];
  let actionType: AIActionType = coerceActionType(raw?.actionType);

  const graphNodes = arr(raw?.graph?.nodes);
  const graphEdges = arr(raw?.graph?.edges);

  const ops: AIGraphOps = {
    actionType,
    upsertNodes: [],
    addEdges: [],
    deleteNodeIds: arr(raw?.deleteNodeIds).map(str).filter(Boolean) as string[],
    deleteEdgeIds: arr(raw?.deleteEdgeIds).map(str).filter(Boolean) as string[],
  };

  // Guard: a REPLACE on a populated canvas when the user did not ask to rebuild
  // is almost always the model returning a partial graph. Downgrade to a merge.
  if (actionType === "REPLACE_GRAPH" && currentNodeCount > 0 && !wantsRebuild(userPrompt)) {
    warnings.push("Kept your existing blocks and merged the suggested changes instead of replacing the whole model.");
    actionType = "UPDATE_NODES";
    ops.actionType = actionType;
  }

  if (actionType === "REPLACE_GRAPH") {
    const nodes = graphNodes.map((n) => toAINode(n, warnings)).filter(Boolean) as AINode[];
    const edges = graphEdges.map(toEdge).filter(Boolean) as AIEdge[];
    if (nodes.length === 0) {
      warnings.push("The suggested model had no valid blocks, so the canvas was left unchanged.");
      ops.actionType = "NONE";
    } else {
      ops.replaceGraph = { nodes, edges };
      warnings.push(...connectivityWarnings(nodes, edges));
    }
    return { ops, warnings };
  }

  if (actionType === "NONE" || actionType === "AUTO_LAYOUT") return { ops, warnings };

  // Incremental actions: explicit op fields first, then legacy `graph` as upserts.
  const nodeSources = [...arr(raw?.addNodes), ...arr(raw?.updateNodes), ...graphNodes];
  const seen = new Set<string>();
  for (const n of nodeSources) {
    const patch = toPatch(n, warnings);
    if (!patch || seen.has(patch.id)) continue;
    seen.add(patch.id);
    ops.upsertNodes.push(patch);
  }
  ops.addEdges = [...arr(raw?.addEdges), ...graphEdges].map(toEdge).filter(Boolean) as AIEdge[];

  return { ops, warnings };
}

/**
 * Structural sanity of a complete model (megaprompt section 6: "zero broken
 * graphs"). Reported as warnings rather than enforced: a half-built model the
 * user can see and fix beats silently discarding their request.
 */
export function connectivityWarnings(nodes: AINode[], edges: AIEdge[]): string[] {
  const out: string[] = [];
  const sources = nodes.filter((n) => n.nodeType === "source");
  const sinks = nodes.filter((n) => n.nodeType === "sink");
  if (sources.length === 0) out.push("This model has no entry point, so nothing will arrive. Add a source block.");
  if (sinks.length === 0) out.push("This model has no exit point, so nothing will be counted as finished. Add a sink block.");

  if (sources.length > 0) {
    const adjacency = new Map<string, string[]>();
    for (const e of edges) {
      const list = adjacency.get(e.source) ?? [];
      list.push(e.target);
      adjacency.set(e.source, list);
    }
    const reached = new Set<string>();
    const stack = sources.map((n) => n.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const next of adjacency.get(id) ?? []) stack.push(next);
    }
    const orphans = nodes.filter((n) => !reached.has(n.id));
    if (orphans.length > 0) {
      const names = orphans.slice(0, 3).map((n) => `"${n.label}"`).join(", ");
      out.push(
        `${orphans.length} block${orphans.length > 1 ? "s" : ""} cannot be reached from a source (${names}${orphans.length > 3 ? ", …" : ""}) and will stay idle.`
      );
    }
  }
  return out;
}

// ─── Application against the live canvas ──────────────────────────────────────

const NODE_W = 210;
const COL_GAP = 260;
const ROW_GAP = 110;

function canvasNode(n: AINode, position: { x: number; y: number }, base?: any) {
  return {
    ...(base || {}),
    id: n.id,
    type: "simNode",
    position,
    data: { ...(base?.data || {}), nodeType: n.nodeType, label: n.label, params: n.params },
  };
}

function canvasEdge(e: AIEdge) {
  return { id: e.id, source: e.source, target: e.target, animated: true, type: "smoothstep" };
}

/**
 * Enforces graph-level invariants on a simulation-shaped graph:
 * unique ids, no dangling or self-loop edges, no duplicate links, and decision
 * routes that point at real, connected targets with probabilities summing to 1.
 */
export function repairGraph(
  nodes: AINode[],
  edges: AIEdge[],
  warnings: string[],
  /** When given, only these decision blocks are re-validated (incremental edits). */
  decisionScope?: Set<string>
): { nodes: AINode[]; edges: AIEdge[] } {
  const byId = new Map<string, AINode>();
  for (const n of nodes) {
    if (byId.has(n.id)) warnings.push(`Merged duplicate block id "${n.id}".`);
    byId.set(n.id, n);
  }

  const pairSeen = new Set<string>();
  const edgeIds = new Set<string>();
  const cleanEdges: AIEdge[] = [];
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) {
      warnings.push(`Dropped a link to a block that does not exist (${e.source} → ${e.target}).`);
      continue;
    }
    if (e.source === e.target) {
      warnings.push(`Dropped a link from "${byId.get(e.source)!.label}" to itself.`);
      continue;
    }
    const pair = `${e.source}→${e.target}`;
    if (pairSeen.has(pair)) continue;
    pairSeen.add(pair);
    let id = e.id;
    while (edgeIds.has(id)) id = `${e.id}-${edgeIds.size}`;
    edgeIds.add(id);
    cleanEdges.push({ ...e, id });
  }

  // Decision routing must agree with the drawn links, or the engine routes to
  // nodes the user cannot see a connection to.
  for (const n of byId.values()) {
    if (n.nodeType !== "decision") continue;
    if (decisionScope && !decisionScope.has(n.id)) continue;
    const outTargets = cleanEdges.filter((e) => e.source === n.id).map((e) => e.target);
    let routes = arr(n.params.routes)
      .map((r) => ({ targetId: str(r?.targetId), probability: num(r?.probability) }))
      .filter((r) => r.targetId && byId.has(r.targetId) && r.targetId !== n.id) as { targetId: string; probability?: number }[];

    if (routes.length === 0 && outTargets.length > 0) {
      routes = outTargets.map((t) => ({ targetId: t, probability: 1 / outTargets.length }));
      warnings.push(`${n.label}: no routing split given, divided evenly across its ${outTargets.length} outputs.`);
    }

    for (const r of routes) {
      if (!outTargets.includes(r.targetId)) {
        const id = `e-${n.id}-${r.targetId}`;
        cleanEdges.push({ id, source: n.id, target: r.targetId });
        outTargets.push(r.targetId);
      }
    }

    const probs = routes.map((r) => (r.probability !== undefined && r.probability >= 0 ? r.probability : 0));
    const sum = probs.reduce((a, b) => a + b, 0);
    if (routes.length > 0) {
      const normalized = sum > 0 ? probs.map((p) => p / sum) : routes.map(() => 1 / routes.length);
      if (Math.abs(sum - 1) > 0.001) {
        warnings.push(`${n.label}: routing percentages added up to ${Math.round(sum * 100)}%, rescaled to 100%.`);
      }
      n.params = { ...n.params, routes: routes.map((r, i) => ({ targetId: r.targetId, probability: Number(normalized[i].toFixed(6)) })) };
    }
  }

  return { nodes: [...byId.values()], edges: cleanEdges };
}

/** Places new nodes next to their connected neighbours, never on top of existing ones. */
function placeNewNodes(
  newIds: string[],
  positions: Map<string, { x: number; y: number }>,
  edges: AIEdge[]
) {
  const pending = new Set(newIds);
  const stackCount = new Map<string, number>();
  const occupied = () => [...positions.values()];

  const nudgeFree = (p: { x: number; y: number }) => {
    let y = p.y;
    while (occupied().some((o) => Math.abs(o.x - p.x) < NODE_W && Math.abs(o.y - y) < ROW_GAP * 0.8)) y += ROW_GAP;
    return { x: p.x, y };
  };

  let progress = true;
  while (pending.size > 0 && progress) {
    progress = false;
    for (const id of [...pending]) {
      const upstream = edges.find((e) => e.target === id && positions.has(e.source));
      const downstream = edges.find((e) => e.source === id && positions.has(e.target));
      const anchorId = upstream?.source ?? downstream?.target;
      if (!anchorId) continue;
      const anchor = positions.get(anchorId)!;
      const k = stackCount.get(anchorId) ?? 0;
      stackCount.set(anchorId, k + 1);
      const x = upstream ? anchor.x + COL_GAP : anchor.x - COL_GAP;
      positions.set(id, nudgeFree({ x, y: anchor.y + k * ROW_GAP }));
      pending.delete(id);
      progress = true;
    }
  }

  // Disconnected new nodes: a fresh column to the right of everything.
  const all = occupied();
  const maxX = all.length ? Math.max(...all.map((p) => p.x)) : 0;
  const minY = all.length ? Math.min(...all.map((p) => p.y)) : 100;
  let row = 0;
  for (const id of pending) {
    positions.set(id, nudgeFree({ x: maxX + COL_GAP, y: minY + row++ * ROW_GAP }));
  }
}

/**
 * Applies a validated op set to the live canvas. The only paths that can remove
 * blocks are REPLACE_GRAPH (guarded upstream) and explicit delete ids.
 */
export function applyAIOps(currentNodes: any[], currentEdges: any[], ops: AIGraphOps): ApplyResult {
  const warnings: string[] = [];
  const noChange: ApplyResult = {
    nodes: currentNodes, edges: currentEdges, changed: false, needsFullLayout: false, newNodeIds: [], warnings,
  };

  if (ops.actionType === "NONE") return noChange;
  if (ops.actionType === "AUTO_LAYOUT") {
    return { ...noChange, changed: currentNodes.length > 0, needsFullLayout: currentNodes.length > 0 };
  }

  if (ops.actionType === "REPLACE_GRAPH" && ops.replaceGraph) {
    const repaired = repairGraph(
      ops.replaceGraph.nodes.map((n) => ({ ...n, params: { ...n.params } })),
      ops.replaceGraph.edges,
      warnings
    );
    // If every block came with coordinates (a restored snapshot), keep them.
    // Otherwise Dagre lays the whole thing out.
    const allPositioned = repaired.nodes.length > 0 && repaired.nodes.every((n) => !!n.position);
    return {
      nodes: repaired.nodes.map((n) => canvasNode(n, n.position ?? { x: 100, y: 100 })),
      edges: repaired.edges.map(canvasEdge),
      changed: true,
      needsFullLayout: !allPositioned,
      newNodeIds: repaired.nodes.map((n) => n.id),
      warnings,
    };
  }

  // ── Incremental merge ──────────────────────────────────────────────────────
  const baseById = new Map<string, any>();
  const simNodes = new Map<string, AINode>();
  const positions = new Map<string, { x: number; y: number }>();

  for (const raw of currentNodes) {
    const r = readNode(raw);
    if (!r.id || !isNodeType(r.nodeType)) {
      // Keep blocks we do not understand exactly as they are.
      if (r.id) baseById.set(r.id, raw);
      continue;
    }
    baseById.set(r.id, raw);
    simNodes.set(r.id, {
      id: r.id,
      nodeType: r.nodeType,
      label: str(r.label) ?? r.id,
      params: { ...((r.params as any) || {}) },
    });
    if (raw.position) positions.set(r.id, { x: raw.position.x, y: raw.position.y });
  }

  const newNodeIds: string[] = [];
  let changed = false;

  for (const patch of ops.upsertNodes) {
    const existing = simNodes.get(patch.id);
    if (existing) {
      const nodeType = patch.nodeType ?? existing.nodeType;
      const label = patch.label ?? existing.label;
      const params = sanitizeParams(nodeType, { ...existing.params, ...(patch.params || {}) }, label, warnings);
      simNodes.set(patch.id, { id: patch.id, nodeType, label, params });
      changed = true;
    } else {
      if (!patch.nodeType) {
        warnings.push(`Skipped "${patch.label ?? patch.id}": it is not on the canvas and no block type was given.`);
        continue;
      }
      const label = patch.label ?? patch.id;
      simNodes.set(patch.id, {
        id: patch.id,
        nodeType: patch.nodeType,
        label,
        params: sanitizeParams(patch.nodeType, patch.params, label, warnings),
      });
      // Use the model's coordinates when it supplied them; otherwise place the
      // block next to its neighbours below.
      if (patch.position) positions.set(patch.id, patch.position);
      newNodeIds.push(patch.id);
      changed = true;
    }
  }

  // Edges: keep existing canvas edges verbatim, append the model's.
  const existingEdges: AIEdge[] = currentEdges
    .map((e: any) => ({ id: String(e.id), source: String(e.source), target: String(e.target) }));
  const deleteNodes = new Set(ops.deleteNodeIds);
  const deleteEdges = new Set(ops.deleteEdgeIds);

  for (const id of deleteNodes) {
    if (simNodes.delete(id) || baseById.has(id)) changed = true;
    baseById.delete(id);
  }
  // Decision routes pointing at deleted nodes are removed by repairGraph.

  let mergedEdges = [...existingEdges, ...ops.addEdges].filter(
    (e) => !deleteEdges.has(e.id) && !deleteNodes.has(e.source) && !deleteNodes.has(e.target)
  );
  if (ops.addEdges.length > 0 || deleteEdges.size > 0 || deleteNodes.size > 0) changed = true;

  // Only decision blocks this edit touched are re-validated: those the model
  // changed or added, and those whose routes pointed at a block now deleted.
  // Pre-existing routing on untouched blocks is the user's, and is left alone.
  const decisionScope = new Set<string>(ops.upsertNodes.map((p) => p.id));
  for (const n of simNodes.values()) {
    if (n.nodeType === "decision" && arr(n.params.routes).some((r) => deleteNodes.has(r?.targetId))) {
      decisionScope.add(n.id);
    }
  }

  // Opaque (unparseable) canvas nodes still count as valid edge endpoints.
  const opaqueIds = [...baseById.keys()].filter((id) => !simNodes.has(id));
  const repaired = repairGraph(
    [...simNodes.values(), ...opaqueIds.map((id) => ({ id, nodeType: "service" as AINodeType, label: id, params: {} }))],
    mergedEdges,
    warnings,
    decisionScope
  );
  mergedEdges = repaired.edges;

  if (!changed) return { ...noChange, warnings };

  placeNewNodes(newNodeIds.filter((id) => !positions.has(id)), positions, mergedEdges);

  const repairedById = new Map(repaired.nodes.map((n) => [n.id, n]));
  const outNodes: any[] = [];
  // Preserve original canvas order, then append new blocks.
  for (const raw of currentNodes) {
    const id = readNode(raw).id;
    if (!id || !baseById.has(id)) continue;
    const sim = simNodes.has(id) ? repairedById.get(id) : undefined;
    outNodes.push(sim ? canvasNode(sim, positions.get(id) ?? raw.position ?? { x: 100, y: 100 }, raw) : raw);
  }
  for (const id of newNodeIds) {
    const sim = repairedById.get(id);
    if (sim) outNodes.push(canvasNode(sim, positions.get(id)!));
  }

  const existingEdgeById = new Map(currentEdges.map((e: any) => [String(e.id), e]));
  const outEdges = mergedEdges.map((e) => existingEdgeById.get(e.id) ?? canvasEdge(e));

  return { nodes: outNodes, edges: outEdges, changed: true, needsFullLayout: false, newNodeIds, warnings };
}

/**
 * Compact simulation-shaped view of the canvas for the model's context window.
 * Coordinates are omitted: they are noise in the prompt and the model is told
 * they are auto-computed.
 */
export function summarizeCanvas(nodes: any[], edges: any[]) {
  return {
    nodes: nodes.map((n) => {
      const r = readNode(n);
      return { id: r.id, nodeType: r.nodeType, label: r.label, params: r.params ?? {} };
    }),
    edges: edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

/**
 * Snapshot stored on a chat message so it can be restored later.
 *
 * Unlike the prompt summary this KEEPS coordinates, so undoing a change puts the
 * blocks back exactly where the user had them instead of re-running Dagre and
 * rearranging a layout they positioned by hand.
 */
export function snapshotForHistory(nodes: any[], edges: any[]) {
  return {
    nodes: nodes.map((n) => {
      const r = readNode(n);
      return {
        id: r.id,
        nodeType: r.nodeType,
        label: r.label,
        params: r.params ?? {},
        ...(r.position ? { position: r.position } : {}),
      };
    }),
    edges: edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target })),
  };
}
