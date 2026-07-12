# Module 7 — KPI Dashboard & Results

## 1. Purpose
Turns the raw numbers the Simulation Engine produces into something a
non-technical user can actually interpret at a glance: charts for utilization,
wait times, and a plain summary of what happened, so a student or business owner
can answer "where's my bottleneck?" without reading a table of numbers.

## 2. Files owned by this module
| File | Lines | Role |
|---|---|---|
| `src/components/workspace/SimResultsPanel.tsx` | 259 | Bottom-drawer panel shown after a simulation completes: KPI pill summary + Recharts charts + per-node stats table |

## 3. Algorithm / logic
- Rendered conditionally in the workspace page only when `simResult` is non-null
  (i.e. after `PyodideSimEngine.onComplete` fires) — it's a **post-run summary**,
  not a live dashboard; live in-progress stats are shown directly on canvas nodes
  instead (Module 3's live-stats-badge feature), a deliberate split between "watch
  it happen" (canvas) and "review what happened" (this panel).
- Pulls `simConfig = SIM_TYPE_REGISTRY[simType]` to get the domain's `entityName`
  (e.g. "Customer" vs "Vehicle" vs "Package") so chart labels read naturally
  per-domain ("AVG WAIT TIME (Customers)" vs "AVG WAIT TIME (Vehicles)") — another
  place per-domain plain language is already partially built in.
- Three charts, all from **Recharts**, all driven by `result.nodeStats` (the same
  `Record<string, NodeStats>` shape the engine emits):
  1. **Resource Utilization** — bar chart, one bar per resource-type node,
     `utilization` as %.
  2. **Avg Wait Time** — bar chart, one bar per queue, `avgWaitTime`.
  3. **Utilization Distribution** — pie chart breaking down total utilization
     share across resources.
- A scrollable **Node Stats table** listing every node's full `NodeStats` record
  (entities in/out, current depth, utilization, wait/service time, and the
  type-specific optional fields — renege count, breakdown count, downtime, dropped
  count, average latency — whichever apply to that node's type).
- `KpiPill` components at the top surface the headline numbers: total
  arrived/completed, and the bottleneck node's label (color-coded, using the same
  red-flag convention as the canvas's bottleneck highlighting in Module 3).

## 4. ⚠️ Gap flagged: results are never saved
Confirmed by full-repo search: **no simulation result is ever written to the
database.** `SimResultsPanel` renders directly from the `simResult` React state
the workspace page holds in memory; there is no `INSERT` into `simulation_runs`
(the table that exists for exactly this purpose in the root `supabase_schema.sql`
— see Module 2's schema-gap note) anywhere in the codebase. Refreshing the page or
navigating away loses all simulation results permanently — the user would have to
re-run the simulation to see the numbers again.

This directly affects the new **Export & Share (Module 9)** work: exporting
"the last run's results" as CSV only works while that in-memory state is still
alive in the current browser tab. If Export & Share should also support
"re-download results from a previous run later," that requires actually
persisting runs to `simulation_runs` first — flagging this dependency now so it's
accounted for when Module 9 is built, rather than discovered mid-implementation.

## 5. Design notes for the rebuild
- Keep all three chart types and every stat field exactly as computed by the
  engine — this module only visualizes, it doesn't compute anything itself.
- Recharts supports custom colors per series — map bar/pie colors to
  `--color-accent` / status tokens instead of the current neon palette.
  KPI-pill "bottleneck" coloring should use `--color-error`.
- Apply glossary terms to every axis label and column header (`utilization` →
  "Busy %", `avgWaitTime` → "Avg Wait Time" stays close to already-plain, `dropped`
  → "Dropped", etc. — cross-reference `docs/00-glossary.md`).

## 6. Connections to other modules
- **Simulation Engine (Module 5)**: sole data source — this module does not
  recompute or reinterpret any statistic, purely renders `SimResult`.
- **Template Gallery / simTypeRegistry (Module 8)**: supplies `entityName`
  (actually used, confirmed). The registry separately defines a per-domain
  `kpiMetrics: KpiMetricDef[]` array (which node stats to chart, with what chart
  type, per domain) — confirmed by direct search this is **also unused**:
  `SimResultsPanel.tsx` never references `kpiMetrics`. Like the AI route's unused
  `aiSystemPrompt` (Module 6), the panel instead has a **hardcoded, one-size-fits-
  all** three-chart layout (utilization bar, wait-time bar, utilization pie)
  regardless of simulation domain, even though the registry already contains the
  data to make it domain-specific (e.g. a Network/Signal simulation has no
  meaningful "utilization" concept the way a Human Queue does, but gets the same
  charts anyway). Flagging as a third instance of the same pattern — registry
  fields defined for a feature that was designed but never actually connected.
- **Export & Share (Module 9, new)**: will read from this same `simResult` object
  to generate CSV/JSON downloads — see the persistence gap in Section 4.

## 7. Database tables touched
None today (see Section 4's gap). Would touch `simulation_runs` if result
persistence is added.
