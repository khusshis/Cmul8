"use client";

import React, { useState, useCallback, createContext, useContext, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap, addEdge, useReactFlow, useViewport, useConnection, useStore,
  Handle, Position, BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, EdgeLabelRenderer,
  type Connection, type Edge, type Node, BackgroundVariant, type NodeTypes, type EdgeTypes, type EdgeProps, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges, SelectionMode
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SimState } from "@/app/dashboard/project/[id]/page";
import type { SimTick, NodeStats, NodeType, SimGraph } from "@/lib/simulation/types";
import { AlertCircle, X, CalendarClock, Users, Shuffle, Star, ListOrdered, ArrowDownWideNarrow, Hourglass, UserRound, Timer, Gauge, Zap, Wrench, Flag, Package, Layers, ArrowDownToLine, ArrowUpFromLine, GitFork } from "lucide-react";
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


// ─── Live Glow Color resolver (Exact Thresholds) ──────────────────────────────
function resolveNodeGlowColor(nodeType: string, stats: NodeStats | undefined): {
  color: string;
  isDimmed: boolean;
} {
  if (!stats) return { color: NODE_BASE_COLORS[nodeType] || "var(--color-info)", isDimmed: true };

  switch (nodeType) {
    case "resource":
    case "priority_resource":
    case "service": {
      const u = stats.utilization ?? 0;
      if (u > 0.8) return { color: "var(--color-error)", isDimmed: false };
      if (u > 0.5) return { color: "var(--color-warning)", isDimmed: false };
      return { color: "var(--color-success)", isDimmed: false };
    }
    case "queue":
    case "store": {
      const d = stats.currentDepth ?? 0;
      if (d > 10) return { color: "var(--color-error)", isDimmed: false };
      if (d > 0) return { color: "var(--color-warning)", isDimmed: false };
      return { color: NODE_BASE_COLORS[nodeType] || "var(--color-info)", isDimmed: true };
    }
    case "source":
      return { color: "var(--color-info)", isDimmed: stats.entitiesIn === 0 };
    case "sink":
      return { color: "var(--color-text-secondary)", isDimmed: stats.entitiesOut === 0 };
    default:
      return { color: NODE_BASE_COLORS[nodeType] || "var(--color-info)", isDimmed: false };
  }
}

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

function SimEdge({ id, source, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd, style, data }: EdgeProps) {
  const { getNode, deleteElements, screenToFlowPosition } = useReactFlow();
  const { simState } = useContext(LiveStatsContext);
  const { updateEdgeData, readOnly } = useContext(EdgeEditContext);
  const isRunning = simState === "running";
  const edgeData = (data || {}) as SimEdgeData;
  const shape: EdgeShape = edgeData.shape || "curve";
  // While dragging, points live here; they are committed once on release so history gets one entry.
  const [dragPoints, setDragPoints] = useState<Offset[] | null>(null);
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

  // Get edge color dynamically based on the source node type!
  const sourceNode = getNode(source);
  const nodeType = (sourceNode?.data?.nodeType || "source") as NodeType;
  const edgeColor = NODE_BASE_COLORS[nodeType] || "var(--color-info)";
  const editing = selected && !readOnly && !isRunning;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        className={isRunning ? "animate-[dash_1s_linear_infinite]" : ""}
        style={{
          stroke: selected ? "var(--color-info)" : edgeColor,
          strokeWidth: selected ? 2 : 1.5,
          transition: "stroke 0.3s ease, stroke-width 0.3s ease",
          strokeDasharray: isRunning ? "4 4" : "none",
          opacity: 0.6,
          ...style,
        }}
      />

      {isRunning && (
        <circle r="4" fill={edgeColor}>
          <animateMotion dur="1.2s" repeatCount="indefinite" path={edgePath} />
        </circle>
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

// ─── Handle style helper ──────────────────────────────────────────────────────
// Dots stay hidden until they're useful: on hover/select (drag from here) or while a link is being drawn (drop here).
function handleStyle(color: string, isConnected: boolean, visible: boolean): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    width: 12,
    height: 12,
    background: isConnected ? color : "var(--color-surface)",
    border: `2px solid ${color}`,
    borderRadius: "50%",
    transition: "all 0.2s ease",
  };
}

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

// ─── Hover details card ─────────────────────────────────────────────────────
const plural = (n: number, one: string, many = /(s|ch|sh|x)$/.test(one) ? `${one}es` : `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nounPlural = (one: string) => (/(s|ch|sh|x)$/.test(one) ? `${one}es` : `${one}s`);
const perMinute = (perSec: number) => {
  const m = perSec * 60;
  return m >= 10 ? String(Math.round(m)) : m.toFixed(1);
};

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type Point = { icon: IconType; label: string; value: string; warn?: boolean };

/** How a block is set up, as short pointers: plain label → bold value. */
function getNodePoints(nodeType: string, p: Record<string, any>, noun: string): Point[] {
  const many = nounPlural(noun);
  const timing = (d?: string) => (d === "deterministic" ? "fixed" : "varies");
  switch (nodeType) {
    case "source": {
      if (Array.isArray(p.schedule) && p.schedule.length > 0) {
        return [{ icon: CalendarClock, label: "Arrivals", value: plural(p.schedule.length, "timed wave") }];
      }
      const rate = Number(p.arrivalRate ?? 1);
      return [
        { icon: Users, label: "Arrivals", value: `${rate}/sec · ${perMinute(rate)}/min` },
        { icon: Shuffle, label: "Timing", value: p.distribution === "deterministic" ? "Evenly spaced" : p.distribution === "poisson" ? "In bursts" : p.distribution === "normal" ? "Near average" : "Random" },
        ...(p.priorityLevel && p.priorityLevel !== "standard"
          ? [{ icon: Star, label: "Priority", value: p.priorityLevel === "urgent" ? "Urgent" : "Fast-track" }]
          : []),
      ];
    }
    case "queue": {
      const unlimited = p.capacity === undefined || p.capacity === -1 || p.capacity === "";
      const patient = p.patienceDistribution && p.patienceDistribution !== "none";
      return [
        { icon: ListOrdered, label: "Line limit", value: unlimited ? "No limit" : `${p.capacity} ${many}` },
        { icon: ArrowDownWideNarrow, label: "Order", value: p.discipline === "PRIORITY" ? "VIP first" : p.discipline === "LIFO" ? "Newest first" : "First come, first served" },
        { icon: Hourglass, label: "Gives up after", value: patient ? `~${p.patienceTimeout ?? 5} sec` : "Never" },
      ];
    }
    case "resource":
    case "priority_resource": {
      const cap = Number(p.capacity) || 1;
      const mean = Number(p.serviceTimeMean ?? 1) || 1;
      return [
        { icon: UserRound, label: "Counters", value: String(cap) },
        { icon: Timer, label: `Time per ${noun}`, value: `~${mean} sec (${timing(p.serviceDistribution)})` },
        { icon: Gauge, label: "Max output", value: `${perMinute(cap / mean)} ${many}/min` },
        ...(p.isPreemptive ? [{ icon: Zap, label: "VIPs jump ahead", value: "Yes" }] : []),
        ...(p.meanTimeBetweenFailures
          ? [{ icon: Wrench, label: "Breakdowns", value: `Every ~${p.meanTimeBetweenFailures}s · fix ~${p.repairTimeMean ?? 1}s` }]
          : []),
      ];
    }
    case "service": {
      const mean = Number(p.durationMean ?? 1) || 1;
      return [
        { icon: Timer, label: `Time per ${noun}`, value: `~${mean} sec (${timing(p.distribution)})` },
        { icon: Users, label: "At once", value: "No limit" },
      ];
    }
    case "sink":
      return [{ icon: Flag, label: "Records", value: p.collectKPIs !== false ? "Time, wait, output" : "Off" }];
    case "store":
      return [{ icon: Package, label: "Storage limit", value: p.capacity === undefined || p.capacity === -1 ? "No limit" : `${p.capacity} ${many}` }];
    case "container":
      return [{ icon: Package, label: "Tank size", value: `${p.capacity ?? 100} units` }];
    case "decision":
      return [];
    default:
      return Object.entries(p)
        .filter(([k]) => !k.startsWith("_"))
        .slice(0, 3)
        .map(([k, v]) => ({ icon: Layers, label: k, value: String(v) }));
  }
}

function liveHealth(nodeType: string, s: NodeStats): { label: string; color: string } {
  if (nodeType === "resource" || nodeType === "priority_resource") {
    const u = s.utilization ?? 0;
    if (u > 0.85) return { label: "Overloaded", color: "var(--color-error)" };
    if (u > 0.6) return { label: "Busy", color: "var(--color-warning)" };
    return { label: "Smooth", color: "var(--color-success)" };
  }
  if (nodeType === "queue" || nodeType === "store") {
    const d = s.currentDepth ?? 0;
    if (d > 10) return { label: "Long line", color: "var(--color-error)" };
    if (d > 3) return { label: "Growing", color: "var(--color-warning)" };
    return { label: "Flowing", color: "var(--color-success)" };
  }
  return { label: "Active", color: "var(--color-success)" };
}

const cardMotion = {
  hidden: { opacity: 0, y: 6, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 600, damping: 34, staggerChildren: 0.022 } },
  exit: { opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.08 } },
};
const itemMotion = { hidden: { opacity: 0, x: -3 }, show: { opacity: 1, x: 0, transition: { duration: 0.15 } } };

function PointRow({ icon: Icon, label, value, color, warn }: Point & { color: string }) {
  return (
    <motion.li variants={itemMotion} className="flex items-center gap-2 py-[3px] text-[11px]">
      <span className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0" style={{ background: warn ? "#fef3c7" : `color-mix(in srgb, ${color} 12%, white)`, color: warn ? "#d97706" : color }}>
        <Icon size={11} strokeWidth={2.4} />
      </span>
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`ml-auto pl-2 text-right font-semibold truncate ${warn ? "text-amber-600" : "text-gray-900"}`}>{value}</span>
    </motion.li>
  );
}

function NodeHoverCard({ id, data, nodeType, color, Icon, liveStats, isRunning, isBottleneck, waitingNearby, entityName }: {
  id: string;
  data: any;
  nodeType: string;
  color: string;
  Icon: IconType | null;
  liveStats?: NodeStats;
  isRunning: boolean;
  isBottleneck: boolean;
  waitingNearby: number;
  entityName: string;
}) {
  const { getEdges, getNode } = useReactFlow();
  const params = data.params || {};
  const noun = entityName.toLowerCase();
  const nameOf = (nid: string) => (getNode(nid)?.data?.label as string) || "Unnamed";
  const edges = getEdges();
  const from = edges.filter((e) => e.target === id).map((e) => nameOf(e.source));
  const to = edges.filter((e) => e.source === id).map((e) => e.target);
  const routes: { targetId: string; probability: number }[] = nodeType === "decision" ? params.routes || [] : [];
  const isSource = nodeType === "source";
  const isSink = nodeType === "sink";
  const disconnected = (!isSource && from.length === 0) || (!isSink && to.length === 0);
  const live = isRunning && liveStats ? liveStats : null;
  const health = live ? liveHealth(nodeType, live) : null;
  const isCounter = nodeType === "resource" || nodeType === "priority_resource";
  const isLine = nodeType === "queue" || nodeType === "store";
  const status = health ?? (disconnected ? { label: "Not connected", color: "#d97706" } : { label: "Ready", color: "var(--color-success)" });
  const typeName = (NODE_LABELS as Record<string, string>)[nodeType] || nodeType.replace(/_/g, " ");
  const names = (list: string[]) => (list.length <= 1 ? list[0] : `${list[0]} +${list.length - 1}`);

  const flow: Point[] = [
    ...(!isSource ? [from.length ? { icon: ArrowDownToLine, label: "Comes from", value: names(from)! } : { icon: ArrowDownToLine, label: "Comes from", value: "Not connected", warn: true }] : []),
    ...(!isSink && nodeType !== "decision"
      ? [to.length ? { icon: ArrowUpFromLine, label: "Goes to", value: names(to.map(nameOf))! } : { icon: ArrowUpFromLine, label: "Goes to", value: "Not connected", warn: true }]
      : []),
  ];

  const liveRows: Point[] = live
    ? [
        { icon: ArrowDownToLine, label: "Came in", value: String(live.entitiesIn ?? 0) },
        { icon: Flag, label: "Finished", value: String(live.entitiesOut ?? 0) },
        { icon: isCounter ? UserRound : Users, label: isCounter ? "Being served" : isLine ? "Waiting now" : "Inside now", value: String(live.currentDepth ?? 0) },
        ...((live.avgWaitTime ?? 0) > 0 ? [{ icon: Hourglass, label: "Average wait", value: `${live.avgWaitTime.toFixed(1)} sec` }] : []),
        ...(isCounter && waitingNearby > 0 ? [{ icon: Users, label: "Waiting for it", value: String(waitingNearby) }] : []),
        ...((live.renegeCount ?? 0) > 0 ? [{ icon: Hourglass, label: "Gave up", value: String(live.renegeCount), warn: true }] : []),
        ...((live.breakdownCount ?? 0) > 0 ? [{ icon: Wrench, label: "Breakdowns", value: String(live.breakdownCount) }] : []),
      ]
    : [];

  return (
    <motion.div
      variants={cardMotion}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ transformOrigin: "50% 100%" }}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-[9999] pointer-events-none w-[240px] text-left"
    >
      <div className="relative rounded-[14px] bg-white border border-gray-200/90 shadow-[0_16px_36px_-14px_rgba(16,24,40,0.30),0_2px_6px_-2px_rgba(16,24,40,0.06)]">
        <span aria-hidden className="absolute left-3 right-3 top-0 h-[2px] rounded-b-full" style={{ background: color }} />

        {/* Header */}
        <motion.div variants={itemMotion} className="flex items-center gap-2 px-2.5 pt-2.5 pb-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ background: color }}>
            {Icon && <Icon size={14} strokeWidth={2.3} />}
          </span>
          <div className="min-w-0 flex-1 leading-none">
            <div className="text-[12.5px] font-semibold text-gray-900 truncate">{data.label}</div>
            <div className="mt-1 text-[10px] font-medium truncate" style={{ color }}>{typeName}</div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-[3px] text-[9.5px] font-semibold" style={{ color: status.color, background: `color-mix(in srgb, ${status.color} 12%, white)` }}>
            <span className={`w-1.5 h-1.5 rounded-full ${health ? "animate-pulse" : ""}`} style={{ background: status.color }} />
            {status.label}
          </span>
        </motion.div>

        <ul className="px-2.5 pb-2 border-t border-gray-100 pt-1.5">
          {flow.map((pt) => <PointRow key={pt.label} {...pt} color={color} />)}

          {/* Decision: one pointer per path, with its share */}
          {nodeType === "decision" && (to.length === 0
            ? <PointRow icon={GitFork} label="Paths" value="Not connected" warn color={color} />
            : to.map((tid) => {
                const pr = routes.find((r) => r.targetId === tid)?.probability;
                const pct = pr === undefined ? null : Math.round(Number(pr) * 100);
                return (
                  <motion.li key={tid} variants={itemMotion} className="flex items-center gap-2 py-[3px] text-[11px]">
                    <span className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>
                      <GitFork size={11} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 truncate text-gray-500">{nameOf(tid)}</span>
                    <span className="ml-auto w-12 h-1 rounded-full bg-gray-100 overflow-hidden shrink-0">
                      <span className="block h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: color }} />
                    </span>
                    <span className={`w-9 text-right font-semibold tabular-nums ${pct === null ? "text-amber-600" : "text-gray-900"}`}>{pct === null ? "—" : `${pct}%`}</span>
                  </motion.li>
                );
              }))}

          {getNodePoints(nodeType, params, noun).map((pt) => <PointRow key={pt.label} {...pt} color={color} />)}
        </ul>

        {/* Live pointers */}
        {live && (
          <div className="mx-2 mb-2 rounded-[10px] px-1.5 pt-1 pb-1.5" style={{ background: `color-mix(in srgb, ${health!.color} 7%, white)`, border: `1px solid color-mix(in srgb, ${health!.color} 20%, white)` }}>
            <div className="px-1 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: health!.color }}>Live</div>
            <ul>{liveRows.map((pt) => <PointRow key={pt.label} {...pt} color={health!.color} />)}</ul>
            {isCounter && (
              <motion.div variants={itemMotion} className="mt-1 px-1 flex items-center gap-2 text-[10px]">
                <span className="flex-1 h-1 rounded-full bg-white overflow-hidden">
                  <motion.span
                    className="block h-full rounded-full origin-left"
                    style={{ background: health!.color }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.min(1, live.utilization ?? 0) }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </span>
                <span className="font-semibold tabular-nums text-gray-700">{Math.round((live.utilization ?? 0) * 100)}% busy</span>
              </motion.div>
            )}
          </div>
        )}

        {isBottleneck && (
          <motion.div variants={itemMotion} className="mx-2 mb-2 flex items-center gap-1.5 rounded-[10px] bg-red-50 border border-red-100 px-2 py-1.5 text-[10.5px] text-red-700">
            <AlertCircle size={12} strokeWidth={2.5} className="shrink-0" />
            <span><b className="font-semibold">Slowest step</b> · add a counter or speed it up</span>
          </motion.div>
        )}

        {/* Pointer notch */}
        <span aria-hidden className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white border-r border-b border-gray-200/90" />
      </div>
    </motion.div>
  );
}

// ─── SimNode ────────────────────────────────────────────────────────────────
function SimNode({ data, selected, id }: { data: any; selected: boolean; id: string }) {
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { setNodes, setEdges } = useReactFlow();
  const { stats, bottleneckId, simState, connectedHandles, simType, upstreamQueueDepth, remoteUsers } = useContext(LiveStatsContext);
  const nodeType = data.nodeType;
  const liveStats = stats[id];
  const isBottleneck = bottleneckId === id;
  const isRunning = simState === "running";
  const connectable = useStore((s) => s.nodesConnectable);
  const linking = useConnection((c) => c.inProgress);
  const showHandles = connectable && (isHovered || selected || linking);

  // Remote presence on this node
  const selectingUsers = remoteUsers.filter((u) => u.selectedNodeId === id || u.editingNodeId === id);
  const primaryRemoteUser = selectingUsers[0];
  const isRemoteEditing = selectingUsers.some((u) => u.editingNodeId === id);

  const remoteShadow = isRemoteEditing
    ? `0 0 0 2px #fff, 0 0 0 4px ${primaryRemoteUser.color}`
    : primaryRemoteUser
    ? `0 0 0 2px ${primaryRemoteUser.color}`
    : undefined;

  useEffect(() => {
    if (!selected) {
      setShowDeleteBtn(false);
    }
  }, [selected]);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
  };

  const simConfig = (SIM_TYPE_REGISTRY as any)[simType] || SIM_TYPE_REGISTRY.human_queue;
  const paletteDef = simConfig.paletteNodes?.find((n: any) => n.type === nodeType);
  const icon = paletteDef?.icon || "";

  const baseColor = NODE_BASE_COLORS[nodeType] || "var(--color-info)";
  const { color: statusColor, isDimmed } = isRunning
    ? resolveNodeGlowColor(nodeType, liveStats)
    : { color: baseColor, isDimmed: true };

  // Check which handles are connected
  const hasTargetConnection = connectedHandles.has(`${id}__target`);
  const hasSourceConnection = connectedHandles.has(`${id}__source`);

  // Determine which handles to show based on node type
  const isSink = nodeType === "sink";
  const isSource = nodeType === "source";

  // Stats badge content
  let statsBadge: string | null = null;
  if (isRunning && liveStats) {
    if (nodeType === "resource" || nodeType === "priority_resource") {
      const cap = Number(data.params?.capacity) || 1;
      const depth = liveStats.currentDepth ?? 0;
      const serving = Math.min(depth, cap);
      const queued = (upstreamQueueDepth[id] ?? 0) + Math.max(0, depth - cap);
      statsBadge = `${Math.round((liveStats.utilization ?? 0) * 100)}% util | Serving: ${serving}/${cap} | Queue: ${queued}`;
    } else if (nodeType === "service") {
      // A service node is a pure delay with UNBOUNDED concurrency (the engine spawns
      // one timeout per entity, with no resource contention) and no capacity param.
      // Everything in it is in service, nothing is queued, and there is no server to
      // be busy — so neither a capacity ratio nor a utilisation figure is meaningful.
      statsBadge = `${liveStats.currentDepth ?? 0} in progress | Proc: ${liveStats.entitiesOut ?? 0}`;
    } else if (nodeType === "queue" || nodeType === "store") {
      statsBadge = `${liveStats.currentDepth ?? 0} waiting | Proc: ${liveStats.entitiesOut ?? 0}`;
    } else if (nodeType === "source") {
      statsBadge = `↑${liveStats.entitiesIn ?? 0} arrived`;
    } else if (nodeType === "sink") {
      statsBadge = `✓${liveStats.entitiesOut ?? 0} completed`;
    }
  }


  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setShowDeleteBtn((prev) => !prev);
      }}
      className={`relative w-[175px] bg-white rounded-2xl shadow-sm border border-gray-200 border-l-4 p-3 flex gap-3 items-center transition-all select-none cursor-pointer ${
        isHovered ? "z-[9999]" : "z-10"
      } ${
        selected ? "scale-105 shadow-lg border-gray-300 ring-2 ring-indigo-500/20" : "hover:shadow-md"
      }`}
      style={{
        borderLeftColor: baseColor,
        boxShadow: remoteShadow,
        zIndex: isHovered ? 9999 : selected ? 50 : 1,
      }}
    >
      {/* ── Remote User Presence Pill / Editing Badge ── */}
      {primaryRemoteUser && (
        <div
          className="absolute -top-3 left-2 px-2 py-0.5 rounded-full text-white text-[9.5px] font-bold shadow-sm flex items-center gap-1 pointer-events-none z-30 transition-all"
          style={{ backgroundColor: primaryRemoteUser.color }}
        >
          {isRemoteEditing && <span className="text-[9px]">✏️</span>}
          <span className="truncate max-w-[70px]">{primaryRemoteUser.name}</span>
          {selectingUsers.length > 1 && (
            <span className="opacity-80 text-[8.5px]">+{selectingUsers.length - 1}</span>
          )}
        </div>
      )}
      {/* ── Hover details card ── */}
      <AnimatePresence>
        {isHovered && !showDeleteBtn && (
          <NodeHoverCard
            id={id}
            data={data}
            nodeType={nodeType}
            color={baseColor}
            Icon={icon || null}
            liveStats={liveStats}
            isRunning={isRunning}
            isBottleneck={isBottleneck}
            entityName={simConfig.entityName || "Item"}
            waitingNearby={(upstreamQueueDepth[id] ?? 0) + Math.max(0, (liveStats?.currentDepth ?? 0) - (Number(data.params?.capacity) || 1))}
          />
        )}
      </AnimatePresence>

      {/* ── Circular Red X Delete Button on Double-Click ── */}
      {showDeleteBtn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setNodes((nds) => nds.filter((n) => n.id !== id));
            setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
          }}
          className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white flex items-center justify-center shadow-[0_2px_10px_rgba(244,63,94,0.4)] hover:scale-115 active:scale-95 transition-all z-50 cursor-pointer border-2 border-white nodrag nopan"
          title="Delete block"
        >
          <X size={12} strokeWidth={3} />
        </button>
      )}

      {/* ── Target Handle (left) ── */}
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          style={handleStyle(baseColor, hasTargetConnection, showHandles)}
        />
      )}

      {/* ── Source Handle (right) ── */}
      {!isSink && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          style={handleStyle(baseColor, hasSourceConnection, showHandles)}
        />
      )}

      {/* Bottleneck badge (Post-run) */}
      {isBottleneck && !showDeleteBtn && (
        <div className="absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm animate-pulse z-20">
          <AlertCircle size={12} strokeWidth={3} />
        </div>
      )}

      <div style={{ color: statusColor, opacity: isDimmed ? 0.5 : 1 }}>
        {(() => {
          const IconComponent = icon as any;
          return IconComponent ? <IconComponent size={18} strokeWidth={2} /> : null;
        })()}
      </div>
      <div className="pointer-events-none min-w-0 flex-1">
        <h5 className="text-[11.5px] font-bold text-gray-900 leading-tight truncate">{data.label}</h5>
        
        {/* Static params or live stats */}
        {statsBadge ? (
          <p className="text-[9.5px] font-semibold mt-0.5 truncate" style={{ color: !isDimmed ? statusColor : "var(--color-text-secondary)" }}>
            {statsBadge}
          </p>
        ) : (
          <p className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight truncate">
            {formatNodeFriendlySubtext(nodeType, data.params)}
          </p>
        )}
      </div>
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
  /** Hide the minimap on small embedded canvases where it would cover the graph. */
  hideMiniMap?: boolean;
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
  exposedRef, readOnly = false, hideMiniMap = false,
}: NodeCanvasProps & { exposedRef?: React.Ref<NodeCanvasHandle> }) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const { fitView, setNodes, setEdges, deleteElements, setCenter, getZoom } = useReactFlow();
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
    const clientX = e.clientX;
    const clientY = e.clientY;
    requestAnimationFrame(() => {
      if (reactFlowInstance) {
        // screenToFlowPosition takes viewport (client) coords and subtracts the canvas offset itself.
        const flowPos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
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
        x: (bounds?.left ?? 0) + (bounds?.width ?? 800) / 2,
        y: (bounds?.top ?? 0) + (bounds?.height ?? 600) / 2,
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
    const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    
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
      animated: simState === "running",
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
          {!hideMiniMap && (
            <MiniMap
              nodeColor={getMiniMapNodeColor}
              nodeBorderRadius={6}
              maskColor="rgba(245, 243, 255, 0.72)"
              className="jc-minimap"
              // Drag the viewport box or click anywhere on the map to jump there.
              pannable
              zoomable
              onClick={(_, pos) => setCenter(pos.x, pos.y, { zoom: getZoom(), duration: 400 })}
            />
          )}
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
