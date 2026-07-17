"use client";

import React, { useCallback, createContext, useContext, useRef, useEffect } from "react";
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap, addEdge, useReactFlow,
  Handle, Position, BaseEdge, getSmoothStepPath, EdgeLabelRenderer,
  type Connection, type Edge, type Node, BackgroundVariant, type NodeTypes, type EdgeTypes, type EdgeProps, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SimState } from "@/app/dashboard/project/[id]/page";
import type { SimTick, NodeStats } from "@/lib/simulation/types";
import { AlertCircle } from "lucide-react";

// ─── Live Stats Context ───────────────────────────────────────────────────────
const LiveStatsContext = createContext<{
  stats: Record<string, NodeStats>;
  bottleneckId: string;
  simState: SimState;
  connectedHandles: Set<string>;
}>({ stats: {}, bottleneckId: "", simState: "idle", connectedHandles: new Set() });

// ─── Node color map (Gap G6 Resolved) ─────────────────────────────────────────
const NODE_BASE_COLORS: Record<string, string> = {
  source:           "#2f6fed", // var(--color-info)
  queue:            "#8b5cf6",
  resource:         "#12a150", // var(--color-success)
  service:          "#0ea5a5",
  decision:         "#d9a400", // var(--color-warning)
  sink:             "#6b6b7b", // var(--color-text-secondary)
  priority_resource:"#059669",
  container:        "#2563eb",
  store:            "#7c3aed",
  event_trigger:    "#db2777",
  channel:          "#0891b2",
  broadcaster:      "#ea580c",
  any_of:           "#ca8a04",
  all_of:           "#b45309",
  interrupter:      "#dc2626", // var(--color-error)
};

const NODE_LABELS: Record<string, string> = {
  source: "Arrival Point",
  queue: "Waiting Line",
  resource: "Staff / Machine",
  service: "Service",
  decision: "Decision",
  sink: "Exit",
  priority_resource: "Priority Resource",
  container: "Container",
  store: "Store",
  event_trigger: "Event Trigger",
  channel: "Transmission Link",
  broadcaster: "Broadcast Hub",
  any_of: "Wait For Any",
  all_of: "Wait For All",
  interrupter: "Interrupter",
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
function SimEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd, style, animated }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          stroke: selected ? "var(--color-info)" : "var(--color-border)",
          strokeWidth: selected ? 2 : 1.5,
          transition: "stroke 0.3s ease, stroke-width 0.3s ease",
          animation: animated ? "dashdraw 0.5s linear infinite" : "none",
          strokeDasharray: animated ? "5 5" : "none",
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
              className="w-6 h-6 flex items-center justify-center bg-surface border border-error text-error rounded-full shadow-sm hover:bg-error hover:text-white transition-colors text-xs font-bold"
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

const edgeTypes: EdgeTypes = { simEdge: SimEdge as any };

// ─── Handle style helper ──────────────────────────────────────────────────────
function handleStyle(color: string, isConnected: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    background: isConnected ? color : "var(--color-surface)",
    border: `2px solid ${color}`,
    borderRadius: "50%",
    transition: "all 0.2s ease",
  };
}

// ─── SimNode ────────────────────────────────────────────────────────────────
function SimNode({ data, selected, id }: { data: any; selected: boolean; id: string }) {
  const { stats, bottleneckId, simState, connectedHandles } = useContext(LiveStatsContext);
  const nodeType = data.nodeType;
  const liveStats = stats[id];
  const isBottleneck = bottleneckId === id;
  const isRunning = simState === "running";

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
      className={`card-surface min-w-[140px] px-3 py-2 border-l-4 transition-all ${selected ? 'border-color-info shadow-md ring-1 ring-color-info/30' : 'border-border'}`}
      style={{
        borderLeftColor: baseColor,
      }}
    >
      {/* ── Target Handle (left) ── */}
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          style={handleStyle(baseColor, hasTargetConnection)}
        />
      )}

      {/* ── Source Handle (right) ── */}
      {!isSink && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          style={handleStyle(baseColor, hasSourceConnection)}
        />
      )}

      {/* Bottleneck badge (Post-run) */}
      {isBottleneck && (
        <div className="absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm animate-pulse z-20">
          <AlertCircle size={12} strokeWidth={3} />
        </div>
      )}

      <div className="text-xs font-semibold text-text-primary">{data.label}</div>
      
      {/* Static params or live stats */}
      {statsBadge ? (
        <div className="mt-1 flex items-center gap-1.5">
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0 transition-colors" 
            style={{ backgroundColor: statusColor, opacity: isDimmed ? 0.4 : 1 }} 
          />
          <div className="text-[10px] font-mono font-medium text-text-secondary truncate" style={{ color: !isDimmed ? statusColor : 'var(--color-text-secondary)' }}>
            {statsBadge}
          </div>
        </div>
      ) : data.params && Object.keys(data.params).length > 0 ? (
        <div className="text-[10px] text-text-muted font-mono mt-1 truncate">
          {Object.entries(data.params || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" | ")}
        </div>
      ) : (
        <div className="text-[10px] text-text-muted font-mono mt-1">
          Double-click to config
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

export interface NodeCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  simState: SimState;
  simType?: string;
  simTick?: SimTick | null;
  bottleneckNodeId?: string;
}

const getMiniMapNodeColor = (n: Node) => NODE_BASE_COLORS[(n.data as any)?.nodeType] || "var(--color-info)";

// Inner canvas with access to useReactFlow
function NodeCanvasInner({
  nodes, edges, onNodesChange, onEdgesChange,
  selectedNodeId, onSelectNode, simState, simType, simTick, bottleneckNodeId = "",
}: NodeCanvasProps) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const { fitView, setNodes, setEdges } = useReactFlow();
  const prevNodeCountRef = useRef(0);

  // Sync selection state from parent
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      selected: n.id === selectedNodeId
    })));
  }, [selectedNodeId, setNodes]);

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
        label: NODE_LABELS[nodeType] || nodeType,
        nodeType,
        params: {},
      },
    };
    onNodesChange([{ type: "add", item: newNode }]);
  }, [reactFlowInstance, nodes, onNodesChange]);

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
      type: e.type || "simEdge",
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
    <LiveStatsContext.Provider value={{ stats: liveStats, bottleneckId: bottleneckNodeId, simState, connectedHandles }}>
      <div ref={reactFlowWrapper} className="w-full h-full workspace-canvas relative">
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
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "simEdge" }}
          connectionLineStyle={connectionLineStyle}
          fitView
          deleteKeyCode="Delete"
        >
          <Background variant={BackgroundVariant.Dots} size={1.5} color="#d6d6de" gap={24} />
          <Controls className="bg-surface border border-border rounded-md shadow-sm" />
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            maskColor="rgba(240, 240, 244, 0.7)"
            className="border border-border rounded-md shadow-sm bg-surface"
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
