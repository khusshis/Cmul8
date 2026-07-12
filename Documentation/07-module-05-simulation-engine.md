# Module 5 — Simulation Engine

## 1. Purpose
This module is the "brain" of JustCmul8. It takes a graph the user built (nodes +
edges) and actually *runs* a discrete-event simulation on it — generating random
arrivals, moving entities through queues/resources/services, and producing the
statistics (utilization, wait times, throughput) the KPI Dashboard displays.

It is the only module in the whole app implementing real DES (Discrete Event
Simulation) theory, so it is the highest-priority module for "100% correctness":
a bug here silently produces wrong numbers everywhere downstream.

## 2. Files owned by this module
| File | Lines | Role |
|---|---|---|
| `src/lib/simulation/types.ts` | 353 | Every shared type: `NodeType` (15 values), all per-node `*Params` interfaces, `SimGraph`, `SimResult`, `SimTick`, the `SimulationEngine` interface every engine implements |
| `src/lib/simulation/distributions.ts` | 75 | Pure random-number-generator functions (exponential, uniform, normal, deterministic, poisson) |
| `src/lib/simulation/codeGenerator.ts` | 544 | Compiles a `SimGraph` into a **Python SimPy script** (a big template string with the graph's JSON spliced in) |
| `src/lib/simulation/pyodideWorker.ts` | 99 | A persistent Web Worker that loads the Pyodide WASM runtime + installs SimPy via micropip, then executes the generated Python |
| `src/lib/simulation/pyodideEngine.ts` | 115 | `PyodideSimEngine` class — the primary `SimulationEngine` implementation the UI actually talks to; owns the worker, and **automatically falls back** to the JS engine if Pyodide fails to load |
| `src/lib/simulation/legacyWorker.ts` | 568 | `GraphSimulator` — a complete, independent, pure-TypeScript discrete-event engine (min-heap event queue) that runs in its own Web Worker. Used both as (a) the automatic fallback when Pyodide fails, and (b) directly via `clientEngine.ts` |
| `src/lib/simulation/clientEngine.ts` | 100 | `ClientSimEngine` class — thin `SimulationEngine` wrapper around `legacyWorker.ts` |
| `src/lib/simulation/pythonEngineStub.ts` | 107 | `PythonSimEngine` — an **unused, future-only** stub for a possible server-side Python backend (SSE-based). Not wired into the UI anywhere today. Keep as documentation of a future extension point, not as working code. |

## 3. Why two full execution engines exist
The synopsis (Section 6) promises "real Python SimPy... running directly inside the
browser." Running actual CPython + SimPy in a browser requires **Pyodide**
(Python compiled to WebAssembly), which is a ~10MB download and can fail to load
(slow/blocked network, browser incompatibility, CDN outage — `pyodideWorker.ts`
loads it from `cdn.jsdelivr.net`, an external dependency).

So the app has a safety net: `PyodideSimEngine` (Section 4 below) tries Pyodide
first, and if the worker reports a `status: "error"` phase, `PyodideSimEngine`
transparently swaps to `ClientSimEngine` (the pure-JS engine) for that run — the
workspace page (`src/app/dashboard/project/[id]/page.tsx`) always instantiates
`PyodideSimEngine` and is unaware of which path actually executed.

**⚠️ Correctness flag (found while auditing the original code, not introduced by
us):** the two engines do **not** implement identical logic for all 15 node types.
See Section 6.

## 4. Algorithm — `codeGenerator.ts` + `pyodideWorker.ts` (primary path)
1. `generateSimPyScript(graph, durationSeconds, tickIntervalSeconds)` serializes the
   graph's nodes/edges to JSON and string-replaces them into a large Python template
   (`PYTHON_TEMPLATE`). No AST/parser is used — it's literal string templating.
2. The generated Python defines:
   - `sample(dist_type, mean, std)` — mirrors `distributions.ts` but re-implemented
     in Python using `random.expovariate`, `random.uniform`, `random.gauss`.
   - `entity_process(env, eid, node_id, resources, entity_attrs)` — a SimPy generator
     function, one big `if/elif` dispatch on `node_type`, called recursively as an
     entity moves from node to node along the graph's edges.
   - `source_process(...)` — spawns entities either on a fixed rate (sampling
     inter-arrival time from the configured distribution) or from an explicit
     `schedule` timetable (`ArrivalScheduleEntry[]`), optionally recurring.
   - `tick_emitter(...)` — a SimPy process that fires every `TICK_INTERVAL` sim-time
     units, snapshots all node statistics, and calls `emit_sim_tick(json)` — a Python
     global that pyodideWorker.ts registers as a bridge back into JS
     (`pyodide.globals.set("emit_sim_tick", ...)`).
   - `run_simulation()` — builds SimPy `Resource`/`PriorityResource`/`Store`/
     `PriorityStore`/`FilterStore` objects per node, starts all `source` processes,
     starts the ticker, then calls `env.run(until=DURATION)` (SimPy's own event loop
     — not a hand-rolled one, unlike the fallback engine).
3. `pyodideWorker.ts` receives `{type:"start", params}`, calls
   `generateSimPyScript(...)`, registers the `emit_sim_tick`/`emit_sim_result` JS
   callbacks into Pyodide's global namespace, then runs the whole script with
   `pyodide.runPythonAsync(python)`. All ticks and the final result are emitted as
   the Python code calls those two callbacks — genuinely SimPy driving the timeline,
   not JS polling it.
4. **Per-node-type behavior implemented in Python (confirmed by reading the
   template, not inferred):**
   - `source` → spawns entities on schedule or rate; supports `routingMode`
     (`round_robin` / `broadcast` / `priority`→falls back to round-robin), priority
     levels, entity classes.
   - `queue` → if the queue feeds directly into a `resource`/`priority_resource`,
     patience/reneging (`patienceTimeout`) is applied *inline* at the queue step,
     racing `resource.request()` against `env.timeout(patience)` with SimPy's
     `|` (OR) event composition.
   - `resource` / `priority_resource` → `simpy.Resource` or `simpy.PriorityResource`
     depending on `isPreemptive`/type; `do_resource_service()` handles the actual
     hold time.
   - `service` → an interruptible SimPy sub-process (`simpy.Interrupt` caught), so
     an `interrupter` node can cut it short.
   - `decision` → weighted-random routing via cumulative probability over
     `DecisionParams.routes`.
   - `sink` → terminal; logs `"completed"`.
   - `store` → `simpy.Store` / `simpy.PriorityStore` / `simpy.FilterStore` depending
     on `isPriority`/`filterEnabled`.
   - `event_trigger` / `any_of` / `all_of` → uses real `env.event()`,
     `env.any_of()`, `env.all_of()` — genuine SimPy synchronization primitives.
   - `interrupter` → calls `.interrupt(cause)` on tracked active processes.

## 5. Algorithm — `legacyWorker.ts` (fallback / JS-native path)
A hand-built discrete-event engine, independent of SimPy:
- **`EventQueue`** — a binary min-heap ordered by `(time, insertion sequence)` —
  the classic DES "future event list."
- **`DESResource`** — capacity-limited queueing with **priority-ordered waiting**
  (`waiting.findIndex(r => r.priority > priority)`, i.e. lower number = higher
  priority, inserted ahead of lower-priority waiters) and explicit
  `breakdown()`/`repair()` methods for machine-failure modeling.
- **`DESContainer`** — continuous-level put/get with waiter queues that flush when
  capacity/level allows (tank/reservoir semantics).
- **`DESStore`** — discrete item buffer with put/get waiter queues (SimPy `Store`
  equivalent).
- **`GraphSimulator.build()`** constructs one of the above per node, then
  `runUntil(maxTime)` pops events off the heap and executes their callback,
  advancing `this.now` to each event's timestamp — this *is* the event loop (SimPy
  has its own internal one; this hand-rolled one mirrors it for the JS path).
- The **Worker Controller** (bottom of the file) runs the simulation in small
  **chunks** bounded by `tickIntervalSeconds`, using `setTimeout` between chunks so
  the `speedMultiplier` (1x/2x/5x/10x/50x from the toolbar) actually throttles
  wall-clock playback speed — the Pyodide path has no equivalent throttle; it runs
  to completion as fast as Python can execute and emits ticks as SimPy's virtual
  clock crosses each interval, which in practice streams quickly regardless of the
  UI's speed selector for that path. *(Flagging as a UX/behavior difference between
  the two paths, not fixing silently.)*

## 6. ⚠️ Correctness gaps found in the original code (flagged, not silently fixed)
Auditing `codeGenerator.ts` line-by-line against `legacyWorker.ts` and `types.ts`
surfaced real discrepancies that existed in the original app before this rebuild:

1. **`container`, `channel`, and `broadcaster` node types are not implemented in
   the Python code generator.** `codeGenerator.ts` has zero references to any of
   these three type names — they silently fall into the generic `else` branch in
   `entity_process()`, which just passes the entity straight through with no
   fill-rate, propagation-delay, or fan-out logic at all. `legacyWorker.ts`, by
   contrast, fully implements all three (`case "container"`, `case "channel"`,
   `case "broadcaster"` in `processAtNode()`). **Practical impact:** any project
   using the "Liquid & Material Flow" or "Network & Signals" domains (which rely
   heavily on `container`/`channel`/`broadcaster`) behaves correctly only when the
   JS fallback engine happens to run, and silently loses that behavior when Pyodide
   loads successfully (the normal case).
2. **The AI Assistant's system prompt only teaches Gemini 10 of the 15 node types**
   (missing `channel`, `broadcaster`, `any_of`, `all_of`, `interrupter` — see
   Module 6 doc). So the AI can never generate a graph using the 3 node types that
   are also broken in the Python engine, which is a partial mutual mitigation but
   not a fix.
3. **`simTypeRegistry.ts` defines a per-domain `aiSystemPrompt` field** intended to
   be "injected into the Gemini API route" (per its own doc comment), but
   `src/app/api/ai/generate/route.ts` never imports or references
   `SIM_TYPE_REGISTRY` or `aiSystemPrompt` at all — it uses one hardcoded generic
   prompt for every domain.
4. **Pause is not supported on the Pyodide path.** `pyodideWorker.ts`'s `"pause"`
   handler only emits a status message ("Pause not supported with SimPy sync
   mode") — `env.run(until=DURATION)` runs to completion synchronously inside
   Python once started. The JS fallback engine *does* support real pause (its
   chunked `setTimeout` loop simply stops scheduling the next chunk). The toolbar
   UI shows a Pause button unconditionally regardless of which engine is active.

These are documented here per the project rule: *flag bugs found during the audit,
never fix them silently.* Decide with your project supervisor whether closing gap
#1 (the most functionally significant) is in scope for the rebuild, since fixing
the *generator* itself would be a logic change, not a restyle.

## 7. Connections to other modules
- **Visual Graph Editor (Module 3)** produces the `SimGraph` (nodes+edges) this
  module consumes, via `graphToSimNodes()` in the workspace page.
- **Node Config Panel (Module 4)** edits the `params` object on each node that this
  module's `NODE_CONFIG` reads at simulation time.
- **KPI Dashboard (Module 7)** renders the `SimResult`/`SimTick` objects this
  module emits.
- Engine selection and lifecycle (`start`/`pause`/`resume`/`stop`, tick/complete/
  error callbacks) are orchestrated entirely from
  `src/app/dashboard/project/[id]/page.tsx`, which is the only place a
  `PyodideSimEngine` instance is created.

## 8. Database tables touched
None directly — this module is pure computation, in-memory/in-worker only. Results
are handed to the workspace page, which is responsible for any persistence (today:
none — simulation results are **not saved to the database** at all, they exist only
in React state for the current session; see Module 7 doc for the implication on the
new Export & Share module).
