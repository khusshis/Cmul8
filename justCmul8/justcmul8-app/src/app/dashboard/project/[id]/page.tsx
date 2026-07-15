"use client";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Play, Pause, Square, FastForward, Save, Timer,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { JustCmul8Icon } from "@/components/ui/JustCmul8Icon";
import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { StarterGraph } from "@/lib/simulation/simTypeRegistry";
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import type { SimTick, SimResult, SimTypeId, NodeType, PyodideStatus } from "@/lib/simulation/types";
import { validateGraphConnectivity, type GraphValidationResult } from "@/components/workspace/NodeCanvas";

const NodeCanvas = dynamic(() => import("@/components/workspace/NodeCanvas"), { ssr: false });
const AIChatPanel = dynamic(() => import("@/components/workspace/AIChatPanel"), { ssr: false });
const NodePalette = dynamic(() => import("@/components/workspace/NodePalette"), { ssr: false });
const NodePropertiesPanel = dynamic(() => import("@/components/workspace/NodePropertiesPanel"), { ssr: false });
const SimResultsPanel = dynamic(() => import("@/components/workspace/SimResultsPanel"), { ssr: false });

export type SimState = "idle" | "running" | "paused";

interface Project { id: string; name: string; sim_type: string; graph_json: string; }

// ─── Default params per node type ─────────────────────────────────────────────
function defaultParamsForType(nodeType: NodeType): Record<string, unknown> {
  switch (nodeType) {
    case "source":           return { arrivalRate: 1, distribution: "exponential" };
    case "queue":            return { capacity: -1, discipline: "FIFO" };
    case "resource":         return { capacity: 1, serviceTimeMean: 5, serviceDistribution: "exponential" };
    case "priority_resource":return { capacity: 1, serviceTimeMean: 5, serviceDistribution: "exponential" };
    case "service":          return { durationMean: 5, distribution: "exponential" };
    case "decision":         return { routes: [] };
    case "sink":             return { collectKPIs: true };
    case "container":        return { capacity: 1000, initialLevel: 0, fillRate: 1 };
    case "store":            return { capacity: -1, discipline: "FIFO" };
    case "channel":          return { propagationDelay: 1, delayDistribution: "deterministic", bufferCapacity: -1 };
    case "broadcaster":      return { bufferCapacity: -1 };
    case "event_trigger":    return {};
    default:                 return {};
  }
}

// ─── Graph to SimParams converter ─────────────────────────────────────────────
function graphToSimNodes(rfNodes: any[], rfEdges: any[]) {
  const simNodes = rfNodes.map((n: any) => ({
    id: n.id,
    nodeType: (n.data?.nodeType || "source") as NodeType,
    label: n.data?.label || n.id,
    params: n.data?.params && Object.keys(n.data.params).length > 0
      ? n.data.params
      : defaultParamsForType((n.data?.nodeType || "source") as NodeType),
    position: n.position,
  }));

  const simEdges = rfEdges.map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: false,
  }));

  return { nodes: simNodes, edges: simEdges };
}

// ─── Starter graph → React Flow nodes/edges ────────────────────────────────────
function starterToRfNodes(starter: StarterGraph): { nodes: any[]; edges: any[] } {
  return {
    nodes: starter.nodes.map((n) => ({
      id: n.id,
      type: "cyberNode",
      position: n.position,
      data: {
        label: n.label,
        nodeType: n.nodeType,
        params: n.params,
      },
    })),
    edges: starter.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: false,
    })),
  };
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [simState, setSimState] = React.useState<SimState>("idle");
  const [speed, setSpeed] = React.useState(5);
  const [duration, setDuration] = React.useState(100);
  const [timeUnit, setTimeUnit] = React.useState<"seconds" | "minutes" | "hours" | "days">("minutes");
  const [saved, setSaved] = React.useState(true);
  const [nodes, setNodes] = React.useState<any[]>([]);
  const [edges, setEdges] = React.useState<any[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [activeRightPanel, setActiveRightPanel] = React.useState<"ai" | "properties">("ai");

  // ── Simulation live state ────────────────────────────────────────────────
  const [simTick, setSimTick] = React.useState<SimTick | null>(null);
  const [simResult, setSimResult] = React.useState<SimResult | null>(null);
  const [bottleneckNodeId, setBottleneckNodeId] = React.useState<string>("");
  const [pyodideStatus, setPyodideStatus] = React.useState<PyodideStatus>({ phase: "idle" });

  const saveTimer = React.useRef<NodeJS.Timeout | null>(null);
  const engineRef = React.useRef<PyodideSimEngine | null>(null);

  // Validation state
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const validationTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const engine = new PyodideSimEngine();
    engine.init(); // Starts Pyodide pre-warm
    engineRef.current = engine;

    // Register persistent callbacks once (they always read current sceneRef)
    engine.onTick((tick) => {
      setSimTick(tick);
    });

    engine.onComplete((result) => {
      setSimResult(result);
      setSimState("idle");
      setBottleneckNodeId(result.bottleneckNodeId || "");
    });

    engine.onError((err) => {
      console.error("[SimEngine Error]", err);
      setSimState("idle");
    });
    
    engine.onStatus((status) => {
      console.log("[Pyodide Status]", status.phase, status.message);
      setPyodideStatus(status);
    });

    return () => {
      engine.destroy(); // stop sim and terminate worker
    };
  }, []);

  React.useEffect(() => {
    loadProject();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadProject() {
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    if (!data) { router.push("/dashboard"); return; }
    setProject(data);
    const graph = JSON.parse(data.graph_json || '{"nodes":[],"edges":[]}');
    setNodes(graph.nodes || []);
    setEdges(graph.edges || []);
    setLoading(false);
  }

  const onNodesChange = React.useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const newNds = applyNodeChanges(changes, nds);
      setSaved(false);
      return newNds;
    });
  }, []);

  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const newEds = applyEdgeChanges(changes, eds);
      setSaved(false);
      return newEds;
    });
  }, []);

  React.useEffect(() => {
    if (!saved) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => autoSave(nodes, edges), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, saved]);

  function onUpdateNodeData(nodeId: string, partialData: any) {
    setNodes((nds) => {
      const updated = nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, ...partialData } };
        }
        return n;
      });
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => autoSave(updated, edges), 1500);
      return updated;
    });
  }

  async function autoSave(n: any[], e: any[]) {
    if (!project) return;
    await supabase.from("projects").update({
      graph_json: JSON.stringify({ nodes: n, edges: e }),
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);
    setSaved(true);
  }

  // ── Scenario loading ─────────────────────────────────────────────────────
  function onLoadScenario(starter: StarterGraph) {
    const { nodes: rfNodes, edges: rfEdges } = starterToRfNodes(starter);
    setNodes(rfNodes);
    setEdges(rfEdges);
    setSaved(false);
    // Stop any running sim
    if (engineRef.current) engineRef.current.stop();
    setSimState("idle");
    setSimTick(null);
    setSimResult(null);
    setBottleneckNodeId("");
  }

  // ── Run simulation ───────────────────────────────────────────────────────
  function handleRun() {
    if (!engineRef.current) return;

    // Validate graph connectivity before running
    const validation = validateGraphConnectivity(nodes, edges);
    if (!validation.valid) {
      setValidationError(validation.message);
      // Auto-dismiss after 5 seconds
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
      validationTimerRef.current = setTimeout(() => setValidationError(null), 5000);
      return;
    }
    setValidationError(null);

    setSimResult(null);
    setSimTick(null);
    setBottleneckNodeId("");

    const graph = graphToSimNodes(nodes, edges);
    engineRef.current.start({
      simType: (project?.sim_type || "human_queue") as SimTypeId,
      durationSeconds: duration,
      tickIntervalSeconds: 0.1,
      speedMultiplier: speed,
      graph,
    });
    setSimState("running");
  }

  const speedOptions = [1, 2, 5, 10, 50];

  // ── Sim clock display ────────────────────────────────────────────────────
  const simTimeDisplay = simTick ? simTick.simTime.toFixed(1) : "0.0";
  const arrivedDisplay = simTick?.totalArrived ?? 0;
  const completedDisplay = simTick?.totalCompleted ?? 0;
  const inFlight = Math.max(0, arrivedDisplay - completedDisplay);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-neon-cyan text-sm animate-pulse" style={{ fontFamily: "var(--font-mono)" }}>LOADING WORKSPACE...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* ── Top Toolbar ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 h-12 flex items-center gap-3 px-4 border-b"
        style={{ background: "var(--bg-secondary)", borderColor: "rgba(0,242,255,0.15)" }}
      >
        {/* Back link */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-cyan)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <ArrowLeft size={14} /> BACK
        </Link>
        <div className="w-px h-6" style={{ background: "rgba(0,242,255,0.15)" }} />
        <JustCmul8Icon width={20} height={20} style={{ color: "var(--neon-cyan)" }} />
        <span
          className="font-display font-bold text-sm text-neon-cyan tracking-wider truncate max-w-xs"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {project?.name}
        </span>

        <div className="flex-1" />

        {/* ── Sim Controls ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          
          {/* Pyodide Loading Indicator */}
          {(pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy") && (
            <span className="text-[10px] animate-pulse whitespace-nowrap hidden md:inline-block" style={{ color: "var(--neon-yellow)", fontFamily: "var(--font-mono)" }}>
              ⚙ {pyodideStatus.message}
            </span>
          )}

          {/* Run / Resume */}
          {simState === "idle" || simState === "paused" ? (
            <button
              id="toolbar-run"
              disabled={pyodideStatus.phase !== "ready" && pyodideStatus.phase !== "idle"}
              onClick={() => {
                if (simState === "idle") {
                  handleRun();
                } else if (simState === "paused" && engineRef.current) {
                  engineRef.current.resume();
                  setSimState("running");
                }
              }}
              className="btn-cyber-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: "4px 14px", fontSize: "0.7rem" }}
            >
              <Play size={12} /> {simState === "paused" ? "RESUME" : "RUN"}
            </button>
          ) : (
            <button
              id="toolbar-pause"
              onClick={() => {
                if (engineRef.current) engineRef.current.pause();
                setSimState("paused");
              }}
              className="btn-cyber-ghost"
              style={{ padding: "4px 12px", fontSize: "0.7rem" }}
            >
              <Pause size={12} /> PAUSE
            </button>
          )}

          {/* Stop */}
          <button
            id="toolbar-stop"
            onClick={() => {
              if (engineRef.current) engineRef.current.stop();
              setSimState("idle");
              setSimTick(null);
            }}
            className="btn-cyber-ghost"
            style={{ padding: "4px 10px", fontSize: "0.7rem" }}
          >
            <Square size={12} />
          </button>

          {/* Duration */}
          <div className="flex items-center gap-1">
            <Timer size={12} style={{ color: "var(--text-muted)" }} />
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
              className="text-xs rounded px-1 py-0.5 w-16 text-center"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(0,242,255,0.2)",
                color: "var(--neon-cyan)",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
              title="Simulation Duration"
            />
          </div>

          {/* Time Unit */}
          <select
            value={timeUnit}
            onChange={(e) => setTimeUnit(e.target.value as any)}
            className="text-xs rounded px-1 py-0.5"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(0,242,255,0.2)",
              color: "var(--neon-cyan)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <option value="seconds">secs</option>
            <option value="minutes">mins</option>
            <option value="hours">hrs</option>
            <option value="days">days</option>
          </select>

          {/* Speed */}
          <div className="flex items-center gap-1">
            <FastForward size={12} style={{ color: "var(--text-muted)" }} />
            <select
              value={speed}
              onChange={(e) => {
                const newSpeed = Number(e.target.value);
                setSpeed(newSpeed);
                if (engineRef.current) engineRef.current.updateSpeed(newSpeed);
              }}
              className="text-xs rounded px-1 py-0.5"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(0,242,255,0.2)",
                color: "var(--neon-cyan)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {speedOptions.map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </div>
        </div>

        {/* ── Sim Clock HUD ──────────────────────────────────────────────── */}
        {(simState === "running" || simState === "paused" || simTick) && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(0,242,255,0.15)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <Timer size={11} style={{ color: "var(--neon-cyan)" }} />
            <span style={{ color: "var(--neon-cyan)", fontSize: "0.7rem", minWidth: "60px" }}>
              {simTimeDisplay} {timeUnit === "seconds" ? "s" : timeUnit === "minutes" ? "m" : timeUnit === "hours" ? "h" : "d"}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>|</span>
            <span style={{ color: "var(--neon-green)", fontSize: "0.65rem" }}>↑{arrivedDisplay}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>↓{completedDisplay}</span>
            {inFlight > 0 && (
              <span style={{ color: "var(--neon-yellow)", fontSize: "0.65rem" }}>∿{inFlight}</span>
            )}
            {bottleneckNodeId && (
              <>
                <span style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>|</span>
                <span style={{ color: "var(--neon-red)", fontSize: "0.65rem" }}>🔴 {simResult?.bottleneckLabel || "bottleneck"}</span>
              </>
            )}
          </div>
        )}

        <div className="w-px h-6" style={{ background: "rgba(0,242,255,0.15)" }} />

        {/* Save status */}
        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ fontFamily: "var(--font-mono)", color: saved ? "var(--neon-green)" : "var(--neon-yellow)" }}
        >
          <Save size={12} />
          {saved ? "SAVED" : "SAVING..."}
        </div>
      </div>

      {/* ── 3-Panel Layout ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: Node Palette */}
        <div className="w-52 flex-shrink-0 border-r overflow-hidden flex flex-col" style={{ borderColor: "rgba(0,242,255,0.1)", background: "var(--bg-secondary)" }}>
          <NodePalette
            simType={project?.sim_type || "human_queue"}
            onLoadScenario={onLoadScenario}
          />
        </div>

        {/* Center: React Flow Canvas */}
        <div className="flex-1 min-w-0">
          <NodeCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            onNodeSelect={(id) => {
              setSelectedNodeId(id);
              if (id) setActiveRightPanel("properties");
            }}
            simState={simState}
            simType={project?.sim_type || "human_queue"}
            simTick={simTick}
            bottleneckNodeId={bottleneckNodeId}
          />
        </div>

        {/* Right: Auxiliary Panel (AI Chat / Properties) */}
        <div className="w-72 flex-shrink-0 border-l relative flex flex-col items-stretch" style={{ borderColor: "rgba(0,242,255,0.1)" }}>
          <div className="flex-1 overflow-hidden relative">
            {activeRightPanel === "ai" ? (
              <AIChatPanel
                simType={project?.sim_type || "human_queue"}
                currentGraph={{ nodes, edges }}
                onGraphGenerated={(n, e) => {
                  setNodes(n);
                  setEdges(e);
                  setSaved(false);
                }}
              />
            ) : (
              selectedNodeId && nodes.find((n) => n.id === selectedNodeId) ? (
                <NodePropertiesPanel
                  node={nodes.find((n) => n.id === selectedNodeId)!}
                  simType={project?.sim_type || "human_queue"}
                  onUpdate={onUpdateNodeData}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-xs font-mono mb-2" style={{ color: "var(--neon-cyan)" }}>NO NODE SELECTED</p>
                  <p className="text-[10px]">Click any node on the blueprint canvas to edit its properties.</p>
                </div>
              )
            )}
          </div>

          {/* Panel toggle pills */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="flex bg-black/80 rounded-full border p-1 pointer-events-auto backdrop-blur-md shadow-lg" style={{ borderColor: "rgba(0,242,255,0.2)" }}>
              <button
                onClick={() => setActiveRightPanel("ai")}
                className="px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all"
                style={{
                  background: activeRightPanel === "ai" ? "rgba(0,242,255,0.2)" : "transparent",
                  color: activeRightPanel === "ai" ? "var(--neon-cyan)" : "var(--text-muted)",
                }}
              >
                AI ASSISTANT
              </button>
              <button
                onClick={() => setActiveRightPanel("properties")}
                className="px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all"
                style={{
                  background: activeRightPanel === "properties" ? "rgba(0,242,255,0.2)" : "transparent",
                  color: activeRightPanel === "properties" ? "var(--neon-cyan)" : "var(--text-muted)",
                }}
              >
                PROPERTIES
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Results Panel (bottom drawer) ──────────────────────────── */}
      {simResult && (
        <SimResultsPanel
          result={simResult}
          simType={(project?.sim_type || "human_queue") as SimTypeId}
          onClose={() => setSimResult(null)}
        />
      )}

      {/* ── Validation Error Toast ──────────────────────────────────────── */}
      {validationError && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up"
          style={{
            maxWidth: "500px",
            width: "90vw",
          }}
        >
          <div
            style={{
              background: "rgba(10, 10, 20, 0.95)",
              border: "1px solid rgba(239, 68, 68, 0.6)",
              borderLeft: "3px solid #ef4444",
              borderRadius: "6px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.2), 0 4px 20px rgba(0,0,0,0.6)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1.5px solid #ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                color: "#ef4444",
                fontWeight: "bold",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              !
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-mono)",
                  color: "#ef4444",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  marginBottom: "4px",
                }}
              >
                VALIDATION ERROR
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-body)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                {validationError}
              </div>
            </div>
            <button
              onClick={() => setValidationError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "1rem",
                lineHeight: 1,
                padding: "2px",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
