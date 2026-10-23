"use client";

import React from "react";
import { FlaskConical, Gauge, RotateCcw, Target as TargetIcon, TrendingUp } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { CONFIDENCE_LEVELS, METRIC_KEYS, RISK_BANDS, type MetricKey } from "@/lib/simulation/monteCarlo";
import { describeConditions, NEUTRAL_CONDITIONS, type StressConditions } from "@/lib/simulation/stressTransforms";
import { sweepSteps } from "@/lib/simulation/stressAnalysis";
import { Field, NumberField, Segmented, SliderField, btnGhost, btnPrimary, cardCls, formatDuration, focusRing, inputCls, levelText, type MetricMeta } from "./shared";
import { MAX_RUNS, MAX_SWEEP_RUNS, MIN_RUNS, UNIT_SECONDS, type LabSettings, type TimeUnit } from "./settings";

const x = (v: number) => `${Number(v.toFixed(2))}×`;

function Section({ icon: Icon, title, help, children, action }: { icon: React.ElementType; title: string; help: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={`${cardCls} p-4 sm:p-5`} aria-label={title}>
      <header className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3F1FF] text-[#5742FF]"><Icon size={16} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-extrabold text-[#161622]">{title}</h3>
          <p className="text-[12px] text-slate-600">{help}</p>
        </div>
        {action}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Editor for what-if multipliers; reused per scenario in A/B compare. */
export function ConditionsEditor({ value, onChange, sources, disabled, compact }: { value: StressConditions; onChange: (c: StressConditions) => void; sources: { id: string; label: string }[]; disabled?: boolean; compact?: boolean }) {
  const set = (p: Partial<StressConditions>) => onChange({ ...value, ...p });
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <Field label="Demand" help="Multiplies how often new items arrive at every Start Point. 1.5× = 50% busier than today; 0.8× = a quiet day.">
        <SliderField label="Demand multiplier" value={value.demand} min={0.25} max={3} step={0.05} onChange={(demand) => set({ demand })} format={x} disabled={disabled} />
      </Field>
      {sources.length > 1 && (
        <details className="rounded-xl border border-gray-100 bg-[#FAFAFE] px-3 py-2">
          <summary className={`cursor-pointer text-[11.5px] font-extrabold text-gray-700 ${focusRing}`}>Set demand per Start Point</summary>
          <ul className="mt-2 space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-[12px] font-bold text-gray-700">{s.label}</span>
                <NumberField
                  label={`Demand multiplier for ${s.label}`}
                  value={value.demandBySource?.[s.id] ?? value.demand}
                  min={0}
                  max={10}
                  step={0.05}
                  suffix="×"
                  width="w-20"
                  disabled={disabled}
                  onCommit={(m) => set({ demandBySource: { ...value.demandBySource, [s.id]: m } })}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
      <Field label="Service time" help="Multiplies how long each step takes (servers, fixed delays, channel delays). 1.2× = every task takes 20% longer, e.g. new or tired staff.">
        <SliderField label="Service time multiplier" value={value.service} min={0.25} max={3} step={0.05} onChange={(service) => set({ service })} format={x} disabled={disabled} />
      </Field>
      <Field label="Servers per station" help="Adds or removes parallel servers at every staffed station. Stations set to unlimited stay unlimited, and no station drops below 1.">
        <SliderField label="Servers added or removed" value={value.capacityDelta} min={-3} max={5} step={1} onChange={(capacityDelta) => set({ capacityDelta })} format={(v) => (v > 0 ? `+${v}` : `${v}`)} disabled={disabled} />
      </Field>
    </div>
  );
}

export default function StressCustomize({
  settings,
  update,
  sources,
  meta,
  hasCost,
  canvasSeconds,
  busy,
  secondsPerRun,
  onRunSweep,
}: {
  settings: LabSettings;
  update: (p: Partial<LabSettings>) => void;
  sources: { id: string; label: string }[];
  meta: Record<MetricKey, MetricMeta>;
  hasCost: boolean;
  canvasSeconds: number;
  busy: boolean;
  secondsPerRun: number;
  onRunSweep: () => void;
}) {
  const metricOptions = METRIC_KEYS.filter((k) => k !== "totalCost" || hasCost).map((k) => ({ value: k, label: meta[k].label }));
  const sw = settings.sweep;
  const steps = sweepSteps(sw.from, sw.to, sw.steps);
  const sweepRuns = steps.length * sw.runsPerStep;
  const overCap = sweepRuns > MAX_SWEEP_RUNS;
  const chips = describeConditions(settings.conditions, (id) => sources.find((s) => s.id === id)?.label ?? id);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section icon={FlaskConical} title="Test setup" help="How many runs, how long each one is, and how strict the statistics are.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F8F7FF] px-3 py-2.5">
          <div>
            <p className="text-[12.5px] font-extrabold text-gray-800">Run until precise</p>
            <p className="text-[11.5px] text-gray-600">Keep adding runs until the average is pinned down, then stop.</p>
          </div>
          <Switch checked={settings.mode === "precise"} onChange={(on) => update({ mode: on ? "precise" : "fixed" })} label="Run until precise" />
        </div>
        {settings.mode === "precise" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Precision" help="Stop once the confidence band for the average is within ± this % of it. 5% is a good default; 2% needs many more runs.">
              <NumberField label="Precision percent" value={settings.precisionPct} min={0.5} max={50} step={0.5} suffix="%" width="w-20" onCommit={(precisionPct) => update({ precisionPct })} />
            </Field>
            <Field label="For metric" help="Which number has to reach that precision.">
              <select aria-label="Metric to make precise" value={settings.precisionMetric} onChange={(e) => update({ precisionMetric: e.target.value as MetricKey })} className={`${inputCls} w-full`}>
                {metricOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Max runs" help={`Safety cap so a very noisy model can't run forever (${MIN_RUNS}–${MAX_RUNS}).`}>
              <NumberField label="Maximum runs" value={settings.maxRuns} min={MIN_RUNS} max={MAX_RUNS} width="w-20" onCommit={(v) => update({ maxRuns: Math.round(v) })} />
            </Field>
          </div>
        ) : (
          <Field label="Custom run count" help={`Any number from ${MIN_RUNS} to ${MAX_RUNS}. More runs = a tighter, more trustworthy average, but it takes longer.`}>
            <NumberField label="Custom run count" value={settings.runs} min={MIN_RUNS} max={MAX_RUNS} width="w-24" suffix="runs" onCommit={(v) => update({ runs: Math.round(v) })} />
          </Field>
        )}
        <Field label="Simulated time per run" help={`How much time each run simulates. By default it matches the canvas setting (${formatDuration(canvasSeconds)}).`}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] font-bold text-gray-700">
              <input type="checkbox" checked={settings.duration.override} onChange={(e) => update({ duration: { ...settings.duration, override: e.target.checked } })} className="h-4 w-4 accent-[#5742FF]" />
              Override
            </label>
            <NumberField label="Simulated duration" value={settings.duration.value} min={1} max={100000} width="w-20" disabled={!settings.duration.override} onCommit={(value) => update({ duration: { ...settings.duration, value } })} />
            <select aria-label="Duration unit" disabled={!settings.duration.override} value={settings.duration.unit} onChange={(e) => update({ duration: { ...settings.duration, unit: e.target.value as TimeUnit } })} className={`${inputCls} disabled:opacity-50`}>
              {(Object.keys(UNIT_SECONDS) as TimeUnit[]).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {!settings.duration.override && <span className="text-[11.5px] text-gray-500">using {formatDuration(canvasSeconds)}</span>}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Confidence level" help="How sure the bands should be. 95% is standard. 99% gives wider, safer bands and a stricter bar for calling a difference real; 90% is looser. Used everywhere, including A/B compare.">
            <Segmented label="Confidence level" value={settings.level} options={CONFIDENCE_LEVELS.map((l) => ({ value: l, label: levelText(l) }))} onChange={(level) => update({ level })} />
          </Field>
          <Field label="Risk band" help="The 'bad day to good day' range of individual runs. P5–P95 covers the middle 90% of runs; P1–P99 is more cautious and shows rarer extremes.">
            <Segmented label="Risk band" value={settings.riskQ} options={RISK_BANDS.map((b) => ({ value: b.q, label: b.label }))} onChange={(riskQ) => update({ riskQ })} />
          </Field>
        </div>
      </Section>

      <Section
        icon={Gauge}
        title="Stress conditions"
        help="Try your system under pressure without touching the canvas. Applied to a copy for each run."
        action={
          chips.length > 0 ? (
            <button type="button" onClick={() => update({ conditions: NEUTRAL_CONDITIONS })} className={btnGhost} aria-label="Reset stress conditions">
              <RotateCcw size={13} /> Reset
            </button>
          ) : undefined
        }
      >
        <ConditionsEditor value={settings.conditions} onChange={(conditions) => update({ conditions })} sources={sources} />
        <p className="text-[11.5px] text-gray-500">Variability can&apos;t be changed here: the engine&apos;s timing distributions don&apos;t expose a spread setting. Change a block&apos;s distribution type on the canvas instead.</p>
      </Section>

      <Section icon={TargetIcon} title="Targets" help="Say what 'good enough' means. We'll show how often runs meet it, mark misses on the charts, and use it to find the breaking point.">
        <ul className="space-y-2.5">
          {settings.targets
            .filter((t) => t.metric !== "totalCost" || hasCost)
            .map((t) => {
              const m = meta[t.metric];
              const set = (p: Partial<typeof t>) => update({ targets: settings.targets.map((x) => (x.metric === t.metric ? { ...x, ...p } : x)) });
              return (
                <li key={t.metric} className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-[160px] flex-1 items-center gap-2 text-[12.5px] font-bold text-gray-800">
                    <input type="checkbox" checked={t.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-4 w-4 accent-[#5742FF]" />
                    {m.label}
                  </label>
                  <span className="w-5 text-center text-[13px] font-black text-gray-500" aria-hidden>{t.op === "max" ? "≤" : "≥"}</span>
                  <NumberField label={`${m.label} target (${t.op === "max" ? "at most" : "at least"})`} value={t.value} min={0} width="w-24" suffix={m.unit} disabled={!t.enabled} onCommit={(value) => set({ value })} />
                </li>
              );
            })}
        </ul>
        <p className="text-[11.5px] text-gray-500">Median wait is in simulated seconds (120 = 2 minutes).</p>
      </Section>

      <Section icon={TrendingUp} title="Breaking point" help="Re-run the model at rising demand levels to find where it stops coping.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="From" help="Lowest demand to test, as a multiple of today's arrival rate.">
            <NumberField label="Sweep from" value={sw.from} min={0.1} max={sw.to - 0.1} step={0.1} suffix="×" width="w-20" onCommit={(from) => update({ sweep: { ...sw, from } })} />
          </Field>
          <Field label="To" help="Highest demand to test.">
            <NumberField label="Sweep to" value={sw.to} min={sw.from + 0.1} max={10} step={0.1} suffix="×" width="w-20" onCommit={(to) => update({ sweep: { ...sw, to } })} />
          </Field>
          <Field label="Steps" help="How many demand levels between From and To (including both ends).">
            <NumberField label="Sweep steps" value={sw.steps} min={2} max={15} width="w-16" onCommit={(steps) => update({ sweep: { ...sw, steps: Math.round(steps) } })} />
          </Field>
          <Field label="Runs per step" help="Runs at each demand level. 10 is usually enough to see the trend.">
            <NumberField label="Runs per step" value={sw.runsPerStep} min={3} max={100} width="w-16" onCommit={(runsPerStep) => update({ sweep: { ...sw, runsPerStep: Math.round(runsPerStep) } })} />
          </Field>
        </div>
        <Field label="Watch metric" help="The number charted against demand. Your targets (if any) decide where it 'breaks'.">
          <select aria-label="Sweep metric" value={sw.metric} onChange={(e) => update({ sweep: { ...sw, metric: e.target.value as MetricKey } })} className={`${inputCls} w-full sm:w-auto`}>
            {metricOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F8F7FF] px-3 py-2.5">
          <p className={`text-[12px] font-bold ${overCap ? "text-rose-700" : "text-gray-700"}`}>
            {steps.length} steps × {sw.runsPerStep} runs = <span className="tabular-nums">{sweepRuns}</span> runs
            {overCap ? ` (over the ${MAX_SWEEP_RUNS}-run limit)` : ` · about ${formatDuration(sweepRuns * secondsPerRun).replace(" s", " sec")} of computing`}
          </p>
          <button type="button" onClick={onRunSweep} disabled={busy || overCap} className={`${btnPrimary} py-2 text-[12.5px]`}>
            <TrendingUp size={14} /> Find breaking point
          </button>
        </div>
        {chips.length > 0 && <p className="text-[11.5px] text-gray-500">Your stress conditions apply too; the sweep multiplies demand on top of them.</p>}
      </Section>
    </div>
  );
}
