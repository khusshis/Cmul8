# Module 4 — Node Configuration Panel

## 1. Purpose
Once a node exists on the canvas, this panel is where the user sets its actual
simulation parameters — how fast customers arrive, how many staff a resource has,
how long service takes, what a decision node's branch probabilities are, and so
on. Without this module, every node would run on hardcoded defaults forever.

## 2. Files owned by this module
| File | Lines | Role |
|---|---|---|
| `src/components/workspace/NodePropertiesPanel.tsx` | 500 | The entire properties panel — one exported default component, with several internal sub-form components for parameter groups that need extra UI logic |

## 3. Algorithm / logic
- Receives the currently-selected `node` object, the workspace's `simType`, and an
  `onUpdate(nodeId, partialData)` callback (from the workspace page — ultimately
  triggers the same auto-save debounce documented in Module 2).
- Renders a **different set of input fields depending on `node.data.nodeType`** —
  effectively a big switch/lookup over the 15 node types, each mapped to the
  correct subset of that type's `*Params` interface from `types.ts` (e.g. a
  `source` node shows arrival rate + distribution + optional schedule builder; a
  `resource` node shows capacity + service time + preemption + breakdown/repair
  fields).
- **`SourceProperties`** is the most complex sub-component: beyond the basic
  arrival-rate field, it implements a full **arrival schedule builder** UI
  (`addScheduleEntry` / `updateScheduleEntry` / `removeScheduleEntry`) — letting a
  user define an explicit timetable of `{simTime, count}` batches instead of a
  random rate, directly matching `SourceParams.schedule` from the engine (Module
  5). This is a fully-featured, non-trivial piece of UI logic, not just a form
  field — preserve it exactly.
- **`QueuePatienceProperties`** exposes the renege/patience-timeout fields
  (`patienceTimeout`, `patienceDistribution`, `patienceMin/Max`,
  `soldOutThreshold`, `broadcastRenege`) that drive the "Bank Renege"/"Movie
  Renege" behaviors documented in the engine's type comments.
- **`StoreProperties`** exposes capacity, priority-store toggle, and the
  filter-store fields (`filterEnabled`, `filterProperty`, `filterOperator`,
  `filterValue`) — a genuinely more advanced feature (conditional item filtering)
  that only makes sense once the user understands SimPy's `FilterStore` concept;
  this is exactly the kind of field that most needs the glossary's plain-language
  treatment in the rebuild (e.g. "Only accept items where..." instead of exposing
  `filterOperator` as a raw `==`/`!=`/`>`/`<` dropdown with no explanation).
- **`InterrupterProperties`** exposes `targetNodeId` (which other node's active
  process to interrupt) and `cause` (a free-text label attached to the interrupt,
  surfaced in simulation logs).
- Every sub-form calls a local `setParam(key, value)` helper that spreads the
  change into the node's existing `params` object and calls `onUpdate` — no field
  is saved until this fires, and `onUpdate` itself triggers the workspace's
  1.5-second debounce auto-save (see Module 2), so parameter edits are persisted
  automatically, same as canvas edits.

## 4. Design notes for the rebuild
- This module benefits the most from the glossary work (`docs/00-glossary.md`) of
  any module in the app — it's where the most raw technical vocabulary
  (`discipline: FIFO/LIFO/PRIORITY`, `isPreemptive`, `meanTimeBetweenFailures`,
  `filterOperator`) is directly exposed to a non-technical user today. Every field
  label in the rebuilt panel must go through the glossary mapping — e.g.
  `meanTimeBetweenFailures` → "How often does this break down, on average?" with
  the technical field name kept only as the underlying state key.
- Keep every field and every conditional show/hide rule (e.g. patience fields only
  appearing when a queue feeds into a resource) exactly as-is — only the labels,
  input styling, and help text change.
- Numeric inputs should keep their exact valid ranges/defaults from
  `defaultParamsForType()` (Module 3's workspace-page helper) as placeholder/
  default values.

## 5. Connections to other modules
- **Visual Graph Editor (Module 3)**: node selection there is what populates
  `node` here; this panel is one of two tabs in the same right-hand sidebar (the
  other being the AI Assistant chat, Module 6) — see the `activeRightPanel` state
  in the workspace page.
- **Simulation Engine (Module 5)**: every field here maps 1:1 to a field in one of
  the `*Params` interfaces in `types.ts` that the engine reads at run time — this
  panel is effectively a form-generator for those interfaces, and any new engine
  parameter needs a matching field added here to be user-editable at all.
- **Project Management (Module 2)**: parameter edits flow through the same
  auto-save mechanism as node/edge position changes.

## 6. Database tables touched
None directly — writes flow through the workspace page's `onUpdateNodeData` into
the same `projects.graph_json` auto-save documented under Module 2.
