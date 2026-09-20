# Feature: Cost & ROI Financial Calculator

## Status before this feature
**Not started (0%).** Grep confirms zero matches for `cost`, `roi`, `price`, `holdingCost`, `waitingPenalty` anywhere in `src/lib/simulation/types.ts` or `src/components/workspace/NodePropertiesPanel.tsx`. No cost math exists in `analyticsEngine.ts`.

## What this feature does
Lets the user attach real-world dollar costs to nodes (resource hourly rate, buffer holding cost, waiting-penalty cost) and see a computed **Total System Cost** and **ROI** on the results dashboard. This is what turns the project from "a queueing demo" into "an industrial engineering / operations-research tool" — the single highest business-value feature on the list, and it's also the cheapest to build because every other layer (charts, dashboard tabs, node params) already exists and only needs new fields, not new architecture.

## Why it matters for the synopsis
Bridges CS with industrial engineering / management — professors specifically call this out as a differentiator from "just another web app."

---

## Implementation plan

This feature has 4 layers. Build them in this exact order — each layer is testable on its own before moving to the next.

### Layer 1 — Add cost fields to the type system

File: `src/lib/simulation/types.ts`

Add optional cost fields to the params interfaces that represent something with cost. Do **not** make them required — existing saved projects have no cost data and must keep working.

```ts
// Add to ResourceParams (around line 101)
export interface ResourceParams {
  capacity: number;
  serviceTimeMean: number;
  serviceDistribution: DistributionType;
  isPreemptive?: boolean;
  meanTimeBetweenFailures?: number;
  repairTimeMean?: number;
  repairDistribution?: DistributionType;
  repairmanNodeId?: string;
  repairPriority?: number;

  // ── Cost & ROI (new) ──────────────────────────────────────────────────────
  /** Cost per unit sim-time this resource is busy (e.g. $/hour of a worker/machine). */
  hourlyCost?: number;
}

// Add to QueueParams (around line 80)
export interface QueueParams {
  capacity: number;
  discipline: QueueDiscipline;
  patienceTimeout?: number;
  patienceDistribution?: DistributionType;
  patienceMin?: number;
  patienceMax?: number;
  soldOutThreshold?: number;
  broadcastRenege?: boolean;

  // ── Cost & ROI (new) ──────────────────────────────────────────────────────
  /** Cost per unit sim-time per entity sitting in this queue (inventory/buffer holding cost). */
  holdingCostPerUnitTime?: number;
  /** Dollar penalty incurred once per unit of sim-time an entity waits here (customer dissatisfaction cost). */
  waitingPenaltyPerUnitTime?: number;
}

// Add to ContainerParams (around line 136) — same holding-cost idea for tanks/inventory
export interface ContainerParams {
  capacity: number;
  initialLevel: number;
  fillRate: number;
  holdingCostPerUnitTime?: number;
}
```

Then extend `SimResult` (around line 371) with the computed cost/ROI output the UI will read:

```ts
export interface CostBreakdown {
  nodeId: string;
  nodeLabel: string;
  resourceCost: number;      // hourlyCost * busySeconds
  holdingCost: number;       // holdingCostPerUnitTime * entity-seconds-in-queue
  waitingPenalty: number;    // waitingPenaltyPerUnitTime * entity-seconds-waited
  totalCost: number;
}

export interface CostAnalysis {
  totalSystemCost: number;
  breakdown: CostBreakdown[];
  costPerCompletedEntity: number;
  /** Only present when comparing against a baseline run (see Monte Carlo MD for scenario diffing). */
  roiVsBaseline?: {
    baselineCost: number;
    savedCost: number;
    savedPercent: number;
  };
}

export interface SimResult {
  // ...existing fields...
  costAnalysis?: CostAnalysis;
}
```

### Layer 2 — UI inputs in the Node Configuration Panel

File: `src/components/workspace/NodePropertiesPanel.tsx` (982 lines, one function per node type, e.g. `ResourceProperties`, `QueueProperties`, `ContainerProperties`)

Every field in this file follows the exact same hand-rolled pattern — no shared `NumberField` component exists, so match it exactly. This is the real `ResourceProperties` function (around line 686):

```tsx
function ResourceProperties({ params, nodeId, onUpdate, theme, isPriorityNode }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Server} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Staff & Counter Capacity
      </SectionHeading>

      <div>
        <label className={labelCls}>Number of Staff / Parallel Counters</label>
        <input type="number" min={1} value={params.capacity ?? 1}
          onChange={(e) => setParam("capacity", Number(e.target.value))} className={modernInputCls} />
      </div>
      {/* ...serviceTimeMean, serviceDistribution, isPreemptive... */}
```

Add a new `<div>` block right after the existing fields, in the exact same shape — a `<label className={labelCls}>` plus `<input type="number" className={modernInputCls}>` bound through `setParam`:

```tsx
      {/* ── Cost & ROI (new) ── */}
      <SectionHeading icon={DollarSign} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Cost & ROI
      </SectionHeading>
      <div>
        <label className={labelCls}>Hourly Cost ($/hr)</label>
        <input
          type="number"
          min={0}
          step={0.5}
          value={params.hourlyCost ?? 0}
          onChange={(e) => setParam("hourlyCost", Number(e.target.value))}
          className={modernInputCls}
        />
        <span className="text-[11px] text-gray-400">Wage or operating cost while this resource is busy</span>
      </div>
```

Do the same inside `QueueProperties` for `holdingCostPerUnitTime` and `waitingPenaltyPerUnitTime`, and inside `ContainerProperties` for `holdingCostPerUnitTime`. Import `DollarSign` from `lucide-react` at the top of the file (it already imports many icons from `lucide-react` — add to that existing import list, don't create a new import statement).

### Layer 3 — Compute the cost roll-up

File: `src/lib/simulation/analyticsEngine.ts`

Add a new function near `calculateResourceOperationalStates` (this is the function that already knows `busySeconds` per resource, which is exactly what's needed for resource cost):

```ts
export function calculateCostAnalysis(
  graph: SimGraph,               // pass the original SimGraph so params are available
  result: SimResult,
  resourceStates: Record<string, ResourceOperationalStates>
): CostAnalysis {
  const breakdown: CostBreakdown[] = [];
  let totalSystemCost = 0;

  for (const node of graph.nodes) {
    const stats = result.nodeStats[node.id];
    if (!stats) continue;

    let resourceCost = 0;
    let holdingCost = 0;
    let waitingPenalty = 0;

    if (node.nodeType === "resource" || node.nodeType === "priority_resource") {
      const p = node.params as ResourceParams;
      const busySeconds = resourceStates[node.id]?.busySeconds ?? 0;
      resourceCost = (p.hourlyCost ?? 0) * (busySeconds / 3600);
    }

    if (node.nodeType === "queue" || node.nodeType === "container") {
      const p = node.params as QueueParams & ContainerParams;
      // Approximate entity-seconds-in-queue via avgWaitTime * entitiesIn (L*W relationship,
      // consistent with how littlesLaw already estimates WIP elsewhere in this file).
      const entitySecondsWaited = stats.avgWaitTime * stats.entitiesIn;
      holdingCost = (p.holdingCostPerUnitTime ?? 0) * entitySecondsWaited;
      waitingPenalty = (p.waitingPenaltyPerUnitTime ?? 0) * entitySecondsWaited;
    }

    const totalCost = resourceCost + holdingCost + waitingPenalty;
    if (totalCost > 0) {
      breakdown.push({
        nodeId: node.id,
        nodeLabel: node.label,
        resourceCost,
        holdingCost,
        waitingPenalty,
        totalCost,
      });
      totalSystemCost += totalCost;
    }
  }

  return {
    totalSystemCost,
    breakdown,
    costPerCompletedEntity: result.totalCompleted > 0 ? totalSystemCost / result.totalCompleted : 0,
  };
}
```

Wire it into `enrichSimResult()` (around line 626). **Important:** `enrichSimResult` currently only receives `rawResult: SimResult` — it does not have access to the `SimGraph` (node params), because params live on the ReactFlow nodes in `page.tsx`, not inside `SimResult`. You have two options:
- **(Recommended)** Change `enrichSimResult(rawResult: SimResult, graph?: SimGraph)` to accept the graph as a second optional argument, and pass `graphToSimNodes(nodes, edges)` from `page.tsx` at both call sites (`page.tsx:112` in the `engine.onComplete` handler, and `AdvancedResultsDashboard.tsx:69` inside the `useMemo`). If `graph` is omitted, skip cost analysis (`costAnalysis: undefined`) — keeps backward compatibility for old saved runs from `simulation_runs` history that only stored `result_json` without a graph snapshot.
- (Alternative, more work) Bake `hourlyCost`/`holdingCostPerUnitTime` values directly into `NODE_CONFIG` sent to the Python script in `codeGenerator.ts`, and have `nodeStats` return per-node cost already computed server-side (Python-side) instead of TS-side. Not recommended — keep cost math in TS/analyticsEngine.ts for consistency with everything else in this file (Little's Law, health score, etc. are all computed TS-side from `nodeStats`, not in Python).

```ts
export function enrichSimResult(rawResult: SimResult, graph?: SimGraph): SimResult {
  if (rawResult.entityJourneys !== undefined) return rawResult;
  // ...existing code...
  const resourceStates = calculateResourceOperationalStates(rawResult.nodeStats || {}, rawResult.totalSimTime);
  const costAnalysis = graph ? calculateCostAnalysis(graph, rawResult, resourceStates) : undefined;
  // ...
  return {
    ...rawResult,
    // ...existing fields...
    costAnalysis,
  };
}
```

### Layer 4 — Display it (this MD only covers the data layer; the UI tab is in `02-kpi-cost-roi-dashboard.md`)

Once `result.costAnalysis` exists, hand off to the companion MD file `02-kpi-cost-roi-dashboard.md` for the dashboard panel that renders it.

---

## Files touched
- `src/lib/simulation/types.ts` — add cost fields to `ResourceParams`, `QueueParams`, `ContainerParams`; add `CostBreakdown`/`CostAnalysis`; extend `SimResult`
- `src/components/workspace/NodePropertiesPanel.tsx` — add cost input fields per node type
- `src/lib/simulation/analyticsEngine.ts` — add `calculateCostAnalysis()`, wire into `enrichSimResult()`
- `src/app/dashboard/project/[id]/page.tsx` — pass `graph` into `enrichSimResult(rawResult, simGraph)` at the `engine.onComplete` call site
- `src/components/workspace/AdvancedResultsDashboard.tsx` — pass `graph` into `enrichSimResult()` inside its `useMemo`

## Definition of done
- [ ] Setting `hourlyCost` on a Resource node and `holdingCostPerUnitTime`/`waitingPenaltyPerUnitTime` on a Queue node is possible from the properties panel and persists on save/reload (already handled by existing autosave — no new persistence code needed since `params` is a free-form JSON blob in `graph_json`).
- [ ] Running a simulation with these values set produces a non-null `result.costAnalysis.totalSystemCost > 0`.
- [ ] Running a simulation with all cost fields left at 0/undefined produces `totalSystemCost === 0` and does not crash (regression check for old projects).
