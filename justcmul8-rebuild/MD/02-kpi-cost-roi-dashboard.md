# Feature: Cost & ROI Dashboard Panel

## Status before this feature
**Not started (0%).** This is the display half of the Cost & ROI feature — it depends on `result.costAnalysis` existing, which is built in `MD/01-cost-roi-calculator.md`. **Implement that file first.** `src/components/workspace/AdvancedResultsDashboard.tsx` currently has 7 tabs (`executive`, `analytics`, `flow`, `timeline`, `blocks`, `entities`, `logs`) and none of them show cost data. `ExecutiveTab.tsx`'s 4 hero stat cards are Arrived / Completed / Completion Rate / Wait Time — no dollar figures anywhere.

## What this feature does
Adds an 8th dashboard tab, **"Cost & ROI"**, showing:
- Total System Cost (big hero number)
- Cost breakdown per node (bar chart — resource cost vs holding cost vs waiting penalty)
- Cost per completed entity
- A plain-English line like *"Adding 1 extra machine costs $200/day, but saves $850/day in delayed order penalties — Net ROI: +$650/day"* (this is the exact example the professor-facing pitch used)

---

## Implementation plan

### Step 1 — Register the new tab

File: `src/components/workspace/AdvancedResultsDashboard.tsx`

```ts
// Around line 31
export type DashboardTab =
  | "executive"
  | "analytics"
  | "flow"
  | "timeline"
  | "blocks"
  | "entities"
  | "logs"
  | "cost";   // ← new

// Around line 40, add to TABS array (use DollarSign from lucide-react, already a common icon lib here)
const TABS: { id: DashboardTab; label: string; icon: any }[] = [
  { id: "executive", label: "Executive Summary", icon: LayoutGrid },
  { id: "analytics", label: "Flow & Balance Check", icon: Scale },
  { id: "flow", label: "Traffic Heatmap", icon: Flame },
  { id: "timeline", label: "Line Buildup Timeline", icon: TrendingUp },
  { id: "blocks", label: "Station Counters", icon: Table2 },
  { id: "entities", label: "Person / Item Journey", icon: User },
  { id: "logs", label: "Live Activity Log", icon: ScrollText },
  { id: "cost", label: "Cost & ROI", icon: DollarSign },  // ← new
];
```

Then wire the render branch (find where `tab === "executive" ? <ExecutiveTab .../> : tab === "analytics" ? ...` is chained, around where the tab content switches — grep this file for `<ExecutiveTab` to find the exact spot) and add:

```tsx
: tab === "cost" ? (
  <CostRoiTab result={result} simType={simType} />
)
```

And import it at the top alongside the other tab imports:
```ts
import CostRoiTab from "./results-dashboard/CostRoiTab";
```

### Step 2 — Build the tab component

New file: `src/components/workspace/results-dashboard/CostRoiTab.tsx`

Model this directly on the existing `ExecutiveTab.tsx` (same `HeroStatCard`-style pattern, same Tailwind classes, same `recharts` usage — that file already imports `ResponsiveContainer, BarChart, Bar, Tooltip` from `recharts`, reuse the same imports here for consistency):

```tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingDown, Users, PieChart as PieChartIcon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { useCountUp } from "@/lib/hooks/useCountUp";

export default function CostRoiTab({ result, simType }: { result: SimResult; simType: SimTypeId }) {
  const cost = result.costAnalysis;

  if (!cost || cost.totalSystemCost === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#5742FF] flex items-center justify-center mb-4">
          <DollarSign size={26} />
        </div>
        <h3 className="text-[16px] font-extrabold text-gray-900 mb-1.5">No Cost Data Yet</h3>
        <p className="text-[13px] text-gray-500 max-w-md">
          Set an Hourly Cost on a Resource node, or Holding Cost / Waiting Penalty on a Queue node,
          in the Node Configuration Panel — then re-run the simulation to see the financial breakdown here.
        </p>
      </div>
    );
  }

  const chartData = cost.breakdown.map((b) => ({
    name: b.nodeLabel,
    "Resource Cost": Math.round(b.resourceCost * 100) / 100,
    "Holding Cost": Math.round(b.holdingCost * 100) / 100,
    "Waiting Penalty": Math.round(b.waitingPenalty * 100) / 100,
  }));

  const totalCostAnimated = useCountUp(cost.totalSystemCost, 900, 2);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <DollarSign size={20} />
          </div>
          <div className="text-[28px] font-black text-gray-900">${totalCostAnimated}</div>
          <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mt-1">
            Total System Cost
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center mb-3">
            <Users size={20} />
          </div>
          <div className="text-[28px] font-black text-gray-900">
            ${cost.costPerCompletedEntity.toFixed(2)}
          </div>
          <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mt-1">
            Cost Per Completed Entity
          </div>
        </motion.div>

        {cost.roiVsBaseline && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-[20px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 shadow-sm p-5"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <TrendingDown size={20} />
            </div>
            <div className="text-[28px] font-black text-emerald-700">
              -${cost.roiVsBaseline.savedCost.toFixed(2)}
            </div>
            <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mt-1">
              Saved vs Baseline ({cost.roiVsBaseline.savedPercent.toFixed(0)}% ROI)
            </div>
          </motion.div>
        )}
      </div>

      <div className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon size={16} className="text-[#5742FF]" />
          <span className="text-[13px] font-extrabold text-gray-900">Cost Breakdown by Station</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Resource Cost" stackId="a" fill="#5742FF" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Holding Cost" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Waiting Penalty" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

`useCountUp` already exists at `src/lib/hooks/useCountUp.ts` (used by `ExecutiveTab.tsx`) — reuse it, don't reimplement.

### Step 3 — Add a Cost quick-glance card to the Executive tab (optional but recommended)

In `src/components/workspace/results-dashboard/ExecutiveTab.tsx`, the 4-card grid (around line 253) currently shows Arrived / Completed / Completion Rate / Wait Time. If `result.costAnalysis` is present, consider swapping the layout to a 5-card grid (`md:grid-cols-5`) and adding:

```tsx
{result.costAnalysis && (
  <HeroStatCard
    icon={DollarSign}
    label="Total System Cost"
    value={result.costAnalysis.totalSystemCost}
    decimals={2}
    suffix=""
    color="#10B981"
    delay={0.3}
    subtext={`$${result.costAnalysis.costPerCompletedEntity.toFixed(2)} per completed ${SIM_TYPE_REGISTRY[simType].entityName.toLowerCase()}`}
  />
)}
```
(Import `DollarSign` from `lucide-react` into `ExecutiveTab.tsx`'s existing icon import list.)

### Step 4 — CSV/PDF export should include cost data too

Once this tab exists, note for whoever implements `MD/05-executive-pdf-report.md` and the CSV export route (`src/app/api/projects/[id]/export/route.ts`) that `result.costAnalysis` should be included in those outputs as well — don't duplicate the cost-formatting logic, write one small shared formatter (e.g. `formatCostBreakdown(cost: CostAnalysis): string[]` in `src/lib/simulation/reportGenerator.ts`) that both the CSV route and the HTML/PDF report call.

---

## Files touched
- `src/components/workspace/AdvancedResultsDashboard.tsx` — new tab id, new tab button, new render branch
- `src/components/workspace/results-dashboard/CostRoiTab.tsx` — new file
- `src/components/workspace/results-dashboard/ExecutiveTab.tsx` — optional 5th hero card

## Dependencies
Requires `MD/01-cost-roi-calculator.md` to be implemented first (needs `result.costAnalysis` to exist).

## Definition of done
- [ ] "Cost & ROI" tab appears in the 8-tab switcher and is clickable on both desktop (`xl:flex` row) and mobile (scrollable row) — this file already renders `TABS.map()` twice for both layouts, make sure both loops pick up the new tab automatically (they do, since both map over the same `TABS` array — no extra work needed there).
- [ ] With cost params set on at least one node, the tab shows a non-zero Total System Cost and a populated bar chart.
- [ ] With no cost params set, the tab shows the empty state, not a crash or a $0 chart.
