"use client";

import React from "react";
import { DollarSign, TrendingDown, Users, BarChart3, ArrowUpRight, Lightbulb } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import MetricCard from "@/components/ui/MetricCard";
import ChartCard, { EmptyState } from "@/components/ui/ChartCard";
import ChartTooltip from "@/components/ui/ChartTooltip";
import { AXIS, GRID, axisLabel, fmtMoney, niceMaxFloat } from "@/components/ui/chartTheme";

const COST_KINDS = [
  { key: "Resource Cost", label: "Staff & machine time", color: "var(--color-sf-5742ff)" },
  { key: "Holding Cost", label: "Holding inventory", color: "var(--color-sf-e69f00)" },
  { key: "Waiting Penalty", label: "Waiting penalty", color: "var(--color-sf-d55e00)" },
] as const;

const shortName = (s: string) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);

export default function CostRoiTab({ result, simType }: { result: SimResult; simType: SimTypeId }) {
  const cost = result.costAnalysis;
  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;
  const entity = simConfig.entityName.toLowerCase();

  if (!cost || cost.totalSystemCost === 0) {
    return (
      <div className="rounded-[24px] border border-ln-ecebf7 bg-surface shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)]">
        <EmptyState
          icon={DollarSign}
          title="No costs set up yet"
          hint={
            <>
              Set an <strong>hourly cost</strong> on a staff or machine block, or a <strong>holding cost</strong> / <strong>waiting penalty</strong> on a queue,
              then run the simulation again to see the money side here.
            </>
          }
          action={
            <span className="inline-flex items-center gap-2 rounded-xl border border-ln-e7e3ff bg-sf-f6f4ff px-4 py-2 text-[12.5px] font-bold text-fg-4331e0">
              <ArrowUpRight size={14} aria-hidden /> Tip: click any block on the canvas to set its costs
            </span>
          }
        />
      </div>
    );
  }

  const chartData = cost.breakdown.map((b) => ({
    name: b.nodeLabel,
    "Resource Cost": Math.round(b.resourceCost * 100) / 100,
    "Holding Cost": Math.round(b.holdingCost * 100) / 100,
    "Waiting Penalty": Math.round(b.waitingPenalty * 100) / 100,
  }));

  const totals = {
    resource: cost.breakdown.reduce((sum, b) => sum + b.resourceCost, 0),
    holding: cost.breakdown.reduce((sum, b) => sum + b.holdingCost, 0),
    penalty: cost.breakdown.reduce((sum, b) => sum + b.waitingPenalty, 0),
  };
  const shareTotal = totals.resource + totals.holding + totals.penalty || 1;
  const shares = [totals.resource, totals.holding, totals.penalty].map((v) => (v / shareTotal) * 100);
  const roi = cost.roiVsBaseline;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <MetricCard
          icon={DollarSign}
          tone="brand"
          label="Total system cost"
          value={cost.totalSystemCost}
          format={(n) => fmtMoney(n)}
          caption={`Across ${cost.breakdown.length} cost centre${cost.breakdown.length === 1 ? "" : "s"}`}
          help="Everything this run cost: staff and machine time, inventory held in queues, and penalties for making people wait."
        >
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={COST_KINDS.map((k, i) => `${k.label} ${Math.round(shares[i])}%`).join(", ")}>
            {COST_KINDS.map((k, i) => (
              <span key={k.key} className="h-full" style={{ width: `${shares[i]}%`, background: k.color }} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-slate-600">
            {COST_KINDS.map((k, i) => (
              <span key={k.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: k.color }} aria-hidden />{Math.round(shares[i])}%</span>
            ))}
          </div>
        </MetricCard>

        <MetricCard
          icon={Users}
          tone="info"
          label={`Cost per finished ${entity}`}
          value={cost.costPerCompletedEntity}
          format={(n) => fmtMoney(n)}
          caption={`${result.totalCompleted.toLocaleString()} ${entity}s finished`}
          help={`Total cost divided by the number of ${entity}s that made it all the way through. Lower is better.`}
          delay={0.05}
        />

        {roi ? (
          <MetricCard
            icon={TrendingDown}
            tone={roi.savedCost >= 0 ? "good" : "bad"}
            label="Saved vs baseline"
            value={Math.abs(roi.savedCost)}
            format={(n) => fmtMoney(n)}
            delta={{ value: roi.savedPercent, goodWhen: "up", text: `${roi.savedPercent.toFixed(0)}%`, label: "saved compared with the baseline run" }}
            caption={`Baseline cost was ${fmtMoney(roi.baselineCost)}`}
            help="How much cheaper this run is than the baseline you compared it with."
            delay={0.1}
          />
        ) : (
          <MetricCard
            icon={Lightbulb}
            tone="neutral"
            label="Return on investment"
            value="Compare a change"
            caption="Try adding a worker at the bottleneck and re-run to see whether lower waiting penalties pay for it."
            delay={0.1}
          />
        )}
      </div>

      <ChartCard
        icon={BarChart3}
        title="Cost by station"
        description="Each bar is one station's total, split by what drove it. Tall orange or red slices mean waiting is costing you money."
        legend={COST_KINDS.map((k) => ({ label: k.label, color: k.color }))}
        height={300}
        empty={chartData.length === 0}
        delay={0.12}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} tickFormatter={shortName} tick={{ ...AXIS.tick, fontSize: 10.5 }} />
            <YAxis {...AXIS} domain={[0, niceMaxFloat]} tickFormatter={(v: number) => fmtMoney(v, true).replace(/\.00$/, "")} width={64} label={axisLabel("Cost (USD)")} />
            <Tooltip cursor={{ fill: "rgba(87,66,255,0.05)" }} content={<ChartTooltip valueFormatter={(v) => fmtMoney(v)} />} />
            {COST_KINDS.map((k, i) => (
              <Bar key={k.key} dataKey={k.key} name={k.label} stackId="cost" fill={k.color} maxBarSize={56} radius={i === COST_KINDS.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section aria-labelledby="cost-table-title" className="overflow-hidden rounded-[22px] border border-ln-ecebf7 bg-surface shadow-[0_14px_36px_-24px_rgba(87,66,255,.3)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ln-f1f0fa p-4 sm:p-5">
          <h3 id="cost-table-title" className="text-[14px] font-extrabold text-fg-161622">Station cost summary</h3>
          <span className="text-[12px] font-medium text-slate-600">Calculated from the simulated run</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-ln-f1f0fa bg-sf-faf9ff text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                <th scope="col" className="px-4 py-3">Station</th>
                <th scope="col" className="px-4 py-3 text-right">Staff & machines</th>
                <th scope="col" className="px-4 py-3 text-right">Holding</th>
                <th scope="col" className="px-4 py-3 text-right">Waiting penalty</th>
                <th scope="col" className="px-4 py-3 text-right text-fg-161622">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ln-f4f3fb">
              {cost.breakdown.map((b) => (
                <tr key={b.nodeId} className="transition-colors hover:bg-sf-faf9ff">
                  <th scope="row" className="px-4 py-3 font-bold text-fg-161622">{b.nodeLabel}</th>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-700">{b.resourceCost > 0 ? fmtMoney(b.resourceCost) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-amber-800">{b.holdingCost > 0 ? fmtMoney(b.holdingCost) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-orange-800">{b.waitingPenalty > 0 ? fmtMoney(b.waitingPenalty) : "—"}</td>
                  <td className="px-4 py-3 text-right font-extrabold tabular-nums text-fg-161622">{fmtMoney(b.totalCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ln-ecebf7 bg-sf-faf9ff font-black text-fg-161622">
                <th scope="row" className="px-4 py-3 text-left">Total</th>
                <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totals.resource)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-800">{fmtMoney(totals.holding)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-orange-800">{fmtMoney(totals.penalty)}</td>
                <td className="px-4 py-3 text-right text-[14px] tabular-nums text-fg-4331e0">{fmtMoney(cost.totalSystemCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
