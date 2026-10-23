"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { X, Scale, BarChart2, RefreshCw } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import { toast } from "@/components/ui/Toast";
import type { PyodideStatus, SimGraph, SimTypeId } from "@/lib/simulation/types";
import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
import { enrichSimResult } from "@/lib/simulation/analyticsEngine";
import { runMonteCarlo, isAbortError } from "@/lib/simulation/monteCarloRunner";
import { mergeScenario } from "@/lib/simulation/scenarioDiff";
import { loadSettings, pinHistory, runHistory, saveSettings, scenarioLibrary, type HistoryEntry, type LibraryScenario } from "@/lib/simulation/mcStorage";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import StressTab from "./montecarlo/StressTab";
import CompareTab, { MAX_SCENARIOS, scenarioFromCanvas } from "./montecarlo/CompareTab";
import type { LabScenario } from "./montecarlo/ScenarioPane";
import type { BatchKind, ErrorInfo, RunEnriched, StartBatch } from "./montecarlo/graphUtils";
import { ProgressCard, focusRing, getMetricMeta } from "./montecarlo/shared";
import { DEFAULT_SETTINGS, normalizeSettings, type LabSettings } from "./montecarlo/settings";

type Slot = "A" | "B";
type Batch = { kind: BatchKind; title: string; status: string; completed: number; total: number };

function engineStatusText(s: PyodideStatus): string | null {
  switch (s.phase) {
    case "loading_runtime": return "Loading the Python simulation engine. First time only, this can take 10 to 30 seconds.";
    case "loading_simpy": return "Installing SimPy, the simulation library. Almost ready.";
    case "error": return "The Python engine couldn't load, so runs use the built-in engine instead.";
    default: return null;
  }
}

function errorText(e: unknown): ErrorInfo {
  const raw = e instanceof Error ? e.message : String(e);
  if (/pyodide|importScripts|failed to fetch|network/i.test(raw)) {
    return { title: "Couldn't load the simulation engine", message: "The Python engine failed to download (check your connection). Try again and the built-in engine will take over." };
  }
  return { title: "The batch stopped with an error", message: raw.length > 400 ? `${raw.slice(0, 400)}…` : raw };
}

interface MonteCarloPanelProps {
  open: boolean;
  onClose: () => void;
  currentGraph: SimGraph;
  /** Live React Flow nodes/edges of the main canvas (selection included) for scenario capture. */
  canvasNodes: Node[];
  canvasEdges: Edge[];
  /** Set by the canvas "Compare as A/B" bar; `at` makes repeated sends to the same slot re-trigger. */
  sendRequest?: { slot: Slot; at: number } | null;
  simType: SimTypeId;
  durationSeconds: number;
  speed: number;
  tickInterval: number;
  /** Keys per-project settings, run history and the scenario library. */
  projectId?: string;
  projectName?: string;
  /** View-only collaborators can't apply a scenario to the canvas. */
  canEdit?: boolean;
  /** Replace the canvas graph (the page routes it through its normal save + realtime path). */
  onApplyScenario?: (nodes: Node[], edges: Edge[]) => void;
}

export default function MonteCarloPanel({
  open,
  onClose,
  currentGraph,
  canvasNodes,
  canvasEdges,
  sendRequest,
  simType,
  durationSeconds,
  projectId = "",
  projectName = "Simulation",
  canEdit = false,
  onApplyScenario,
}: MonteCarloPanelProps) {
  const [activeTab, setActiveTab] = useState<"monte_carlo" | "scenario_compare">("monte_carlo");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [engineMsg, setEngineMsg] = useState<string | null>(null);
  const [secondsPerRun, setSecondsPerRun] = useState(1.5);

  // ── Per-project persistence (loaded during render when the project changes) ──
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [library, setLibrary] = useState<LibraryScenario[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== projectId) {
    setLoadedFor(projectId);
    setSettings(normalizeSettings(loadSettings(projectId, DEFAULT_SETTINGS)));
    setHistory(runHistory.load(projectId));
    setLibrary(scenarioLibrary.load(projectId));
  }
  useEffect(() => {
    if (loadedFor === projectId) saveSettings(projectId, settings);
  }, [settings, loadedFor, projectId]);
  const update = useCallback((p: Partial<LabSettings>) => setSettings((s) => ({ ...s, ...p })), []);

  const historyOps = {
    add: (e: HistoryEntry) => setHistory(runHistory.add(projectId, e)),
    rename: (id: string, name: string) => setHistory(runHistory.rename(projectId, id, name)),
    remove: (id: string) => setHistory(runHistory.remove(projectId, id)),
    pin: (id: string | null) => setHistory(pinHistory(projectId, id)),
  };
  const libraryOps = {
    save: (s: LibraryScenario) => setLibrary(scenarioLibrary.add(projectId, s)),
    rename: (id: string, name: string) => setLibrary(scenarioLibrary.rename(projectId, id, name)),
    remove: (id: string) => setLibrary(scenarioLibrary.remove(projectId, id)),
  };

  const entity = (SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue).entityName;
  const metaFor = useCallback((runLength: string) => getMetricMeta(entity, runLength), [entity]);

  // ── Scenarios (A–D) ──
  const [scenarios, setScenarios] = useState<LabScenario[]>([]);
  const [baselineId, setBaselineId] = useState<string | null>(null);

  // Handle each "Compare as A/B" send once (state adjusted during render, not in an effect).
  // Only a new request captures; later canvas edits must not overwrite the scenario.
  const [handledSendAt, setHandledSendAt] = useState<number | null>(null);
  if (sendRequest && sendRequest.at !== handledSendAt) {
    setHandledSendAt(sendRequest.at);
    const idx = sendRequest.slot === "A" ? 0 : 1;
    setScenarios((all) => {
      const fresh = scenarioFromCanvas(canvasNodes, canvasEdges, Math.min(idx, all.length), all.map((s) => s.color));
      if (all[idx]) return all.map((s, i) => (i === idx ? { ...fresh, id: s.id, name: s.name, color: s.color, stress: s.stress } : s));
      return [...all, fresh].slice(0, MAX_SCENARIOS);
    });
    setActiveTab("scenario_compare");
  }

  // ── Engine: dedicated to batches (separate from the main canvas engine so a live run never
  // receives batch results). Created when the panel first opens so Pyodide preloads.
  const engineRef = useRef<PyodideSimEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  function getEngine(): PyodideSimEngine {
    if (!engineRef.current) {
      const engine = new PyodideSimEngine();
      engine.onStatus((s) => setEngineMsg(engineStatusText(s)));
      engine.init();
      engineRef.current = engine;
    }
    return engineRef.current;
  }

  useEffect(() => {
    if (open) getEngine();
  });

  useEffect(
    () => () => {
      abortRef.current?.abort();
      engineRef.current?.destroy();
      engineRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "Escape" || t?.closest("input, textarea, select, [contenteditable]")) return;
      // A confirm dialog on top handles its own Escape.
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const runEnriched: RunEnriched = (graph, n, { durationSeconds: seconds, signal, onProgress, stopWhen }) =>
    runMonteCarlo(
      getEngine(),
      // speedMultiplier 0 = no wall-clock pacing (the legacy fallback otherwise replays each run in real time).
      { graph, simType, durationSeconds: seconds, speedMultiplier: 0, tickIntervalSeconds: Math.max(0.05, seconds / 1000) },
      n,
      { signal, stopWhen, map: (r) => enrichSimResult(r, graph), onProgress: (pr) => pr.completedRuns > 0 && onProgress?.(pr.completedRuns) }
    );

  const startBatch: StartBatch = (kind, title, total, work, onError) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    setBatch({ kind, title, status: "Starting…", completed: 0, total });
    const t0 = performance.now();
    let done = 0;
    work(ac.signal, (completed, status) => {
      done = completed;
      setBatch((b) => b && { ...b, completed, status });
    })
      .catch((e) => {
        if (!isAbortError(e)) onError(errorText(e));
      })
      .finally(() => {
        abortRef.current = null;
        busyRef.current = false;
        setBatch(null);
        if (done > 0) setSecondsPerRun((performance.now() - t0) / 1000 / done);
      });
  };

  const applyScenario = onApplyScenario
    ? (s: LabScenario) => {
        const merged = mergeScenario(canvasNodes, canvasEdges, s.nodes, s.edges, s.sourceIds);
        onApplyScenario(merged.nodes, merged.edges);
        toast.success(`"${s.name}" is now on your main canvas. Press Ctrl+Z to undo.`, "Scenario applied");
      }
    : undefined;

  if (!open) return null;

  const busy = batch !== null;
  const stressKinds: BatchKind[] = ["stress", "sweep"];
  const progressFor = (kinds: BatchKind[]) =>
    batch && kinds.includes(batch.kind) ? (
      <ProgressCard title={batch.title} status={batch.completed === 0 && engineMsg ? engineMsg : batch.status} completed={batch.completed} total={batch.total} onCancel={() => abortRef.current?.abort()} />
    ) : null;
  const otherBusyNote = (kinds: BatchKind[]) =>
    batch && !kinds.includes(batch.kind) ? (
      <p className="w-full text-[11.5px] font-semibold text-gray-500">The {batch.kind === "compare" ? "scenario comparison" : "stress test"} is still running. Cancel it or wait to start this one.</p>
    ) : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F0B2E]/55 p-2 backdrop-blur-sm sm:p-6">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mc-title"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="flex h-full max-h-[96vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[22px] border border-indigo-100 bg-[#F8F7FF] shadow-[0_25px_70px_rgba(15,11,46,0.35)] sm:max-h-[94vh] sm:rounded-[28px]"
        >
          {/* ── Header ── */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-indigo-100/70 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5742FF] to-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(87,66,255,0.5)]">
                <BarChart2 size={20} strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <h2 id="mc-title" className="truncate text-[16px] font-black tracking-tight text-gray-900 sm:text-[17px]">Reliability Lab</h2>
                <p className="hidden truncate text-[12px] font-medium text-gray-500 sm:block">
                  Replay your model many times to see the realistic range of outcomes, push it to its limits, and compare setups fairly.
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close Reliability Lab" className={`order-2 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 sm:order-3 ${focusRing}`}>
              <X size={16} />
            </button>
            <div role="tablist" aria-label="Lab mode" className="order-3 flex w-full rounded-xl border border-indigo-100 bg-[#F4F2FF] p-1 sm:order-2 sm:w-auto">
              {([
                ["monte_carlo", "Stress test", RefreshCw, stressKinds],
                ["scenario_compare", "Compare scenarios", Scale, ["compare"] as BatchKind[]],
              ] as const).map(([id, label, Icon, kinds]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-extrabold transition-all sm:flex-none ${focusRing} ${
                    activeTab === id ? "bg-white text-[#5742FF] shadow-[0_2px_8px_rgba(87,66,255,0.15)]" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Icon size={13} /> {label}
                  {batch && kinds.includes(batch.kind) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5742FF] motion-reduce:animate-none" aria-label="running" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-3 sm:p-6">
            {activeTab === "monte_carlo" ? (
              <StressTab
                settings={settings}
                update={update}
                currentGraph={currentGraph}
                canvasNodes={canvasNodes}
                canvasEdges={canvasEdges}
                canvasSeconds={durationSeconds}
                entity={entity}
                metaFor={metaFor}
                busy={busy}
                startBatch={startBatch}
                runEnriched={runEnriched}
                secondsPerRun={secondsPerRun}
                history={history}
                onHistory={historyOps}
                projectName={projectName}
                progressCard={progressFor(stressKinds)}
                otherBusyNote={otherBusyNote(stressKinds)}
              />
            ) : (
              <CompareTab
                settings={settings}
                update={update}
                scenarios={scenarios}
                setScenarios={setScenarios}
                baselineId={baselineId}
                setBaselineId={setBaselineId}
                simType={simType}
                canvasNodes={canvasNodes}
                canvasEdges={canvasEdges}
                canvasSeconds={durationSeconds}
                entity={entity}
                metaFor={metaFor}
                busy={busy}
                startBatch={startBatch}
                runEnriched={runEnriched}
                canEdit={canEdit}
                onApplyScenario={canEdit ? applyScenario : undefined}
                library={library}
                onLibrary={libraryOps}
                projectName={projectName}
                progressCard={progressFor(["compare"])}
                otherBusyNote={otherBusyNote(["compare"])}
              />
            )}
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
