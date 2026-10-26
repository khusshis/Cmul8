"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import { Trophy, Scale, Minus, ArrowUpRight, ArrowDownRight, ListOrdered, Crown } from "lucide-react";
import ChartCard from "@/components/ui/ChartCard";
import type { MetricComparison, MetricKey, ScenarioComparisonResult } from "@/lib/simulation/monteCarlo";
import type { ScoredEntry, WinnerCall } from "@/lib/simulation/decisionScore";
import { themeColor } from "@/components/ui/chartTheme";
import { HelpTip, LetterSwatch, RangeBar, deltaText, fmtP, levelText, niceTicks, type MetricMeta } from "./shared";

interface Props {
  comp: ScenarioComparisonResult;
  meta: Record<MetricKey, MetricMeta>;
  ranked: ScoredEntry[];
  winner: WinnerCall;
  visible: MetricKey[];
  letters: Record<string, string>;
  entity: string;
  runLength: string;
}

const pctWord = (p: number) => {
  const a = Math.abs(p);
  return `${a < 10 ? a.toFixed(1) : a.toFixed(0)}%`;
};

function phrase(m: MetricComparison, meta: MetricMeta, ent: string): string | null {
  // Zero baseline → no honest %, so say the absolute amount instead.
  const amt = m.pct !== null ? pctWord(m.pct) : meta.format(Math.abs(m.diff));
  const up = m.diff > 0;
  switch (m.key) {
    case "throughput": return `${amt} ${up ? "more" : "fewer"} ${ent}s completed`;
    case "avgWaitTime": return `${amt} ${up ? "more" : "less"} waiting`;
    case "totalCost": return `${amt} ${up ? "higher" : "lower"} cost`;
    case "healthScore": return `a health score ${Math.abs(m.diff).toFixed(0)} pts ${up ? "higher" : "lower"}`;
    default: return null;
  }
}

export const joinList = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** Plain-English verdict for N scenarios, consistent with the per-metric rows. */
export function buildVerdict(comp: ScenarioComparisonResult, winner: WinnerCall, meta: Record<MetricKey, MetricMeta>, entity: string) {
  const ent = entity.toLowerCase();
  const name = (id: string | null) => comp.scenarios.find((s) => s.id === id)?.name ?? "";
  const base = name(comp.baselineId);
  const top = winner.topMetric ? meta[winner.topMetric].label.toLowerCase() : "your top priority";
  const vs = (id: string) => {
    const rows = comp.vsBaseline[id] ?? [];
    const clauses = rows.filter((m) => m.significant && m.direction !== "neutral").map((m) => phrase(m, meta[m.key], ent)).filter((s): s is string => !!s);
    return clauses.length ? `Compared with ${base}, ${name(id)} shows ${joinList(clauses)}.` : "";
  };
  // Scenarios whose only real change is a neutral metric (utilization): say so instead of "noise".
  const neutralNotes = Object.entries(comp.vsBaseline)
    .filter(([, rows]) => rows.some((m) => m.significant) && rows.every((m) => !m.significant || m.direction === "neutral"))
    .map(([id, rows]) => `${name(id)}: only ${joinList(rows.filter((m) => m.significant).map((m) => meta[m.key].label.toLowerCase()))} changed for real, which is neither better nor worse by itself.`);

  let badge: { text: string; icon: React.ElementType };
  let headline: string;
  let sub: string;
  switch (winner.reason) {
    case "clear":
      badge = { text: `${name(winner.winnerId)} wins`, icon: Trophy };
      if (winner.winnerId === comp.baselineId) {
        headline = `${base} (your baseline) is still the best fit for your priorities.`;
        sub = `No alternative beats it on ${top}, your most important metric, by more than run-to-run noise.`;
      } else {
        headline = `${name(winner.winnerId)} is the best fit for your priorities.`;
        sub = `${vs(winner.winnerId!)} Its lead over ${name(winner.runnerUpId)} on ${top}, your most important metric, is statistically significant.`.trim();
      }
      break;
    case "not-significant":
      badge = { text: "Too close to call", icon: Scale };
      headline = `Too close to call between ${name(winner.leaderId)} and ${name(winner.runnerUpId)}.`;
      sub = `${name(winner.leaderId)} edges ahead on the weighted score, but its lead on ${top} (your most important metric) is within run-to-run noise. Add runs per scenario or try a bigger change.`;
      break;
    case "leader-worse-on-top":
      badge = { text: "Trade-off", icon: Scale };
      headline = `It's a trade-off: ${name(winner.leaderId)} scores best overall, ${name(winner.runnerUpId)} wins on ${top}.`;
      sub = `${name(winner.runnerUpId)} is significantly better on your most important metric, so the right choice depends on how much the other metrics matter to you.`;
      break;
    default:
      badge = { text: "No clear winner", icon: Minus };
      headline = "No meaningful difference between the scenarios.";
      sub = "They score the same on your priorities. Every gap is small enough to be random run-to-run noise.";
  }
  return { badge, headline, sub, notes: neutralNotes };
}

function CompareResults({ comp, meta, ranked, winner, visible, letters, entity, runLength }: Props) {
  const v = buildVerdict(comp, winner, meta, entity);
  const BadgeIcon = v.badge.icon;
  const byId = Object.fromEntries(comp.scenarios.map((s) => [s.id, s]));
  const runs = comp.scenarios.map((s) => s.mc.runCount);
  const rows = visible.filter((k) => comp.scenarios.every((s) => s.mc[k]));

  return (
    <div className="space-y-5">
      {/* ── Verdict ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        aria-label="Comparison verdict"
        className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-sf-1e1b4b via-sf-3b2fb8 to-sf-5742ff p-5 text-white shadow-[0_18px_40px_-14px_rgba(87,66,255,0.55)] sm:p-6"
      >
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-sf-e69f00/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-black uppercase tracking-wider ring-1 ring-white/25">
            <BadgeIcon size={13} aria-hidden /> {v.badge.text}
          </span>
          <span className="text-[11.5px] font-semibold text-white/70">
            {Math.min(...runs) === Math.max(...runs) ? `${runs[0]} runs each` : `${runs.join("/")} runs`} · each run = {runLength} simulated · {levelText(comp.level)} confidence
          </span>
        </div>
        <p className="relative mt-3 text-[19px] font-black leading-snug tracking-tight sm:text-[23px]">{v.headline}</p>
        <p className="relative mt-2 max-w-3xl text-[13px] leading-relaxed text-white/85">{v.sub}</p>
        {v.notes.map((n) => <p key={n} className="relative mt-1.5 max-w-3xl text-[12.5px] text-white/75">{n}</p>)}
      </motion.section>

      {/* ── Leaderboard ── */}
      <ChartCard
        icon={ListOrdered}
        title="Leaderboard for your priorities"
        description="Weighted score out of 100: 100 = best of these scenarios on everything you care about."
        help="Each metric is scored from 0 (worst of these scenarios) to 1 (best), with bottleneck busy scored by how close it is to your ideal range. Then we take a weighted average using your priority weights. The score ranks options; the verdict above also checks the lead is bigger than random noise."
        height={null}
      >
        <ol className="space-y-2.5">
          {ranked.map((r, i) => {
            const s = byId[r.id];
            if (!s) return null;
            return (
              <li key={r.id} className="grid grid-cols-[22px_1fr_auto] items-center gap-3">
                <span className="text-[13px] font-black tabular-nums text-gray-400">{i + 1}</span>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <LetterSwatch color={s.color} letter={letters[s.id] ?? "?"} />
                    <span className="truncate text-[13px] font-black text-gray-900">{s.name}</span>
                    {s.id === comp.baselineId && <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 text-[10px] font-black uppercase text-gray-600"><Crown size={10} aria-hidden /> baseline</span>}
                    {s.id === winner.winnerId && <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] font-black uppercase text-emerald-700 ring-1 ring-emerald-100">winner</span>}
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, r.score)}%`, background: themeColor(s.color) }} />
                  </div>
                </div>
                <span className="w-12 text-right text-[17px] font-black tabular-nums text-gray-900">{r.score.toFixed(0)}</span>
              </li>
            );
          })}
        </ol>
      </ChartCard>

      {/* ── Forest plot: one row per metric, each on its own scale (units never mixed) ── */}
      <section aria-label="Metric by metric comparison" className="rounded-[20px] border border-ln-ecebf7 bg-surface shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_36px_-24px_rgba(87,66,255,.3)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ln-f1f0fa px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-[14.5px] font-extrabold text-fg-161622">Metric by metric</h3>
            <p className="text-[12px] text-slate-600">Each row has its own scale. Dot = average · dark bar = {levelText(comp.level)} band for the average · faint bar = typical range of runs. Changes are vs the baseline.</p>
          </div>
          <ul className="flex flex-wrap gap-3 text-[11.5px] font-bold text-gray-700">
            {comp.scenarios.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5"><LetterSwatch color={s.color} letter={letters[s.id] ?? "?"} />{s.name}</li>
            ))}
          </ul>
        </div>
        <ul className="divide-y divide-ln-f6f5fc">
          {rows.map((k, i) => (
            <ForestRow key={k} metric={k} meta={meta[k]} comp={comp} letters={letters} delay={0.04 * i} />
          ))}
        </ul>
      </section>
    </div>
  );
}

export default memo(CompareResults);

function ForestRow({ metric, meta, comp, letters, delay }: { metric: MetricKey; meta: MetricMeta; comp: ScenarioComparisonResult; letters: Record<string, string>; delay: number }) {
  const stats = comp.scenarios.map((s) => s.mc[metric]!);
  let lo = Math.min(...stats.map((s) => Math.min(s.bandLo, s.ciLower)));
  let hi = Math.max(...stats.map((s) => Math.max(s.bandHi, s.ciUpper)));
  const pad = (hi - lo) * 0.06 || Math.max(1, Math.abs(hi) * 0.05);
  lo -= pad;
  hi += pad;
  const ticks = niceTicks(lo, hi, 3).filter((v, i, all) => v >= lo && v <= hi && all.findIndex((w) => meta.format(w) === meta.format(v)) === i);
  const Icon = meta.icon;
  const direction = comp.vsBaseline[Object.keys(comp.vsBaseline)[0]]?.find((m) => m.key === metric)?.direction;
  const betterNote = direction === "up" ? "Higher is better" : direction === "down" ? "Lower is better" : "Neither direction is automatically better";

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className="relative grid gap-4 px-4 py-4 transition-colors last:rounded-b-[20px] focus-within:z-10 hover:z-10 hover:bg-sf-faf9ff sm:px-5 md:grid-cols-[200px_1fr_250px] md:items-center"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sf-5742ff/10 text-fg-5742ff"><Icon size={14} /></span>
          <span className="text-[13px] font-black leading-tight text-gray-900">{meta.label}</span>
          <HelpTip text={meta.help} label={`About ${meta.label}`} align="start" />
        </div>
        <p className="mt-1 text-[11px] font-medium text-gray-500">{betterNote}</p>
      </div>

      <div className="min-w-0">
        {comp.scenarios.map((s, i) => (
          <div key={s.id} className="mb-2 grid grid-cols-[18px_1fr_auto] items-center gap-2.5">
            <LetterSwatch color={s.color} letter={letters[s.id] ?? "?"} />
            <RangeBar stat={stats[i]} color={s.color} domain={[lo, hi]} />
            <span className="w-[86px] text-right text-[12px] font-bold text-gray-800 tabular-nums">{meta.format(stats[i].mean)}</span>
          </div>
        ))}
        <div className="relative ml-[28px] mr-[96px] h-3.5" aria-hidden>
          {ticks.map((v) => (
            <span key={v} className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-500 tabular-nums" style={{ left: `${((v - lo) / (hi - lo)) * 100}%` }}>{meta.format(v)}</span>
          ))}
        </div>
      </div>

      <ul className="space-y-1.5 md:text-right">
        {comp.scenarios.filter((s) => s.id !== comp.baselineId).map((s) => {
          const m = comp.vsBaseline[s.id]?.find((x) => x.key === metric);
          if (!m) return null;
          const tone = m.better === "scenario" ? "text-emerald-700" : m.better === "baseline" ? "text-rose-700" : "text-gray-700";
          const DeltaIcon = m.diff > 0 ? ArrowUpRight : m.diff < 0 ? ArrowDownRight : Minus;
          const verdict = Number.isNaN(m.pValue)
            ? "needs ≥ 2 runs"
            : m.significant
              ? m.direction === "neutral" ? "real change" : "significant"
              : "within noise";
          const ci = Number.isFinite(m.ciLower) ? `${levelText(m.level)} CI ${meta.formatDiff(m.ciLower)} to ${meta.formatDiff(m.ciUpper)}` : "";
          return (
            <li key={s.id} className="flex items-center gap-2 md:justify-end" title={`${s.name} vs baseline: ${meta.formatDiff(m.diff)}. ${ci}. ${fmtP(m.pValue)}.`}>
              <LetterSwatch color={s.color} letter={letters[s.id] ?? "?"} size={14} />
              <span className={`inline-flex items-center gap-0.5 text-[15px] font-black tabular-nums ${tone}`}>
                <DeltaIcon size={14} aria-hidden />
                {deltaText(m.diff, m.pct, meta)}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${m.significant ? (m.better === "scenario" ? "bg-emerald-50 text-emerald-700" : m.better === "baseline" ? "bg-rose-50 text-rose-700" : "bg-indigo-50 text-indigo-700") : "bg-gray-100 text-gray-600"}`}>
                {verdict} · {fmtP(m.pValue)}
              </span>
              <span className="sr-only">{ci}</span>
            </li>
          );
        })}
      </ul>
    </motion.li>
  );
}
