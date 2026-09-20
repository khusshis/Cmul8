"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, Square, Save, Loader2, Home, ChevronRight, ChevronDown, Edit2, Check, Settings, X, Share2, Sparkles, Clock, BarChart2, Activity, Code2, Undo2, Redo2, MoreHorizontal, Zap, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { JustCmul8Icon } from "@/components/ui/JustCmul8Icon";
import { toast } from "@/components/ui/Toast";
import type { StarterGraph } from "@/lib/simulation/simTypeRegistry";
import type { SimTick, SimResult, SimTypeId, PyodideStatus, SimGraph, SimulationEngine } from "@/lib/simulation/types";
import { toSimulationRunRow } from "@/lib/simulation/resultPersistence";
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
import { validateGraphConnectivity } from "@/components/workspace/NodeCanvas";
import type { NodeCanvasHandle } from "@/components/workspace/NodeCanvas";
import { usePresence } from "@/lib/realtime/usePresence";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import type { OptimizerFix } from "@/app/api/ai/optimize/route";

// Dynamic imports for workspace components (stubs in Phase 4)
import NodeCanvas from "@/components/workspace/NodeCanvas";
import AIChatPanel from "@/components/workspace/AIChatPanel";
import NodePalette from "@/components/workspace/NodePalette";
import NodePropertiesPanel from "@/components/workspace/NodePropertiesPanel";
import SimResultsPanel from "@/components/workspace/SimResultsPanel";
import TemplateGallery from "@/components/workspace/TemplateGallery";
import ShareExportModal from "@/components/workspace/ShareExportModal";
import AdvancedResultsDashboard from "@/components/workspace/AdvancedResultsDashboard";
import MonteCarloPanel from "@/components/workspace/MonteCarloPanel";
import DigitalTwinCanvas, { type TwinViewport, type TwinFrameInfo } from "@/components/workspace/DigitalTwinCanvas";
import PlaybackControls from "@/components/workspace/PlaybackControls";
import LiveCursor from "@/components/workspace/LiveCursor";
import { CodeInspectorPanel } from "@/components/workspace/CodeInspectorPanel";

export type SimState = "idle" | "running" | "paused";

interface Project {
  id: string;
  name: string;
  sim_type: string;
  graph_json: { nodes: any[]; edges: any[] };
}

interface HistorySnapshot {
  nodes: any[];
  edges: any[];
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

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [saved, setSaved] = useState(true);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoingRef = useRef(false);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<"ai" | "properties">("properties");
  const [galleryDismissed, setGalleryDismissed] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [monteCarloOpen, setMonteCarloOpen] = useState(false);
  const [digitalTwinActive, setDigitalTwinActive] = useState(false);
  const [codeInspectorOpen, setCodeInspectorOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [twinPlaying, setTwinPlaying] = useState(true);
  const [twinSpeed, setTwinSpeed] = useState(2);
  const [twinViewport, setTwinViewport] = useState<TwinViewport>({ x: 0, y: 0, zoom: 1 });
  const [twinReplayKey, setTwinReplayKey] = useState(0);
  const [twinFrame, setTwinFrame] = useState<TwinFrameInfo>({ index: 0, total: 0, simTime: 0 });
  // Every tick of the current run; the SimPy worker finishes in a burst, so the twin replays from this buffer at a watchable pace.
  const tickBufferRef = useRef<SimTick[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  // Simulation state placeholders
  const [simState, setSimState] = useState<SimState>("idle");
  const [simTick, setSimTick] = useState<SimTick | null>(null);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [pyodideStatus, setPyodideStatus] = useState<PyodideStatus>({ phase: "idle" });
  const [fallbackBannerDismissed, setFallbackBannerDismissed] = useState(false);
  const [runSavedPulse, setRunSavedPulse] = useState(false);

  const [speed, setSpeed] = useState(5);
  const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false);
  const speedOptions = [1, 2, 5, 10, 50];

  const [durationValue, setDurationValue] = useState(100);
  const [durationUnit, setDurationUnit] = useState<"secs" | "mins" | "hrs" | "days">("mins");
  const [durationUnitOpen, setDurationUnitOpen] = useState(false);
  const unitMultipliers: Record<string, number> = {
    secs: 1,
    mins: 60,
    hrs: 3600,
    days: 86400,
  };

  const twinNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        x: (n.position?.x ?? 0) + (n.measured?.width ?? n.width ?? 160) / 2,
        y: (n.position?.y ?? 0) + (n.measured?.height ?? n.height ?? 80) / 2,
        label: (n.data as any)?.label || n.id,
      })),
    [nodes]
  );
  const twinEdges = useMemo(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    [edges]
  );

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const canvasRef = useRef<NodeCanvasHandle>(null);
  const projectRef = useRef<Project | null>(null);
  const runStartTimeRef = useRef<number>(0);
  const throttleRef = useRef(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const nodeDataBroadcastTimer = useRef<NodeJS.Timeout | null>(null);

  const { users: remoteUsers, broadcastOp, onRemoteOp, updatePresence } = usePresence(
    project?.id || "",
    currentUser?.id || "",
    currentUser?.email?.split("@")[0] || "Someone"
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    updatePresence({
      selectedNodeId,
      editingNodeId: activeRightPanel === "properties" ? selectedNodeId : null,
    });
  }, [selectedNodeId, activeRightPanel, updatePresence]);

  useEffect(() => {
    const engine = new PyodideSimEngine();
    // The worker emits ~1000 ticks in a burst; the twin reads the full buffer, but React state
    // (HUD + node stats) only needs ~7 updates/sec, otherwise every tick re-renders the whole page.
    let latestTick: SimTick | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushTick = () => {
      flushTimer = null;
      if (latestTick) setSimTick(latestTick);
    };
    engine.onTick((tick) => {
      tickBufferRef.current.push(tick);
      latestTick = tick;
      if (!flushTimer) flushTimer = setTimeout(flushTick, 150);
    });
    engine.onComplete(async (rawResult) => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTick();
      setSimState("idle");
      const currentSimGraph = graphToSimNodes(nodesRef.current, edgesRef.current);
      const result = enrichSimResult(rawResult, currentSimGraph);
      setSimResult(result);

      if (projectRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const durationSeconds = (Date.now() - runStartTimeRef.current) / 1000;
          const row = toSimulationRunRow(projectRef.current.id, user.id, result, durationSeconds);
          const { error } = await supabase.from("simulation_runs").insert(row);
          if (error) {
            console.warn("Failed to save simulation run to history:", error.message);
          } else {
            setRunSavedPulse(true);
            setTimeout(() => setRunSavedPulse(false), 2000);
          }
        }
      }
    });
    engine.onStatus((status) => setPyodideStatus(status));
    engine.onError((err) => {
      toast.error(String(err), "Simulation Error");
      setSimState("idle");
    });
    engine.init();
    engineRef.current = engine;

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      engine.stop();
    };
  }, []);

  // Record history snapshot helper
  const recordHistory = useCallback((newNodes: any[], newEdges: any[]) => {
    if (isUndoRedoingRef.current) return;

    try {
      const clonedNodes = JSON.parse(JSON.stringify(newNodes));
      const clonedEdges = JSON.parse(JSON.stringify(newEdges));

      setHistory((prev) => {
        const curIdx = historyIndexRef.current;
        const base = curIdx >= 0 ? prev.slice(0, curIdx + 1) : [];

        // Check if identical to last snapshot
        const last = base[base.length - 1];
        if (
          last &&
          JSON.stringify(last.nodes) === JSON.stringify(clonedNodes) &&
          JSON.stringify(last.edges) === JSON.stringify(clonedEdges)
        ) {
          return prev;
        }

        const next = [...base, { nodes: clonedNodes, edges: clonedEdges }];
        if (next.length > 50) {
          next.shift();
        }
        const nextIdx = next.length - 1;
        historyIndexRef.current = nextIdx;
        setHistoryIndex(nextIdx);
        return next;
      });
    } catch (e) {
      console.error("Failed to record history", e);
    }
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    const curIdx = historyIndexRef.current;
    if (curIdx <= 0 || historyRef.current.length === 0) return;

    const targetIdx = curIdx - 1;
    const snapshot = historyRef.current[targetIdx];
    if (!snapshot) return;

    isUndoRedoingRef.current = true;
    historyIndexRef.current = targetIdx;
    setHistoryIndex(targetIdx);

    const restoredNodes = JSON.parse(JSON.stringify(snapshot.nodes));
    const restoredEdges = JSON.parse(JSON.stringify(snapshot.edges));

    setNodes(restoredNodes);
    setEdges(restoredEdges);
    triggerAutoSave(restoredNodes, restoredEdges);
    toast.info("Action undone", "Undo");

    setTimeout(() => {
      isUndoRedoingRef.current = false;
    }, 150);
  }, []);

  const handleRedo = useCallback(() => {
    const curIdx = historyIndexRef.current;
    if (curIdx >= historyRef.current.length - 1 || curIdx < 0) return;

    const targetIdx = curIdx + 1;
    const snapshot = historyRef.current[targetIdx];
    if (!snapshot) return;

    isUndoRedoingRef.current = true;
    historyIndexRef.current = targetIdx;
    setHistoryIndex(targetIdx);

    const restoredNodes = JSON.parse(JSON.stringify(snapshot.nodes));
    const restoredEdges = JSON.parse(JSON.stringify(snapshot.edges));

    setNodes(restoredNodes);
    setEdges(restoredEdges);
    triggerAutoSave(restoredNodes, restoredEdges);
    toast.info("Action redone", "Redo");

    setTimeout(() => {
      isUndoRedoingRef.current = false;
    }, 150);
  }, []);

  // Keyboard Shortcuts for Undo & Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (modKey && e.key.toLowerCase() === "y") ||
        (modKey && e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUser({ id: user.id, email: user.email || "" });

    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error || !data) {
      console.error("Failed to load project", error);
      router.push("/dashboard");
      return;
    }

    setProject(data);
    projectRef.current = data;
    const parsedGraph = data.graph_json || { nodes: [], edges: [] };
    const initNodes = parsedGraph.nodes || [];
    const initEdges = parsedGraph.edges || [];
    setNodes(initNodes);
    setEdges(initEdges);
    
    // Initialize undo history with initial canvas
    const initSnap = [{ nodes: JSON.parse(JSON.stringify(initNodes)), edges: JSON.parse(JSON.stringify(initEdges)) }];
    setHistory(initSnap);
    historyRef.current = initSnap;
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    
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

  useEffect(() => {
    onRemoteOp((op) => {
      if (op.kind === "nodes") {
        onUpdateNodes((prev) => applyNodeChanges(op.changes, prev));
      } else if (op.kind === "edges") {
        onUpdateEdges((prev) => applyEdgeChanges(op.changes, prev));
      } else if (op.kind === "nodeData") {
        const payload = op.changes?.[0];
        if (payload && payload.id && payload.partialData) {
          onUpdateNodes((prev) =>
            prev.map((n) =>
              n.id === payload.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      ...payload.partialData,
                      params: payload.partialData.params
                        ? { ...(n.data?.params || {}), ...payload.partialData.params }
                        : n.data?.params,
                    },
                  }
                : n
            )
          );
        }
      }
    });
  }, [onRemoteOp]);

  function handleNodesChange(changes: NodeChange[]) {
    onUpdateNodes((prev) => {
      const next = applyNodeChanges(changes, prev);
      const hasStructureChange = changes.some(
        (c) => c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      if (hasStructureChange) {
        recordHistory(next, edgesRef.current);
      }
      return next;
    });
    broadcastOp({ kind: "nodes", changes });
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    onUpdateEdges((prev) => {
      const next = applyEdgeChanges(changes, prev);
      const hasStructureChange = changes.some(
        (c) => c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      if (hasStructureChange) {
        recordHistory(nodesRef.current, next);
      }
      return next;
    });
    broadcastOp({ kind: "edges", changes });
  }

  function handleNodeDragStop() {
    recordHistory(nodesRef.current, edgesRef.current);
  }

  function handleSelectNode(id: string | null) {
    setSelectedNodeId(id);
    if (id) setActiveRightPanel("properties");
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

  function applyOptimizerFix(fix: OptimizerFix) {
    const updatedNodes = nodes.map((n) => {
      if (n.id === fix.nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            params: {
              ...(n.data?.params || {}),
              ...fix.paramPatch,
            },
          },
        };
      }
      return n;
    });

    onUpdateNodes(() => updatedNodes);
    recordHistory(updatedNodes, edges);
    toast.success(`Applied fix: ${fix.description}`, "Optimization Applied");
  }

  function handleRun() {
    const validation = validateGraphConnectivity(nodes, edges);
    if (!validation.valid) {
      toast.warning(validation.message, "Incomplete Network");
      return;
    }

    const unitMultipliers: Record<string, number> = {
      secs: 1,
      mins: 60,
      hrs: 3600,
      days: 86400,
    };
    const totalDurationSeconds = Math.max(1, (durationValue || 1) * (unitMultipliers[durationUnit] || 60));
    // F-6: 100 ticks is too coarse to integrate WIP (~11% error, ~8% low bias on
    // M/M/1) and short runs could not even reach 100 samples -- Math.round meant a
    // 5 s run produced 5 ticks. 1000 samples lands within 0.5% of the true value.
    const tickInterval = Math.max(0.05, totalDurationSeconds / 1000);

    const simGraph = graphToSimNodes(nodes, edges);
    if (engineRef.current && project) {
      setSimTick(null);
      setSimResult(null);
      tickBufferRef.current.length = 0;
      setDigitalTwinActive(true);
      setSimState("running");
      runStartTimeRef.current = Date.now();
      engineRef.current.start({
        graph: simGraph,
        simType: project.sim_type as SimTypeId,
        durationSeconds: totalDurationSeconds,
        speedMultiplier: speed,
        tickIntervalSeconds: tickInterval,
      });
    }
  }

  function handlePause() {
    if (engineRef.current) {
      if (pyodideStatus.phase !== "error" && !pyodideStatus.fallbackActive) {
        toast.info("This simulation runs synchronously on SimPy and cannot be paused mid-flight — use Stop to restart instead.", "Pause Not Supported");
      } else {
        engineRef.current.pause();
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
    recordHistory(rfNodes, rfEdges);
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
      <div className="flex-shrink-0 h-[60px] flex items-center justify-between px-4 border-b border-gray-100 bg-white min-w-0 overflow-x-auto">
        
        {/* Left Section: Logo, Breadcrumbs, Undo/Redo */}
        <div className="flex items-center gap-3 shrink-0 min-w-0 mr-3">
          {/* Logo Section */}
          <Link href="/dashboard" className="flex items-center gap-2 group cursor-pointer shrink-0" title="Go to Dashboard">
            <img src="/logo-transparent.png" alt="JustCmul8" className="w-8 h-8 object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-extrabold text-[15px] text-[#111827] group-hover:text-[#5742FF] transition-colors leading-[1.1] tracking-tight whitespace-nowrap">JustCmul8</span>
              <span className="text-[10px] text-[#5742FF] font-medium leading-[1.1] whitespace-nowrap">Model. Simulate. Optimize.</span>
            </div>
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 shrink-0" />

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-400 shrink-0 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-1 hover:text-[#5742FF] transition-colors shrink-0 whitespace-nowrap">
              <Home size={14} /> My Simulations
            </Link>
            <ChevronRight size={13} className="text-gray-300 shrink-0" />
            <div className="flex items-center gap-1 text-[#111827] font-bold cursor-pointer group hover:text-[#5742FF] transition-colors shrink-0">
              <span className="max-w-[120px] lg:max-w-[160px] truncate">{project?.name || "Loading..."}</span>
              <ChevronDown size={13} className="text-gray-400 group-hover:text-[#5742FF] transition-colors shrink-0" />
              <Edit2 size={12} className="text-gray-400 group-hover:text-[#5742FF] transition-colors ml-0.5 shrink-0" />
            </div>
          </div>

          {/* Undo / Redo Toolbar Controls */}
          <div className="flex items-center bg-gray-50 border border-gray-200/80 rounded-full p-0.5 shadow-xs shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="flex items-center justify-center w-7 h-7 rounded-full text-gray-700 hover:text-[#5742FF] hover:bg-white hover:shadow-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-700 active:scale-95"
            >
              <Undo2 size={14} strokeWidth={2.4} />
            </button>
            <div className="w-px h-3 bg-gray-200 mx-0.5" />
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              aria-label="Redo"
              className="flex items-center justify-center w-7 h-7 rounded-full text-gray-700 hover:text-[#5742FF] hover:bg-white hover:shadow-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-700 active:scale-95"
            >
              <Redo2 size={14} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Right Section: Simulation Status, Controls, HUD, More Tools, Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          
          {/* Engine Status (Circular Icon with Tooltip) */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs shrink-0 cursor-pointer border transition-colors ${
              pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy"
                ? "bg-amber-50 border-amber-200 text-amber-600"
                : pyodideStatus.phase === "error"
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : "bg-emerald-50 border-emerald-200/80 text-emerald-600"
            }`}
            title={
              pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy"
                ? "Simulation Engine: Loading SimPy runtime..."
                : pyodideStatus.phase === "error"
                ? "Simulation Engine: Error (Fallback active)"
                : "Simulation Engine: SimPy Ready"
            }
          >
            {pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : pyodideStatus.phase === "error" ? (
              <AlertCircle size={14} strokeWidth={2.4} />
            ) : (
              <Zap size={14} strokeWidth={2.4} fill="currentColor" />
            )}
          </div>

          {/* Saved Status (Circular Icon with Tooltip) */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs shrink-0 cursor-pointer border transition-colors ${
              saved
                ? "bg-emerald-50 border-emerald-200/80 text-emerald-600"
                : "bg-amber-50 border-amber-200 text-amber-600"
            }`}
            title={saved ? (runSavedPulse ? "Run saved to history!" : "All changes saved to cloud") : "Saving changes..."}
          >
            {saved ? (
              <Check size={14} strokeWidth={2.6} className={runSavedPulse ? "text-blue-600 animate-pulse" : ""} />
            ) : (
              <Loader2 size={14} className="animate-spin text-amber-600" />
            )}
          </div>

          {/* Simulation Duration Control Pill */}
          <div className="relative flex items-center h-[32px] rounded-full bg-white border border-gray-200 text-[#111827] shadow-xs px-2 text-[12px] font-bold shrink-0 whitespace-nowrap">
            <div className="flex items-center pl-0.5 pr-1 text-gray-400">
              <Clock size={13} strokeWidth={2.3} className="text-[#5742FF] shrink-0" />
            </div>

            <input
              type="number"
              min={1}
              max={99999}
              value={durationValue}
              onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={simState === "running"}
              className="w-10 h-5 px-1 text-center font-extrabold text-[12px] text-[#111827] bg-gray-50 rounded border border-gray-200 focus:bg-white focus:border-[#5742FF] focus:outline-none transition-all disabled:opacity-50"
              title="Simulation Duration"
            />

            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setDurationUnitOpen((o) => !o)}
                disabled={simState === "running"}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11.5px] font-bold text-gray-700 hover:text-[#5742FF] transition-colors rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <span>{durationUnit}</span>
                <ChevronDown size={11} strokeWidth={2.5} className="text-gray-400 shrink-0" />
              </button>

              {durationUnitOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDurationUnitOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-28 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
                    <div className="px-3 py-1 text-[9.5px] font-extrabold text-gray-400 uppercase tracking-widest">
                      Unit
                    </div>
                    {[
                      { id: "secs", label: "secs" },
                      { id: "mins", label: "mins" },
                      { id: "hrs", label: "hrs" },
                      { id: "days", label: "days" },
                    ].map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setDurationUnit(u.id as any);
                          setDurationUnitOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-1.5 text-[12px] font-bold hover:bg-[#F8F7FF] flex items-center justify-between transition-colors ${
                          durationUnit === u.id ? "text-[#5742FF] bg-indigo-50/60" : "text-gray-700"
                        }`}
                      >
                        <span>{u.label}</span>
                        {durationUnit === u.id && <Check size={13} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Run Button with Speed Control */}
          <div className="relative flex items-center shadow-xs h-[32px] shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={handleRun}
              disabled={simState === "running" || pyodideStatus.phase === "loading_runtime" || pyodideStatus.phase === "loading_simpy"}
              className="flex items-center h-full gap-1.5 pl-3.5 pr-2.5 rounded-l-full bg-[#5742FF] text-white text-[12.5px] font-bold hover:bg-[#4531E5] disabled:opacity-50 transition-colors border-r border-[#4531E5]"
            >
              <Play size={13} fill="currentColor" className="shrink-0" /> Run
            </button>
            <button
              type="button"
              onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
              className="flex items-center justify-center h-full pl-1.5 pr-2.5 rounded-r-full bg-[#5742FF] text-white hover:bg-[#4531E5] transition-colors disabled:opacity-50"
              title="Select Simulation Speed"
            >
              <ChevronDown size={13} strokeWidth={2.5} />
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
                        if (engineRef.current?.updateSpeed) engineRef.current.updateSpeed(s);
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

          {/* Pause (Circular Button) */}
          <button
            type="button"
            onClick={handlePause}
            disabled={simState !== "running" || (pyodideStatus.phase !== "error" && !pyodideStatus.fallbackActive)}
            title={
              pyodideStatus.phase !== "error" && !pyodideStatus.fallbackActive
                ? "Pause is not supported for synchronous SimPy simulations — use Stop instead"
                : "Pause Simulation"
            }
            aria-label="Pause"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-700 hover:text-[#5742FF] hover:bg-gray-50 disabled:opacity-40 transition-all shadow-xs disabled:cursor-not-allowed shrink-0 active:scale-95"
          >
            <Pause size={13} fill="currentColor" />
          </button>

          {/* Stop (Circular Button) */}
          <button
            type="button"
            onClick={handleStop}
            disabled={simState === "idle"}
            title="Stop Simulation"
            aria-label="Stop"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-40 transition-all shadow-xs shrink-0 active:scale-95"
          >
            <Square size={12} fill="currentColor" />
          </button>

          {/* Live Simulation Clock & Progress HUD */}
          {(simState === "running" || simState === "paused" || simTick) && (() => {
            const unitMult = unitMultipliers[durationUnit] || 60;
            const currentSecs = simTick?.simTime ?? (simResult?.totalSimTime ?? 0);
            const totalSecs = Math.max(1, (durationValue || 1) * unitMult);
            const currentVal = (currentSecs / unitMult).toFixed(1);
            const pct = Math.min(100, Math.round((currentSecs / totalSecs) * 100));
            return (
              <div className="flex items-center gap-2 h-[32px] px-3 rounded-full bg-[#F5F3FF] border border-indigo-100 text-[#1E1B4B] text-[11.5px] font-bold shadow-xs shrink-0 whitespace-nowrap">
                <div className="flex items-center gap-1 text-[#5742FF]">
                  <Clock size={12} strokeWidth={2.5} className="shrink-0" />
                  <span>{currentVal}/{durationValue} {durationUnit}</span>
                </div>
                <span className="text-indigo-200">|</span>
                <span className="text-emerald-600 font-extrabold" title="Total Entities Arrived">↑{simTick?.totalArrived ?? 0}</span>
                <span className="text-[#5742FF] font-extrabold" title="Total Entities Completed">↓{simTick?.totalCompleted ?? 0}</span>
                <div className="w-10 h-1.5 bg-indigo-200/60 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-[#5742FF] rounded-full transition-all duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10.5px] font-extrabold text-gray-500">{pct}%</span>
              </div>
            );
          })()}

          {/* Triple-Dot More Options Dropdown (Monte Carlo, Digital Twin, Code Inspector) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((v) => !v)}
              className={`relative flex items-center justify-center w-8 h-8 rounded-full border transition-all shadow-xs active:scale-95 ${
                digitalTwinActive || moreMenuOpen
                  ? "bg-indigo-50 border-[#5742FF] text-[#5742FF]"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-[#5742FF]"
              }`}
              title="More Options (Digital Twin, Monte Carlo, Python Code)"
              aria-label="More Options"
            >
              <MoreHorizontal size={15} strokeWidth={2.4} />
              {digitalTwinActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#5742FF] rounded-full border-2 border-white" />
              )}
            </button>

            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Simulation Views & Tools
                  </div>

                  {/* Digital Twin 2D Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setDigitalTwinActive((d) => !d);
                      setMoreMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[#F8F7FF] flex items-center justify-between transition-colors ${
                      digitalTwinActive ? "text-[#5742FF] bg-indigo-50/50" : "text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${digitalTwinActive ? "bg-[#5742FF] text-white" : "bg-gray-100 text-gray-600"}`}>
                        <Activity size={14} strokeWidth={2.4} />
                      </div>
                      <div>
                        <div className="leading-tight">Digital Twin 2D</div>
                        <div className="text-[10.5px] font-medium text-gray-400">Live 2D physics animation</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${digitalTwinActive ? "bg-[#5742FF] text-white" : "bg-gray-100 text-gray-500"}`}>
                      {digitalTwinActive ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Monte Carlo & Scenario Studio */}
                  <button
                    type="button"
                    onClick={() => {
                      setMonteCarloOpen(true);
                      setMoreMenuOpen(false);
                    }}
                    disabled={simState === "running"}
                    className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[#F8F7FF] flex items-center justify-between transition-colors text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#5742FF] flex items-center justify-center">
                        <BarChart2 size={14} strokeWidth={2.4} />
                      </div>
                      <div>
                        <div className="leading-tight">Monte Carlo Studio</div>
                        <div className="text-[10.5px] font-medium text-gray-400">Multi-run trials & A/B test</div>
                      </div>
                    </div>
                  </button>

                  {/* Python Code Inspector */}
                  <button
                    type="button"
                    onClick={() => {
                      setCodeInspectorOpen(true);
                      setMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[#F8F7FF] flex items-center justify-between transition-colors text-gray-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Code2 size={14} strokeWidth={2.4} />
                      </div>
                      <div>
                        <div className="leading-tight">SimPy Python Code</div>
                        <div className="text-[10.5px] font-medium text-gray-400">Inspect & Export Notebook</div>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {remoteUsers.length > 0 && (
            <div className="flex items-center -space-x-2 shrink-0">
              {remoteUsers.slice(0, 4).map((u) => (
                <div
                  key={u.id}
                  title={u.name}
                  className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-[11px] shadow-xs border-2 border-white shrink-0"
                  style={{ background: u.color }}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {remoteUsers.length > 4 && (
                <div
                  title={remoteUsers.slice(4).map((u) => u.name).join(", ")}
                  className="w-7 h-7 rounded-full bg-gray-500 text-white flex items-center justify-center font-bold text-[11px] shadow-xs border-2 border-white shrink-0"
                >
                  +{remoteUsers.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Right Divider */}
          <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />

          {/* Share Button (Circular) */}
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            title="Share & Export Simulation"
            aria-label="Share"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-700 hover:text-[#5742FF] hover:bg-gray-50 transition-all shadow-xs shrink-0 active:scale-95"
          >
            <Share2 size={14} strokeWidth={2.2} />
          </button>

          {/* Avatar (Circular) */}
          <div className="flex items-center gap-1 cursor-pointer group ml-0.5 shrink-0" title={currentUser?.email || "User Profile"}>
            <div className="w-8 h-8 rounded-full bg-[#5742FF] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {currentUser?.email ? currentUser.email[0].toUpperCase() : "M"}
            </div>
            <ChevronDown size={13} className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
          </div>

        </div>
      </div>

      {/* ── Fallback Engine Warning Banner ── */}
      {pyodideStatus.fallbackActive && !fallbackBannerDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-[12px] text-amber-900 font-medium z-30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-800">⚠️ Approximate engine in use:</span>
            <span>The SimPy runtime could not load, so this run used the built-in fallback engine. Results are indicative. Reload to retry full engine.</span>
          </div>
          <button
            onClick={() => setFallbackBannerDismissed(true)}
            className="text-amber-700 hover:text-amber-950 font-bold ml-3 text-xs"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* ── Main Workspace Row (Palette + Canvas + Config Panel) ─────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {showTemplateGallery && (
          <TemplateGallery
            simType={project?.sim_type || "human_queue"}
            onLoadScenario={onLoadScenario}
            onClose={() => setGalleryDismissed(true)}
          />
        )}
        
        <NodePalette
          simType={project?.sim_type || "human_queue"}
          onAddNode={(type) => canvasRef.current?.addNode(type)}
        />

        <div className="flex-1 relative overflow-hidden">
          <NodeCanvas
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            simType={project?.sim_type || "human_queue"}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            simState={simState}
            simTick={simTick}
            remoteUsers={remoteUsers}
            onBroadcastCursor={(cursor) =>
              broadcastOp({ kind: "cursor", changes: [cursor] })
            }
            onViewportChange={setTwinViewport}
          />

          {digitalTwinActive && (
            <>
              <div className="absolute inset-0 pointer-events-none z-10">
                <DigitalTwinCanvas
                  nodes={twinNodes}
                  edges={twinEdges}
                  tickBufferRef={tickBufferRef}
                  playing={twinPlaying}
                  speed={twinSpeed}
                  viewport={twinViewport}
                  replayKey={twinReplayKey}
                  onFrame={setTwinFrame}
                />
              </div>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <PlaybackControls
                  playing={twinPlaying}
                  onTogglePlay={() => setTwinPlaying((p) => !p)}
                  speed={twinSpeed}
                  onSpeedChange={setTwinSpeed}
                  onClose={() => setDigitalTwinActive(false)}
                  onReplay={() => { setTwinPlaying(true); setTwinReplayKey((k) => k + 1); }}
                  progress={twinFrame}
                />
              </div>
            </>
          )}
        </div>

        <div className="w-[330px] border-l border-gray-100 bg-[#fcfcfd] h-full flex flex-col overflow-hidden shadow-[-2px_0_12px_rgba(0,0,0,0.03)] shrink-0">
          {/* Top Unified Header with Circular Pill Shaped Animated Tab Switcher */}
          <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
            <div className="flex bg-[#F1F2F6] p-1 rounded-full w-full border border-gray-200/60 relative">
              <button
                type="button"
                onClick={() => setActiveRightPanel("ai")}
                className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] font-bold transition-colors duration-200 select-none ${
                  activeRightPanel === "ai"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {activeRightPanel === "ai" && (
                  <motion.div
                    layoutId="activeRightSidebarTabPill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full shadow-[0_2px_10px_rgba(99,102,241,0.35)] -z-10"
                  />
                )}
                <Sparkles size={13} className={activeRightPanel === "ai" ? "text-white" : "text-gray-400"} />
                AI Assistant
              </button>

              <button
                type="button"
                onClick={() => setActiveRightPanel("properties")}
                className={`flex-1 relative z-10 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] font-bold transition-colors duration-200 select-none ${
                  activeRightPanel === "properties"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {activeRightPanel === "properties" && (
                  <motion.div
                    layoutId="activeRightSidebarTabPill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 bg-[#111827] rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.25)] -z-10"
                  />
                )}
                <Settings size={13} className={activeRightPanel === "properties" ? "text-white" : "text-gray-400"} />
                Properties
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
            {activeRightPanel === "properties" ? (
              selectedNodeId && nodes.find((n) => n.id === selectedNodeId) ? (
                <NodePropertiesPanel
                  node={nodes.find((n) => n.id === selectedNodeId)!}
                  simType={project?.sim_type || "human_queue"}
                  onUpdate={(id, partialData) => {
                    const updatedNodes = nodesRef.current.map((n) =>
                      n.id === id
                        ? {
                            ...n,
                            data: {
                              ...n.data,
                              ...partialData,
                              params: partialData.params
                                ? { ...(n.data?.params || {}), ...partialData.params }
                                : n.data?.params,
                            },
                          }
                        : n
                    );
                    onUpdateNodes(() => updatedNodes);
                    recordHistory(updatedNodes, edgesRef.current);
                    if (nodeDataBroadcastTimer.current) {
                      clearTimeout(nodeDataBroadcastTimer.current);
                    }
                    nodeDataBroadcastTimer.current = setTimeout(() => {
                      broadcastOp({
                        kind: "nodeData",
                        changes: [{ id, partialData }],
                      });
                    }, 150);
                  }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-[#9ca3af] px-6">
                  <div className="w-12 h-12 rounded-[14px] bg-[#f5f5fa] flex items-center justify-center mb-1">
                    <Settings size={22} className="text-[#c4c4d0]" />
                  </div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">Select a block on the canvas to configure it.</p>
                </div>
              )
            ) : (
              <AIChatPanel
                project={{ id: project?.id || "", name: project?.name || "", sim_type: project?.sim_type || "human_queue" }}
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNodeId}
                simResult={simResult}
                simState={simState}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                onApplyChanges={(newNodes, newEdges) => {
                  setNodes(newNodes);
                  setEdges(newEdges);
                  recordHistory(newNodes, newEdges);
                  setSaved(false);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {simResult && (
        <SimResultsPanel
          result={simResult}
          simType={(project?.sim_type || "human_queue") as SimTypeId}
          onClose={() => setSimResult(null)}
          onExpand={() => setDashboardOpen(true)}
        />
      )}

      <ShareExportModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} projectId={project?.id || ""} />
      
      <AdvancedResultsDashboard
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        result={simResult}
        simType={(project?.sim_type as SimTypeId) || "human_queue"}
        projectId={project?.id || ""}
        onApplyFix={applyOptimizerFix}
        onCaptureCanvasSnapshot={() => canvasRef.current?.captureSnapshot() ?? Promise.resolve(null)}
      />

      <MonteCarloPanel
        open={monteCarloOpen}
        onClose={() => setMonteCarloOpen(false)}
        currentGraph={graphToSimNodes(nodes, edges)}
        simType={(project?.sim_type as SimTypeId) || "human_queue"}
        durationSeconds={Math.max(1, (durationValue || 1) * (unitMultipliers[durationUnit] || 60))}
        speed={speed}
        tickInterval={Math.max(0.05, Math.max(1, (durationValue || 1) * (unitMultipliers[durationUnit] || 60)) / 1000)}
      />

      <CodeInspectorPanel
        isOpen={codeInspectorOpen}
        onClose={() => setCodeInspectorOpen(false)}
        graph={graphToSimNodes(nodes, edges)}
        projectName={project?.name || "Simulation System"}
        durationSeconds={Math.max(1, (durationValue || 1) * (unitMultipliers[durationUnit] || 60))}
        tickIntervalSeconds={Math.max(0.05, Math.max(1, (durationValue || 1) * (unitMultipliers[durationUnit] || 60)) / 1000)}
        result={simResult}
      />
    </div>
  );
}
