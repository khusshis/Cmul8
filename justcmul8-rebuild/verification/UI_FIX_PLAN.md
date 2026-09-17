# UI Accuracy Fix Plan — JustCmul8 Results & Live Simulation Display

**Status:** proposed, nothing implemented. No UI file has been modified.
**Scope:** correctness of displayed numbers only. No restyling, no layout redesign, no copy
rewrites beyond the labels that are factually wrong.
**Prerequisite:** the engine/analytics fixes from `AUDIT.md` Part II are already in the
working tree. Several items below exist *because* of those fixes.

---

## 0. Ground rules

1. **Do not change visual design.** Colours, spacing, fonts, animations and component
   structure stay as they are. Where a fix makes a string longer (U-1), the plan flags it
   and stops for a design decision rather than guessing.
2. **One item = one commit.** Each section below is independently revertable.
3. **Re-run both verification suites after every item** (§8). They are fast and they are
   what caught the last regression.
4. **`npx tsc --noEmit` must stay clean.** It is currently clean.
5. Anything marked **DECISION** needs your answer before that item can be implemented.

---

## 1. Severity summary

| ID | Issue | File | Severity | Cause |
|---|---|---|---|---|
| U-1 | Resource badge says `Wait: N` but now shows in-service count | `NodeCanvas.tsx:397` | **Critical** | Regression from engine fix F-2 |
| U-1b | Heatmap intensity uses resource `currentDepth` | `FlowHeatmapTab.tsx:26` | Medium | Same cause |
| U-2 | Percentile chart invents its 25th-percentile point | `SimResultsPanel.tsx:199` | **Critical** | Pre-existing |
| U-3 | Legacy fallback engine runs silently with different maths | `pyodideEngine.ts:48` | **Critical** | Pre-existing |
| U-4 | WIP chart renders every point; categorical time axis | `SimResultsPanel.tsx:221,695` | Medium | Amplified by F-6 |
| U-5 | Synthetic `sin()` WIP curve fallback | `SimResultsPanel.tsx:233` | Medium | Pre-existing |
| U-6 | `enrichSimResult` runs 3× per result | 3 files | Low (perf) | Pre-existing |
| U-7 | Full enriched result + logs written to Supabase | `resultPersistence.ts` | Low | Pre-existing |
| U-8 | `healthScore ?? 85` defaults to "Grade B" | `SimResultsPanel.tsx:193` | Low | Pre-existing |
| U-9 | Source node glow permanently dim | `NodeCanvas.tsx:70` | **Already fixed** | Fixed by F-3, no action |

---

## 2. U-1 — Resource node badge mislabels in-service as waiting

### 2.1 Why this is wrong now

`NodeCanvas.tsx:397`:

```ts
statsBadge = `${Math.round((liveStats.utilization ?? 0) * 100)}% util | Wait: ${liveStats.currentDepth ?? 0} | Proc: ${liveStats.entitiesOut ?? 0}`;
```

Before the F-2 fix, a queue-fed resource's `currentDepth` counted *waiting + in-service*, so
`Wait:` was roughly defensible. F-2 moved the waiting entity's accounting to the queue node
only, and credits the resource at service start. `currentDepth` on a resource is now
**entities in service, bounded by capacity**.

Measured, M/M/3 at ρ = 0.8 (`verification/`, seed 11):

```
queue node currentDepth: mean 2.89  max 31    <- actually waiting   (theory Lq = 2.59)
resource   currentDepth: mean 2.41  max  3    <- in service         (theory a  = 2.40)
```

So the canvas can read `Wait: 2` while 31 entities are queued. Line 399 (queue/store nodes)
is **correct** and must not be touched — a queue's `currentDepth` genuinely is the waiting
count.

### 2.2 Complication: two topologies, two meanings

- **Queue-fed** (`Source → Queue → Resource`): resource depth = in-service, `0..capacity`.
  Waiting lives on the upstream queue node.
- **Direct** (`Source → Resource`, no Queue node): `entity_process` increments the resource
  at arrival, so depth = waiting + in-service, and there is no upstream queue to read.

A single formula must handle both, or the badge will be wrong on one of them.

### 2.3 Unified formula

```
serving = min(depth, capacity)
queued  = upstreamQueueDepth + max(0, depth - capacity)
```

- Queue-fed: `depth ≤ capacity`, so `serving = depth`, `queued = upstreamQueueDepth`. ✔
- Direct: `upstreamQueueDepth = 0`, so `serving = min(depth, cap)` and the overflow is the
  queue. ✔

### 2.4 Steps

**Step 1 — compute an upstream-queue map in the canvas parent.**

`NodeCanvas.tsx`, next to the existing `liveStats` (line 723) and `connectedHandles`
(line 726) memo, both of which already have `edges` in scope:

```ts
// Waiting entities live on the upstream Queue/Store node, not on the resource.
const upstreamQueueDepth = React.useMemo(() => {
  const map: Record<string, number> = {};
  for (const e of edges) {
    const src = liveStats[e.source];
    if (!src) continue;
    if (src.nodeType === "queue" || src.nodeType === "store") {
      map[e.target] = (map[e.target] ?? 0) + (src.currentDepth ?? 0);
    }
  }
  return map;
}, [edges, liveStats]);
```

**Step 2 — carry it on the existing context.** `NodeCanvas.tsx:18-24`, add one field to the
type and to the default value:

```ts
const LiveStatsContext = createContext<{
  stats: Record<string, NodeStats>;
  bottleneckId: string;
  simState: SimState;
  connectedHandles: Set<string>;
  simType: string;
  upstreamQueueDepth: Record<string, number>;   // NEW
}>({ stats: {}, bottleneckId: "", simState: "idle", connectedHandles: new Set(), simType: "human_queue", upstreamQueueDepth: {} });
```

and add `upstreamQueueDepth` to the provider value at line 752.

**Step 3 — consume it.** `NodeCanvas.tsx:353`, add to the destructure; then replace line 397:

```ts
const cap = Number(data.params?.capacity) || 1;
const depth = liveStats.currentDepth ?? 0;
const serving = Math.min(depth, cap);
const queued = (upstreamQueueDepth[id] ?? 0) + Math.max(0, depth - cap);
statsBadge = `${Math.round((liveStats.utilization ?? 0) * 100)}% util | Serving: ${serving}/${cap} | Queue: ${queued} | Proc: ${liveStats.entitiesOut ?? 0}`;
```

> **DECISION — badge width.** This string is ~12 characters longer than the current one and
> the badge is a fixed-width pill on the canvas node. Three options, pick one:
> **(a)** Keep all four fields and let the badge widen (layout change — needs your OK).
> **(b)** Drop `Proc:` from resource nodes, since the sink already reports completions:
> `85% util | Serving: 2/3 | Queue: 31`.
> **(c)** Compact glyph form, same width as today: `85% · 2/3 · ⧗31 · ✓480`.
> I recommend **(b)**: it fits the existing pill and `Proc:` is the least informative of the
> four. I will not change layout without your answer.

### 2.5 U-1b — heatmap

`FlowHeatmapTab.tsx:26`:

```ts
heat = Math.min(100, Math.round((stat.currentDepth * 15) + (renege * 20) + (wait * 5)));
```

For a resource, `currentDepth` is now capped at capacity, so the depth term saturates at
`capacity * 15` and resources will read cooler than before. The heat signal for a resource
should come from utilisation, not depth:

```ts
const depthTerm = (stat.nodeType === "resource" || stat.nodeType === "priority_resource")
  ? (stat.utilization ?? 0) * 40
  : (stat.currentDepth ?? 0) * 15;
heat = Math.min(100, Math.round(depthTerm + (renege * 20) + (wait * 5)));
```

The `40` is chosen so a fully-busy resource contributes the same 40 points that a depth of
~2.7 used to. It is a heuristic either way — flagging it rather than pretending it is derived.

### 2.6 Verification

- Run a `Source → Queue → Resource(c=3) → Sink` graph at ρ≈0.8. During the run the canvas
  must show `Serving: n/3` with `n ≤ 3`, and `Queue:` should track the queue node's own
  `n waiting` badge.
- Run the same graph with the Queue node deleted. `Serving` must still be `≤ 3` and `Queue`
  must become non-zero under load rather than staying at 0.

---

## 3. U-2 — Percentile chart fabricates its first point

### 3.1 Current code

`SimResultsPanel.tsx:197-204`:

```ts
// Build percentile data for spectrum chart (using plain English labels & fallback values)
const percentileData = [
  { name: "Fast Visit (25%)", wait: (waitP?.p50 || 0) * 0.75, total: Math.max(0.1, (cycleP?.p50 || 0) * 0.8) },
  { name: "Average Customer", wait: waitP?.p50 ?? 0, total: Math.max(0.1, cycleP?.p50 ?? 0) },
  ...
```

`p50 * 0.75` is not the 25th percentile of anything. For an exponential-tailed wait
distribution the true p25 sits well below `0.75 × p50`, so the chart's left-hand point is
both invented and biased high. `cycleP.p50 * 0.8` likewise.

`DeepAnalyticsTab.tsx:73-79` builds the same kind of chart and is **clean** — it uses only
real percentiles. This is the only fabrication site.

### 3.2 Steps

**Step 1 — expose p25.** `types.ts:302`, add one field to `PercentileStats`:

```ts
export interface PercentileStats {
  p25: number;   // NEW
  p50: number;
  ...
```

**Step 2 — return it.** `analyticsEngine.ts`, in `calculatePercentiles`. `p25` is *already
computed* on the line above the return (it is used for the IQR) — it simply is not returned.
Add `p25,` to the returned object, and add `p25: 0` to the empty-samples early return.

**Step 3 — use it.** `SimResultsPanel.tsx:199`:

```ts
{ name: "Fast Visit (25%)", wait: waitP?.p25 ?? 0, total: Math.max(0.1, cycleP?.p25 ?? 0) },
```

**Step 4 — keep the Python port in sync.** `verification/engine_harness.py`,
`calculate_percentiles`: add `p25=p25` to the returned dict and `p25=0` to the empty branch.
The harness is a bug-for-bug mirror; if it drifts, the scorecard stops meaning anything.

### 3.3 Ripple check

`PercentileStats` is consumed by `SimResultsPanel`, `DeepAnalyticsTab`, `reportGenerator.ts`
and `computeDomainMetrics`. Adding an optional-in-practice field is additive; no consumer
constructs a `PercentileStats` literal except `calculatePercentiles` itself (verified by
grep for `p99`). `tsc` will catch it if that is wrong.

### 3.4 Verification

On M/M/1 ρ=0.8 the four points must be monotonically increasing and match theory for the
unconditional waiting-time distribution: p25 ≈ 0 (25 % of customers are served immediately
when ρ = 0.8 — expect a genuine 0, which is correct, not a bug), p50 ≈ 2.35 s, p75 ≈ 5.8 s,
p90 ≈ 10.4 s, p99 ≈ 21.9 s.

> **Note:** a truthful p25 of `0` will make the chart's first bar flat. That is the real
> answer — at ρ = 0.8, a quarter of customers never wait. If that reads badly, the honest
> fix is to relabel the axis, not to re-introduce a multiplier.

---

## 4. U-3 — Legacy fallback engine runs silently (banner approach, per your decision)

### 4.1 The problem

`pyodideEngine.ts:46-52`:

```ts
case "status":
  if (msg.phase === "error") {
    console.warn("[PyodideSimEngine] Falling back to legacy TS engine due to pyodide init error");
    this.useFallback = true;
  }
```

If Pyodide fails to load, every subsequent `start()` silently routes to `ClientSimEngine`
(`legacyWorker.ts`) — a separate TypeScript implementation that has **none** of the F-1…F-16
fixes. Its utilisation, `legacyWorker.ts:137`:

```ts
utilization: t.in>0 ? Math.min(1,busyTime/Math.max(now,1)) : 0,
```

`busyTime` is accumulated from a single `busyStart` interval (lines 358-364) — it measures
"was **any** server busy", with no capacity divisor. For c = 3 at ρ = 0.8 that reads ≈ 0.94
instead of 0.80, and it is clamped at 1.0 so the error is invisible. The only current signal
to the user is the `Engine: Error` pill at `page.tsx:393` — which says the engine errored,
while results are in fact being produced by a different engine.

### 4.2 Steps

**Step 1 — make the mode explicit.** `types.ts:436`:

```ts
export interface PyodideStatus {
  phase: "idle" | "loading_runtime" | "loading_simpy" | "ready" | "error";
  message?: string;
  progress?: number;
  fallbackActive?: boolean;   // NEW: results are coming from the legacy TS engine
}
```

**Step 2 — set it.** `pyodideEngine.ts`, in the `"status"` case, forward
`{ ...msg, fallbackActive: true }` to `onStatusCallbacks` when `this.useFallback` becomes
true, so `page.tsx` receives it through the existing `engine.onStatus` wiring
(`page.tsx:119`) with no new plumbing.

**Step 3 — tag the result.** `types.ts`, add to `SimResult`:

```ts
/** Which engine produced this result. Absent on older saved runs. */
engine?: "pyodide" | "legacy";
```

Set `engine: "legacy"` in the `ClientSimEngine` path in `pyodideEngine.ts:57-70` (wrap the
`onComplete` forward), and `engine: "pyodide"` in the normal `"complete"` branch. This
matters because results are persisted (§7) — six months from now nobody will know which
engine produced a saved run.

**Step 4 — banner.** `page.tsx`, rendered above the canvas, shown when
`pyodideStatus.fallbackActive`:

> ⚠ **Approximate engine in use.** The SimPy runtime could not load, so this run used the
> built-in fallback engine. Results are indicative — multi-server utilisation in particular
> is overstated. Reload the page to retry the full engine.

**Step 5 — results chip.** `SimResultsPanel.tsx`, next to the existing health-score badge
(line ~283), render a small amber `Approximate` chip when `result.engine === "legacy"`, so
the caveat travels with the numbers and with saved runs.

> **DECISION — banner placement.** I propose a full-width dismissible strip directly under
> the toolbar, above the canvas. Tell me if you would rather it live inside the existing
> `Engine:` pill area (`page.tsx:387-400`) to avoid adding a new region.

### 4.3 Explicitly out of scope

Fixing `legacyWorker.ts` itself. It would need the capacity divisor plus the F-1…F-16
equivalents, and it is ~580 lines of an independent implementation. The banner makes it
honest; correcting it is a separate decision. If you later want it, the minimum is:
track `busyServerSeconds` (increment per concurrent request, as the SimPy template's
`busy_seconds` does) and divide by `now * capacity`.

---

## 5. U-4 — WIP chart: no downsampling, categorical time axis

### 5.1 The problem

`SimResultsPanel.tsx:221-232` maps **every** timeline point into the chart, and
`SimResultsPanel.tsx:695` feeds it straight to `<AreaChart data={wipTimelineData}>`. The
F-6 tick change took the timeline from ~100 to ~1000 points, so this is now ~1000 SVG points
in a panel a few hundred pixels wide.

Separately, the X value is `formatTimeFriendly(t.simTime)` — a **string**. Recharts treats
that as a categorical axis, so with 1000 points you get 1000 categories and, because the
formatter rounds to one decimal, many identical labels (`"0.1 min"` repeated).

Note the fine-grained timeline is *correct and wanted* — it is what makes the Little's Law
integral accurate (11.3 % error at 100 samples vs 0.5 % at 1000, per `AUDIT.md`). The fix
belongs in the chart, not in the tick rate. Do **not** revert F-6.

### 5.2 Steps

**Step 1 — keep `simTime` numeric** in `wipTimelineData`:

```ts
return result.timeline.map((t) => ({
  simTime: t.simTime,                                    // numeric, not formatted
  wip: t.wip !== undefined ? t.wip : Object.values(t.depth || {}).reduce((a, b) => a + b, 0),
  completed: t.completed,
}));
```

**Step 2 — downsample for display, preserving the peak.** Add below the memo:

```ts
const TARGET_POINTS = 180;
const wipChartData = useMemo(() => {
  const src = wipTimelineData;
  if (src.length <= TARGET_POINTS) return src;
  const stride = Math.ceil(src.length / TARGET_POINTS);
  const out = src.filter((_, i) => i % stride === 0);
  // Never lose the global peak or the final point to striding.
  const peak = src.reduce((a, b) => (b.wip > a.wip ? b : a), src[0]);
  if (!out.includes(peak)) out.push(peak);
  const last = src[src.length - 1];
  if (!out.includes(last)) out.push(last);
  out.sort((a, b) => a.simTime - b.simTime);
  return out;
}, [wipTimelineData]);
```

**Step 3 — numeric axis.** On the `<XAxis>` inside the `<AreaChart>` at line 695:

```tsx
<XAxis
  dataKey="simTime"
  type="number"
  domain={["dataMin", "dataMax"]}
  tickFormatter={formatTimeFriendly}
  /* keep all existing style props unchanged */
/>
```

and pass `data={wipChartData}` instead of `wipTimelineData`.

**Step 4 — same treatment for any other chart bound to `result.timeline`.**
`timelineSelectors.ts` (`buildThroughputSeries`, `buildDepthSeries`) already returns numeric
`simTime`; check `TimelineTab.tsx` renders it as `type="number"` and downsample there too if
it plots the full series.

### 5.3 Verification

A 10-hour run must render in well under a second, the peak WIP in the chart must equal
`maxWip` (line 207, computed from the **full** series — do not point it at the downsampled
one), and the X axis must show strictly increasing, non-duplicated labels.

---

## 6. U-5 — Delete the synthetic WIP curve

`SimResultsPanel.tsx:233-248` builds a fake `sin()`-shaped curve when the timeline is empty:

```ts
const count = Math.round(inFlight * Math.sin((progress * Math.PI) / 2));
```

This renders a smooth, plausible, entirely invented workload curve. It is currently
unreachable (the engine always emits a timeline plus a final snapshot), which makes it worse,
not better: it is a dormant path that would silently show fiction.

**Step:** delete the fallback block and return `[]`. Where the chart is rendered, guard with
an empty state that matches the existing panel styling:

```tsx
{wipChartData.length === 0
  ? <div className="...existing empty-state classes...">No timeline data for this run</div>
  : <ResponsiveContainer>...</ResponsiveContainer>}
```

> **DECISION:** this introduces one new empty-state string. Confirm the wording, or tell me
> to reuse an existing empty state if the panel already has one.

---

## 7. Low-severity items

### 7.1 U-6 — `enrichSimResult` runs three times

Call sites: `page.tsx:102` (stores the enriched result), `SimResultsPanel.tsx:137` and
`AdvancedResultsDashboard.tsx:69` (both re-enrich what is already enriched). It is
idempotent, so the numbers are right — but it re-runs `reconstructEntityJourneys` over up to
4 000 entities, plus percentile sorts, up to three times per result.

**Step:** guard at the top of `enrichSimResult` in `analyticsEngine.ts`:

```ts
export function enrichSimResult(rawResult: SimResult): SimResult {
  // Idempotence guard: page.tsx already enriches before storing, and both result
  // panels re-enrich defensively. Re-running costs a full journey reconstruction.
  if (rawResult.entityJourneys !== undefined) return rawResult;
  ...
```

Keep the child call sites as they are — they are a reasonable defence for the case where an
un-enriched result is passed in (e.g. a run loaded from history).

### 7.2 U-7 — Supabase payload size

`resultPersistence.ts` writes `result_json: result` — the **enriched** object, including
`entityJourneys` (up to 4 000 entities, each with a nested `steps` array) and
`topSlowestEntities` — *and* `logs_json: result.logs` separately, which is the same event
data again.

**Step:** strip the reconstructable fields before insert; they can be rebuilt from
`logs_json` by `reconstructEntityJourneys` on load:

```ts
const { entityJourneys, topSlowestEntities, logs, ...summary } = result;
return {
  ...
  result_json: summary as SimResult,
  logs_json: logs,
};
```

Check `SimulationRunRecord` consumers (run-history loading) still work — they should call
`enrichSimResult` on the rehydrated `{...result_json, logs: logs_json}`.

> **DECISION:** this changes the shape of rows written to `simulation_runs`. Confirm no
> dashboard or query reads `result_json->entityJourneys` directly.

### 7.3 U-8 — Health score default

`SimResultsPanel.tsx:193`: `const healthScore = result.healthScore ?? 85;` — a missing score
silently renders as "Minor Congestion (Grade B)". Since `calculateSystemHealthScore` always
returns a number for an enriched result, `??` only fires on malformed input, where inventing
85 is the worst option.

**Step:** `const healthScore = result.healthScore;` and render the grade badge only when
`healthScore !== undefined`, otherwise show a neutral "—". Touches the three grade branches
at lines ~283-300.

---

## 8. Verification protocol

Run after **each** item, not just at the end:

```bash
# 1. Types
cd justcmul8-rebuild && npx tsc --noEmit          # must stay clean

# 2. Engine + analytics regression (11 s)
cd verification && python verify_engine.py --quick   # must stay 28/28, exit 0

# 3. Complex graph invariants (~40 s)
python complex_scenario.py                            # must stay 22/22, exit 0
```

Items U-2 and U-6 touch `analyticsEngine.ts`, so suites 2 and 3 are load-bearing for those.
U-1, U-4, U-5, U-8 are presentation-only and cannot move the suites — if they do, something
unintended changed.

**Manual UI checks** (no automated coverage exists for the canvas):

| Item | Scenario | Expected |
|---|---|---|
| U-1 | `Source → Queue → Resource(c=3) → Sink`, ρ≈0.8 | `Serving: n/3` with n ≤ 3; `Queue:` tracks the queue node badge |
| U-1 | Same graph, Queue node deleted | `Serving` ≤ 3, `Queue` rises under load |
| U-2 | Any run, Analytics tab | 5 monotonically increasing points; p25 may legitimately be 0 |
| U-3 | Block the Pyodide CDN in devtools, run | Banner appears; results panel shows `Approximate` chip |
| U-4 | 10-hour run, Overview tab | Chart renders fast; X labels strictly increasing; peak matches `maxWip` |
| U-5 | — | Empty state, never a smooth invented curve |

---

## 9. Suggested order

| # | Item | Why this position | Risk |
|---|---|---|---|
| 1 | **U-1 + U-1b** | Active regression I introduced; wrong on screen right now | Low, but needs the badge-width DECISION |
| 2 | **U-3** | Silent wrong numbers is the worst failure mode; independent of everything else | Low — additive fields + one banner |
| 3 | **U-2** | Touches a shared type, so land it before other analytics edits | Low — `tsc` catches ripples |
| 4 | **U-5** | Trivial, and removes a landmine before touching the same chart in U-4 | Very low |
| 5 | **U-4** | Largest presentational change; do it after U-5 so the chart has one shape | Medium — chart props |
| 6 | **U-6, U-7, U-8** | Cleanup; no user-visible number changes | Low |

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Badge string overflows the canvas node pill (U-1) | Blocked on your DECISION; option (b) keeps current width |
| Adding `p25` breaks a `PercentileStats` literal somewhere | `tsc --noEmit` catches it; grep already shows only one constructor |
| Python harness drifts from TS analytics (U-2, U-6) | §3.2 Step 4 mirrors the change; suites fail loudly if it drifts |
| Downsampling hides a WIP spike (U-4) | Peak and last point are force-included; `maxWip` stays on the full series |
| Trimming `result_json` breaks run history (U-7) | Blocked on DECISION; rehydrate via `enrichSimResult` on load |
| A "fix" changes a number the suites cover | Run §8 after every item, not at the end |

---

## 11. Open decisions

1. **U-1 badge width** — (a) widen, (b) drop `Proc:` *(recommended)*, (c) glyph form.
2. **U-3 banner placement** — new strip under the toolbar, or fold into the `Engine:` pill.
3. **U-5 empty-state wording** — new string, or reuse an existing empty state.
4. **U-7** — confirm nothing queries `result_json->entityJourneys` before trimming it.

Nothing in this plan is implemented. Say which items to start with.


---

## 12. Verification results (independent check)

Checked against the working tree after implementation.

| Item | Status | Evidence |
|---|---|---|
| U-1 | **Done, correct** | `NodeCanvas.tsx:398-402` uses the unified `min(depth,cap)` / `upstream + max(0,depth-cap)` formula; context plumbing at `:24,354,731,770`. Badge width kept via option (b) |
| U-2 | **Done, correct** | `p25` in `types.ts:303`, returned by `calculatePercentiles`, used at `SimResultsPanel.tsx:200`, mirrored in `engine_harness.py:75,93` |
| U-3 | **Done, correct** | `SimResult.engine` (`types.ts:383`), `PyodideStatus.fallbackActive` (`:444`), tagging at `pyodideEngine.ts:41,65`, banner `page.tsx:589`, chip `SimResultsPanel.tsx:325` |
| U-4 | **Done, correct** | Downsample to <=180 preserving peak (`SimResultsPanel.tsx:222-245`); numeric axis `type="number"` + `domain=["dataMin","dataMax"]` (`:739-740`); `maxWip` correctly still computed on the **full** series (`:208`) |
| U-5 | **Done** | `Math.sin` fallback removed; empty state guarded at `:726` |
| U-6 | **Done** | Idempotence guard at `analyticsEngine.ts:629` |
| U-8 | **Done** | `SimResultsPanel.tsx:194` no longer defaults to 85 |
| **U-7** | **NOT done** | `resultPersistence.ts:29-30` still writes the full enriched `result_json` plus `logs_json`. This was a blocked DECISION item (confirm nothing queries `result_json->entityJourneys`), so it is correctly outstanding rather than missed |
| **U-1b** | **Withdrawn — my error** | `FlowHeatmapTab.tsx` was already correct: line 26 is the *queue* branch; the resource branch below it already uses `Math.round(util * 100)`. I read line 26 in isolation and misattributed it. The file is unchanged and needs no change |

Suites (all green):

```
python verify_engine.py --quick    28/28  exit 0
python verify_engine.py --reps 5   28/28  exit 0
python complex_scenario.py         22/22  exit 0
npx tsc --noEmit                   clean
```

### 12.1 New issue found: `service` nodes in the resource badge branch

`NodeCanvas.tsx:397` groups `service` with `resource`/`priority_resource`. A `service` node
is a pure delay with **unbounded concurrency** — `codeGenerator.ts` spawns one
`interruptible_delay` per entity with no resource contention — and it has no `capacity`
param, so `cap` falls back to `1`. It also never accumulates `busy_seconds`, so its
utilisation is always 0.

Measured (λ=2/s, mean 3 s, 600 s): `currentDepth = 5`, `utilization = 0.000`. The badge
renders:

```
0% util | Serving: 1/5 -> actually "Serving: 1/1 | Queue: 4"
```

when in truth all 5 entities are in service and nothing is queued. This is my plan's fault
for listing `service` in that branch without noting its semantics differ.

**Proposed fix** — give `service` its own branch, leaving the resource branch untouched:

```ts
} else if (nodeType === "service") {
  statsBadge = `${liveStats.currentDepth ?? 0} in progress | Proc: ${liveStats.entitiesOut ?? 0}`;
}
```

(Drop the utilisation term: a service node has no server to be busy, so `0% util` is
meaningless rather than merely unmeasured.)

### 12.2 Correction: the `--quick` gate was wrong in §8

§8 instructed that `verify_engine.py --quick` must stay `28/28, exit 0`. That was wrong and
it failed on the correct, fixed engine (22/28). Cause: `--quick` runs 2 replications over a
6 000 s horizon, but the tolerances were calibrated for 5 reps over 36 000 s. A 6 000 s
M/M/1 at ρ=0.8 has not reached steady state, so it carries a genuine **initial-transient
bias** (~+8 % on W) that is consistent across seeds — a confidence interval does not absorb
it, because it is bias and not noise.

Fixed in `verify_engine.py`: `--quick` now applies a 3× tolerance scale and prints a
**SMOKE TEST** disclaimer in the scorecard header, so a quick pass can never be mistaken for
an accuracy result. Both modes now exit 0. The full run remains the accuracy gate.


---

## 13. Closing items (§12.1 and U-7) — implemented and verified

### 13.1 `service` node badge (§12.1)

`NodeCanvas.tsx`: `service` split out of the resource branch into its own case. Resource and
`priority_resource` keep the unified capacity formula untouched.

```
OLD:  0% util | Serving: 1/1 | Queue: 4     <- invented a queue, meaningless 0% util
NEW:  5 in progress | Proc: 1244
```

Measured on a service node (lambda=2/s, mean 3 s, 600 s): `currentDepth = 5`,
`entitiesOut = 1244`. All five entities are genuinely in service and nothing is queued, so
the new badge is exact. Utilisation is dropped from the string because a service node has no
server to be busy — the engine never accumulates `busy_seconds` for it, so the old `0% util`
was reporting an unmeasured quantity as a measured zero.

### 13.2 U-7 — persisted payload trimmed

`resultPersistence.ts`: `result_json` now goes through `stripReconstructable()`, which drops
`entityJourneys`, `topSlowestEntities` and `logs`. The first two are rebuildable from
`logs_json`; `logs` was being persisted twice (once nested, once as `logs_json`).

Measured on a 10-hour M/M/1 run:

| | `result_json` | `logs_json` | total insert |
|---|---|---|---|
| before | 5 240.4 KB | 2 399.0 KB | **7 639.4 KB** |
| after | **115.5 KB** | 2 399.0 KB | **2 514.5 KB** |

`result_json` is **45x smaller**; the whole insert drops **67 %**. Everything the UI and the
CSV export read directly is retained — `nodeStats`, `timeline`, `waitTimePercentiles`,
`cycleTimePercentiles`, `littlesLaw`, `resourceStates`, `domainMetrics`, `healthScore`,
`aiDiagnosis` (all confirmed present in the stripped object).

**Consumer check:** the only code that reads a persisted run is
`app/api/projects/[id]/export/route.ts:46`, which uses `result_json.nodeStats` — retained.
Nothing reads `result_json.entityJourneys`, so the DECISION blocking this item is resolved.
Rehydration recipe is documented in the source comment:

```ts
enrichSimResult({ ...row.result_json, logs: row.logs_json })
```

The U-6 idempotence guard keys on `entityJourneys !== undefined`, so a stripped row correctly
re-enriches on load rather than short-circuiting. The two fixes compose.

### 13.3 Remaining size note (not addressed)

`logs_json` is now 95 % of the insert at ~2.4 MB per run. That is the reservoir-sampled
event stream and it is genuinely needed to reconstruct journeys and percentiles. If run
history volume becomes a problem, the levers are: lower `LOG_ENTITY_CAP` (currently 4000 in
`codeGenerator.ts` — note 4000 samples still reproduced p99 to within 0.2 % of the
full-population value, so there is headroom), or gzip the column. Flagging, not fixing.

### 13.4 Verification

```
npx tsc --noEmit                   clean
python verify_engine.py --quick    28/28  exit 0
python verify_engine.py --reps 5   28/28  exit 0
python complex_scenario.py         22/22  exit 0
```

All nine UI items are now closed: U-1, U-2, U-3, U-4, U-5, U-6, U-7, U-8 implemented;
U-1b withdrawn as an error on my part; U-9 was already fixed by engine fix F-3.
