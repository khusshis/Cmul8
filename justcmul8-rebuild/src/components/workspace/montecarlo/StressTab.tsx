"use client";

import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Copy, FileJson, FileSpreadsheet, Image as ImageIcon, Play, SlidersHorizontal, FlaskConical } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import TabStrip, { tabPanelProps } from "@/components/ui/TabStrip";
import { EmptyState } from "@/components/ui/ChartCard";
import { toast } from "@/components/ui/Toast";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { aggregateMonteCarloRuns, metricsOf, relativeHalfWidth, runMetrics, type MetricKey } from "@/lib/simulation/monteCarlo";
import { applyStress, describeConditions, type StressConditions } from "@/lib/simulation/stressTransforms";
import { analyzeSweep, perRunRows, runPasses, sweepHeadline, sweepSteps, toCSV } from "@/lib/simulation/stressAnalysis";
import { newId, type HistoryEntry } from "@/lib/simulation/mcStorage";
import StressTestResults from "./StressTestResults";
import StressCustomize from "./StressCustomize";
import { BlocksView, BreakingPointView, HistoryView, TargetsView, type SweepResult } from "./StressExtras";
import { graphSignature, validateForRun, type ErrorInfo, type RunEnriched, type StartBatch } from "./graphUtils";
import { CountPicker, ErrorCard, Explainer, WarningCard, btnGhost, btnPrimary, cardCls, copyText, downloadFile, downloadPng, fileSlug, focusRing, formatDuration, levelText, type MetricMeta } from "./shared";
import { MAX_RUNS, UNIT_SECONDS, type LabSettings } from "./settings";

type ResultsTab = "overview" | "targets" | "blocks" | "breaking" | "history";

interface Props {
  settings: LabSettings;
  update: (p: Partial<LabSettings>) => void;
  currentGraph: SimGraph;
  canvasNodes: Node[];
  canvasEdges: Edge[];
  canvasSeconds: number;
  entity: string;
  metaFor: (runLength: string) => Record<MetricKey, MetricMeta>;
  busy: boolean;
  startBatch: StartBatch;
  runEnriched: RunEnriched;
  secondsPerRun: number;
  history: HistoryEntry[];
  onHistory: { add: (e: HistoryEntry) => void; rename: (id: string, name: string) => void; remove: (id: string) => void; pin: (id: string | null) => void };
  projectName: string;
  progressCard: React.ReactNode;
  otherBusyNote: React.ReactNode;
}

/** Multiply demand (global and per source) on top of the user's conditions, for the sweep. */
const scaleDemand = (c: StressConditions, m: number): StressConditions => ({
  ...c,
  demand: c.demand * m,
  demandBySource: c.demandBySource && Object.fromEntries(Object.entries(c.demandBySource).map(([k, v]) => [k, v * m])),
});

export default function StressTab(p: Props) {
  const { settings, update, currentGraph, metaFor } = p;
  const [result, setResult] = useState<{ results: SimResult[]; sig: string; conditions: string[]; seconds: number } | null>(null);
  const [sweep, setSweep] = useState<SweepResult | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [tab, setTab] = useState<ResultsTab>("overview");
  const chartRef = useRef<HTMLDivElement>(null);
  const precisionRef = useRef<number>(Infinity);

  const durationSeconds = settings.duration.override ? Math.max(1, settings.duration.value * UNIT_SECONDS[settings.duration.unit]) : p.canvasSeconds;
  const runLength = formatDuration(result?.seconds ?? durationSeconds);
  const meta = useMemo(() => metaFor(runLength), [metaFor, runLength]);
  const sources = useMemo(() => currentGraph.nodes.filter((n) => n.nodeType === "source").map((n) => ({ id: n.id, label: n.label || n.id })), [currentGraph]);
  const labelOf = (id: string) => sources.find((s) => s.id === id)?.label ?? id;
  const chips = describeConditions(settings.conditions, labelOf);

  // Re-aggregate on confidence / risk-band changes without re-running anything.
  const mc = useMemo(() => (result ? aggregateMonteCarloRuns(result.results, { level: settings.level, riskQ: settings.riskQ }) : null), [result, settings.level, settings.riskQ]);
  const pinned = p.history.find((h) => h.pinned) ?? null;
  const hasCost = !!mc?.totalCost;
  const sigNow = graphSignature(applyStress(currentGraph, settings.conditions), durationSeconds);
  const stale = result && result.sig !== sigNow;
  const activeTargets = settings.targets.filter((t) => t.enabled);
  const customCount = chips.length + activeTargets.length + (settings.mode === "precise" ? 1 : 0) + (settings.duration.override ? 1 : 0) + (settings.level !== 0.95 ? 1 : 0) + (settings.riskQ !== 0.05 ? 1 : 0);

  function preflight(): boolean {
    const problem = validateForRun(p.canvasNodes, p.canvasEdges);
    setWarning(problem);
    setError(null);
    return !problem;
  }

  function handleRun() {
    if (!preflight()) return;
    const graph = applyStress(currentGraph, settings.conditions);
    const precise = settings.mode === "precise";
    const n = precise ? settings.maxRuns : settings.runs;
    const { level, precisionPct, precisionMetric } = settings;
    const sig = sigNow;
    const conditions = chips;
    const seconds = durationSeconds;
    precisionRef.current = Infinity;
    const stopWhen = precise
      ? (rs: SimResult[]) => {
          if (rs.length < 5) return false;
          const vals = rs.map((r) => runMetrics(r)[precisionMetric]).filter((v): v is number => v !== undefined && Number.isFinite(v));
          precisionRef.current = relativeHalfWidth(vals, level);
          return precisionRef.current <= precisionPct;
        }
      : undefined;
    p.startBatch("stress", precise ? `Running until ±${precisionPct}% precise (max ${n})` : `Running ${n} stress-test runs`, n, async (signal, progress) => {
      const results = await p.runEnriched(graph, n, {
        durationSeconds: seconds,
        signal,
        stopWhen,
        onProgress: (done) =>
          progress(done, precise && Number.isFinite(precisionRef.current) ? `Run ${done}: average known to ±${precisionRef.current.toFixed(1)}% (aiming for ±${precisionPct}%)` : `Completed run ${done} of ${n}`),
      });
      setResult({ results, sig, conditions, seconds });
      setTab("overview");
      const agg = aggregateMonteCarloRuns(results, { level: settings.level, riskQ: settings.riskQ });
      const metrics: HistoryEntry["metrics"] = {};
      for (const k of metricsOf(agg)) {
        const s = agg[k]!;
        metrics[k] = { n: s.n, mean: s.mean, stdDev: s.stdDev, ciLower: s.ciLower, ciUpper: s.ciUpper, bandLo: s.bandLo, bandHi: s.bandHi, min: s.min, max: s.max };
      }
      p.onHistory.add({
        id: newId(),
        name: conditions.length ? conditions.join(" · ") : "Today's demand",
        createdAt: new Date().toISOString(),
        runCount: results.length,
        level: settings.level,
        riskQ: settings.riskQ,
        durationSeconds: seconds,
        conditions,
        metrics,
      });
      if (precise && precisionRef.current > precisionPct) toast.info(`Stopped at the ${n}-run cap; the average is known to ±${precisionRef.current.toFixed(1)}%.`, "Precision not reached");
    }, setError);
  }

  function handleSweep() {
    if (!preflight()) return;
    const sw = settings.sweep;
    const steps = sweepSteps(sw.from, sw.to, sw.steps);
    const total = steps.length * sw.runsPerStep;
    const { level, riskQ, conditions } = settings;
    const targets = activeTargets;
    const seconds = durationSeconds;
    p.startBatch("sweep", `Finding the breaking point (${steps.length} demand levels)`, total, async (signal, progress) => {
      const points = [];
      for (let i = 0; i < steps.length; i++) {
        const m = steps[i];
        const res = await p.runEnriched(applyStress(currentGraph, scaleDemand(conditions, m)), sw.runsPerStep, {
          durationSeconds: seconds,
          signal,
          onProgress: (done) => progress(i * sw.runsPerStep + done, `Step ${i + 1} of ${steps.length} (${m}× demand): run ${done} of ${sw.runsPerStep}`),
        });
        const agg = aggregateMonteCarloRuns(res, { level, riskQ });
        const stat = agg[sw.metric] ?? agg.throughput;
        const meetShare = targets.length ? runPasses(res, targets).filter(Boolean).length / res.length : undefined;
        points.push({ multiplier: m, stat, meetShare });
      }
      const analysis = analyzeSweep(points, sw.metric);
      const m = p.metaFor(formatDuration(seconds))[sw.metric];
      setSweep({ points, metric: sw.metric, analysis, headline: sweepHeadline(points, analysis, sw.metric, m.label, m.format), conditions: describeConditions(conditions, labelOf), hasTargets: targets.length > 0 });
      setTab("breaking");
    }, setError);
  }

  function exportCSV() {
    if (!mc) return;
    const rows = perRunRows(mc.results, { conditions: result!.conditions.join("; ") || "none", simulated_seconds: result!.seconds }, settings.targets);
    downloadFile(`${fileSlug(p.projectName)}-stress-runs.csv`, toCSV(rows), "text/csv");
  }
  function exportJSON() {
    if (!mc) return;
    const aggregates = Object.fromEntries(metricsOf(mc).map((k) => [k, mc[k]]));
    const data = { generatedAt: new Date().toISOString(), project: p.projectName, simulatedSecondsPerRun: result!.seconds, confidenceLevel: settings.level, riskBand: settings.riskQ, conditions: result!.conditions, targets: activeTargets, aggregates, runs: perRunRows(mc.results, {}, settings.targets) };
    // Per-run values are already in `runs`, so drop the duplicate sample arrays.
    downloadFile(`${fileSlug(p.projectName)}-stress-test.json`, JSON.stringify(data, (key, v) => (key === "samples" ? undefined : v), 2), "application/json");
  }
  async function copySummary() {
    if (!mc) return;
    const t = mc.throughput;
    const w = mc.avgWaitTime;
    const lines = [
      `Stress test: ${p.projectName} (${mc.runCount} runs, ${runLength} simulated each, ${levelText(settings.level)} confidence)`,
      result!.conditions.length ? `Conditions: ${result!.conditions.join(", ")}` : "Conditions: today's demand",
      `${meta.throughput.label}: average ${meta.throughput.format(t.mean)} (band ${meta.throughput.format(t.ciLower)}–${meta.throughput.format(t.ciUpper)}); typical range ${meta.throughput.format(t.bandLo)}–${meta.throughput.format(t.bandHi)}; worst run ${meta.throughput.format(t.min)}.`,
      `Median wait: average ${meta.avgWaitTime.format(w.mean)}; typical range ${meta.avgWaitTime.format(w.bandLo)}–${meta.avgWaitTime.format(w.bandHi)}; worst run ${meta.avgWaitTime.format(w.max)}.`,
      `Bottleneck busy: ${meta.utilization.format(mc.utilization.mean)} on average.`,
      ...(activeTargets.length ? [`Runs meeting all targets: ${Math.round((runPasses(mc.results, activeTargets).filter(Boolean).length / mc.runCount) * 100)}%.`] : []),
      ...(sweep ? [sweep.headline] : []),
    ];
    if (await copyText(lines.join("\n"))) toast.success("Summary copied to your clipboard.", "Copied");
    else toast.error("Your browser blocked clipboard access.", "Couldn't copy");
  }
  async function exportPNG() {
    if (!chartRef.current) return toast.info("Open the Overview tab to export its chart.", "No chart to export");
    try {
      await downloadPng(chartRef.current, `${fileSlug(p.projectName)}-distribution.png`);
    } catch {
      toast.error("The chart image couldn't be created.", "Export failed");
    }
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "targets" as const, label: activeTargets.length ? `Targets (${activeTargets.length})` : "Targets" },
    { id: "blocks" as const, label: "Blocks" },
    ...(sweep ? [{ id: "breaking" as const, label: "Breaking point" }] : []),
    { id: "history" as const, label: `History (${p.history.length})` },
  ];
  const showResults = mc || sweep || p.history.length > 0;

  return (
    <>
      <Explainer title="How does the stress test work?">
        <div className="grid gap-4 md:grid-cols-3">
          <p>
            <b className="text-gray-900">One run is one possible day.</b> Your model has randomness built in: {p.entity.toLowerCase()}s don&apos;t arrive on a
            fixed schedule and service times vary. So a single simulation shows just one way things could go.
          </p>
          <p>
            <b className="text-gray-900">We replay it many times.</b> Each run uses fresh random numbers, like living through 20 or 50 different days with the
            same setup. That reveals the typical outcome and how bad a bad day gets.
          </p>
          <p>
            <b className="text-gray-900">Two kinds of range.</b> The <i>risk band</i> (e.g. P5 to P95) shows day-to-day swings. The <i>confidence band</i> shows
            how sure we are about the average itself. It narrows as you add runs.
          </p>
        </div>
        <p className="mt-3 rounded-xl bg-surface/80 px-3 py-2 text-[12px] text-gray-500 ring-1 ring-indigo-100">
          <b className="text-gray-700">Example:</b> run 1 serves 92 customers, run 2 serves 105, run 3 serves 98… After 20 runs the average is 99, 9 in 10 runs landed
          between 90 and 108, and we&apos;re 95% sure the true long-run average is between 97 and 101. Use <b>Customize</b> to add stress (busier days, slower staff),
          targets, and a breaking-point search.
        </p>
      </Explainer>

      {/* ── Setup bar ── */}
      <div className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5`}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-extrabold text-gray-700">Runs</span>
          {settings.mode === "precise" ? (
            <span className="rounded-xl bg-sf-efedff px-3 py-1.5 text-[12px] font-black text-fg-4331e0">Until ±{settings.precisionPct}% precise · max {settings.maxRuns}</span>
          ) : (
            <CountPicker label="Number of stress-test runs" value={settings.runs} options={[10, 20, 50, 100]} onChange={(runs) => update({ runs })} disabled={p.busy} custom={{ min: 5, max: MAX_RUNS }} />
          )}
          <span className="text-[11.5px] text-gray-500">each run simulates {formatDuration(durationSeconds)}</span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button type="button" onClick={() => setCustomizeOpen((o) => !o)} aria-expanded={customizeOpen} aria-controls="stress-customize" className={`${btnGhost} flex-1 justify-center sm:flex-none`}>
            <SlidersHorizontal size={14} /> Customize
            {customCount > 0 && <span className="rounded-full bg-sf-5742ff px-1.5 text-[10.5px] font-black text-white tabular-nums">{customCount}</span>}
          </button>
          <button type="button" onClick={handleRun} disabled={p.busy} className={`${btnPrimary} flex-1 sm:flex-none`}>
            <Play size={15} fill="currentColor" /> {mc ? "Run again" : settings.mode === "precise" ? "Run until precise" : `Run ${settings.runs} simulations`}
          </button>
        </div>
        {chips.length > 0 && (
          <ul className="flex w-full flex-wrap gap-1.5" aria-label="Active stress conditions">
            {chips.map((c) => <li key={c} className="rounded-full bg-sf-efedff px-2.5 py-0.5 text-[11px] font-bold text-fg-4331e0 ring-1 ring-indigo-100">{c}</li>)}
          </ul>
        )}
        {p.otherBusyNote}
      </div>

      <AnimatePresence initial={false}>
        {customizeOpen && (
          <motion.div id="stress-customize" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <StressCustomize settings={settings} update={update} sources={sources} meta={meta} hasCost={hasCost} canvasSeconds={p.canvasSeconds} busy={p.busy} secondsPerRun={p.secondsPerRun} onRunSweep={handleSweep} />
          </motion.div>
        )}
      </AnimatePresence>

      {p.progressCard}
      {warning && <WarningCard message={warning} onDismiss={() => setWarning(null)} />}
      {error && <ErrorCard title={error.title} message={error.message} onRetry={handleRun} onDismiss={() => setError(null)} />}
      {stale && !p.busy && (
        <p className="flex items-center gap-2 text-[12px] font-semibold text-amber-800">
          <AlertCircle size={14} aria-hidden /> The model or stress settings changed since these results were produced. Run again to update them.
        </p>
      )}

      {showResults ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabStrip tabs={tabs} value={tab} onChange={setTab} layoutId="stress-results" label="Stress test results" className="max-w-full" />
            {mc && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Export results">
                <button type="button" onClick={exportCSV} className={btnGhost} title="Every run as a spreadsheet row"><FileSpreadsheet size={14} /> CSV</button>
                <button type="button" onClick={exportJSON} className={btnGhost} title="Settings, aggregates and runs"><FileJson size={14} /> JSON</button>
                <button type="button" onClick={copySummary} className={btnGhost} title="Plain-English summary"><Copy size={14} /> Summary</button>
                <button type="button" onClick={exportPNG} className={btnGhost} title="Image of the distribution chart" aria-label="Download distribution chart as PNG"><ImageIcon size={14} /> PNG</button>
              </div>
            )}
          </div>
          <div {...tabPanelProps("stress-results", tab)} className={`space-y-4 rounded-[20px] ${focusRing}`}>
            {tab === "overview" &&
              (mc ? (
                <StressTestResults mc={mc} meta={meta} entity={p.entity} runLength={runLength} conditions={result!.conditions} targets={settings.targets} pinned={pinned} chartRef={chartRef} />
              ) : (
                <NoRunYet />
              ))}
            {tab === "targets" && (mc ? <TargetsView mc={mc} targets={settings.targets} meta={meta} level={settings.level} /> : <NoRunYet />)}
            {tab === "blocks" && (mc ? <BlocksView mc={mc} riskQ={settings.riskQ} utilBand={settings.utilBand} /> : <NoRunYet />)}
            {tab === "breaking" && sweep && <BreakingPointView sweep={sweep} meta={meta} target={activeTargets.find((t) => t.metric === sweep.metric)} />}
            {tab === "history" && <HistoryView entries={p.history} meta={meta} onRename={p.onHistory.rename} onDelete={p.onHistory.remove} onPin={p.onHistory.pin} />}
          </div>
        </div>
      ) : (
        !p.busy && (
          <div className={`${cardCls} border-dashed`}>
            <EmptyState
              icon={FlaskConical}
              title="Ready to stress test your system"
              hint={<>Press <strong>Run</strong> for a quick check with sensible defaults. You&apos;ll see the typical result, the realistic best and worst case, and how confident you can be. Open <strong>Customize</strong> to add busier days, targets or a breaking-point search.</>}
            />
          </div>
        )
      )}
    </>
  );
}

function NoRunYet() {
  return (
    <div className={`${cardCls} border-dashed`}>
      <EmptyState icon={FlaskConical} title="Run a stress test first" hint="These views fill in after a stress-test batch." compact />
    </div>
  );
}
