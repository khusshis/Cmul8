"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Pause, Square, Save, Loader2, Home, ChevronRight, ChevronDown, Edit2, Check } from "lucide-react";
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

  const [speed, setSpeed] = useState(5);
  const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false);
  const speedOptions = [1, 2, 5, 10, 50];

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
      return typeof newNodes === "function" ? newNodes(prev) : newNodes;
    });
  }

  function onUpdateEdges(newEdges: any[] | ((e: any[]) => any[])) {
    setEdges((prev) => {
      return typeof newEdges === "function" ? newEdges(prev) : newEdges;
    });
  }

  useEffect(() => {
    if (project && (nodes.length > 0 || edges.length > 0)) {
      triggerAutoSave(nodes, edges);
    }
  }, [nodes, edges]);

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
        speedMultiplier: speed,
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
      type: "simNode",
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FE]">
        <div className="relative flex items-center justify-center mb-6">
          {/* Subtle glowing pulse */}
          <div className="absolute inset-0 bg-[#5742FF] rounded-[20px] blur-[20px] opacity-20 animate-pulse" />
          <div className="w-16 h-16 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center relative z-10 border border-[#E5E0FF]">
            <Loader2 className="w-7 h-7 animate-spin text-[#5742FF]" />
          </div>
        </div>
        <h3 className="text-[#111827] font-extrabold tracking-tight text-xl mb-1.5">Preparing Workspace</h3>
        <p className="text-gray-500 text-[13px]">Initializing your simulation environment...</p>
      </div>
    );
  }

  const showTemplateGallery = nodes.length === 0 && !galleryDismissed;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-surface-sunken text-text-primary">
      {/* ── Top Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-[68px] flex items-center px-5 border-b border-gray-100 bg-white">
        
        {/* Logo Section */}
        <div className="flex items-center gap-2 mr-5">
          <img src="/logo-transparent.png" alt="JustCmul8" className="w-10 h-10 object-contain mix-blend-multiply" />
          <div className="flex flex-col">
            <span className="font-extrabold text-[16px] text-[#111827] leading-[1.1] tracking-tight">JustCmul8</span>
            <span className="text-[10.5px] text-[#5742FF] font-medium leading-[1.1]">Model. Simulate. Optimize.</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 mr-5" />

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-gray-400">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-[#5742FF] transition-colors">
            <Home size={15} /> Dashboard
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <Link href="/dashboard" className="hover:text-[#5742FF] transition-colors">
            My Simulations
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <div className="flex items-center gap-1.5 text-[#111827] font-bold cursor-pointer group hover:text-[#5742FF] transition-colors">
            {project?.name || "Loading..."}
            <ChevronDown size={14} className="text-gray-400 group-hover:text-[#5742FF] transition-colors" />
            <Edit2 size={13} className="text-gray-400 group-hover:text-[#5742FF] transition-colors ml-0.5" />
          </div>
        </div>

        <div className="flex-1" />

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          
          {/* Saved Status */}
          <div className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-emerald-50 border border-emerald-100/60 text-emerald-600 text-[12.5px] font-bold shadow-sm">
            {saved ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                Saved just now
              </>
            ) : (
              <>
                <Loader2 size={12} className="animate-spin text-emerald-500" />
                Saving...
              </>
            )}
          </div>

          {/* Engine Status */}
          <div className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-white border border-gray-200 text-[#111827] text-[12.5px] font-bold shadow-sm">
            <span className="text-gray-400 font-semibold mr-0.5">Engine:</span>
            {pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy" ? (
              <span className="text-orange-500 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Loading
              </span>
            ) : pyodideStatus.phase === "error" ? (
              <span className="text-red-500 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Error
              </span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Ready
              </span>
            )}
          </div>

          {/* Run Button with Speed Control */}
          <div className="relative flex items-center shadow-sm h-[34px]">
            <button
              onClick={handleRun}
              disabled={simState === "running" || pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy"}
              className="flex items-center h-full gap-1.5 pl-4 pr-3 rounded-l-full bg-[#5742FF] text-white text-[13.5px] font-bold hover:bg-[#4531E5] disabled:opacity-50 transition-colors border-r border-[#4531E5]"
            >
              <Play size={14} fill="currentColor" /> Run
            </button>
            <button
              onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
              className="flex items-center justify-center h-full pl-2 pr-3 rounded-r-full bg-[#5742FF] text-white hover:bg-[#4531E5] transition-colors disabled:opacity-50"
            >
              <ChevronDown size={14} strokeWidth={2.5} />
            </button>
            
            {/* Speed Dropdown */}
            {speedDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSpeedDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-3 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Speed</div>
                  {speedOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setSpeed(s);
                        if (engineRef.current) engineRef.current.updateSpeed(s);
                        setSpeedDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[13px] font-bold hover:bg-[#F8F7FF] flex items-center justify-between transition-colors ${speed === s ? 'text-[#5742FF]' : 'text-gray-600'}`}
                    >
                      {s}x
                      {speed === s && <Check size={14} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pause */}
          <button
            onClick={handlePause}
            disabled={simState !== "running"}
            className="flex items-center justify-center h-[34px] gap-1.5 px-4 rounded-full bg-white border border-gray-200 text-[#111827] text-[13.5px] font-bold hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Pause size={14} fill="currentColor" /> Pause
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            disabled={simState === "idle"}
            className="flex items-center justify-center h-[34px] gap-1.5 px-4 rounded-full bg-white border border-gray-200 text-[#111827] text-[13.5px] font-bold hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Square size={13} fill="currentColor" /> Stop
          </button>

          {/* Right Divider */}
          <div className="w-px h-8 bg-gray-200 ml-1" />

          {/* Avatar */}
          <div className="flex items-center gap-1.5 cursor-pointer group ml-1">
            <div className="w-8 h-8 rounded-full bg-[#5742FF] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              M
            </div>
            <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </div>

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
