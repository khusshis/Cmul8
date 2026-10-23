import type { Node, Edge } from "@xyflow/react";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { validateGraphConnectivity } from "@/components/workspace/NodeCanvas";

/** Friendly reason a graph can't be simulated, or null if it's runnable. */
export function validateForRun(nodes: Node[], edges: Edge[]): string | null {
  const types = new Set(nodes.map((n) => (n.data as { nodeType?: string } | undefined)?.nodeType));
  if (nodes.length > 0 && !types.has("source")) return "Add a Start Point so items can enter the system.";
  if (nodes.length > 0 && !types.has("sink")) return "Add an Exit Point. Finished items are counted there, so without one every run reports zero.";
  const v = validateGraphConnectivity(nodes, edges);
  return v.valid ? null : v.message;
}

/** Model identity minus layout, so dragging a block doesn't mark results stale. */
export const graphSignature = (g: SimGraph, ...extra: unknown[]) =>
  JSON.stringify([extra, g.nodes.map((n) => [n.id, n.nodeType, n.params]), g.edges.map((e) => [e.source, e.target])]);

/** Copies the selected nodes (or the whole canvas when nothing is selected) plus the edges between them. */
export function captureNodes(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[]; sourceIds: string[] } {
  const picked = nodes.some((n) => n.selected) ? nodes.filter((n) => n.selected) : nodes;
  const ids = new Set(picked.map((n) => n.id));
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    nodes: picked.map((n) => ({ ...clone(n), selected: false })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...clone(e), selected: false })),
    sourceIds: [...ids],
  };
}

export const timeStamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Batch plumbing shared by the panel and its tabs ─────────────────────────

export type BatchKind = "stress" | "sweep" | "compare";
export type ErrorInfo = { title: string; message: string };
export type ProgressFn = (completed: number, status: string) => void;
/** Runs `work` as the one active batch (progress card, Cancel, error reporting). */
export type StartBatch = (kind: BatchKind, title: string, total: number, work: (signal: AbortSignal, progress: ProgressFn) => Promise<void>, onError: (e: ErrorInfo) => void) => void;
/** Runs `graph` n times on the lab engine and returns enriched results. */
export type RunEnriched = (
  graph: SimGraph,
  n: number,
  opts: { durationSeconds: number; signal: AbortSignal; onProgress?: (completed: number) => void; stopWhen?: (results: SimResult[]) => boolean }
) => Promise<SimResult[]>;
