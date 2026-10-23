"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, BookMarked, Copy, FileSpreadsheet, FileText, Layers, Plus, Scale, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { graphToSimNodes } from "@/components/workspace/NodeCanvas";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { aggregateMonteCarloRuns, compareScenarios, METRIC_KEYS, type MetricKey } from "@/lib/simulation/monteCarlo";
import { applyStress, describeConditions, NEUTRAL_CONDITIONS } from "@/lib/simulation/stressTransforms";
import { pickWinner, scoreScenarios, WEIGHT_PRESETS } from "@/lib/simulation/decisionScore";
import { diffGraphs } from "@/lib/simulation/scenarioDiff";
import { toCSV } from "@/lib/simulation/stressAnalysis";
import { newId, type LibraryScenario } from "@/lib/simulation/mcStorage";
import ScenarioPane, { changeText, type LabScenario } from "./ScenarioPane";
import CompareResults, { buildVerdict } from "./CompareResults";
import { captureNodes, graphSignature, timeStamp, validateForRun, type ErrorInfo, type RunEnriched, type StartBatch } from "./graphUtils";
import { CountPicker, ErrorCard, Explainer, Field, NumberField, SCENARIO_COLORS, SLOT_LETTERS, Segmented, SliderField, WarningCard, btnGhost, btnPrimary, cardCls, copyText, deltaText, downloadFile, fileSlug, fmtP, focusRing, formatDuration, inputCls, levelText, type MetricMeta } from "./shared";
import { UNIT_SECONDS, type LabSettings } from "./settings";

export const MAX_SCENARIOS = 4;

interface Props {
  settings: LabSettings;
  update: (p: Partial<LabSettings>) => void;
  scenarios: LabScenario[];
  setScenarios: React.Dispatch<React.SetStateAction<LabScenario[]>>;
  baselineId: string | null;
  setBaselineId: (id: string) => void;
  simType: SimTypeId;
  canvasNodes: Node[];
  canvasEdges: Edge[];
  canvasSeconds: number;
  entity: string;
  metaFor: (runLength: string) => Record<MetricKey, MetricMeta>;
  busy: boolean;
  startBatch: StartBatch;
  runEnriched: RunEnriched;
  canEdit: boolean;
  onApplyScenario?: (s: LabScenario) => void;
  library: LibraryScenario[];
  onLibrary: { save: (s: LibraryScenario) => void; rename: (id: string, name: string) => void; remove: (id: string) => void };
  projectName: string;
  progressCard: React.ReactNode;
  otherBusyNote: React.ReactNode;
}

/** A new scenario from the canvas (selection or everything). */
export function scenarioFromCanvas(nodes: Node[], edges: Edge[], index: number, taken: string[]): LabScenario {
  const cap = captureNodes(nodes, edges);
  const color = SCENARIO_COLORS.find((c) => !taken.includes(c)) ?? SCENARIO_COLORS[index % SCENARIO_COLORS.length];
  return { id: newId(), name: index === 0 ? "Baseline" : `Option ${SLOT_LETTERS[index]}`, color, ...cap, timestamp: timeStamp(), stress: NEUTRAL_CONDITIONS };
}

const scenarioSig = (s: LabScenario[], seconds: number) => s.map((x) => graphSignature(graphToSimNodes(x.nodes, x.edges), x.id, x.stress, seconds)).join("|");

export default function CompareTab(p: Props) {
  const { settings, update, scenarios, setScenarios, metaFor } = p;
  const [result, setResult] = useState<{ runs: { id: string; results: SimResult[] }[]; sig: string; seconds: number } | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [confirmApply, setConfirmApply] = useState<LabScenario | null>(null);

  const durationSeconds = settings.duration.override ? Math.max(1, settings.duration.value * UNIT_SECONDS[settings.duration.unit]) : p.canvasSeconds;
  const runLength = formatDuration(result?.seconds ?? durationSeconds);
  const meta = useMemo(() => metaFor(runLength), [metaFor, runLength]);
  const selectionCount = p.canvasNodes.filter((n) => n.selected).length;
  const baselineId = scenarios.some((s) => s.id === p.baselineId) ? p.baselineId! : scenarios[0]?.id ?? null;
  const baseline = scenarios.find((s) => s.id === baselineId);
  const letterKey = scenarios.map((s) => s.id).join(",");
  const letters = useMemo(() => Object.fromEntries(letterKey.split(",").map((id, i) => [id, SLOT_LETTERS[i]])) as Record<string, string>, [letterKey]);
  const canAdd = scenarios.length < MAX_SCENARIOS;

  // Re-derive from stored raw results: renames, recolours, a new baseline or a new confidence level apply instantly.
  const comp = useMemo(() => {
    if (!result) return null;
    const live = result.runs.map((r) => ({ r, s: scenarios.find((x) => x.id === r.id) })).filter((x) => x.s);
    if (live.length < 2) return null;
    const runs = live.map(({ r, s }) => ({ id: r.id, name: s!.name, color: s!.color, mc: aggregateMonteCarloRuns(r.results, { level: settings.level, riskQ: settings.riskQ }) }));
    return compareScenarios(runs, live.some((x) => x.r.id === baselineId) ? baselineId! : runs[0].id, settings.level);
  }, [result, scenarios, baselineId, settings.level, settings.riskQ]);

  const scoring = useMemo(() => {
    if (!comp) return null;
    const keys = METRIC_KEYS.filter((k) => comp.scenarios.every((s) => s.mc[k]));
    const entries = comp.scenarios.map((s) => ({ id: s.id, means: Object.fromEntries(keys.map((k) => [k, s.mc[k]!.mean])) }));
    const ranked = scoreScenarios(entries, settings.weights, settings.utilBand);
    const stats = Object.fromEntries(comp.scenarios.map((s) => [s.id, Object.fromEntries(keys.map((k) => [k, s.mc[k]!]))]));
    return { ranked, winner: pickWinner(ranked, stats, settings.weights, settings.utilBand, settings.level) };
  }, [comp, settings.weights, settings.utilBand, settings.level]);

  const visible = useMemo(() => METRIC_KEYS.filter((k) => !settings.hiddenMetrics.includes(k)), [settings.hiddenMetrics]);
  const stale = result && result.sig !== scenarioSig(scenarios, durationSeconds);

  // ── Scenario management ──
  const patch = (id: string) => (fn: (s: LabScenario) => LabScenario) => setScenarios((all) => all.map((s) => (s.id === id ? fn(s) : s)));
  function add(s: LabScenario) {
    if (!canAdd) return;
    setScenarios((all) => [...all, s]);
  }
  function addFromCanvas() {
    add(scenarioFromCanvas(p.canvasNodes, p.canvasEdges, scenarios.length, scenarios.map((s) => s.color)));
  }
  function duplicate(s: LabScenario) {
    const color = SCENARIO_COLORS.find((c) => !scenarios.some((x) => x.color === c)) ?? s.color;
    add({ ...JSON.parse(JSON.stringify(s)), id: newId(), name: `${s.name} copy`.slice(0, 40), color, timestamp: timeStamp() });
  }
  function remove(id: string) {
    setScenarios((all) => all.filter((s) => s.id !== id));
  }
  function recapture(s: LabScenario) {
    const cap = captureNodes(p.canvasNodes, p.canvasEdges);
    patch(s.id)((x) => ({ ...x, ...cap, timestamp: timeStamp() }));
  }
  function saveToLibrary(s: LabScenario) {
    p.onLibrary.save({ id: newId(), name: s.name, savedAt: new Date().toISOString(), nodes: s.nodes, edges: s.edges, sourceIds: s.sourceIds, stress: s.stress });
    toast.success(`"${s.name}" saved to this project's scenario library (on this device).`, "Saved");
  }
  function loadFromLibrary(item: LibraryScenario) {
    if (!canAdd) return toast.info(`Remove a scenario first: up to ${MAX_SCENARIOS} at once.`, "Scenario limit");
    const color = SCENARIO_COLORS.find((c) => !scenarios.some((x) => x.color === c)) ?? SCENARIO_COLORS[0];
    add({ id: newId(), name: item.name, color, nodes: item.nodes as Node[], edges: item.edges as Edge[], sourceIds: item.sourceIds ?? [], timestamp: timeStamp(), stress: { ...NEUTRAL_CONDITIONS, ...(item.stress as object) } });
  }

  // ── Run ──
  function handleRun() {
    if (scenarios.length < 2) return;
    let problem: string | null = null;
    for (const s of scenarios) {
      const v = validateForRun(s.nodes, s.edges);
      if (v) {
        problem = `${letters[s.id]} (${s.name}): ${v}`;
        break;
      }
    }
    setWarning(problem);
    setError(null);
    if (problem) return;
    const list = scenarios.map((s) => ({ ...s }));
    const n = settings.compareRuns;
    const seconds = durationSeconds;
    const sig = scenarioSig(list, seconds);
    p.startBatch("compare", `Comparing ${list.length} scenarios`, n * list.length, async (signal, progress) => {
      const runs = [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const results = await p.runEnriched(applyStress(graphToSimNodes(s.nodes, s.edges), s.stress), n, {
          durationSeconds: seconds,
          signal,
          onProgress: (done) => progress(i * n + done, `${SLOT_LETTERS[i]} · ${s.name}: run ${done} of ${n}`),
        });
        runs.push({ id: s.id, results });
      }
      setResult({ runs, sig, seconds });
    }, setError);
  }

  // ── Export ──
  function rowsForCSV() {
    if (!comp) return [];
    return comp.scenarios.flatMap((s) =>
      METRIC_KEYS.filter((k) => s.mc[k]).map((k) => {
        const st = s.mc[k]!;
        const d = comp.vsBaseline[s.id]?.find((m) => m.key === k);
        return {
          scenario: s.name,
          baseline: s.id === comp.baselineId,
          metric: meta[k].label,
          runs: st.n,
          mean: st.mean,
          ci_low: st.ciLower,
          ci_high: st.ciUpper,
          band_low: st.bandLo,
          band_high: st.bandHi,
          diff_vs_baseline: d?.diff,
          pct_vs_baseline: d?.pct ?? undefined,
          p_value: d?.pValue,
          significant: d?.significant,
          score: scoring?.ranked.find((r) => r.id === s.id)?.score,
        };
      })
    );
  }
  function summaryText() {
    if (!comp || !scoring) return "";
    const v = buildVerdict(comp, scoring.winner, meta, p.entity);
    return [
      v.headline,
      v.sub,
      ...v.notes,
      "",
      "Leaderboard:",
      ...scoring.ranked.map((r, i) => `${i + 1}. ${comp.scenarios.find((s) => s.id === r.id)?.name}: ${r.score.toFixed(0)}/100`),
    ].join("\n");
  }
  function markdownReport() {
    if (!comp || !scoring) return "";
    const v = buildVerdict(comp, scoring.winner, meta, p.entity);
    const name = (id: string) => comp.scenarios.find((s) => s.id === id)?.name ?? id;
    const keys = METRIC_KEYS.filter((k) => comp.scenarios.every((s) => s.mc[k]));
    const esc = (s: string) => s.replace(/\|/g, "\\|");
    const lines = [
      `# Scenario comparison: ${esc(p.projectName)}`,
      "",
      `_${new Date().toLocaleString()} · ${comp.scenarios[0].mc.runCount} runs per scenario · ${runLength} simulated per run · ${levelText(comp.level)} confidence · baseline: ${esc(name(comp.baselineId))}_`,
      "",
      `## Verdict`,
      "",
      `**${esc(v.headline)}** ${esc(v.sub)}`,
      ...v.notes.map((n) => `\n${esc(n)}`),
      "",
      `## Leaderboard`,
      "",
      "| Rank | Scenario | Score |",
      "| ---: | --- | ---: |",
      ...scoring.ranked.map((r, i) => `| ${i + 1} | ${esc(name(r.id))} | ${r.score.toFixed(0)} |`),
      "",
      `## Metrics`,
      "",
      `| Metric | ${comp.scenarios.map((s) => esc(s.name)).join(" | ")} |`,
      `| --- | ${comp.scenarios.map(() => "---:").join(" | ")} |`,
      ...keys.map((k) => `| ${meta[k].label} | ${comp.scenarios.map((s) => {
        const st = s.mc[k]!;
        const d = comp.vsBaseline[s.id]?.find((m) => m.key === k);
        return `${meta[k].format(st.mean)} (${meta[k].format(st.ciLower)}–${meta[k].format(st.ciUpper)})${d ? ` · ${deltaText(d.diff, d.pct, meta[k])}, ${fmtP(d.pValue)}${d.significant ? " ✓" : ""}` : ""}`;
      }).join(" | ")} |`),
      "",
      "✓ = statistically significant difference from the baseline.",
      "",
      `## What differs from the baseline`,
      "",
      ...comp.scenarios.filter((s) => s.id !== comp.baselineId).flatMap((s) => {
        const live = scenarios.find((x) => x.id === s.id);
        if (!live || !baseline) return [];
        const changes = diffGraphs(graphToSimNodes(baseline.nodes, baseline.edges), graphToSimNodes(live.nodes, live.edges)).map(changeText);
        const stress = describeConditions(live.stress);
        const all = [...stress.map((c) => `Stress: ${c}`), ...changes];
        return [`### ${esc(s.name)}`, "", ...(all.length ? all.map((c) => `- ${esc(c)}`) : ["- No changes"]), ""];
      }),
    ];
    return lines.join("\n");
  }

  const weightKeys = METRIC_KEYS.filter((k) => k !== "totalCost" || comp?.scenarios.every((s) => s.mc.totalCost) || !comp);

  return (
    <div className="space-y-5">
      <Explainer title="How is the winner decided?">
        <div className="grid gap-4 md:grid-cols-3">
          <p>
            Every scenario is run several times. Because each run is a little different, one setup can beat another just by luck. We use{" "}
            <b className="text-gray-900">Welch&apos;s t-test</b> to check whether each gap is bigger than that run-to-run noise.
          </p>
          <p>
            <b className="text-gray-900">Statistically significant</b> means a gap this big would happen by chance less than {Math.round((1 - settings.level) * 100)}% of the time if the setups were really
            equal ({levelText(settings.level)} confidence, set in Stress test → Customize).
          </p>
          <p>
            <b className="text-gray-900">Your priorities</b> turn the metrics into one score. We only call a winner when it also leads on your most important metric by more than noise; otherwise we say it&apos;s close.
          </p>
        </div>
      </Explainer>

      {/* ── Panes ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {scenarios.map((s) => (
          <ScenarioPane
            key={s.id}
            scenario={s}
            letter={letters[s.id]}
            baseline={baseline}
            isBaseline={s.id === baselineId}
            simType={p.simType}
            selectionCount={selectionCount}
            canEdit={p.canEdit && !!p.onApplyScenario}
            canRemove={scenarios.length > 1}
            canAdd={canAdd}
            disabled={p.busy}
            onChange={patch(s.id)}
            onSetBaseline={() => p.setBaselineId(s.id)}
            onCapture={() => recapture(s)}
            onDuplicate={() => duplicate(s)}
            onRemove={() => remove(s.id)}
            onSave={() => saveToLibrary(s)}
            onApply={() => setConfirmApply(s)}
          />
        ))}
        {canAdd && (
          // Big empty-slot card until there's a pair to compare; after that a slim full-width row so the grid has no hole.
          <div className={scenarios.length < 2
            ? `${cardCls} flex min-h-[220px] flex-col items-center justify-center gap-3 border-dashed p-6 text-center`
            : `${cardCls} flex flex-wrap items-center gap-3 border-dashed px-4 py-3 xl:col-span-2`}>
            <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-sf-f3f1ff text-fg-5742ff ${scenarios.length < 2 ? "h-12 w-12" : "h-9 w-9"}`}><Plus size={scenarios.length < 2 ? 22 : 17} aria-hidden /></span>
            <div className={scenarios.length < 2 ? "" : "min-w-0 flex-1"}>
              <p className="text-[13.5px] font-black text-gray-900">{scenarios.length === 0 ? "Add your first scenario" : `Add scenario ${SLOT_LETTERS[scenarios.length]}`}</p>
              <p className={`text-[12px] text-gray-500 ${scenarios.length < 2 ? "mx-auto mt-1 max-w-xs" : ""}`}>
                {scenarios.length < 2
                  ? <>Up to {MAX_SCENARIOS}. Load the canvas (or the blocks you&apos;ve box-selected), duplicate the baseline and tweak its numbers, or pick one from your library.</>
                  : `Optional · up to ${MAX_SCENARIOS} scenarios side by side.`}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={addFromCanvas} className={btnGhost}>
                <Layers size={14} /> {selectionCount > 0 ? `Load ${selectionCount} selected` : "Load full canvas"}
              </button>
              {baseline && <button type="button" onClick={() => duplicate(baseline)} className={btnGhost}><Copy size={14} /> Duplicate baseline</button>}
              {p.library.length > 0 && (
                <select aria-label="Add a saved scenario" value="" onChange={(e) => { const it = p.library.find((x) => x.id === e.target.value); if (it) loadFromLibrary(it); }} className={inputCls}>
                  <option value="">From library…</option>
                  {p.library.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Run bar ── */}
      <div className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-extrabold text-gray-700">Runs per scenario</span>
          <CountPicker label="Runs per scenario" value={settings.compareRuns} options={[10, 20, 50]} onChange={(compareRuns) => update({ compareRuns })} disabled={p.busy} />
          <span className="text-[11.5px] text-gray-500">{levelText(settings.level)} confidence · {formatDuration(durationSeconds)} per run</span>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button type="button" onClick={() => setLibraryOpen((o) => !o)} aria-expanded={libraryOpen} aria-controls="compare-library" className={`${btnGhost} flex-1 justify-center sm:flex-none`}>
            <BookMarked size={14} /> Library{p.library.length ? ` (${p.library.length})` : ""}
          </button>
          <button type="button" onClick={() => setPrioritiesOpen((o) => !o)} aria-expanded={prioritiesOpen} aria-controls="compare-priorities" className={`${btnGhost} flex-1 justify-center sm:flex-none`}>
            <SlidersHorizontal size={14} /> Priorities
          </button>
          <button type="button" onClick={handleRun} disabled={scenarios.length < 2 || p.busy} className={`${btnPrimary} flex-1 sm:flex-none`}>
            <Scale size={16} /> Compare {scenarios.length >= 2 ? `${scenarios.length} scenarios` : ""}
          </button>
        </div>
        {scenarios.length < 2 && <p className="w-full text-[11.5px] text-gray-500">Add at least two scenarios to compare.</p>}
        {p.otherBusyNote}
      </div>

      <AnimatePresence initial={false}>
        {libraryOpen && (
          <motion.section id="compare-library" aria-label="Scenario library" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`${cardCls} p-4 sm:p-5`}>
              <h3 className="text-[14px] font-extrabold text-gray-900">Saved scenarios</h3>
              <p className="mb-3 text-[12px] text-gray-600">Named scenarios for this project, stored in this browser. Save one with the disk icon on any pane.</p>
              {p.library.length === 0 ? (
                <p className="text-[12.5px] text-gray-500">Nothing saved yet.</p>
              ) : (
                <ul className="divide-y divide-ln-f1f0fa">
                  {p.library.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center gap-2 py-2">
                      <input defaultValue={it.name} aria-label="Saved scenario name" onBlur={(e) => e.target.value !== it.name && p.onLibrary.rename(it.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} className={`${inputCls} min-w-0 flex-1 border-transparent font-black hover:border-gray-200`} />
                      <span className="text-[11px] font-semibold text-gray-500">{(it.nodes as unknown[]).length} blocks · {new Date(it.savedAt).toLocaleDateString()}</span>
                      <button type="button" onClick={() => loadFromLibrary(it)} disabled={!canAdd} className={btnGhost}><Plus size={13} /> Add</button>
                      <button type="button" onClick={() => p.onLibrary.remove(it.id)} aria-label={`Delete saved scenario ${it.name}`} className={`flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.section>
        )}
        {prioritiesOpen && (
          <motion.section id="compare-priorities" aria-label="Priorities" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`${cardCls} grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.3fr_1fr]`}>
              <div className="space-y-4">
                <Field label="Start from a preset" help="Quick starting points. You can fine-tune every weight afterwards.">
                  <Segmented label="Priority preset" value={settings.weightPreset} options={WEIGHT_PRESETS.map((w) => ({ value: w.id, label: w.label }))} onChange={(id) => update({ weightPreset: id, weights: WEIGHT_PRESETS.find((w) => w.id === id)!.weights })} />
                </Field>
                <p className="text-[11.5px] text-gray-500">{WEIGHT_PRESETS.find((w) => w.id === settings.weightPreset)?.help ?? "Custom weights."}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {weightKeys.map((k) => (
                    <Field key={k} label={meta[k].label} help={`How much ${meta[k].label.toLowerCase()} matters in the overall score. 0 = ignore it, 5 = it matters most.`}>
                      <SliderField label={`Weight for ${meta[k].label}`} value={settings.weights[k]} min={0} max={5} step={1} onChange={(w) => update({ weights: { ...settings.weights, [k]: w }, weightPreset: "custom" })} format={(w) => `${w}/5`} />
                    </Field>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <Field label="Ideal bottleneck busy range" help="Utilization isn't simply 'higher is better': too low wastes staff, too high means queues explode on bad days. Scenarios inside this range score best; the further outside, the worse.">
                  <div className="flex items-center gap-2">
                    <NumberField label="Ideal range low" value={settings.utilBand[0]} min={0} max={settings.utilBand[1]} suffix="%" width="w-20" onCommit={(lo) => update({ utilBand: [lo, settings.utilBand[1]] })} />
                    <span className="text-gray-400">to</span>
                    <NumberField label="Ideal range high" value={settings.utilBand[1]} min={settings.utilBand[0]} max={100} suffix="%" width="w-20" onCommit={(hi) => update({ utilBand: [settings.utilBand[0], hi] })} />
                  </div>
                </Field>
                <Field label="Show in results" help="Hide metrics you don't care about from the comparison table. Hidden metrics still count in the score if they have weight.">
                  <div className="flex flex-wrap gap-1.5">
                    {METRIC_KEYS.map((k) => {
                      const on = !settings.hiddenMetrics.includes(k);
                      return (
                        <button key={k} type="button" aria-pressed={on} onClick={() => update({ hiddenMetrics: on ? [...settings.hiddenMetrics, k] : settings.hiddenMetrics.filter((x) => x !== k) })} className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1 ${on ? "bg-sf-efedff text-fg-4331e0 ring-indigo-200" : "bg-surface text-gray-500 ring-gray-200 line-through"} ${focusRing}`}>
                          {meta[k].label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {p.progressCard}
      {warning && <WarningCard message={warning} onDismiss={() => setWarning(null)} />}
      {error && <ErrorCard title={error.title} message={error.message} onRetry={handleRun} onDismiss={() => setError(null)} />}
      {stale && !p.busy && comp && (
        <p className="flex items-center gap-2 text-[12px] font-semibold text-amber-800">
          <AlertCircle size={14} aria-hidden /> Scenarios changed since this comparison ran. Compare again to update it.
        </p>
      )}

      {comp && scoring && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-black text-gray-900">Comparison results</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Export comparison">
            <button type="button" onClick={() => downloadFile(`${fileSlug(p.projectName)}-comparison.csv`, toCSV(rowsForCSV()), "text/csv")} className={btnGhost}><FileSpreadsheet size={14} /> CSV</button>
            <button type="button" onClick={async () => ((await copyText(summaryText())) ? toast.success("Summary copied.", "Copied") : toast.error("Your browser blocked clipboard access.", "Couldn't copy"))} className={btnGhost}><Copy size={14} /> Summary</button>
            <button type="button" onClick={() => downloadFile(`${fileSlug(p.projectName)}-comparison.md`, markdownReport(), "text/markdown")} className={btnGhost}><FileText size={14} /> Report (.md)</button>
          </div>
          </div>
          <CompareResults comp={comp} meta={meta} ranked={scoring.ranked} winner={scoring.winner} visible={visible} letters={letters} entity={p.entity} runLength={runLength} />
        </div>
      )}

      <Modal open={!!confirmApply} onClose={() => setConfirmApply(null)} title="Apply to the main canvas?" subtitle={confirmApply ? `Use "${confirmApply.name}" on your real model` : undefined} icon={<Upload size={18} />}>
        {confirmApply && (
          <div className="space-y-4 text-[13px] text-gray-600">
            <p>
              {confirmApply.sourceIds.length
                ? `This replaces the ${confirmApply.sourceIds.length} block${confirmApply.sourceIds.length === 1 ? "" : "s"} this scenario was loaded from with its ${confirmApply.nodes.length}-block version. Everything else on the canvas stays as it is.`
                : `This adds the scenario's ${confirmApply.nodes.length} blocks to the canvas.`}{" "}
              Collaborators see the change, and you can undo it with Ctrl+Z.
            </p>
            {!describeConditions(confirmApply.stress).length ? null : (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">Stress conditions ({describeConditions(confirmApply.stress).join(", ")}) are test settings and are not applied.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmApply(null)} className={btnGhost}>Cancel</button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  p.onApplyScenario?.(confirmApply);
                  setConfirmApply(null);
                }}
              >
                <Upload size={15} /> Apply to canvas
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
