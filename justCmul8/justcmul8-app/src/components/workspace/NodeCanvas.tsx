"use client";
import React, { useCallback, createContext, useContext, useRef, useEffect, useState } from "react";
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap, addEdge, useReactFlow,
  Handle, Position, BaseEdge, getSmoothStepPath, EdgeLabelRenderer,
  type Connection, type Edge, type Node, BackgroundVariant, type NodeTypes, type EdgeTypes, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SimState } from "@/app/dashboard/project/[id]/page";
import type { SimTick, NodeStats } from "@/lib/simulation/types";

// ─── Live Stats Context ───────────────────────────────────────────────────────
const LiveStatsContext = createContext<{
  stats: Record<string, NodeStats>;
  bottleneckId: string;
  simState: SimState;
  connectedHandles: Set<string>;
}>({ stats: {}, bottleneckId: "", simState: "idle", connectedHandles: new Set() });

// ─── Node color map ───────────────────────────────────────────────────────────
const NODE_BASE_COLORS: Record<string, string> = {
  source:           "#00f2ff",
  queue:            "#fbbf24",
  resource:         "#10b981",
  service:          "#f97316",
  decision:         "#7000ff",
  sink:             "#ef4444",
  priority_resource:"#fbbf24",
  container:        "#00f2ff",
  store:            "#7000ff",
  event_trigger:    "#ff00ff",
  channel:          "#e879f9",
  broadcaster:      "#ff7a00",
};

const NODE_LABELS: Record<string, string> = {
  source: "Source", queue: "Queue", resource: "Resource",
  service: "Service", decision: "Decision", sink: "Sink",
  priority_resource: "Priority Resource", container: "Container",
  store: "Store", event_trigger: "Event Trigger",
  channel: "Channel", broadcaster: "Broadcaster",
};

// ─── Live Glow Color resolver ─────────────────────────────────────────────────
function resolveNodeGlowColor(nodeType: string, stats: NodeStats | undefined, isBottleneck: boolean): {
  color: string;
  glowStrength: number;
  label?: string;
} {
  if (isBottleneck) return { color: "#ef4444", glowStrength: 0.8 };
  if (!stats) return { color: NODE_BASE_COLORS[nodeType] || "#00f2ff", glowStrength: 0.15 };

  switch (nodeType) {
    case "resource":
    case "priority_resource":
    case "service": {
      const u = stats.utilization ?? 0;
      if (u > 0.8) return { color: "#ef4444", glowStrength: 0.7 };
      if (u > 0.5) return { color: "#fbbf24", glowStrength: 0.5 };
      return { color: "#10b981", glowStrength: 0.35 };
    }
    case "queue":
    case "store": {
      const d = stats.currentDepth ?? 0;
      if (d > 10) return { color: "#ef4444", glowStrength: 0.7 };
      if (d > 5) return { color: "#f97316", glowStrength: 0.5 };
      if (d > 0) return { color: "#fbbf24", glowStrength: 0.35 };
      return { color: "#fbbf24", glowStrength: 0.1 };
    }
    case "source":
      return { color: "#00f2ff", glowStrength: stats.entitiesIn > 0 ? 0.5 : 0.15 };
    case "sink":
      return { color: "#ef4444", glowStrength: stats.entitiesOut > 0 ? 0.4 : 0.1 };
    default:
      return { color: NODE_BASE_COLORS[nodeType] || "#00f2ff", glowStrength: 0.2 };
  }
}

// ─── CyberEdge (styled edge) ──────────────────────────────────────────────────
function CyberEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd, style }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      {/* Glow layer */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{
          stroke: selected ? "rgba(0,242,255,0.35)" : "rgba(0,242,255,0.12)",
          strokeWidth: selected ? 8 : 5,
          filter: "blur(3px)",
          ...style,
        }}
      />
      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          stroke: selected ? "#00f2ff" : "rgba(0,242,255,0.6)",
          strokeWidth: selected ? 2.5 : 1.5,
          transition: "stroke 0.3s ease, stroke-width 0.3s ease",
          ...style,
        }}
      />

      {/* Delete Button when selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEdges((eds) => eds.filter((edge) => edge.id !== id));
              }}
              style={{
                width: 24,
                height: 24,
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                color: "#ef4444",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
                backdropFilter: "blur(4px)",
                fontSize: "14px",
                fontWeight: "bold",
                lineHeight: 1,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#ef4444";
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.4)";
              }}
              title="Delete Edge"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = { cyberEdge: CyberEdge as any };

// ─── Handle style helper ──────────────────────────────────────────────────────
function handleStyle(color: string, isConnected: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    background: isConnected ? color : "rgba(0,0,0,0.85)",
    border: `2px solid ${color}`,
    borderRadius: "50%",
    boxShadow: isConnected
      ? `0 0 6px ${color}, 0 0 12px ${color}40`
      : `0 0 4px ${color}50`,
    transition: "all 0.25s ease",
  };
}

// ─── CyberNode ────────────────────────────────────────────────────────────────
function CyberNode({ data, selected, id }: { data: any; selected: boolean; id: string }) {
  const { stats, bottleneckId, simState, connectedHandles } = useContext(LiveStatsContext);
  const nodeType = data.nodeType;
  const liveStats = stats[id];
  const isBottleneck = bottleneckId === id;
  const isRunning = simState === "running";

  const baseColor = NODE_BASE_COLORS[nodeType] || "#00f2ff";
  const { color: glowColor, glowStrength } = isRunning
    ? resolveNodeGlowColor(nodeType, liveStats, isBottleneck)
    : { color: baseColor, glowStrength: selected ? 0.4 : 0.12 };

  const boxShadow = `0 0 ${Math.round(glowStrength * 20)}px ${glowColor}${Math.round(glowStrength * 99).toString(16).padStart(2, "0")}`;

  // Check which handles are connected
  const hasTargetConnection = connectedHandles.has(`${id}__target`);
  const hasSourceConnection = connectedHandles.has(`${id}__source`);

  // Determine which handles to show based on node type
  const isSink = nodeType === "sink";
  const isSource = nodeType === "source";

  // Stats badge content
  let statsBadge: string | null = null;
  if (isRunning && liveStats) {
    if (nodeType === "resource" || nodeType === "priority_resource" || nodeType === "service") {
      statsBadge = `${Math.round((liveStats.utilization ?? 0) * 100)}% util | Wait: ${liveStats.currentDepth ?? 0} | Proc: ${liveStats.entitiesOut ?? 0}`;
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
      className="cyber-node-wrapper"
      style={{
        background: "rgba(0,0,0,0.82)",
        border: `1px solid ${glowColor}${selected ? "ee" : "50"}`,
        borderLeft: `3px solid ${glowColor}`,
        borderRadius: "4px",
        padding: "8px 12px",
        minWidth: "120px",
        boxShadow: selected ? `${boxShadow}, inset 0 0 6px ${glowColor}15` : boxShadow,
        fontFamily: "var(--font-body)",
        transition: "box-shadow 0.4s ease, border-color 0.4s ease",
        position: "relative",
      }}
    >
      {/* ── Target Handle (left) ── */}
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          style={handleStyle(glowColor, hasTargetConnection)}
        />
      )}

      {/* ── Source Handle (right) ── */}
      {!isSink && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          style={handleStyle(glowColor, hasSourceConnection)}
        />
      )}

      {/* Bottleneck badge */}
      {isBottleneck && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            background: "#ef4444",
            borderRadius: "50%",
            width: 14,
            height: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.5rem",
            color: "#fff",
            fontWeight: "bold",
            boxShadow: "0 0 8px #ef4444",
            animation: "pulse-glow 1s ease-in-out infinite",
            zIndex: 20,
          }}
        >
          !
        </div>
      )}

      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fff" }}>{data.label}</div>
      
      {/* Static params or live stats */}
      {statsBadge ? (
        <div style={{
          fontSize: "0.65rem",
          color: glowColor,
          fontFamily: "var(--font-mono)",
          marginTop: "3px",
          fontWeight: 600,
        }}>
          {statsBadge}
        </div>
      ) : data.params && (
        <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
          {Object.entries(data.params || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" | ")}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = { cyberNode: CyberNode as any };

let nodeIdCounter = 1;

// ─── Graph Validation ─────────────────────────────────────────────────────────
export interface GraphValidationResult {
  valid: boolean;
  disconnectedNodes: string[];
  message: string;
}

export function validateGraphConnectivity(nodes: Node[], edges: Edge[]): GraphValidationResult {
  if (nodes.length === 0) {
    return { valid: false, disconnectedNodes: [], message: "No nodes in the graph. Add nodes to build a simulation." };
  }
  if (nodes.length === 1) {
    return { valid: false, disconnectedNodes: [nodes[0].id], message: "Add more nodes and connect them to build a simulation." };
  }
  if (edges.length === 0) {
    return { valid: false, disconnectedNodes: nodes.map(n => n.id), message: "No edges found. Connect all nodes before running the simulation." };
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

interface NodeCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  onNodeSelect?: (nodeId: string | null) => void;
  simState: SimState;
  simType?: string;
  simTick?: SimTick | null;
  bottleneckNodeId?: string;
}

const getMiniMapNodeColor = (n: Node) => NODE_BASE_COLORS[(n.data as any)?.nodeType] || "#00f2ff";

// Inner canvas with access to useReactFlow
function NodeCanvasInner({
  nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges,
  onNodeSelect, simState, simType, simTick, bottleneckNodeId = "",
}: NodeCanvasProps) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(0);

  // FitView when nodes change (e.g. scenario loaded)
  useEffect(() => {
    if (nodes.length > 0 && nodes.length !== prevNodeCountRef.current) {
      prevNodeCountRef.current = nodes.length;
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
    }
  }, [nodes.length, fitView]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (onNodeSelect) {
      onNodeSelect(selectedNodes.length === 1 ? selectedNodes[0].id : null);
    }
  }, [onNodeSelect]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: "cyberEdge",
      animated: simState === "running",
    }, eds));
  }, [simState, setEdges]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("application/reactflow");
    if (!nodeType || !reactFlowInstance) return;
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: e.clientX - (bounds?.left || 0),
      y: e.clientY - (bounds?.top || 0),
    });
    const newNode: Node = {
      id: `node_${nodeIdCounter++}`,
      type: "cyberNode",
      position,
      data: {
        label: NODE_LABELS[nodeType] || nodeType,
        nodeType,
        params: {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  // Live stats from the current tick
  const liveStats = simTick?.nodeStats ?? {};

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
      type: e.type || "cyberEdge",
      animated: simState === "running",
    }));
  }, [edges, simState]);

  // Connection line styling
  const connectionLineStyle = React.useMemo(() => ({
    stroke: "rgba(0,242,255,0.7)",
    strokeWidth: 2,
    strokeDasharray: "6 3",
  }), []);

  return (
    <LiveStatsContext.Provider value={{ stats: liveStats, bottleneckId: bottleneckNodeId, simState, connectedHandles }}>
      <div ref={reactFlowWrapper} className="w-full h-full cyber-grid-canvas">
        <ReactFlow
          nodes={nodes}
          edges={liveEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "cyberEdge" }}
          connectionLineStyle={connectionLineStyle}
          fitView
          deleteKeyCode="Delete"
          style={{ background: "transparent" }}
        >
          <Background variant={BackgroundVariant.Dots} size={1} color="rgba(0,242,255,0.08)" gap={24} />
          <Controls />
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            maskColor="rgba(10,10,20,0.7)"
          />
        </ReactFlow>
      </div>
    </LiveStatsContext.Provider>
  );
}

export default function NodeCanvas(props: NodeCanvasProps) {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
