"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Pause, Square, Save, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { JustCmul8Icon } from "@/components/ui/JustCmul8Icon";
import type { StarterGraph } from "@/lib/simulation/simTypeRegistry";
import type { SimTick, SimResult, SimTypeId, PyodideStatus, SimGraph, SimulationEngine } from "@/lib/simulation/types";
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
import { validateGraphConnectivity } from "@/components/workspace/NodeCanvas";

// Dynamic imports for workspace components (stubs in Phase 4)
import NodeCanvas from "@/components/workspace/NodeCanvas";
import AIChatPanel from "@/components/workspace/AIChatPanel";
import NodePalette from "@/components/workspace/NodePalette";
import NodePropertiesPanel from "@/components/workspace/NodePropertiesPanel";
import SimResultsPanel from "@/components/workspace/SimResultsPanel";
import TemplateGallery from "@/components/workspace/TemplateGallery";

export type SimState = "idle" | "running" | "paused";

interface Project {
  id: string;
  name: string;
  sim_type: string;
  graph_json: { nodes: any[]; edges: any[] };
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [saved, setSaved] = useState(true);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<"ai" | "properties">("ai");
  const [galleryDismissed, setGalleryDismissed] = useState(false);

  // Simulation state placeholders
  const [simState, setSimState] = useState<SimState>("idle");
  const [simTick, setSimTick] = useState<SimTick | null>(null);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [pyodideStatus, setPyodideStatus] = useState<PyodideStatus>({ phase: "idle" });

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);

  useEffect(() => {
    const engine = new PyodideSimEngine();
    engine.onTick((tick) => setSimTick(tick));
    engine.onComplete((result) => {
      setSimState("idle");
      setSimResult(result);
    });
    engine.onStatus((status) => setPyodideStatus(status));
    engine.onError((err) => {
      alert(`Simulation Error: ${err}`);
      setSimState("idle");
    });
    engine.init();
    engineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, []);

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error || !data) {
      console.error("Failed to load project", error);
      router.push("/dashboard");
      return;
    }

    setProject(data);
    const parsedGraph = data.graph_json || { nodes: [], edges: [] };
    setNodes(parsedGraph.nodes || []);
    setEdges(parsedGraph.edges || []);
    setLoading(false);
  }

  // Auto-save logic
  function onUpdateNodes(newNodes: any[] | ((n: any[]) => any[])) {
    setNodes((prev) => {
      const updated = typeof newNodes === "function" ? newNodes(prev) : newNodes;
      triggerAutoSave(updated, edges);
      return updated;
    });
  }

  function onUpdateEdges(newEdges: any[] | ((e: any[]) => any[])) {
    setEdges((prev) => {
      const updated = typeof newEdges === "function" ? newEdges(prev) : newEdges;
      triggerAutoSave(nodes, updated);
      return updated;
    });
  }

  function handleNodesChange(changes: NodeChange[]) {
    onUpdateNodes((prev) => applyNodeChanges(changes, prev));
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    onUpdateEdges((prev) => applyEdgeChanges(changes, prev));
  }

  function triggerAutoSave(n: any[], e: any[]) {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(n, e), 1500);
  }

  async function autoSave(n: any[], e: any[]) {
    if (!project) return;
    await supabase.from("projects").update({
      graph_json: { nodes: n, edges: e },
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);
    setSaved(true);
  }

  function graphToSimNodes(rfNodes: any[], rfEdges: any[]): SimGraph {
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

  function handleRun() {
    const validation = validateGraphConnectivity(nodes, edges);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    const simGraph = graphToSimNodes(nodes, edges);
    if (engineRef.current && project) {
      setSimTick(null);
      setSimResult(null);
      setSimState("running");
      engineRef.current.start({
        graph: simGraph,
        simType: project.sim_type as SimTypeId,
        durationSeconds: 3600, // Default 1 hour simulation
        speedMultiplier: 1,
        tickIntervalSeconds: 60,
      });
    }
  }

  function handlePause() {
    if (engineRef.current) {
      engineRef.current.pause();
      if (pyodideStatus.phase !== "error") {
        // Warning: pause is not supported on Pyodide. The engine will gracefully ignore it
        // but we'll show an alert just so the user knows.
        console.warn("Pause not supported on Pyodide. Engine continues running.");
      } else {
        setSimState("paused");
      }
    }
  }

  function handleStop() {
    if (engineRef.current) {
      engineRef.current.stop();
      setSimState("idle");
      setSimTick(null);
    }
  }

  function onLoadScenario(starter: StarterGraph) {
    // Basic mapping, full RF node mapping in Phase 5
    const rfNodes = starter.nodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: { label: n.label, nodeType: n.nodeType, params: n.params },
    }));
    const rfEdges = starter.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));
    
    setNodes(rfNodes);
    setEdges(rfEdges);
    triggerAutoSave(rfNodes, rfEdges);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-surface-sunken">
        <Loader2 className="w-8 h-8 animate-spin text-color-info" />
      </div>
    );
  }

  const showTemplateGallery = nodes.length === 0 && !galleryDismissed;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-surface-sunken text-text-primary">
      {/* ── Top Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-14 flex items-center gap-4 px-4 border-b border-border bg-surface">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-color-info transition-colors"
        >
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <div className="w-px h-6 bg-border" />
        <JustCmul8Icon width={20} height={20} className="text-color-info" />
        <span className="font-semibold text-text-primary truncate max-w-xs">
          {project?.name}
        </span>

        <div className="flex items-center gap-2 ml-4 text-xs font-mono text-text-muted">
          {saved ? (
            <span className="flex items-center gap-1"><Save size={12} /> Saved</span>
          ) : (
            <span className="flex items-center gap-1 animate-pulse"><Loader2 size={12} className="animate-spin" /> Saving...</span>
          )}
        </div>

        <div className="flex-1" />

        {/* ── Engine Status ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mr-4 text-xs font-mono">
          {pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy" ? (
            <span className="text-color-warning flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Loading Engine...
            </span>
          ) : pyodideStatus.phase === "error" ? (
            <span className="text-color-error">Fallback Engine (JS)</span>
          ) : pyodideStatus.phase === "ready" ? (
            <span className="text-color-success">Engine Ready</span>
          ) : null}
        </div>

        {/* ── Sim Controls ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 bg-bg-surface-sunken p-1 rounded-lg border border-border">
          <button
            onClick={handleRun}
            disabled={simState === "running" || pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy"}
            className="btn-primary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-50"
          >
            <Play size={14} /> RUN
          </button>
          <button
            onClick={handlePause}
            disabled={simState !== "running"}
            className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-50"
          >
            <Pause size={14} /> PAUSE
          </button>
          <button
            onClick={handleStop}
            disabled={simState === "idle"}
            className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-50"
          >
            <Square size={14} /> STOP
          </button>
        </div>
      </div>

      {/* ── Main Workspace Area ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {showTemplateGallery && (
          <TemplateGallery
            simType={project?.sim_type || "human_queue"}
            onLoadScenario={onLoadScenario}
            onClose={() => setGalleryDismissed(true)}
          />
        )}
        
        <NodePalette
          simType={project?.sim_type || "human_queue"}
          onAddNode={() => {}}
        />

        <div className="flex-1 relative">
          <NodeCanvas
            nodes={nodes}
            edges={edges}
            simType={project?.sim_type || "human_queue"}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            simState={simState}
            simTick={simTick}
          />
        </div>

        <div className="relative">
          {activeRightPanel === "properties" ? (
            <NodePropertiesPanel
              node={nodes.find((n) => n.id === selectedNodeId) || {}}
              simType={project?.sim_type || "human_queue"}
              onUpdate={(id, partialData) => {
                onUpdateNodes((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...partialData } } : n))
                );
              }}
            />
          ) : (
            <AIChatPanel
              project={{ id: project?.id || "", name: project?.name || "", sim_type: project?.sim_type || "human_queue" }}
              nodes={nodes}
              edges={edges}
              onApplyChanges={(newNodes, newEdges) => {
                setNodes(newNodes);
                setEdges(newEdges);
                setSaved(false);
              }}
            />
          )}

          {/* Panel Toggle */}
          <div className="absolute top-4 -left-32 flex bg-surface rounded-full border border-border p-1 shadow-sm">
            <button
              onClick={() => setActiveRightPanel("ai")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                activeRightPanel === "ai" ? "bg-bg-surface-sunken text-color-info" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              AI
            </button>
            <button
              onClick={() => setActiveRightPanel("properties")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                activeRightPanel === "properties" ? "bg-bg-surface-sunken text-color-info" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Props
            </button>
          </div>
        </div>
      </div>

      {simResult && (
        <SimResultsPanel
          result={simResult}
          simType={(project?.sim_type || "human_queue") as SimTypeId}
          onClose={() => setSimResult(null)}
        />
      )}
    </div>
  );
}
