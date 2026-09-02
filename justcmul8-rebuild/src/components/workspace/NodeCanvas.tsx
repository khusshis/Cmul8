"use client";

import React, { useCallback, createContext, useContext, useRef, useEffect } from "react";
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap, addEdge, useReactFlow,
  Handle, Position, BaseEdge, getBezierPath, EdgeLabelRenderer,
  type Connection, type Edge, type Node, BackgroundVariant, type NodeTypes, type EdgeTypes, type EdgeProps, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SimState } from "@/app/dashboard/project/[id]/page";
import type { SimTick, NodeStats } from "@/lib/simulation/types";
import { AlertCircle } from "lucide-react";
import { SIM_TYPE_REGISTRY, NODE_LABELS } from "@/lib/simulation/simTypeRegistry";

// ─── Live Stats Context ───────────────────────────────────────────────────────
const LiveStatsContext = createContext<{
  stats: Record<string, NodeStats>;
  bottleneckId: string;
  simState: SimState;
  connectedHandles: Set<string>;
  simType: string;
}>({ stats: {}, bottleneckId: "", simState: "idle", connectedHandles: new Set(), simType: "human_queue" });

// ─── Node color map (Gap G6 Resolved) ─────────────────────────────────────────
const NODE_BASE_COLORS: Record<string, string> = {
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
function SimEdge({ id, source, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd, style, animated }: EdgeProps) {
  const { setEdges, getNode } = useReactFlow();
  const { simState } = useContext(LiveStatsContext);
  const isRunning = simState === "running";
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  // Get edge color dynamically based on the source node type!
  const sourceNode = getNode(source);
  const edgeColor = NODE_BASE_COLORS[sourceNode?.data?.nodeType] || "var(--color-info)";

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
    opacity: 0, // Hidden visually but functional for connecting
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
  const { stats, bottleneckId, simState, connectedHandles, simType } = useContext(LiveStatsContext);
  const nodeType = data.nodeType;
  const liveStats = stats[id];
  const isBottleneck = bottleneckId === id;
  const isRunning = simState === "running";

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
      className={`relative w-[170px] bg-white rounded-2xl shadow-sm border border-gray-200 border-l-4 p-3 flex gap-3 items-center z-10 transition-all select-none ${selected ? 'scale-105 shadow-lg border-gray-300' : 'hover:shadow-md'}`}
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

      <div style={{ color: statusColor, opacity: isDimmed ? 0.5 : 1 }}>
        {(() => {
          const IconComponent = icon as any;
          return IconComponent ? <IconComponent size={18} strokeWidth={2} /> : null;
        })()}
      </div>
      <div className="pointer-events-none min-w-0 flex-1">
        <h5 className="text-[11px] font-bold text-gray-900 leading-tight truncate">{data.label}</h5>
        
        {/* Static params or live stats */}
        {statsBadge ? (
          <p className="text-[9px] mt-0.5 truncate" style={{ color: !isDimmed ? statusColor : 'var(--color-text-secondary)' }}>
            {statsBadge}
          </p>
        ) : data.params && Object.keys(data.params).length > 0 ? (
          <p className="text-[9px] text-gray-500 mt-0.5 leading-tight truncate">
            {Object.entries(data.params || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ")}
          </p>
        ) : (
          <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">Double-click to config</p>
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
    <LiveStatsContext.Provider value={{ stats: liveStats, bottleneckId: bottleneckNodeId, simState, connectedHandles, simType: simType || "human_queue" }}>
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
