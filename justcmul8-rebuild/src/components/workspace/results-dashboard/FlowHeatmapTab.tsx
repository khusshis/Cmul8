"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, ArrowDownToLine, ArrowUpFromLine, Network } from "lucide-react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";
import { EmptyState } from "@/components/ui/ChartCard";
import { HelpTip } from "@/components/ui/MetricCard";
import { TONES, fmtSeconds } from "@/components/ui/chartTheme";

const LEVELS = [
  { max: 50, label: "Free flow", tone: TONES.good },
  { max: 80, label: "Moderate", tone: TONES.warn },
  { max: Infinity, label: "Choked", tone: TONES.bad },
] as const;
const levelOf = (heat: number) => LEVELS.find((l) => heat <= l.max) ?? LEVELS[2];

export default function FlowHeatmapTab({
  result,
}: {
  result: SimResult;
  simType: SimTypeId;
}) {
  // Congestion heat index (0 to 100) per node
  const nodesWithHeat = useMemo(
    () =>
      Object.entries(result.nodeStats).map(([nodeId, stat]) => {
        let heat = 0;
        const util = stat.utilization || 0;
        const renege = stat.renegeCount || 0;
        const wait = stat.avgWaitTime || 0;

        if (stat.nodeType === "queue" || stat.nodeType === "store") {
          heat = Math.min(100, Math.round(((stat.currentDepth || 0) * 15) + (renege * 20) + (wait * 5)));
        } else if (stat.nodeType === "resource" || stat.nodeType === "service" || stat.nodeType === "priority_resource") {
          heat = Math.min(100, Math.round(util * 100));
        } else {
          heat = stat.entitiesIn > 0 ? 10 : 0;
        }
        return { nodeId, stat, heat: Number.isFinite(heat) ? heat : 0 };
      }),
    [result.nodeStats]
  );

  if (nodesWithHeat.length === 0) {
    return (
      <div className="rounded-[24px] border border-ln-ecebf7 bg-surface">
        <EmptyState icon={Network} title="No stations to score" hint="Add blocks to your canvas and run the simulation to see where congestion builds." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Legend banner ── */}
      <div className="flex flex-col gap-3 rounded-[22px] border border-ln-e7e3ff bg-linear-to-r from-sf-f4f2ff via-surface to-sf-fff6ec p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface text-fg-d55e00 shadow-sm"><Flame size={16} aria-hidden /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-[15px] font-extrabold text-fg-161622">Congestion heatmap</h3>
              <HelpTip
                align="start"
                label="How the heat score works"
                text="Staff and machines score by how busy they were (90% busy = 90). Waiting lines score by how many are still queued, how many gave up, and how long people waited. Other blocks score low."
              />
            </div>
            <p className="text-[12.5px] text-slate-600">Each station gets a 0–100 congestion score. The bottleneck is outlined in red.</p>
          </div>
        </div>
        <ul className="flex shrink-0 flex-wrap gap-2 text-[11.5px] font-bold" aria-label="Heat levels">
          {LEVELS.map((l, i) => (
            <li key={l.label} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 shadow-[0_1px_2px_rgba(16,24,40,.06)]" style={{ color: l.tone.text }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.tone.solid }} aria-hidden />
              {l.label} <span className="font-semibold text-slate-500">{i === 0 ? "0–50" : i === 1 ? "51–80" : "81+"}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Station cards ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {nodesWithHeat.map(({ nodeId, stat, heat }, i) => {
          const bottleneck = result.bottleneckNodeId === nodeId;
          const level = levelOf(heat);
          const t = level.tone;
          return (
            <motion.article
              key={nodeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className={`group relative flex flex-col overflow-hidden rounded-[20px] border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_var(--ring)] motion-reduce:transform-none sm:p-5 ${
                bottleneck ? "border-rose-300 ring-2 ring-rose-400/25" : "border-ln-ecebf7"
              }`}
              style={{ ["--ring" as string]: t.ring }}
              aria-label={`${stat.label}: congestion ${heat} of 100, ${level.label}${bottleneck ? ", bottleneck" : ""}`}
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${t.solid}, transparent 90%)` }} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="min-w-0 break-words text-[14.5px] font-extrabold tracking-tight text-fg-161622">{stat.label}</h4>
                    {bottleneck && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white dark:bg-sf-be123c">Bottleneck</span>
                    )}
                  </div>
                  <span className="text-[12px] font-semibold text-slate-500">
                    {NODE_LABELS[stat.nodeType as keyof typeof NODE_LABELS] || stat.nodeType}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[26px] font-black leading-none tabular-nums" style={{ color: t.text }}>
                    {heat}
                    <span className="text-[11px] font-bold text-slate-500">/100</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold" style={{ color: t.text }}>{level.label}</div>
                </div>
              </div>

              {/* Heat gauge */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${TONES.good.solid}, ${heat > 50 ? TONES.warn.solid : TONES.good.solid}, ${heat > 80 ? TONES.bad.solid : heat > 50 ? TONES.warn.solid : TONES.good.solid})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, heat)}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-sf-fbfaff p-3 text-center">
                <div>
                  <dt className="flex items-center justify-center gap-1 text-[10.5px] font-bold uppercase text-slate-500"><ArrowDownToLine size={11} aria-hidden /> In</dt>
                  <dd className="text-[17px] font-black tabular-nums text-fg-161622">{(stat.entitiesIn ?? 0).toLocaleString()}</dd>
                </div>
                <div className="border-l border-ln-ecebf7">
                  <dt className="flex items-center justify-center gap-1 text-[10.5px] font-bold uppercase text-slate-500"><ArrowUpFromLine size={11} aria-hidden /> Out</dt>
                  <dd className="text-[17px] font-black tabular-nums text-emerald-700">{(stat.entitiesOut ?? 0).toLocaleString()}</dd>
                </div>
              </dl>

              <dl className="mt-3 space-y-1.5 text-[12px] text-slate-600">
                {stat.utilization !== undefined && (
                  <div className="flex items-center justify-between">
                    <dt>Busy</dt>
                    <dd className="font-bold tabular-nums text-fg-161622">{Math.round((stat.utilization || 0) * 100)}%</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt>Average wait</dt>
                  <dd className="font-bold tabular-nums text-fg-161622">{fmtSeconds(stat.avgWaitTime)}</dd>
                </div>
                {(stat.renegeCount ?? 0) > 0 && (
                  <div className="flex items-center justify-between font-bold text-rose-700">
                    <dt>Gave up waiting</dt>
                    <dd className="tabular-nums">{stat.renegeCount!.toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
