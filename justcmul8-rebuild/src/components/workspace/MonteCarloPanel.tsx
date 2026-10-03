"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  TrendingUp,
  Scale,
  Clock,
  Activity,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight,
  TrendingDown,
  Sparkles,
  BarChart2,
  RefreshCw,
  Info,
  Sliders,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { SimGraph, SimTypeId } from "@/lib/simulation/types";
import { PyodideSimEngine } from "@/lib/simulation/pyodideEngine";
import {
  type MonteCarloResult,
  type ScenarioComparisonResult,
  aggregateMonteCarloRuns,
  compareScenarios,
} from "@/lib/simulation/monteCarlo";
import { runMonteCarlo, type MonteCarloProgress } from "@/lib/simulation/monteCarloRunner";
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge } from "@xyflow/react";
import NodeCanvas, { graphToSimNodes, type NodeCanvasHandle } from "@/components/workspace/NodeCanvas";
import NodePropertiesPanel from "@/components/workspace/NodePropertiesPanel";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";

type Scenario = { name: string; nodes: Node[]; edges: Edge[]; timestamp: string };
type Slot = "A" | "B";

const SLOT_STYLE: Record<Slot, { title: string; name: string; badge: string; button: string; ring: string }> = {
  A: {
    title: "Scenario A",
    name: "Baseline",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    button: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
    ring: "border-blue-100",
  },
  B: {
    title: "Scenario B",
    name: "Optimized",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    button: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "border-emerald-100",
  },
};

/** Copies the selected nodes (or the whole canvas when nothing is selected) plus the edges between them. */
function captureScenario(name: string, nodes: Node[], edges: Edge[]): Scenario {
  const picked = nodes.some((n) => n.selected) ? nodes.filter((n) => n.selected) : nodes;
  const ids = new Set(picked.map((n) => n.id));
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    name,
    nodes: picked.map((n) => ({ ...clone(n), selected: false })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...clone(e), selected: false })),
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

interface MonteCarloPanelProps {
  open: boolean;
  onClose: () => void;
  currentGraph: SimGraph;
  /** Live React Flow nodes/edges of the main canvas (selection included) for A/B capture. */
  canvasNodes: Node[];
  canvasEdges: Edge[];
  /** Set by the canvas "Compare as A/B" bar; `at` makes repeated sends to the same slot re-trigger. */
  sendRequest?: { slot: Slot; at: number } | null;
  simType: SimTypeId;
  durationSeconds: number;
  speed: number;
  tickInterval: number;
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
  speed,
  tickInterval,
}: MonteCarloPanelProps) {
  const [activeTab, setActiveTab] = useState<"monte_carlo" | "scenario_compare">("monte_carlo");
  const [runCount, setRunCount] = useState<number>(20);
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<MonteCarloProgress | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"throughput" | "avgWaitTime" | "utilization" | "healthScore" | "totalCost">("throughput");

  // Scenario Comparison state
  const [scenarioA, setScenarioA] = useState<Scenario | null>(null);
  const [scenarioB, setScenarioB] = useState<Scenario | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ScenarioComparisonResult | null>(null);
  const [comparisonRunning, setComparisonRunning] = useState<boolean>(false);
  const [comparisonProgress, setComparisonProgress] = useState<{ phase: string; percent: number } | null>(null);
  const selectionCount = canvasNodes.filter((n) => n.selected).length;

  function capture(slot: Slot) {
    const snap = captureScenario(SLOT_STYLE[slot].name, canvasNodes, canvasEdges);
    (slot === "A" ? setScenarioA : setScenarioB)(snap);
    setComparisonResult(null);
  }

  useEffect(() => {
    if (!sendRequest) return;
    capture(sendRequest.slot);
    setActiveTab("scenario_compare");
  }, [sendRequest]);

  // Dedicated Pyodide engine for batch runs
  const engineRef = useRef<PyodideSimEngine | null>(null);

  function getEngine(): PyodideSimEngine {
    if (!engineRef.current) {
      const engine = new PyodideSimEngine();
      engine.init();
      engineRef.current = engine;
    }
    return engineRef.current;
  }

  async function handleRunMonteCarlo() {
    const engine = getEngine();
    setRunning(true);
    setProgress({ completedRuns: 0, totalRuns: runCount, statusText: "Initializing engine..." });

    try {
      const results = await runMonteCarlo(
        engine,
        {
          graph: currentGraph,
          simType,
          durationSeconds,
          speedMultiplier: speed,
          tickIntervalSeconds: tickInterval,
        },
        runCount,
        (p) => setProgress(p)
      );

      const aggregated = aggregateMonteCarloRuns(results);
      setMcResult(aggregated);
    } catch (err: any) {
      console.error("Monte Carlo Run Failed:", err);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function handleRunComparison() {
    if (!scenarioA || !scenarioB) return;
    const engine = getEngine();
    setComparisonRunning(true);
    setComparisonProgress({ phase: `Running Scenario A (${scenarioA.name})...`, percent: 10 });

    try {
      const runsPerScenario = Math.min(20, runCount);
      
      // Run Scenario A
      const resultsA = await runMonteCarlo(
        engine,
        {
          graph: graphToSimNodes(scenarioA.nodes, scenarioA.edges),
          simType,
          durationSeconds,
          speedMultiplier: speed,
          tickIntervalSeconds: tickInterval,
        },
        runsPerScenario,
        (p) => {
          setComparisonProgress({
            phase: `Running Scenario A (${scenarioA.name}) [${p.completedRuns}/${p.totalRuns}]...`,
            percent: 10 + Math.round((p.completedRuns / p.totalRuns) * 40),
          });
        }
      );
      const mcA = aggregateMonteCarloRuns(resultsA);

      // Run Scenario B
      setComparisonProgress({ phase: `Running Scenario B (${scenarioB.name})...`, percent: 55 });
      const resultsB = await runMonteCarlo(
        engine,
        {
          graph: graphToSimNodes(scenarioB.nodes, scenarioB.edges),
          simType,
          durationSeconds,
          speedMultiplier: speed,
          tickIntervalSeconds: tickInterval,
        },
        runsPerScenario,
        (p) => {
          setComparisonProgress({
            phase: `Running Scenario B (${scenarioB.name}) [${p.completedRuns}/${p.totalRuns}]...`,
            percent: 55 + Math.round((p.completedRuns / p.totalRuns) * 45),
          });
        }
      );
      const mcB = aggregateMonteCarloRuns(resultsB);

      const comp = compareScenarios(scenarioA.name, mcA, scenarioB.name, mcB);
      setComparisonResult(comp);
    } catch (err: any) {
      console.error("Comparison Run Failed:", err);
    } finally {
      setComparisonRunning(false);
      setComparisonProgress(null);
    }
  }

  if (!open) return null;

  // Chart data for Monte Carlo
  const activeStat = mcResult ? mcResult[selectedMetric] : null;
  const chartData = activeStat
    ? activeStat.samples.map((val, idx) => ({
        run: `Run ${idx + 1}`,
        runNum: idx + 1,
        value: Math.round(val * 100) / 100,
        mean: Math.round(activeStat.mean * 100) / 100,
        ciLower: Math.round(activeStat.ciLower * 100) / 100,
        ciUpper: Math.round(activeStat.ciUpper * 100) / 100,
      }))
    : [];

  // Chart data for Scenario comparison
  const compChartData = comparisonResult
    ? [
        {
          name: "Throughput (Items)",
          [comparisonResult.scenarioA.name]: Math.round(comparisonResult.scenarioA.mc.throughput.mean),
          [comparisonResult.scenarioB.name]: Math.round(comparisonResult.scenarioB.mc.throughput.mean),
        },
        {
          name: "p50 Wait (s)",
          [comparisonResult.scenarioA.name]: Math.round(comparisonResult.scenarioA.mc.avgWaitTime.mean * 10) / 10,
          [comparisonResult.scenarioB.name]: Math.round(comparisonResult.scenarioB.mc.avgWaitTime.mean * 10) / 10,
        },
        {
          name: "Utilization (%)",
          [comparisonResult.scenarioA.name]: Math.round(comparisonResult.scenarioA.mc.utilization.mean),
          [comparisonResult.scenarioB.name]: Math.round(comparisonResult.scenarioB.mc.utilization.mean),
        },
        {
          name: "Health Score",
          [comparisonResult.scenarioA.name]: Math.round(comparisonResult.scenarioA.mc.healthScore.mean),
          [comparisonResult.scenarioB.name]: Math.round(comparisonResult.scenarioB.mc.healthScore.mean),
        },
        ...(comparisonResult.scenarioA.mc.totalCost && comparisonResult.scenarioB.mc.totalCost
          ? [
              {
                name: "Cost ($)",
                [comparisonResult.scenarioA.name]: Math.round(comparisonResult.scenarioA.mc.totalCost.mean),
                [comparisonResult.scenarioB.name]: Math.round(comparisonResult.scenarioB.mc.totalCost.mean),
              },
            ]
          : []),
      ]
    : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="w-full h-full max-w-[1480px] max-h-[94vh] bg-[#F8F7FF] rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col border border-indigo-100"
        >
          {/* ── Top Header ── */}
          <div className="px-6 py-4 bg-white border-b border-indigo-100/70 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#5742FF]/10 text-[#5742FF] flex items-center justify-center">
                <BarChart2 size={22} strokeWidth={2.4} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-black text-gray-900 tracking-tight">
                    Scenario Stress Testing & Risk Analysis
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-[#5742FF] border border-indigo-100 uppercase tracking-wider">
                    Reliability Lab
                  </span>
                </div>
                <p className="text-[12px] text-gray-400 font-medium">
                  Simulate dozens of unpredictable rush-hour scenarios to test system limits and compare Baseline vs. Optimized setups
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tab Switcher */}
              <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200/60">
                <button
                  onClick={() => setActiveTab("monte_carlo")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === "monte_carlo"
                      ? "bg-white text-[#5742FF] shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <RefreshCw size={13} /> Multi-Scenario Stress Test
                </button>
                <button
                  onClick={() => setActiveTab("scenario_compare")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === "scenario_compare"
                      ? "bg-white text-[#5742FF] shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Scale size={13} /> Scenario A/B Compare
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {activeTab === "monte_carlo" ? (
              <>
                {/* Controls Bar */}
                <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[12.5px] font-extrabold text-gray-700">Iteration Count:</span>
                    <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200/60">
                      {[10, 20, 50, 100].map((count) => (
                        <button
                          key={count}
                          onClick={() => setRunCount(count)}
                          disabled={running}
                          className={`px-3 py-1 text-[12px] font-black rounded-lg transition-all ${
                            runCount === count
                              ? "bg-[#5742FF] text-white shadow-xs"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          {count}x
                        </button>
                      ))}
                    </div>
                    <span className="text-[11.5px] text-gray-400 hidden sm:inline">
                      (Tests realistic customer surges & random spikes)
                    </span>
                  </div>

                  <button
                    onClick={handleRunMonteCarlo}
                    disabled={running}
                    className="px-5 py-2.5 rounded-xl bg-[#5742FF] border border-[#8d80ff] hover:bg-[#4531E5] text-white font-black text-[13px] shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {running ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Running Tests ({progress?.completedRuns || 0}/{runCount})...</span>
                      </>
                    ) : (
                      <>
                        <Play size={15} fill="currentColor" />
                        <span>Execute {runCount}x Scenario Stress Tests</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Bar */}
                {running && progress && (
                  <div className="bg-white rounded-[20px] border border-indigo-100 shadow-sm p-4 space-y-2">
                    <div className="flex justify-between text-[12px] font-bold text-gray-700">
                      <span>{progress.statusText}</span>
                      <span>{Math.round((progress.completedRuns / progress.totalRuns) * 100)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#5742FF] to-indigo-400 rounded-full transition-all duration-300"
                        style={{ width: `${(progress.completedRuns / progress.totalRuns) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Results Section */}
                {mcResult ? (
                  <div className="space-y-6">
                    {/* Stat Cards with 95% CI */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                            Throughput
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <TrendingUp size={15} />
                          </div>
                        </div>
                        <div className="text-[26px] font-black text-gray-900">
                          {mcResult.throughput.mean.toFixed(1)}
                        </div>
                        <div className="text-[11.5px] font-bold text-blue-600 mt-1">
                          95% CI: [{mcResult.throughput.ciLower.toFixed(1)} – {mcResult.throughput.ciUpper.toFixed(1)}]
                        </div>
                        <div className="text-[10.5px] text-gray-400 mt-0.5">
                          σ = {mcResult.throughput.stdDev.toFixed(1)} across {mcResult.runCount} runs
                        </div>
                      </div>

                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                            Median Wait (p50)
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock size={15} />
                          </div>
                        </div>
                        <div className="text-[26px] font-black text-gray-900">
                          {mcResult.avgWaitTime.mean.toFixed(2)}s
                        </div>
                        <div className="text-[11.5px] font-bold text-amber-600 mt-1">
                          95% CI: [{mcResult.avgWaitTime.ciLower.toFixed(2)}s – {mcResult.avgWaitTime.ciUpper.toFixed(2)}s]
                        </div>
                        <div className="text-[10.5px] text-gray-400 mt-0.5">
                          σ = {mcResult.avgWaitTime.stdDev.toFixed(2)}s
                        </div>
                      </div>

                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                            Bottleneck Utilization
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Activity size={15} />
                          </div>
                        </div>
                        <div className="text-[26px] font-black text-gray-900">
                          {mcResult.utilization.mean.toFixed(1)}%
                        </div>
                        <div className="text-[11.5px] font-bold text-purple-600 mt-1">
                          95% CI: [{mcResult.utilization.ciLower.toFixed(1)}% – {mcResult.utilization.ciUpper.toFixed(1)}%]
                        </div>
                        <div className="text-[10.5px] text-gray-400 mt-0.5">
                          σ = {mcResult.utilization.stdDev.toFixed(1)}%
                        </div>
                      </div>

                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                            {mcResult.totalCost ? "Total Cost" : "Health Score"}
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            {mcResult.totalCost ? <DollarSign size={15} /> : <CheckCircle2 size={15} />}
                          </div>
                        </div>
                        <div className="text-[26px] font-black text-gray-900">
                          {mcResult.totalCost
                            ? `$${mcResult.totalCost.mean.toFixed(2)}`
                            : `${Math.round(mcResult.healthScore.mean)} / 100`}
                        </div>
                        <div className="text-[11.5px] font-bold text-emerald-600 mt-1">
                          {mcResult.totalCost
                            ? `95% CI: [$${mcResult.totalCost.ciLower.toFixed(2)} – $${mcResult.totalCost.ciUpper.toFixed(2)}]`
                            : `95% CI: [${mcResult.healthScore.ciLower.toFixed(0)} – ${mcResult.healthScore.ciUpper.toFixed(0)}]`}
                        </div>
                        <div className="text-[10.5px] text-gray-400 mt-0.5">
                          σ = {mcResult.totalCost ? `$${mcResult.totalCost.stdDev.toFixed(2)}` : mcResult.healthScore.stdDev.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-[14px] font-black text-gray-900 block">
                            Trial Distribution & 95% Confidence Band
                          </span>
                          <span className="text-[11.5px] text-gray-400">
                            The shaded band represents the 95% confidence interval across all {mcResult.runCount} runs
                          </span>
                        </div>

                        {/* Metric Selector */}
                        <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200/60 text-[11px] font-bold">
                          {[
                            { id: "throughput", label: "Throughput" },
                            { id: "avgWaitTime", label: "p50 Wait" },
                            { id: "utilization", label: "Utilization" },
                            { id: "healthScore", label: "Health Score" },
                            ...(mcResult.totalCost ? [{ id: "totalCost", label: "Cost" }] : []),
                          ].map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setSelectedMetric(m.id as any)}
                              className={`px-3 py-1 rounded-lg transition-all ${
                                selectedMetric === m.id
                                  ? "bg-white text-[#5742FF] shadow-xs font-black"
                                  : "text-gray-500 hover:text-gray-800"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis dataKey="run" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#FFFFFF",
                                borderRadius: 12,
                                border: "1px solid #E5E7EB",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                fontSize: 12,
                              }}
                            />
                            {activeStat && (
                              <>
                                <ReferenceArea
                                  y1={activeStat.ciLower}
                                  y2={activeStat.ciUpper}
                                  fill="#5742FF"
                                  fillOpacity={0.1}
                                />
                                <ReferenceLine
                                  y={activeStat.mean}
                                  stroke="#5742FF"
                                  strokeDasharray="4 4"
                                  strokeWidth={2}
                                  label={{
                                    value: `Mean: ${activeStat.mean.toFixed(2)}`,
                                    position: "insideTopRight",
                                    fill: "#5742FF",
                                    fontSize: 11,
                                    fontWeight: "bold",
                                  }}
                                />
                              </>
                            )}
                            <Line
                              type="monotone"
                              dataKey="value"
                              name="Run Value"
                              stroke="#5742FF"
                              strokeWidth={2.2}
                              dot={{ r: 3.5, fill: "#5742FF", strokeWidth: 1.5, stroke: "#FFFFFF" }}
                              activeDot={{ r: 5 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#5742FF] flex items-center justify-center mb-4">
                      <Sparkles size={24} />
                    </div>
                    <h3 className="text-[16px] font-black text-gray-900 mb-1">
                      Ready to Stress Test Your System
                    </h3>
                    <p className="text-[13px] text-gray-500 max-w-md">
                      Choose a test size above and click <strong>Execute Scenario Stress Tests</strong> to simulate multiple realistic rush-hour runs, revealing worst-case bottlenecks and true reliability ranges.
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* ── Scenario A/B Compare Tab ── */
              <div className="space-y-6">
                {/* Split screen: two independent, editable canvases */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {(["A", "B"] as Slot[]).map((slot) => (
                    <ScenarioPane
                      key={slot}
                      slot={slot}
                      scenario={slot === "A" ? scenarioA : scenarioB}
                      setScenario={slot === "A" ? setScenarioA : setScenarioB}
                      simType={simType}
                      selectionCount={selectionCount}
                      onCapture={() => capture(slot)}
                    />
                  ))}
                </div>
                <p className="text-[11.5px] text-gray-400 text-center -mt-2">
                  Tip: on the main canvas, left-click and drag to box-select blocks, then use <strong>Compare as A / B</strong>. Edit either side here; drag to box-select, right-drag or two-finger scroll to pan.
                </p>

                {/* Compare Action Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleRunComparison}
                    disabled={!scenarioA || !scenarioB || comparisonRunning}
                    className="px-6 py-3 rounded-2xl bg-[#5742FF] border border-[#8d80ff] hover:bg-[#4531E5] text-white font-black text-[13.5px] shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {comparisonRunning ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>{comparisonProgress?.phase || "Comparing Scenarios..."}</span>
                      </>
                    ) : (
                      <>
                        <Scale size={16} />
                        <span>Run Head-to-Head Comparison (Scenario A vs B)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Comparison Results */}
                {comparisonResult && (
                  <div className="space-y-6">
                    {/* Improvement Delta Badges */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Throughput Delta */}
                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Throughput Impact
                        </span>
                        <div className="flex items-baseline gap-2">
                          <div className="text-[24px] font-black text-gray-900">
                            {comparisonResult.deltas.throughputPct >= 0 ? "+" : ""}
                            {comparisonResult.deltas.throughputPct.toFixed(1)}%
                          </div>
                          {comparisonResult.deltas.throughputPct >= 0 ? (
                            <TrendingUp size={18} className="text-emerald-500" />
                          ) : (
                            <TrendingDown size={18} className="text-rose-500" />
                          )}
                        </div>
                        <div className="text-[11.5px] text-gray-500 font-medium mt-1">
                          {comparisonResult.scenarioA.mc.throughput.mean.toFixed(0)} → {comparisonResult.scenarioB.mc.throughput.mean.toFixed(0)} items
                        </div>
                      </div>

                      {/* Wait Time Delta */}
                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Wait Time Reduction
                        </span>
                        <div className="flex items-baseline gap-2">
                          <div className="text-[24px] font-black text-gray-900">
                            {comparisonResult.deltas.avgWaitTimePct.toFixed(1)}%
                          </div>
                          {comparisonResult.deltas.avgWaitTimePct <= 0 ? (
                            <TrendingDown size={18} className="text-emerald-500" />
                          ) : (
                            <TrendingUp size={18} className="text-rose-500" />
                          )}
                        </div>
                        <div className="text-[11.5px] text-gray-500 font-medium mt-1">
                          {comparisonResult.scenarioA.mc.avgWaitTime.mean.toFixed(1)}s → {comparisonResult.scenarioB.mc.avgWaitTime.mean.toFixed(1)}s
                        </div>
                      </div>

                      {/* Bottleneck Utilization Delta */}
                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Bottleneck Load
                        </span>
                        <div className="flex items-baseline gap-2">
                          <div className="text-[24px] font-black text-gray-900">
                            {comparisonResult.deltas.utilizationPct >= 0 ? "+" : ""}
                            {comparisonResult.deltas.utilizationPct.toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-[11.5px] text-gray-500 font-medium mt-1">
                          {comparisonResult.scenarioA.mc.utilization.mean.toFixed(0)}% → {comparisonResult.scenarioB.mc.utilization.mean.toFixed(0)}%
                        </div>
                      </div>

                      {/* Health / Cost Delta */}
                      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4 sm:p-5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          {comparisonResult.deltas.savedCost !== undefined ? "Cost Difference" : "Health Score"}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <div className="text-[24px] font-black text-gray-900">
                            {comparisonResult.deltas.savedCost !== undefined
                              ? `${comparisonResult.deltas.savedCost >= 0 ? "-$" : "+$"}${Math.abs(comparisonResult.deltas.savedCost).toFixed(2)}`
                              : `${comparisonResult.deltas.healthScoreDiff >= 0 ? "+" : ""}${comparisonResult.deltas.healthScoreDiff.toFixed(0)} pts`}
                          </div>
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        </div>
                        <div className="text-[11.5px] text-emerald-600 font-bold mt-1">
                          {comparisonResult.deltas.costSavingsPct !== undefined
                            ? `${comparisonResult.deltas.costSavingsPct.toFixed(1)}% Cost Savings`
                            : "System health delta"}
                        </div>
                      </div>
                    </div>

                    {/* Comparative Dual Bar Chart */}
                    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[14px] font-black text-gray-900 block">
                            Side-by-Side Metric Comparison
                          </span>
                          <span className="text-[11.5px] text-gray-400">
                            Baseline ({comparisonResult.scenarioA.name}) vs. Optimized ({comparisonResult.scenarioB.name})
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-[290px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={compChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#FFFFFF",
                                borderRadius: 12,
                                border: "1px solid #E5E7EB",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                fontSize: 12,
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                            <Bar dataKey={comparisonResult.scenarioA.name} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey={comparisonResult.scenarioB.name} fill="#10B981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ScenarioPane({
  slot,
  scenario,
  setScenario,
  simType,
  selectionCount,
  onCapture,
}: {
  slot: Slot;
  scenario: Scenario | null;
  setScenario: React.Dispatch<React.SetStateAction<Scenario | null>>;
  simType: SimTypeId;
  selectionCount: number;
  onCapture: () => void;
}) {
  const style = SLOT_STYLE[slot];
  const canvasRef = useRef<NodeCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode = scenario?.nodes.find((n) => n.id === selectedId);
  const paletteNodes = (SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue).paletteNodes || [];

  function updateNode(id: string, partial: any) {
    setScenario((s) => s && {
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                ...partial,
                params: partial.params ? { ...((n.data as any)?.params || {}), ...partial.params } : (n.data as any)?.params,
              },
            }
          : n
      ),
    });
  }

  return (
    <div className={`bg-white rounded-[20px] border ${style.ring} shadow-sm overflow-hidden flex flex-col`}>
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider border ${style.badge}`}>
          {style.title} · {style.name}
        </span>
        <span className="text-[11px] font-bold text-gray-400">
          {scenario ? `${scenario.nodes.length} blocks · ${scenario.edges.length} links · ${scenario.timestamp}` : "Empty"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {scenario && paletteNodes.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && canvasRef.current?.addNode(e.target.value)}
              className="h-8 px-2 rounded-lg border border-gray-200 bg-white text-[11.5px] font-bold text-gray-700 outline-none focus:border-indigo-300"
            >
              <option value="">+ Add block</option>
              {paletteNodes.map((n) => (
                <option key={n.type} value={n.type}>{n.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={onCapture}
            className={`h-8 px-3 rounded-lg border text-[11.5px] font-extrabold transition-colors flex items-center gap-1.5 ${style.button}`}
          >
            <Layers size={13} />
            {selectionCount > 0 ? `Load ${selectionCount} selected` : "Load full canvas"}
          </button>
          {scenario && (
            <button
              onClick={() => { setScenario(null); setSelectedId(null); }}
              title="Clear"
              className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center border border-gray-200"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="relative h-[440px] bg-[#F9F8FD]">
        {scenario ? (
          <NodeCanvas
            ref={canvasRef}
            nodes={scenario.nodes}
            edges={scenario.edges}
            simType={simType}
            simState="idle"
            selectedNodeId={selectedId}
            onSelectNode={setSelectedId}
            onNodesChange={(changes) => setScenario((s) => s && { ...s, nodes: applyNodeChanges(changes, s.nodes) })}
            onEdgesChange={(changes) => setScenario((s) => s && { ...s, edges: applyEdgeChanges(changes, s.edges) })}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#5742FF] flex items-center justify-center mb-3">
              <Sliders size={20} />
            </div>
            <p className="text-[13px] font-black text-gray-900">No {style.name.toLowerCase()} yet</p>
            <p className="text-[12px] text-gray-500 max-w-xs mt-1">
              Box-select blocks on the main canvas and click <strong>Compare as {slot}</strong>, or load the full canvas here.
            </p>
          </div>
        )}

        {selectedNode && (
          <div className="absolute top-0 right-0 h-full w-[300px] max-w-[85%] border-l border-indigo-100 shadow-[-8px_0_24px_rgba(0,0,0,0.06)] z-30 flex flex-col bg-[#FAF9FF]">
            <button
              onClick={() => setSelectedId(null)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center border border-gray-200"
            >
              <X size={13} />
            </button>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <NodePropertiesPanel node={selectedNode} simType={simType} onUpdate={updateNode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
