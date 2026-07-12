# Module 3 — Visual Graph Editor

## 1. Purpose
The core "no-code" interface — a drag-and-drop canvas where the user builds a
simulation model by placing nodes and drawing connections between them, without
writing any code. This is what makes JustCmul8 "no-code" per the synopsis's central
promise (Section 3).

## 2. Files owned by this module
| File | Lines | Role |
|---|---|---|
| `src/components/workspace/NodeCanvas.tsx` | 513 | The React Flow canvas itself: custom node rendering (`CyberNode`), custom edge rendering (`CyberEdge`), drag-and-drop handling, live stats overlay during simulation runs, and the graph connectivity validator |
| `src/components/workspace/NodePalette.tsx` | 156 | The left sidebar: drag source for new nodes (grouped Core/Advanced) + one-click scenario loader |

## 3. Algorithm / logic

### Canvas rendering (`NodeCanvas.tsx`)
- Built on **React Flow (`@xyflow/react`)**, wrapped in `ReactFlowProvider` so
  `useReactFlow()` hooks (for `fitView`, coordinate conversion) work.
- **`CyberNode`** is the single custom node component used for *every* node type
  (`nodeTypes = { cyberNode: CyberNode }`) — node type visually differs only
  through color/label/badge content, not a different component per type.
- **Live stats overlay**: while a simulation is running, each node reads its own
  entry from a React Context (`LiveStatsContext`) populated from the latest
  `SimTick.nodeStats`, and displays a small stats badge (e.g.
  `"42% util | Wait: 3 | Proc: 12"` for a resource, `"7 waiting | Proc: 20"` for a
  queue) computed live from real simulation numbers, not decorative.
- **`resolveNodeGlowColor()`**: while running, a resource/service node's glow color
  changes based on live utilization (green <50%, amber 50–80%, red >80%) and a
  queue/store's glow changes based on live depth (amber >0, orange >5, red >10) —
  this is a genuine visual bottleneck indicator, not just styling, and must be
  preserved exactly (thresholds included) in the rebuild, just re-skinned to the
  new status-color tokens (`--color-success/warning/error`).
- **Drag-and-drop**: `NodePalette` sets
  `e.dataTransfer.setData("application/reactflow", nodeType)` on drag start;
  `NodeCanvas.onDrop()` reads it back, converts screen coordinates to canvas
  coordinates via `reactFlowInstance.screenToFlowPosition()`, and creates a new
  node with **empty `params: {}`** — default parameters are filled in lazily by
  `defaultParamsForType()` in the workspace page only at simulation-run time
  (`graphToSimNodes()`), not at node-creation time. This means a freshly-dropped
  node has no visible parameters until either the user opens its Properties panel
  (which shows registry defaults) or a simulation actually runs.
- **`validateGraphConnectivity(nodes, edges)`** (exported, used by the workspace
  page before every "Run"): does a BFS over the graph treated as **undirected**
  (both directions added to the adjacency map) starting from the first node, and
  fails if: zero nodes, exactly one node, zero edges, or any node unreachable from
  the rest. This catches orphaned/disconnected nodes but does **not** check
  whether the graph is a valid DAG for simulation purposes (e.g. it doesn't verify
  every branch actually reaches a `sink`, or that a `source` exists at all) — worth
  knowing as a scope boundary of what "validated" actually means here.

### Palette (`NodePalette.tsx`)
- Reads `SIM_TYPE_REGISTRY[simType].paletteNodes` — so the exact set of draggable
  node types, their labels, icons, and descriptions **already varies per
  simulation domain** (e.g. the Human Queue domain's palette calls a `resource`
  node "Teller/Agent"; the Vehicle domain calls it "Bay/Pump"). This per-domain
  plain-language labeling is a genuinely good existing UX decision worth
  highlighting — the glossary (`docs/00-glossary.md`) should note that these
  domain-specific labels take precedence over the generic technical-term mapping
  wherever they're shown.
- Splits nodes into "Core" (source/queue/resource/service/decision/sink — the six
  synopsis-listed primitives) and "Advanced" (everything else) sections.
- Also renders the domain's `subScenarios` (starter graphs) as one-click "load a
  complete example" buttons — this is the same data Module 8 (Template Gallery)
  is built from; **the boundary between Module 3 and Module 8 in the actual code
  is blurry: this component *is* effectively the Template Gallery's UI**, just
  embedded inside the Graph Editor's sidebar rather than a separate screen. See
  Module 8's doc for how this affects that module's scope.

## 4. ⚠️ Minor gap flagged
`NodeCanvas.tsx`'s own `NODE_BASE_COLORS` and `NODE_LABELS` constants (used for
edge/minimap coloring and drag-created node default labels) list only **12** of
the 15 `NodeType` values — `any_of`, `all_of`, and `interrupter` are missing from
both maps. A node of one of these 3 types falls back to the hardcoded default
color (`"#00f2ff"`) and its raw technical `nodeType` string as a label (e.g. the
literal text `"any_of"`) instead of a human label, when created outside the
palette's own labeling (the palette itself does supply a proper label via
`PaletteNode.label`, so this only surfaces if a node is created through some other
path). Low practical impact today, but worth closing during the rebuild for the
15-node-type parity goal — add the missing 3 entries using the design system's
node-color tokens (`--color-node-any-of`, `--color-node-all-of`,
`--color-node-interrupter`, already defined in `docs/02-design-system.md`).

## 5. Design notes for the rebuild
- Replace `CyberEdge`'s neon glow-layer technique (`BaseEdge` drawn twice, one
  blurred) with a single clean stroke using `--color-border`/`--color-accent`,
  keeping the delete-button-on-select behavior exactly as-is.
- Replace the dark `cyber-grid-canvas` background with the `.workspace-canvas`
  class (light dotted grid) from `globals.css`.
- Keep the MiniMap and Controls (React Flow built-ins) but restyle their default
  chrome to match the light theme (React Flow supports this via its own CSS
  variables/className overrides — do not fork the library).
- The live-stats glow-by-utilization behavior (Section 3) must map to the new
  status colors exactly: green→`--color-success`, amber→`--color-warning`,
  red→`--color-error`, at the same thresholds.

## 6. Connections to other modules
- **Node Config Panel (Module 4)**: selecting a node here
  (`onSelectionChange`→`onNodeSelect`) is what opens that panel in the workspace
  page's right sidebar.
- **Simulation Engine (Module 5)**: this module's `nodes`/`edges` React state is
  exactly what `graphToSimNodes()` converts into the `SimGraph` the engine runs.
- **Template Gallery (Module 8)**: shares its data source and, practically, its UI
  surface (see Section 3 above).
- **AI Assistant (Module 6)**: `onGraphGenerated` callback from the AI chat panel
  calls the same `setNodes`/`setEdges` setters this canvas renders from — the AI
  and manual editing both write to one shared graph state, live in the same canvas.

## 7. Database tables touched
None directly — operates entirely on in-memory React state; persistence is the
Workspace page's auto-save (`projects.graph_json`), documented under Module 2.
