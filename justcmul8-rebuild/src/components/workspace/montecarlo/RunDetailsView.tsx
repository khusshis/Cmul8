"use client";

import React, { memo } from "react";
import { Users, LogOut, Hourglass, Timer, Layers, Gauge, Lightbulb, ListChecks, CheckCircle2 } from "lucide-react";
import ChartCard from "@/components/ui/ChartCard";
import { fmtSeconds } from "@/components/ui/chartTheme";
import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";
import type { RunDetails, Spread } from "@/lib/simulation/runDetails";
import { riskBandLabel } from "@/lib/simulation/monteCarlo";
import { cardCls } from "./shared";

const count = (v: number) => (!Number.isFinite(v) ? "—" : Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : String(Number(v.toFixed(1))));
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v)}%` : "—");
const time = (v: number) => (Number.isFinite(v) ? fmtSeconds(v) : "—");
const range = (s: Spread, f: (v: number) => string) => (s.n > 1 && s.lo !== s.hi ? `${f(s.lo)} – ${f(s.hi)}` : null);

function Tile({ icon: Icon, label, s, f, help }: { icon: React.ElementType; label: string; s: Spread; f: (v: number) => string; help: string }) {
  const r = range(s, f);
  return (
    <div className={`${cardCls} p-3.5`} title={help}>
      <p className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-gray-500">
        <Icon size={13} className="text-fg-5742ff" aria-hidden /> {label}
      </p>
      <p className="mt-1.5 text-[20px] font-black leading-none tabular-nums text-gray-900">{f(s.mean)}</p>
      <p className="mt-1 text-[11px] font-semibold text-gray-500 tabular-nums">{r ? `typical ${r}` : "same every run"}</p>
    </div>
  );
}

function RunDetailsView({ d, entity, domainLabel, riskQ }: { d: RunDetails; entity: string; domainLabel: string; riskQ: number }) {
  const band = riskBandLabel(riskQ);
  return (
    <div className="space-y-4">
      <ChartCard
        icon={ListChecks}
        title="Across all runs"
        description={`The single-run numbers, averaged over every run. "Typical" is the ${band} range of runs.`}
        help="Each run gives its own arrivals, waits and leftovers; these are their averages, with the range most runs fell in."
        height={null}
      >
        <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <Tile icon={Users} label={`${entity}s arrived`} s={d.arrived} f={count} help="How many came in per run." />
          <Tile icon={CheckCircle2} label="Finished" s={d.finishedPct} f={pct} help="Share of arrivals that made it all the way through." />
          <Tile icon={Hourglass} label="Still inside at end" s={d.stillInside} f={count} help="Arrived but not finished or gone when the run ended." />
          <Tile icon={LogOut} label="Left without service" s={d.lost} f={count} help={`${entity}s turned away at a full line or who gave up waiting.`} />
          <Tile icon={Timer} label="Typical visit" s={d.typicalVisit} f={time} help="Median door-to-door time of finished visits." />
          <Tile icon={Timer} label="Slowest 5% waited" s={d.slowWait} f={time} help="The wait only the unluckiest 5% exceeded." />
          <Tile icon={Layers} label="Inside on average" s={d.avgInside} f={count} help="Average number in the system at any moment." />
        </div>
      </ChartCard>

      {d.kpis.length > 0 && (
        <ChartCard icon={Gauge} title={`${domainLabel} metrics across runs`} description="The same metric cards as a single run's results, averaged over every run." height={null}>
          <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {d.kpis.map((k) => (
              <Tile
                key={k.key + k.label}
                icon={Gauge}
                label={k.label}
                s={k.value}
                f={(v) => (k.isPct ? pct(v) : Number.isFinite(v) ? `${count(v)} ${k.unit}` : "—")}
                help={`${k.label}, per run.`}
              />
            ))}
          </div>
        </ChartCard>
      )}

      <ChartCard icon={Layers} title="Stations across runs" description={`Averages per run, with the ${band} range of runs in grey.`} height={null}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[680px] text-[12.5px]">
            <thead>
              <tr className="border-b border-ln-f1f0fa text-left text-[10.5px] font-black uppercase tracking-wider text-gray-500">
                <th scope="col" className="px-2 py-2">Station</th>
                <th scope="col" className="px-2 py-2 text-right">Arrived</th>
                <th scope="col" className="px-2 py-2 text-right">Finished</th>
                <th scope="col" className="px-2 py-2 text-right">Avg wait</th>
                <th scope="col" className="px-2 py-2 text-right">Busy</th>
                <th scope="col" className="px-2 py-2 text-right">In line at end</th>
                <th scope="col" className="px-2 py-2 text-right">Left</th>
                <th scope="col" className="px-2 py-2 text-right">Bottleneck</th>
              </tr>
            </thead>
            <tbody>
              {d.stations.map((s) => {
                const cell = (sp: Spread, f: (v: number) => string) => (
                  <>
                    <span className="font-bold tabular-nums text-gray-900">{f(sp.mean)}</span>
                    {range(sp, f) && <span className="block text-[10.5px] font-semibold tabular-nums text-gray-500">{range(sp, f)}</span>}
                  </>
                );
                return (
                  <tr key={s.id} className={`border-b border-ln-f4f3fb last:border-0 ${s.bottleneckShare >= 0.5 ? "bg-rose-50/60 dark:bg-rose-500/10" : ""}`}>
                    <th scope="row" className="px-2 py-2 text-left">
                      <span className="block font-bold text-gray-900">{s.label}</span>
                      <span className="text-[11px] font-semibold text-gray-500">{NODE_LABELS[s.nodeType as keyof typeof NODE_LABELS] || s.nodeType}</span>
                    </th>
                    <td className="px-2 py-2 text-right">{cell(s.arrived, count)}</td>
                    <td className="px-2 py-2 text-right">{cell(s.finished, count)}</td>
                    <td className="px-2 py-2 text-right">{s.avgWait.mean > 0 ? cell(s.avgWait, time) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-2 py-2 text-right">{s.busy ? cell(s.busy, pct) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-2 py-2 text-right">{s.inLine.mean > 0 ? cell(s.inLine, count) : <span className="text-gray-400">0</span>}</td>
                    <td className="px-2 py-2 text-right">{s.lost.mean > 0 ? cell(s.lost, count) : <span className="text-gray-400">0</span>}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{s.bottleneckShare > 0 ? `${Math.round(s.bottleneckShare * 100)}% of runs` : <span className="font-normal text-gray-400">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {d.topRec && (
        <section className="relative overflow-hidden rounded-[20px] border border-ln-8d80ff bg-linear-to-br from-sf-6a57ff via-sf-5742ff to-sf-4531e5 p-4 text-white shadow-[0_18px_40px_-22px_rgba(87,66,255,.9)]" aria-label="Suggested fix">
          <p className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-white/80">
            <Lightbulb size={13} aria-hidden /> Suggested fix · top suggestion in {Math.round(d.topRec.share * 100)}% of runs
          </p>
          <h4 className="mt-2 text-[15px] font-black leading-snug">{d.topRec.title}</h4>
          <p className="mt-1 text-[12.5px] leading-snug text-white/85">{d.topRec.action}</p>
          <p className="mt-2 text-[12.5px] font-bold">Impact (typical run): {d.topRec.impact}</p>
        </section>
      )}
    </div>
  );
}

export default memo(RunDetailsView);
