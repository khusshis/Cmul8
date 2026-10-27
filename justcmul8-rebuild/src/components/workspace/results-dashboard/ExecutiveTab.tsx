"use client";

import { toast } from "@/components/ui/Toast";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  CheckCircle2,
  Gauge,
  AlertTriangle,
  Clock,
  Boxes,
  Zap,
  Activity,
  Check,
  DollarSign,
  Loader2,
  ShieldCheck,
  Lightbulb,
  BrainCircuit,
  SlidersHorizontal,
} from "lucide-react";
import type { OptimizerFix, OptimizerRecommendation } from "@/app/api/ai/optimize/route";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { resolveKpiMetrics } from "@/lib/simulation/resolveKpiMetrics";
import MetricCard from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/ChartCard";
import { TONES, downsample, fmtMoney, fmtSeconds, isNum, maxOf } from "@/components/ui/chartTheme";
import { fmtPerTime } from "@/lib/simulation/units";

function kpiIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("wait") || k.includes("latency") || k.includes("time")) return Clock;
  if (k.includes("util")) return Gauge;
  if (k.includes("completed") || k.includes("served")) return CheckCircle2;
  if (k.includes("depth") || k.includes("inventory") || k.includes("level")) return Boxes;
  if (k.includes("dropped") || k.includes("late")) return AlertTriangle;
  return Activity;
}

export default function ExecutiveTab({
  result,
  simType,
  onApplyFix,
}: {
  result: SimResult;
  simType: SimTypeId;
  onApplyFix?: (fix: OptimizerFix) => void;
}) {
  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;
  const entity = simConfig.entityName;
  const efficiencyRate =
    result.totalArrived > 0
      ? Math.round((result.totalCompleted / result.totalArrived) * 100)
      : 100;
  const stillInside = Math.max(0, result.totalArrived - result.totalCompleted);
  const simSecs = Math.max(1, result.totalSimTime);

  const healthScore = result.healthScore ?? 85;
  const healthTone = healthScore >= 80 ? TONES.good : healthScore >= 60 ? TONES.warn : TONES.bad;
  const aiDiagnosis = result.aiDiagnosis;
  const resolvedKpis = resolveKpiMetrics(simConfig.kpiMetrics, result);
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;
  const waitP = result.waitTimePercentiles;
  const hasCost = !!result.costAnalysis && result.costAnalysis.totalSystemCost > 0;

  // Cumulative finished count over time, for the sparkline.
  const finishedTrend = useMemo(
    () => downsample(result.timeline ?? [], 40).map((t) => t.completed),
    [result.timeline]
  );

  const [aiRecs, setAiRecs] = useState<OptimizerRecommendation[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [appliedFixIds, setAppliedFixIds] = useState<Set<number>>(new Set());

  async function runAiOptimizer() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, simType }),
      });
      const data = await res.json();
      if (data.recommendations && Array.isArray(data.recommendations)) {
        setAiRecs(data.recommendations);
      } else if (data.error) {
        toast.error(data.error, res.status === 402 ? "Out of credits" : "Optimizer unavailable");
      }
    } catch (err) {
      console.error("AI Optimizer Request Failed:", err);
      toast.error("Couldn't reach the optimizer. Check your connection and try again.", "Optimizer unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  const activeRecommendations: OptimizerRecommendation[] = aiRecs || aiDiagnosis?.recommendations || [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Top row: health + AI summary ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          aria-label="System health score"
          className="relative flex flex-col overflow-hidden rounded-[24px] border border-ln-e7e3ff bg-linear-to-br from-surface to-sf-f4f2ff p-5 shadow-[0_14px_36px_-24px_rgba(87,66,255,.35)] sm:p-6 lg:col-span-4"
        >
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl dark:opacity-[.16] dark:![background:var(--solid)]" style={{ background: healthTone.tint, ["--solid" as string]: healthTone.solid }} />
          <div className="relative flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-fg-4331e0">System health</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: healthTone.tint, color: healthTone.text }}>
              {healthScore >= 80 ? "Running great" : healthScore >= 60 ? "Needs attention" : "Heavy congestion"}
            </span>
          </div>

          <div className="relative my-4 flex items-center justify-center">
            <div className="relative h-40 w-40" role="img" aria-label={`Health score ${healthScore} out of 100`}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="78%" outerRadius="100%" data={[{ value: healthScore }]} startAngle={90} endAngle={-270}>
                  <defs>
                    <linearGradient id="exec-health-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={healthTone.solid} stopOpacity={0.65} />
                      <stop offset="100%" stopColor={healthTone.solid} />
                    </linearGradient>
                  </defs>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" fill="url(#exec-health-grad)" cornerRadius={12} background={{ fill: "var(--color-sf-ecebfa)" }} isAnimationActive />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[38px] font-black leading-none text-fg-161622 tabular-nums">{healthScore}</span>
                <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">of 100</span>
              </div>
            </div>
          </div>

          <dl className="relative space-y-2 border-t border-ln-ecebf7 pt-3 text-[12.5px] text-slate-600">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5"><Check size={14} className="text-emerald-600" aria-hidden /> Completion rate</dt>
              <dd className="font-bold text-fg-161622 tabular-nums">{efficiencyRate}% finished</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5"><Check size={14} className="text-fg-5742ff" aria-hidden /> Flow balance</dt>
              <dd className="font-bold text-fg-161622">{result.littlesLaw?.isStable ? "Smooth flow" : "Line building up"}</dd>
            </div>
          </dl>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          aria-label="AI performance summary"
          className="flex flex-col justify-between rounded-[24px] border border-ln-ecebf7 bg-surface p-5 shadow-[0_14px_36px_-24px_rgba(16,24,40,.25)] sm:p-6 lg:col-span-8"
        >
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sf-f3f1ff text-fg-5742ff"><BrainCircuit size={15} aria-hidden /></span>
              <span className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-fg-4331e0">AI summary</span>
            </div>
            <h2 className="mb-2 text-[19px] font-extrabold tracking-tight text-fg-161622 sm:text-[21px]">
              {aiDiagnosis?.title || "System performance overview"}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-slate-600">
              {aiDiagnosis?.summary ||
                `The simulation ran for ${fmtSeconds(result.totalSimTime)} across ${Object.keys(result.nodeStats).length} stations.`}
            </p>
          </div>

          <div
            className="mt-4 flex items-start gap-3.5 rounded-2xl border p-4"
            style={{
              background: bottleneck ? TONES.warn.tint : TONES.good.tint,
              borderColor: bottleneck ? "var(--color-ln-fcd9a0)" : "var(--color-ln-bdebd6)",
            }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface"
              style={{ color: bottleneck ? TONES.warn.text : TONES.good.text }}
            >
              {bottleneck ? <AlertTriangle size={18} aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
            </span>
            <div className="min-w-0 text-[13px] leading-relaxed">
              <p className="font-extrabold text-fg-161622">
                {bottleneck ? (
                  <>Biggest delay: <span className="break-words">“{bottleneck.label}”</span></>
                ) : (
                  "Work is flowing evenly across all stations"
                )}
              </p>
              <p className="text-slate-700">
                {aiDiagnosis?.bottleneckCause ||
                  (bottleneck
                    ? `Busy ${Math.round((bottleneck.utilization ?? 0) * 100)}% of the time, with an average wait of ${fmtSeconds(bottleneck.avgWaitTime)}.`
                    : "No station is building a long line.")}
              </p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* ── Headline KPIs ── */}
      <div className={`grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 ${hasCost ? "md:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4"}`}>
        <MetricCard
          icon={Users}
          tone="info"
          label={`${entity}s arrived`}
          value={result.totalArrived}
          caption={`${fmtPerTime(result.totalArrived / simSecs)} on average`}
          help={`How many ${entity.toLowerCase()}s entered the system during the run.`}
          delay={0.08}
        />
        <MetricCard
          icon={CheckCircle2}
          tone="good"
          label={`${entity}s finished`}
          value={result.totalCompleted}
          caption={`${fmtPerTime(result.totalCompleted / simSecs)} leaving`}
          trend={finishedTrend.length > 1 ? finishedTrend : undefined}
          trendLabel="Finished count over the run"
          help={`How many ${entity.toLowerCase()}s made it all the way through. The line shows the running total over time.`}
          delay={0.12}
        />
        <MetricCard
          icon={Gauge}
          tone={efficiencyRate >= 90 ? "good" : efficiencyRate >= 70 ? "warn" : "bad"}
          label="Completion rate"
          value={efficiencyRate}
          unit="%"
          caption={`${stillInside.toLocaleString()} still in the system at the end`}
          progress={efficiencyRate}
          help="Finished divided by arrived. Close to 100% means the system keeps up with demand; lower means work piles up."
          delay={0.16}
        />
        <MetricCard
          icon={Clock}
          tone="warn"
          label="Typical wait"
          value={isNum(waitP?.p50) ? waitP!.p50 : 0}
          format={fmtSeconds}
          caption={<>Unlucky 5% wait <b className="text-fg-161622">{fmtSeconds(waitP?.p95)}</b> or more</>}
          range={
            waitP && waitP.max > 0
              ? { min: 0, max: waitP.max, value: waitP.p50, marker: waitP.p95, minLabel: "0s", markerLabel: "p95", maxLabel: `max ${fmtSeconds(waitP.max)}` }
              : undefined
          }
          help="Half of everyone waited less than this (the median). The bar runs from no wait to the longest wait; the tick marks where the slowest 5% begin."
          delay={0.2}
        />
        {hasCost && (
          <MetricCard
            icon={DollarSign}
            tone="brand"
            label="Total system cost"
            value={result.costAnalysis!.totalSystemCost}
            format={(n) => fmtMoney(n)}
            caption={`${fmtMoney(result.costAnalysis!.costPerCompletedEntity)} per finished ${entity.toLowerCase()}`}
            help="Staff and machine time, held inventory and waiting penalties added together, using the costs you set on each block."
            delay={0.24}
          />
        )}
      </div>

      {/* ── Domain KPIs + recommendations ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-6" aria-labelledby="exec-domain-kpis">
          <h3 id="exec-domain-kpis" className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-slate-600">
            {simConfig.label} metrics
          </h3>

          {resolvedKpis.length === 0 ? (
            <div className="rounded-[20px] border border-ln-ecebf7 bg-surface">
              <EmptyState compact title="No extra metrics for this simulation type" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
              {resolvedKpis.map((kpi, idx) => {
                const series = kpi.series && kpi.series.length > 1 ? kpi.series : null;
                const seriesMax = series ? maxOf(series.map((s) => s.value), 1) : 1;
                return (
                  <MetricCard
                    key={kpi.key + idx}
                    size="sm"
                    icon={kpiIcon(kpi.key)}
                    tone="brand"
                    label={kpi.label}
                    value={kpi.displayValue}
                    caption={kpi.series ? `Across ${kpi.series.length} station${kpi.series.length === 1 ? "" : "s"}${kpi.unit ? ` · ${kpi.unit}` : ""}` : kpi.unit || undefined}
                    delay={0.05 + idx * 0.03}
                  >
                    {series && (
                      <ul className="space-y-1.5 border-t border-ln-f1f0fa pt-2.5" aria-label={`${kpi.label} by station`}>
                        {[...series].sort((a, b) => b.value - a.value).slice(0, 3).map((item, sIdx) => (
                          <li key={sIdx} className="flex items-center gap-2 text-[11px]">
                            <span className="w-[72px] shrink-0 truncate font-semibold text-slate-600" title={item.name}>{item.name}</span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <span className="block h-full rounded-full bg-linear-to-r from-sf-8b7bff to-sf-5742ff" style={{ width: `${Math.min(100, (item.value / seriesMax) * 100)}%` }} />
                            </span>
                            <span className="shrink-0 font-bold tabular-nums text-fg-161622">
                              {isNum(item.value) ? item.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                              {kpi.unit === "%" ? "%" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </MetricCard>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 lg:col-span-6" aria-labelledby="exec-recs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="exec-recs" className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-fg-4331e0">
              {aiRecs ? "AI recommendations" : "Ways to speed things up"}
            </h3>
            <button
              onClick={runAiOptimizer}
              disabled={aiLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ln-8d80ff bg-linear-to-b from-sf-6a57ff to-sf-5742ff px-3 text-[12px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(87,66,255,.8)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <SlidersHorizontal size={13} aria-hidden />}
              {aiLoading ? "Analyzing…" : "Optimize with AI"}
            </button>
          </div>

          {activeRecommendations.length === 0 ? (
            <div className="rounded-[20px] border border-ln-ecebf7 bg-surface">
              <EmptyState
                compact
                icon={Lightbulb}
                title="No suggestions yet"
                hint="Click “Optimize with AI” to get specific changes for this layout."
              />
            </div>
          ) : (
            <ol className="space-y-2.5">
              {activeRecommendations.map((rec, i) => {
                const fix = rec.fix;
                const applied = appliedFixIds.has(i);
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="group flex items-start gap-3.5 rounded-[18px] border border-ln-ecebf7 bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-[border-color,box-shadow] hover:border-ln-d9d3fb hover:shadow-[0_12px_28px_-20px_rgba(87,66,255,.45)]"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sf-f3f1ff text-[12px] font-black text-fg-5742ff">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <h4 className="text-[13.5px] font-extrabold text-fg-161622 group-hover:text-fg-4331e0">{rec.title}</h4>
                        {isNum(rec.confidence) && (
                          <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: TONES.good.tint, color: TONES.good.text }} title="How confident the model is in this change">
                            {Math.round(rec.confidence)}% confident
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{rec.action}</p>
                      {rec.impact && <p className="mt-1 text-[12px] font-semibold text-fg-4331e0">Expected benefit: {rec.impact}</p>}

                      {fix && onApplyFix && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ln-f1f0fa pt-2.5">
                          <span className="min-w-0 truncate text-[11.5px] font-semibold text-slate-600" title={fix.description}>Fix: {fix.description}</span>
                          <button
                            onClick={() => {
                              onApplyFix(fix);
                              setAppliedFixIds((prev) => new Set([...prev, i]));
                            }}
                            disabled={applied}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ln-5742ff/50 ${
                              applied ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-sf-5742ff text-white hover:bg-sf-4531e5"
                            }`}
                          >
                            {applied ? <><Check size={13} strokeWidth={3} aria-hidden /> Applied</> : <><Zap size={13} fill="currentColor" aria-hidden /> Apply fix</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
