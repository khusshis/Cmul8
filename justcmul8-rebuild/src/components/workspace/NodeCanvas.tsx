"use client";

import React, { useState, useCallback, createContext, useContext, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap, addEdge, useReactFlow, useViewport,
  Handle, Position, BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, EdgeLabelRenderer,
  type Connection, type Edge, type Node, BackgroundVariant, type NodeTypes, type EdgeTypes, type EdgeProps, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges, SelectionMode
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SimState } from "@/app/dashboard/project/[id]/page";
import type { SimTick, NodeStats, NodeType, SimGraph } from "@/lib/simulation/types";
import { AlertCircle, X, Layers } from "lucide-react";
import { SIM_TYPE_REGISTRY, NODE_LABELS } from "@/lib/simulation/simTypeRegistry";
import type { PresenceUser } from "@/lib/realtime/usePresence";
import LiveCursor from "@/components/workspace/LiveCursor";

// ─── Live Stats Context ───────────────────────────────────────────────────────
const LiveStatsContext = createContext<{
  stats: Record<string, NodeStats>;
  bottleneckId: string;
  simState: SimState;
  connectedHandles: Set<string>;
  simType: string;
  upstreamQueueDepth: Record<string, number>;
  remoteUsers: PresenceUser[];
}>({
  stats: {},
  bottleneckId: "",
  simState: "idle",
  connectedHandles: new Set(),
  simType: "human_queue",
  upstreamQueueDepth: {},
  remoteUsers: [],
});

// ─── Node color map (Gap G6 Resolved) ─────────────────────────────────────────
export const NODE_BASE_COLORS: Record<string, string> = {
  source:           "var(--color-node-source)",
  queue:            "var(--color-node-queue)",
  resource:         "var(--color-node-resource)",
  service:          "var(--color-node-service)",
  decision:         "var(--color-node-decision)",
  sink:             "var(--color-node-sink)",
  priority_resource:"var(--color-node-priority-resource)",
  container:        "var(--color-node-container)",
  store:            "var(--color-node-store)",
  event_trigger:    "var(--color-node-event-trigger)",
  channel:          "var(--color-node-channel)",
  broadcaster:      "var(--color-node-broadcaster)",
  any_of:           "var(--color-node-any-of)",
  all_of:           "var(--color-node-all-of)",
  interrupter:      "var(--color-node-interrupter)",
};


// ─── SimEdge (styled edge) ──────────────────────────────────────────────────
export type EdgeShape = "curve" | "straight" | "step";
type Offset = { dx: number; dy: number };
/** `points` are user bend points, stored as offsets from the source–target midpoint so they follow moved blocks. */
export type SimEdgeData = { shape?: EdgeShape; points?: Offset[]; bend?: Offset /* legacy single bend */ };
type XY = { x: number; y: number };

// Lets an edge persist its own shape/points through the canvas' onEdgesChange (saved, undoable, synced).
const EdgeEditContext = createContext<{ updateEdgeData: (id: string, patch: SimEdgeData) => void; readOnly: boolean }>({
  updateEdgeData: () => {},
  readOnly: true,
});

/**
 * SVG path through source → points → target, plus `mids`: one spot per segment that lies
 * ON the drawn line, where the "+ add point" handle goes.
 */
function simEdgePath(
  shape: EdgeShape, pts: XY[],
  p: { sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position },
): { d: string; mids: XY[] } {
  if (pts.length === 0) {
    const [d, x, y] =
      shape === "straight" ? getStraightPath(p)
      : shape === "step" ? getSmoothStepPath({ ...p, borderRadius: 10 })
      : getBezierPath(p);
    return { d, mids: [{ x, y }] };
  }
  const S = { x: p.sourceX, y: p.sourceY };
  const T = { x: p.targetX, y: p.targetY };
  const V = [S, ...pts, T];
  const segs = V.slice(0, -1).map((a, k) => [a, V[k + 1]] as const);
  if (shape === "straight") {
    return { d: `M ${V.map((v) => `${v.x},${v.y}`).join(" L ")}`, mids: segs.map(([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) };
  }
  if (shape === "step") {
    // Leave the source horizontally, pass through every point with right angles, enter the target horizontally.
    return {
      d: `M ${S.x},${S.y}` + pts.map((q) => ` H ${q.x} V ${q.y}`).join("") + ` V ${T.y} H ${T.x}`,
      mids: segs.map(([a, b], k) =>
        k < segs.length - 1 ? { x: (a.x + b.x) / 2, y: a.y } : { x: a.x, y: (a.y + b.y) / 2 }
      ),
    };
  }
  // Smooth curve through every vertex (Catmull-Rom converted to cubic Béziers).
  let d = `M ${S.x},${S.y}`;
  const mids: XY[] = [];
  for (let i = 0; i < V.length - 1; i++) {
    const p0 = V[Math.max(0, i - 1)], p1 = V[i], p2 = V[i + 1], p3 = V[Math.min(V.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
    mids.push({ x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 }); // B(0.5)
  }
  return { d, mids };
}

// Positioned wrapper only — no CSS transition or hover scaling here, or the handle drifts off the line.
const HANDLE_STYLE = (x: number, y: number): React.CSSProperties => ({
  position: "absolute",
  transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
  pointerEvents: "all",
  zIndex: 1000,
});

function SimEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, style, data }: EdgeProps) {
  const { getNode, deleteElements, screenToFlowPosition } = useReactFlow();
  const { simState } = useContext(LiveStatsContext);
  const { updateEdgeData, readOnly } = useContext(EdgeEditContext);
  const isRunning = simState === "running";
  const edgeData = (data || {}) as SimEdgeData;
  const shape: EdgeShape = edgeData.shape || "curve";
  // While dragging, points live here; they are committed once on release so history gets one entry.
  const [dragPoints, setDragPoints] = useState<Offset[] | null>(null);
  const [hovered, setHovered] = useState(false);
  const offsets = dragPoints ?? edgeData.points ?? (edgeData.bend ? [edgeData.bend] : []);

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const pts = offsets.map((o) => ({ x: midX + o.dx, y: midY + o.dy }));
  const { d: edgePath, mids } = simEdgePath(shape, pts, { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  /** Drags point `index` of `start`; commits the whole list on release. */
  function dragPoint(e: React.PointerEvent, start: Offset[], index: number) {
    e.stopPropagation();
    e.preventDefault();
    let current = start;
    setDragPoints(current);
    const move = (ev: PointerEvent) => {
      const f = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      current = current.map((o, i) => (i === index ? { dx: f.x - midX, dy: f.y - midY } : o));
      setDragPoints(current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      updateEdgeData(id, { points: current, bend: undefined });
      setDragPoints(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Calm neutral lines; brand purple when hovered/selected; the source block colour while items flow.
  const sourceNode = getNode(source);
  const targetNode = getNode(target);
  const sourceType = (sourceNode?.data?.nodeType || "source") as NodeType;
  const sourceColor = NODE_BASE_COLORS[sourceType] || "var(--color-info)";
  const editing = selected && !readOnly && !isRunning;
  const active = hovered || selected;
  const lineColor = active ? "#5742FF" : isRunning ? `color-mix(in srgb, ${sourceColor}, white 35%)` : "#b6b3cb";

  // Decision blocks: show what share of items takes this path.
  const route = sourceType === "decision"
    ? ((sourceNode?.data?.params as any)?.routes as { targetId: string; probability: number }[] | undefined)?.find((r) => r.targetId === target)
    : undefined;
  const share = route ? Math.round((Number(route.probability) || 0) * 100) : null;
  const labelAt = mids[Math.floor(mids.length / 2)];
  const sourceLabel = (sourceNode?.data?.label as string) || "Block";
  const targetLabel = (targetNode?.data?.label as string) || "Block";
  const arrowId = `edge-arrow-${id}`;

  return (
    <>
      <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
            <path d="M0 0.5 L10 5 L0 9.5 L2.5 5 Z" fill={lineColor} style={{ transition: "fill 0.2s ease" }} />
          </marker>
        </defs>

        {/* Soft halo on hover/selection */}
        <path
          d={edgePath}
          fill="none"
          stroke="#5742FF"
          strokeWidth={8}
          strokeLinecap="round"
          pointerEvents="none"
          style={{ opacity: active ? 0.12 : 0, transition: "opacity 0.2s ease" }}
        />

        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={`url(#${arrowId})`}
          interactionWidth={22}
          style={{
            stroke: lineColor,
            strokeWidth: active ? 2.25 : 1.75,
            strokeLinecap: "round",
            transition: "stroke 0.2s ease, stroke-width 0.2s ease",
            ...style,
          }}
        />

        {/* Running: items travelling along the line */}
        {isRunning && [0, 1, 2].map((i) => (
          <circle key={i} r="3.5" fill={sourceColor} stroke="#fff" strokeWidth="1.5" pointerEvents="none">
            <animateMotion dur="1.8s" begin={`${-i * 0.6}s`} repeatCount="indefinite" path={edgePath} />
          </circle>
        ))}
      </g>

      {!editing && labelAt && (share !== null || hovered) && (
        <EdgeLabelRenderer>
          <div
            style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelAt.x}px,${labelAt.y}px)`, pointerEvents: "none", zIndex: 1000 }}
            className="nodrag nopan"
          >
            <div
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-gray-700 shadow-[0_4px_14px_-4px_rgba(16,24,40,0.22)]"
              style={{ border: `1px solid ${share !== null ? `color-mix(in srgb, ${sourceColor}, white 60%)` : "#e5e3f0"}` }}
            >
              {share !== null && <span style={{ color: sourceColor }}>{share}%</span>}
              {hovered && (
                <span className="text-gray-500 font-semibold">
                  {share !== null ? `go to ${targetLabel}` : <>{sourceLabel} <span className="text-gray-300">→</span> {targetLabel}</>}
                </span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Selected: drag points to reshape, drag a "+" to add a point, double-click a point to remove it. */}
      {editing && (
        <EdgeLabelRenderer>
          {/* 22px hit area; the visible dot is the inner span so hover styling never moves the target. */}
          {mids.map((m, k) => (
            <div
              key={`add-${k}`}
              onPointerDown={(e) => {
                const next = [...offsets];
                next.splice(k, 0, { dx: m.x - midX, dy: m.y - midY });
                dragPoint(e, next, k);
              }}
              style={HANDLE_STYLE(m.x, m.y)}
              className="nodrag nopan group w-[22px] h-[22px] flex items-center justify-center cursor-copy"
            >
              <span className="w-4 h-4 rounded-full bg-white border border-dashed border-[#5742FF] text-[#5742FF] text-[11px] leading-none font-black flex items-center justify-center shadow-sm group-hover:bg-[#5742FF] group-hover:text-white group-hover:border-solid">
                +
              </span>
            </div>
          ))}
          {pts.map((q, i) => (
            <div
              key={`pt-${i}`}
              onPointerDown={(e) => dragPoint(e, offsets, i)}
              onDoubleClick={() => updateEdgeData(id, { points: offsets.filter((_, j) => j !== i), bend: undefined })}
              style={{ ...HANDLE_STYLE(q.x, q.y), zIndex: 1001 }}
              className="nodrag nopan group w-[22px] h-[22px] flex items-center justify-center cursor-move"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#5742FF] shadow group-hover:bg-[#5742FF]" />
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              transform: `translate(0, -100%) translate(${sourceX + 10}px,${sourceY - 12}px)`,
              pointerEvents: "all",
              zIndex: 1002,
            }}
            className="nodrag nopan flex items-center gap-0.5 p-0.5 rounded-full bg-white border border-indigo-100 shadow-[0_6px_18px_rgba(87,66,255,0.18)]"
          >
            {([["curve", "Curved", "M2 12 C 6 2, 10 2, 14 12"], ["straight", "Straight", "M2 12 L 14 4"], ["step", "Step", "M2 12 H 8 V 4 H 14"]] as const).map(([s, label, d]) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); updateEdgeData(id, { shape: s }); }}
                title={`${label} line`}
                className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${shape === s ? "bg-[#5742FF] text-white" : "text-gray-500 hover:bg-indigo-50 hover:text-[#5742FF]"}`}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
              </button>
            ))}
            {offsets.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); updateEdgeData(id, { points: [], bend: undefined }); }}
                title="Remove all bend points"
                className="h-6 px-2 rounded-full text-[10.5px] font-bold text-gray-500 hover:bg-indigo-50 hover:text-[#5742FF]"
              >
                Reset
              </button>
            )}
            <span className="w-px h-4 bg-gray-200 mx-0.5" />
            <button
              onClick={(e) => { e.stopPropagation(); deleteElements({ edges: [{ id }] }); }}
              title="Delete connection"
              className="w-6 h-6 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 text-sm font-bold"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = { simEdge: SimEdge as any };

// Shared by every canvas on the page, so blocks can be copied from the main canvas into a compare pane.
let clipboard: { nodes: Node[]; edges: Edge[]; pasteCount: number } | null = null;
// Which canvas receives keyboard shortcuts: the one last pressed on.
let activeCanvas: object | null = null;

// ─── Non-Technical Plain English Block Summary Formatter ─────────────
function formatNodeFriendlySubtext(nodeType: string, params: Record<string, any> = {}): string {
  switch (nodeType) {
    case "source": {
      if (params.schedule && Array.isArray(params.schedule) && params.schedule.length > 0) {
        return `📅 ${params.schedule.length} scheduled waves`;
      }
      const rate = params.arrivalRate ?? 1;
      const dist =
        params.distribution === "deterministic"
          ? "Fixed"
          : params.distribution === "poisson"
          ? "Bursts"
          : params.distribution === "normal"
          ? "Average"
          : "Random";
      return `${rate}/sec • ${dist} flow`;
    }
    case "queue": {
      const cap =
        params.capacity === undefined || params.capacity === -1 || params.capacity === ""
          ? "Infinite line"
          : `Max ${params.capacity} in line`;
      const disc =
        params.discipline === "PRIORITY"
          ? "VIP first"
          : params.discipline === "LIFO"
          ? "Stack order"
          : "First come";
      return `${cap} • ${disc}`;
    }
    case "resource":
    case "priority_resource": {
      const cap = params.capacity ?? 1;
      const dur = params.serviceTimeMean ?? 1;
      const servers = cap === 1 ? "1 counter" : `${cap} counters`;
      return `${servers} • ~${dur}s avg`;
    }
    case "service": {
      const dur = params.durationMean ?? 1;
      return `Processing ~${dur}s avg`;
    }
    case "decision": {
      const routesCount = params.routes?.length ?? 0;
      return routesCount > 0 ? `${routesCount} split paths` : "Branch router";
    }
    case "sink": {
      return "Exit & final score";
    }
    case "store": {
      const cap = params.capacity ?? -1;
      return cap === -1 ? "Infinite storage" : `Max ${cap} items`;
    }
    case "container": {
      return `Capacity: ${params.capacity ?? 100} units`;
    }
    case "channel": {
      return "Transfer transit link";
    }
    case "broadcaster": {
      return "Multi-broadcast hub";
    }
    default: {
      const entries = Object.entries(params || {}).filter(([k]) => !k.startsWith("_"));
      if (entries.length === 0) return "Ready to configure";
      return entries.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ");
    }
  }
}

// ─── Detailed Spec Formatter for Sleek Hover Tooltip ───────────
function getNodeDetailedSpecs(
  nodeType: string,
  params: Record<string, any> = {}
): { label: string; value: string }[] {
  switch (nodeType) {
    case "source":
      return [
        { label: "Arrival Rate", value: `${params.arrivalRate ?? 1} entities/sec` },
        {
          label: "Flow Pattern",
          value:
            params.distribution === "deterministic"
              ? "Fixed Spacing"
              : params.distribution === "poisson"
              ? "Burst Spikes"
              : params.distribution === "normal"
              ? "Clustered Avg"
              : "Natural Random",
        },
        { label: "Item Type", value: params.entityClass || "Standard" },
        ...(params.priorityLevel && params.priorityLevel !== "standard"
          ? [
              {
                label: "Priority Tier",
                value: params.priorityLevel === "urgent" ? "🚨 VIP Urgent" : "⚡ Fast-Track",
              },
            ]
          : []),
      ];
    case "queue":
      return [
        {
          label: "Max Line Size",
          value:
            params.capacity === undefined || params.capacity === -1 || params.capacity === ""
              ? "♾️ Unlimited"
              : `${params.capacity} in line`,
        },
        {
          label: "Queue Discipline",
          value:
            params.discipline === "PRIORITY"
              ? "⭐ VIP & Urgent First"
              : params.discipline === "LIFO"
              ? "📦 Most Recent First"
              : "🚶 First Come, First Served",
        },
        ...(params.patienceDistribution && params.patienceDistribution !== "none"
          ? [
              {
                label: "Patience Timeout",
                value: `⏱️ Leaves after ${params.patienceTimeout ?? 5}s`,
              },
            ]
          : []),
      ];
    case "resource":
    case "priority_resource":
      return [
        { label: "Station Staff", value: `${params.capacity ?? 1} parallel counter(s)` },
        { label: "Avg Service Time", value: `${params.serviceTimeMean ?? 1} seconds` },
        {
          label: "Duration Pattern",
          value: params.serviceDistribution === "deterministic" ? "Fixed constant" : "Random duration",
        },
        ...(params.isPreemptive ? [{ label: "Fast-Track Override", value: "⚡ Can interrupt" }] : []),
        ...(params.meanTimeBetweenFailures
          ? [
              {
                label: "Breakdowns",
                value: `Every ~${params.meanTimeBetweenFailures}s (Fix: ${params.repairTimeMean ?? 1}s)`,
              },
            ]
          : []),
      ];
    case "service":
      return [
        { label: "Processing Duration", value: `${params.durationMean ?? 1} seconds` },
        {
          label: "Speed Consistency",
          value: params.distribution === "deterministic" ? "Fixed duration" : "Random duration",
        },
      ];
    case "decision":
      return [
        { label: "Routing Paths", value: `${params.routes?.length ?? 2} branches` },
        { label: "Split Method", value: "Probabilistic branch" },
      ];
    case "sink":
      return [
        { label: "KPI Collection", value: params.collectKPIs !== false ? "✅ Active" : "Disabled" },
        { label: "Role", value: "Simulation completion" },
      ];
    case "store":
      return [
        {
          label: "Storage Limit",
          value:
            params.capacity === undefined || params.capacity === -1
              ? "♾️ Unlimited capacity"
              : `Max ${params.capacity} units`,
        },
      ];
    case "container":
      return [{ label: "Tank Capacity", value: `${params.capacity ?? 100} fluid units` }];
    default:
      return Object.entries(params || {})
        .filter(([k]) => !k.startsWith("_"))
        .slice(0, 3)
        .map(([k, v]) => ({ label: k, value: String(v) }));
  }
}

// ─── SimNode ────────────────────────────────────────────────────────────────
const tint = (c: string, whitePct: number) => `color-mix(in srgb, ${c}, white ${whitePct}%)`;

/** Plain-English role shown above each block's name. */
const NODE_ROLE: Record<string, string> = {
  source: "Arrivals",
  queue: "Waiting area",
  resource: "Served by",
  priority_resource: "VIP service",
  service: "Processing",
  decision: "Splits flow",
  sink: "Finish",
  container: "Storage tank",
  store: "Storage",
  channel: "Transfer",
  broadcaster: "Broadcast",
  event_trigger: "Trigger",
  any_of: "Wait for any",
  all_of: "Wait for all",
  interrupter: "Interrupts",
};

/** Short, readable facts about how a block is set up (shown under its name when idle). */
function getNodeSummary(nodeType: string, params: Record<string, any> = {}): string[] {
  const pattern = (d?: string) => (d === "deterministic" ? "Steady" : d === "poisson" ? "In bursts" : d === "normal" ? "Around avg" : "Random");
  switch (nodeType) {
    case "source":
      if (Array.isArray(params.schedule) && params.schedule.length > 0) return [`${params.schedule.length} timed waves`];
      return [`${params.arrivalRate ?? 1} / sec`, pattern(params.distribution)];
    case "queue": {
      const unlimited = params.capacity === undefined || params.capacity === -1 || params.capacity === "";
      const order = params.discipline === "PRIORITY" ? "VIP first" : params.discipline === "LIFO" ? "Newest first" : "First come";
      return [unlimited ? "No limit" : `Max ${params.capacity}`, order];
    }
    case "resource":
    case "priority_resource": {
      const cap = Number(params.capacity) || 1;
      return [cap === 1 ? "1 counter" : `${cap} counters`, `~${params.serviceTimeMean ?? 1}s each`];
    }
    case "service":
      return [`~${params.durationMean ?? 1}s each`, params.distribution === "deterministic" ? "Steady" : "Varies"];
    case "decision": {
      const n = params.routes?.length ?? 0;
      return [n > 0 ? `${n} paths` : "Set paths"];
    }
    case "sink":
      return ["Counts results"];
    case "store":
    case "container": {
      const cap = params.capacity;
      return [cap === undefined || cap === -1 ? "No limit" : `Holds ${cap}`];
    }
    default:
      return [formatNodeFriendlySubtext(nodeType, params)];
  }
}

/** How a block is doing while the simulation runs, in words a non-technical user understands. */
function getNodeHealth(nodeType: string, s: NodeStats | undefined): { label: string; color: string } | null {
  if (!s) return null;
  switch (nodeType) {
    case "resource":
    case "priority_resource": {
      const u = s.utilization ?? 0;
      if (u > 0.85) return { label: "Overloaded", color: "var(--color-error)" };
      if (u > 0.6) return { label: "Busy", color: "var(--color-warning)" };
      return { label: "Smooth", color: "var(--color-success)" };
    }
    case "queue":
    case "store": {
      const d = s.currentDepth ?? 0;
      if (d > 10) return { label: "Long line", color: "var(--color-error)" };
      if (d > 3) return { label: "Building up", color: "var(--color-warning)" };
      return { label: "Flowing", color: "var(--color-success)" };
    }
    case "source":
      return { label: "Arriving", color: "var(--color-info)" };
    case "sink":
      return { label: "Finishing", color: "var(--color-success)" };
    default:
      return { label: "Active", color: "var(--color-success)" };
  }
}

/** Little row of seats (counters) or people (waiting) — shows capacity and load visually. */
function Dots({ total, filled, color, max = 8 }: { total: number; filled: number; color: string; max?: number }) {
  const shown = Math.min(total, max);
  return (
    <span className="inline-flex items-center gap-[3px]">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rounded-full transition-colors duration-300"
          style={{ background: i < filled ? color : "transparent", boxShadow: `inset 0 0 0 1.5px ${color}` }}
        />
      ))}
      {total > max && <span className="text-[9.5px] font-bold text-gray-400 ml-0.5">+{total - max}</span>}
    </span>
  );
}

function SimNode({ data, selected, id }: { data: any; selected: boolean; id: string }) {
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { setNodes, setEdges } = useReactFlow();
  const { stats, bottleneckId, simState, connectedHandles, simType, upstreamQueueDepth, remoteUsers } = useContext(LiveStatsContext);
  const nodeType: string = data.nodeType;
  const params = data.params || {};
  const liveStats = stats[id];
  const isBottleneck = bottleneckId === id;
  const isRunning = simState === "running";
  const live = isRunning && !!liveStats;

  // Remote presence on this node
  const selectingUsers = remoteUsers.filter((u) => u.selectedNodeId === id || u.editingNodeId === id);
  const primaryRemoteUser = selectingUsers[0];
  const isRemoteEditing = selectingUsers.some((u) => u.editingNodeId === id);

  useEffect(() => {
    if (!selected) setShowDeleteBtn(false);
  }, [selected]);

  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => setIsHovered(true), 250);
  };
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
  };

  const simConfig = (SIM_TYPE_REGISTRY as any)[simType] || SIM_TYPE_REGISTRY.human_queue;
  const paletteDef = simConfig.paletteNodes?.find((n: any) => n.type === nodeType);
  const Icon = (paletteDef?.icon || Layers) as React.ComponentType<{ size?: number; strokeWidth?: number }>;
  const description: string = paletteDef?.desc || "";

  const baseColor = NODE_BASE_COLORS[nodeType] || "var(--color-info)";
  const role = NODE_ROLE[nodeType] || nodeType.replace(/_/g, " ");
  const health = live ? getNodeHealth(nodeType, liveStats) : null;

  const hasTargetConnection = connectedHandles.has(`${id}__target`);
  const hasSourceConnection = connectedHandles.has(`${id}__source`);
  const isSink = nodeType === "sink";
  const isSource = nodeType === "source";
  const needsConnection = !isRunning && ((!isSource && !hasTargetConnection) || (!isSink && !hasSourceConnection));

  const isCounter = nodeType === "resource" || nodeType === "priority_resource";
  const capacity = Number(params.capacity) || 1;
  const depth = liveStats?.currentDepth ?? 0;
  const busy = Math.min(depth, capacity);
  const waitingNearby = (upstreamQueueDepth[id] ?? 0) + Math.max(0, depth - capacity);
  const utilPct = Math.round((liveStats?.utilization ?? 0) * 100);
  const queueCap = Number(params.capacity) > 0 ? Number(params.capacity) : 20;

  const specs = getNodeDetailedSpecs(nodeType, params);
  const summary = getNodeSummary(nodeType, params).join(" · ");

  const shadows = [
    primaryRemoteUser ? (isRemoteEditing ? `0 0 0 2px #fff, 0 0 0 4px ${primaryRemoteUser.color}` : `0 0 0 2px ${primaryRemoteUser.color}`) : null,
    selected ? `0 0 0 3px ${tint(baseColor, 80)}` : null,
    isHovered || selected ? "0 12px 28px -12px rgba(16,24,40,0.30)" : "0 1px 2px rgba(16,24,40,0.06), 0 6px 16px -10px rgba(16,24,40,0.18)",
  ].filter(Boolean).join(", ");

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setShowDeleteBtn((prev) => !prev);
      }}
      className={`sim-node ${selected ? "is-selected" : ""} relative w-[200px] rounded-[14px] bg-white select-none cursor-pointer transition-[box-shadow,border-color,transform] duration-200 ${isHovered && !selected ? "-translate-y-0.5" : ""}`}
      style={{
        border: `1px solid ${selected ? baseColor : isBottleneck ? "var(--color-error)" : health ? tint(health.color, 55) : "rgba(17,24,39,0.09)"}`,
        boxShadow: shadows,
        zIndex: isHovered ? 9999 : selected ? 50 : 1,
      }}
    >
      {/* ── Remote user presence ── */}
      {primaryRemoteUser && (
        <div
          className="absolute -top-3 left-3 px-2 py-0.5 rounded-full text-white text-[9.5px] font-bold shadow-sm flex items-center gap-1 pointer-events-none z-30"
          style={{ backgroundColor: primaryRemoteUser.color }}
        >
          {isRemoteEditing && <span className="text-[9px]">✏️</span>}
          <span className="truncate max-w-[70px]">{primaryRemoteUser.name}</span>
          {selectingUsers.length > 1 && <span className="opacity-80 text-[8.5px]">+{selectingUsers.length - 1}</span>}
        </div>
      )}

      {/* ── Bottleneck tag (post-run) ── */}
      {isBottleneck && !showDeleteBtn && (
        <div className="absolute -top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-[var(--color-error)] border border-[color-mix(in_srgb,var(--color-error),white_35%)] px-2 py-0.5 text-[9.5px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(217,70,63,0.6)] pointer-events-none">
          <AlertCircle size={10} strokeWidth={3} /> Slowest step
        </div>
      )}

      {/* ── Hover details card ── */}
      <AnimatePresence>
        {isHovered && !showDeleteBtn && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[9999] pointer-events-none w-64 rounded-2xl bg-white border border-gray-200/90 shadow-[0_18px_40px_-12px_rgba(16,24,40,0.28)] text-left overflow-hidden"
          >
            <div className="px-3.5 pt-3 pb-2.5" style={{ background: `linear-gradient(180deg, ${tint(baseColor, 90)}, #fff)` }}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: tint(baseColor, 82), color: baseColor }}>
                  <Icon size={13} strokeWidth={2.25} />
                </span>
                <span className="text-[12.5px] font-bold text-gray-900 truncate">{data.label}</span>
                <span className="ml-auto shrink-0 text-[9px] font-extrabold uppercase tracking-wider" style={{ color: baseColor }}>{role}</span>
              </div>
              {description && <p className="mt-1.5 text-[11px] leading-snug text-gray-600">{description}.</p>}
            </div>

            <div className="px-3.5 py-2.5 space-y-1.5 border-t border-gray-100">
              {specs.map((spec, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-[11px] leading-tight">
                  <span className="text-gray-500">{spec.label}</span>
                  <span className="text-gray-900 font-semibold truncate max-w-[140px]">{spec.value}</span>
                </div>
              ))}
            </div>

            {live && (
              <div className="px-3.5 py-2.5 border-t border-gray-100 bg-gray-50/70">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  <span>Right now</span>
                  {health && <span style={{ color: health.color }}>{health.label}</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {[
                    ["Came in", liveStats.entitiesIn ?? 0],
                    ["Went out", liveStats.entitiesOut ?? 0],
                    [isCounter ? "Being served" : "Inside", depth],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg bg-white border border-gray-100 py-1">
                      <div className="text-[13px] font-bold text-gray-900 tabular-nums">{v}</div>
                      <div className="text-[9.5px] text-gray-500">{k}</div>
                    </div>
                  ))}
                </div>
                {isCounter && waitingNearby > 0 && (
                  <p className="mt-1.5 text-[10.5px] text-gray-600"><b className="text-gray-900">{waitingNearby}</b> waiting for this counter</p>
                )}
                {(liveStats.avgWaitTime ?? 0) > 0 && (
                  <p className="mt-1.5 text-[10.5px] text-gray-600">Average wait: <b className="text-gray-900">{liveStats.avgWaitTime.toFixed(1)}s</b></p>
                )}
              </div>
            )}

            {isBottleneck && (
              <p className="px-3.5 py-2 border-t border-red-100 bg-red-50 text-[10.5px] leading-snug text-red-700">
                <b>Things pile up here.</b> Try adding another counter or making this step faster.
              </p>
            )}
            {needsConnection && !isBottleneck && (
              <p className="px-3.5 py-2 border-t border-amber-100 bg-amber-50 text-[10.5px] leading-snug text-amber-800">
                Drag from the dot on the {!isSource && !hasTargetConnection ? "left" : "right"} edge to connect this block.
              </p>
            )}

            <div className="px-3.5 py-1.5 border-t border-gray-100 text-[10px] text-gray-400">Click to edit · Double-click to delete</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete button (double-click) ── */}
      {showDeleteBtn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setNodes((nds) => nds.filter((n) => n.id !== id));
            setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
          }}
          className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white flex items-center justify-center shadow-[0_2px_10px_rgba(244,63,94,0.4)] hover:scale-110 active:scale-95 transition-all z-50 cursor-pointer border-2 border-white nodrag nopan"
          title="Delete block"
        >
          <X size={12} strokeWidth={3} />
        </button>
      )}

      {/* ── Connection ports ── */}
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className={`sim-port ${hasTargetConnection ? "" : "is-open"}`}
          style={{ ["--port" as string]: baseColor, background: hasTargetConnection ? baseColor : "#fff" }}
        />
      )}
      {!isSink && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className={`sim-port ${hasSourceConnection ? "" : "is-open"}`}
          style={{ ["--port" as string]: baseColor, background: hasSourceConnection ? baseColor : "#fff" }}
        />
      )}

      <div className="relative flex items-center gap-3 pl-2.5 pr-3 py-2.5 pointer-events-none">
        {/* Solid colour tile = block type at a glance */}
        <div
          className="relative w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 text-white"
          style={{
            background: `linear-gradient(145deg, ${tint(baseColor, 18)}, ${baseColor})`,
            boxShadow: `0 6px 12px -6px ${baseColor}, inset 0 1px 0 rgba(255,255,255,0.28)`,
          }}
        >
          <Icon size={18} strokeWidth={2.2} />
          {(health || needsConnection) && (
            <span
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${health ? "animate-pulse" : ""}`}
              style={{ background: health ? health.color : "#f59e0b" }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h5 className="text-[13px] font-semibold text-[#161622] leading-tight truncate">{data.label}</h5>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-none text-gray-500 truncate">
            {live ? (
              <>
                {isCounter && <Dots total={capacity} filled={busy} color={health?.color || baseColor} max={5} />}
                {health && <span className="font-semibold" style={{ color: health.color }}>{health.label}</span>}
                <span className="truncate">
                  {isCounter
                    ? `· ${busy}/${capacity} serving`
                    : nodeType === "queue" || nodeType === "store"
                    ? `· ${depth} waiting`
                    : nodeType === "source"
                    ? `· ${liveStats.entitiesIn ?? 0} in`
                    : nodeType === "sink"
                    ? `· ${liveStats.entitiesOut ?? 0} done`
                    : `· ${depth} inside`}
                </span>
              </>
            ) : needsConnection ? (
              <span className="text-amber-600 font-medium">Not connected yet</span>
            ) : (
              <span className="truncate">{summary}</span>
            )}
          </p>
        </div>
      </div>

      {/* Live load meter — sits inside the bottom edge so the block never grows */}
      {live && (isCounter || nodeType === "queue" || nodeType === "store") && (
        <div className="absolute left-3 right-3 bottom-[5px] h-[3px] rounded-full bg-gray-100 overflow-hidden pointer-events-none">
          <div
            className="h-full w-full rounded-full origin-left transition-transform duration-500 ease-out"
            style={{
              background: health?.color || baseColor,
              transform: `scaleX(${Math.min(1, isCounter ? utilPct / 100 : depth / queueCap)})`,
            }}
          />
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = { simNode: SimNode as any, cyberNode: SimNode as any }; // Keep cyberNode for backwards compat during mapping

let nodeIdCounter = 1;

// ─── Graph Validation ─────────────────────────────────────────────────────────
export interface GraphValidationResult {
  valid: boolean;
  disconnectedNodes: string[];
  message: string;
}

export function validateGraphConnectivity(nodes: Node[], edges: Edge[]): GraphValidationResult {
  if (nodes.length === 0) {
    return { valid: false, disconnectedNodes: [], message: "No blocks in the canvas. Add blocks to build a simulation." };
  }
  if (nodes.length === 1) {
    return { valid: false, disconnectedNodes: [nodes[0].id], message: "Add more blocks and connect them to build a simulation." };
  }
  if (edges.length === 0) {
    return { valid: false, disconnectedNodes: nodes.map(n => n.id), message: "No connections found. Connect all blocks before running the simulation." };
  }

  // Build adjacency (undirected) to check connectivity
  const adjacency: Record<string, Set<string>> = {};
  for (const n of nodes) {
    adjacency[n.id] = new Set();
  }
  for (const e of edges) {
    if (adjacency[e.source]) adjacency[e.source].add(e.target);
    if (adjacency[e.target]) adjacency[e.target].add(e.source);
  }

  // BFS from first node
  const visited = new Set<string>();
  const queue = [nodes[0].id];
  visited.add(nodes[0].id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency[current] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const disconnected = nodes.filter(n => !visited.has(n.id));
  if (disconnected.length > 0) {
    const labels = disconnected.map(n => (n.data as any)?.label || n.id).join(", ");
    return {
      valid: false,
      disconnectedNodes: disconnected.map(n => n.id),
      message: `Disconnected nodes detected: ${labels}. Connect all nodes before running.`,
    };
  }

  return { valid: true, disconnectedNodes: [], message: "Graph is fully connected." };
}

/** React Flow nodes/edges → the plain graph the simulation engine runs. */
export function graphToSimNodes(rfNodes: any[], rfEdges: any[]): SimGraph {
  return {
    nodes: rfNodes.map((n) => ({
      id: n.id,
      nodeType: (n.data as any).nodeType,
      label: (n.data as any).label,
      params: (n.data as any).params || {},
      position: n.position,
    })),
    edges: rfEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}

export interface NodeCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeDragStop?: (event: any, node: Node, nodes: Node[]) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  simState: SimState;
  simType?: string;
  simTick?: SimTick | null;
  bottleneckNodeId?: string;
  readOnly?: boolean;
  remoteUsers?: PresenceUser[];
  onBroadcastCursor?: (cursor: { x: number; y: number } | null) => void;
  /** Fires on every pan/zoom (and once on init) so overlays can stay aligned with the graph. */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

const getMiniMapNodeColor = (n: Node) => NODE_BASE_COLORS[(n.data as any)?.nodeType] || "var(--color-info)";

export interface NodeCanvasHandle {
  addNode: (nodeType: string) => void;
  captureSnapshot: () => Promise<string | null>;
}

function RemoteCursorsOverlay({
  remoteUsers,
  wrapperRef,
}: {
  remoteUsers: PresenceUser[];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { flowToScreenPosition } = useReactFlow();
  useViewport();

  const bounds = wrapperRef.current?.getBoundingClientRect();
  if (!bounds) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {remoteUsers
        .filter((u) => u.cursor && u.cursor.x != null && u.cursor.y != null)
        .map((u) => {
          const screenPos = flowToScreenPosition(u.cursor!);
          const localX = screenPos.x - bounds.left;
          const localY = screenPos.y - bounds.top;
          return (
            <LiveCursor
              key={u.id}
              x={localX}
              y={localY}
              name={u.name}
              color={u.color}
            />
          );
        })}
    </div>
  );
}

// Inner canvas with access to useReactFlow
function NodeCanvasInner({
  nodes, edges, onNodesChange, onEdgesChange, onNodeDragStop,
  selectedNodeId, onSelectNode, simState, simType, simTick, bottleneckNodeId = "",
  remoteUsers = [], onBroadcastCursor, onViewportChange,
  exposedRef, readOnly = false,
}: NodeCanvasProps & { exposedRef?: React.Ref<NodeCanvasHandle> }) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const { fitView, setNodes, setEdges, deleteElements } = useReactFlow();
  const prevNodeCountRef = useRef(0);
  const cursorThrottleRef = useRef(false);
  const canvasKey = useRef({});
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const edgeEdit = React.useMemo(() => ({
    readOnly,
    updateEdgeData: (edgeId: string, patch: SimEdgeData) => {
      const edge = edgesRef.current.find((e) => e.id === edgeId);
      if (!edge) return;
      onEdgesChange([{ type: "replace", id: edgeId, item: { ...edge, data: { ...(edge.data || {}), ...patch } } }]);
    },
  }), [onEdgesChange, readOnly]);

  // The first canvas mounted (the main one) owns shortcuts until another is clicked, e.g. a compare pane.
  useEffect(() => {
    activeCanvas ??= canvasKey.current;
    return () => { if (activeCanvas === canvasKey.current) activeCanvas = null; };
  }, []);

  // Ctrl/⌘ + A, C, X, V, D — like a file manager. Delete/Backspace is handled by React Flow.
  useEffect(() => {
    if (readOnly) return;
    function paste() {
      if (!clipboard) return;
      clipboard.pasteCount++;
      const offset = 40 * clipboard.pasteCount;
      const idMap = new Map<string, string>();
      const newNodes = clipboard.nodes.map((n) => {
        const newId = `node_${crypto.randomUUID().slice(0, 8)}`;
        idMap.set(n.id, newId);
        return { ...n, id: newId, selected: true, position: { x: n.position.x + offset, y: n.position.y + offset } };
      });
      const newEdges = clipboard.edges.map((e) => ({
        ...e, id: `e_${crypto.randomUUID().slice(0, 8)}`, source: idMap.get(e.source)!, target: idMap.get(e.target)!, selected: false,
      }));
      onNodesChange([
        ...nodes.filter((n) => n.selected).map((n) => ({ type: "select" as const, id: n.id, selected: false })),
        ...newNodes.map((item) => ({ type: "add" as const, item })),
      ]);
      if (newEdges.length) onEdgesChange(newEdges.map((item) => ({ type: "add" as const, item })));
    }
    function copy(selected: Node[]) {
      const ids = new Set(selected.map((n) => n.id));
      clipboard = {
        nodes: JSON.parse(JSON.stringify(selected)),
        edges: JSON.parse(JSON.stringify(edges.filter((e) => ids.has(e.source) && ids.has(e.target)))),
        pasteCount: 0,
      };
    }
    function onKey(e: KeyboardEvent) {
      if (activeCanvas !== canvasKey.current || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      const selected = nodes.filter((n) => n.selected);
      if (key === "a") {
        e.preventDefault();
        onNodesChange(nodes.map((n) => ({ type: "select", id: n.id, selected: true })));
      } else if ((key === "c" || key === "x" || key === "d") && selected.length) {
        e.preventDefault();
        copy(selected);
        if (key === "x") deleteElements({ nodes: selected.map((n) => ({ id: n.id })) });
        if (key === "d") paste();
      } else if (key === "v" && clipboard) {
        e.preventDefault();
        paste();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes, edges, readOnly, onNodesChange, onEdgesChange, deleteElements]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!onBroadcastCursor || !reactFlowInstance || !reactFlowWrapper.current) return;
    if (cursorThrottleRef.current) return;
    cursorThrottleRef.current = true;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    requestAnimationFrame(() => {
      if (reactFlowInstance) {
        const flowPos = reactFlowInstance.screenToFlowPosition({
          x: clientX - bounds.left,
          y: clientY - bounds.top,
        });
        onBroadcastCursor(flowPos);
      }
      cursorThrottleRef.current = false;
    });
  }, [onBroadcastCursor, reactFlowInstance]);

  const handlePointerLeave = useCallback(() => {
    if (onBroadcastCursor) {
      onBroadcastCursor(null);
    }
  }, [onBroadcastCursor]);

  useImperativeHandle(exposedRef, () => ({
    addNode: (nodeType: string) => {
      if (!reactFlowInstance) return;
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const centerScreen = {
        x: (bounds?.width ?? 800) / 2,
        y: (bounds?.height ?? 600) / 2,
      };
      const position = reactFlowInstance.screenToFlowPosition(centerScreen);
      const maxId = nodes.reduce((max, n) => {
        const match = n.id.match(/\d+/);
        return match ? Math.max(max, parseInt(match[0], 10)) : max;
      }, 0);
      const newNodeId = `node_${Math.max(nodeIdCounter++, maxId + 1)}`;
      const newNode: Node = {
        id: newNodeId,
        type: "simNode",
        position: { x: position.x + Math.random() * 40 - 20, y: position.y + Math.random() * 40 - 20 },
        data: { label: (NODE_LABELS as any)[nodeType] || nodeType, nodeType, params: {} },
      };
      onNodesChange([{ type: "add", item: newNode }]);
    },
    captureSnapshot: async () => {
      if (!reactFlowWrapper.current) return null;
      try {
        const { toPng } = await import("html-to-image");
        return await toPng(reactFlowWrapper.current, {
          backgroundColor: "#F9F8FD",
          quality: 0.95,
        });
      } catch (err) {
        console.warn("Failed to capture canvas snapshot:", err);
        return null;
      }
    },
  }), [reactFlowInstance, nodes, onNodesChange]);

  // Selection state is synced natively by ReactFlow's onNodesChange and applyNodeChanges

  // FitView when nodes change (e.g. scenario loaded)
  useEffect(() => {
    if (nodes.length > 0 && nodes.length !== prevNodeCountRef.current) {
      prevNodeCountRef.current = nodes.length;
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
    }
  }, [nodes.length, fitView]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (onSelectNode) {
      onSelectNode(selectedNodes.length === 1 ? selectedNodes[0].id : null);
    }
  }, [onSelectNode]);

  const onConnect = useCallback((params: Connection) => {
    if (readOnly) return;
    const newEdge = {
      ...params,
      id: `e_${params.source}-${params.target}-${Date.now()}`,
      type: "simEdge",
    };
    onEdgesChange([{ type: "add", item: newEdge }]);
  }, [onEdgesChange]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("application/reactflow");
    if (!nodeType || !reactFlowInstance) return;
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: e.clientX - (bounds?.left || 0),
      y: e.clientY - (bounds?.top || 0),
    });
    
    // Fallback to max ID number to prevent collisions
    const maxId = nodes.reduce((max, n) => {
      const match = n.id.match(/\d+/);
      return match ? Math.max(max, parseInt(match[0], 10)) : max;
    }, 0);
    
    const newNodeId = `node_${Math.max(nodeIdCounter++, maxId + 1)}`;
    
    const newNode: Node = {
      id: newNodeId,
      type: "simNode",
      position,
      data: {
        label: (NODE_LABELS as any)[nodeType] || nodeType,
        nodeType,
        params: {},
      },
    };
    onNodesChange([{ type: "add", item: newNode }]);
  }, [reactFlowInstance, nodes, onNodesChange]);

  // Live stats from the current tick
  const liveStats = simTick?.nodeStats ?? {};

  // Waiting entities live on the upstream Queue/Store node, not on the resource.
  const upstreamQueueDepth = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of edges) {
      const src = liveStats[e.source];
      if (!src) continue;
      if (src.nodeType === "queue" || src.nodeType === "store") {
        map[e.target] = (map[e.target] ?? 0) + (src.currentDepth ?? 0);
      }
    }
    return map;
  }, [edges, liveStats]);

  // Build set of connected handles for visual feedback
  const connectedHandles = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of edges) {
      set.add(`${e.source}__source`);
      set.add(`${e.target}__target`);
    }
    return set;
  }, [edges]);

  // Animate edges when running
  const liveEdges = React.useMemo(() => {
    return edges.map((e) => ({
      ...e,
      type: "simEdge", // one edge style everywhere; older AI-built graphs saved "smoothstep"
      animated: false, // SimEdge draws its own flowing dots while running
    }));
  }, [edges, simState]);

  // Connection line styling
  const connectionLineStyle = React.useMemo(() => ({
    stroke: "var(--color-info)",
    strokeWidth: 2,
    strokeDasharray: "6 3",
  }), []);

  return (
    <LiveStatsContext.Provider value={{ stats: liveStats, bottleneckId: bottleneckNodeId, simState, connectedHandles, simType: simType || "human_queue", upstreamQueueDepth, remoteUsers }}>
    <EdgeEditContext.Provider value={edgeEdit}>
      <div
        ref={reactFlowWrapper}
        onPointerDownCapture={() => { activeCanvas = canvasKey.current; }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full workspace-canvas relative"
      >
        <style dangerouslySetInnerHTML={{__html: `
          .sim-node .react-flow__handle.sim-port {
            width: 12px; height: 12px; border-radius: 9999px;
            border: 2px solid var(--port); box-shadow: 0 0 0 3px #fff;
            opacity: 0; transition: opacity .15s ease, transform .15s ease;
          }
          .sim-node:hover .sim-port, .sim-node.is-selected .sim-port, .sim-port.is-open,
          .react-flow__handle.sim-port.connectingfrom, .react-flow__handle.sim-port.connectingto { opacity: 1; }
          .sim-node .sim-port:hover, .react-flow__handle.sim-port.connectingto { transform: translate(var(--tw-tx, 0), -50%) scale(1.35); }
          .sim-node .react-flow__handle-left.sim-port { --tw-tx: -50%; left: 0; }
          .sim-node .react-flow__handle-right.sim-port { --tw-tx: 50%; right: 0; }
          @keyframes dashdraw {
            from { stroke-dashoffset: 10; }
            to { stroke-dashoffset: 0; }
          }
        `}} />
        <ReactFlow
          nodes={nodes}
          edges={liveEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onInit={(instance) => {
            setReactFlowInstance(instance);
            onViewportChange?.(instance.getViewport());
          }}
          onMove={(_, vp) => onViewportChange?.(vp)}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "simEdge" }}
          connectionLineStyle={connectionLineStyle}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          // Left-drag draws a selection box; middle/right-drag or two-finger scroll pans, pinch / ctrl+scroll zooms.
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          panOnScroll
          fitView
          deleteKeyCode={readOnly ? null : ["Delete", "Backspace"]}
          // Ctrl/⌘/Shift + click adds or removes a block from the selection.
          multiSelectionKeyCode={["Control", "Meta", "Shift"]}
        >
          <Background variant={BackgroundVariant.Dots} size={1.5} color="#d6d6de" gap={24} />
          <Controls className="jc-controls" />
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            nodeBorderRadius={6}
            maskColor="rgba(245, 243, 255, 0.72)"
            className="jc-minimap"
          />
          <RemoteCursorsOverlay remoteUsers={remoteUsers} wrapperRef={reactFlowWrapper} />
        </ReactFlow>
      </div>
    </EdgeEditContext.Provider>
    </LiveStatsContext.Provider>
  );
}

const NodeCanvas = forwardRef<NodeCanvasHandle, NodeCanvasProps>(function NodeCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner {...props} exposedRef={ref} />
    </ReactFlowProvider>
  );
});
export default NodeCanvas;
