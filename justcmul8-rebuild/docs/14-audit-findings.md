# Audit Findings — Known Gaps in the Original Codebase

This document consolidates every discrepancy found while writing the module
documentation, by directly reading the original source in `Cmul8.zip` (not
inferred from file names or the synopsis). Each item is also noted in its
relevant module's own doc file; this page exists as a single reference for
project review/viva purposes.

## Correctness gaps (behavior doesn't match what the code implies it should do)

| # | Gap | Where | Module |
|---|---|---|---|
| 1 | `container`, `channel`, `broadcaster` node types are fully implemented in the JS fallback engine (`legacyWorker.ts`) but **not implemented at all** in the primary Python/SimPy code generator (`codeGenerator.ts`) — they silently pass through with none of their special behavior when Pyodide loads successfully (the normal case) | `codeGenerator.ts` | 5 |
| 2 | Pause is not supported when running on the Pyodide/SimPy path (`env.run()` is synchronous once started) but the toolbar shows a Pause button unconditionally | `pyodideWorker.ts` | 5 |
| 3 | The AI Assistant's system prompt only teaches Gemini 10 of the 15 node types — `channel`, `broadcaster`, `any_of`, `all_of`, `interrupter` are never mentioned, so the AI can't generate graphs using them | `api/ai/generate/route.ts` | 6 |
| 4 | `simTypeRegistry.ts` defines a per-domain `aiSystemPrompt` field explicitly documented as meant to be injected into the Gemini route — it is never referenced there; every domain gets one generic prompt | `route.ts` vs `simTypeRegistry.ts` | 6 |
| 5 | `simTypeRegistry.ts` also defines a per-domain `kpiMetrics` array meant to drive which charts the results panel shows — never referenced; the panel has one hardcoded 3-chart layout for every domain | `SimResultsPanel.tsx` vs `simTypeRegistry.ts` | 7 |
| 6 | `NodeCanvas.tsx`'s color/label lookup maps cover only 12 of 15 node types — `any_of`, `all_of`, `interrupter` fall back to a default color and their raw technical name as label | `NodeCanvas.tsx` | 3 |
| 18 | `legacyWorker.ts` sets up a capacity-bounded store for `channel` based on `bufferCapacity` but its runtime loop silently ignores the capacity and only implements a delay | `legacyWorker.ts` | 5 |
| 19 | `codeGenerator.ts` computes resource utilization as an **instantaneous snapshot** (`busyCount / capacity`) rather than a **time-weighted average** (`totalBusySeconds / (env.now × capacity)`). `busyCount` is incremented at service-start and decremented at service-end, so the final `SimResult` utilization reflects only whether the resource *happened* to be busy at the exact moment the simulation clock stopped — not how busy it was over the entire run. A resource busy for 14 of 15 minutes but idle at the final instant reports 0% utilization. This is the headline "Busy %" KPI that Module 7's dashboard is supposed to display. **Fixed** by adding `busy_seconds` / `last_busy_change` accumulator fields. **Cross-engine check:** `legacyWorker.ts` (JS engine) was already correct — it uses `busyTime` (a running accumulator) and `busyStart` (a timestamp) to compute `busyTime / now`, so no G20 needed. **Node-type check:** `priority_resource` shares the same `do_resource_service()` call as `resource` in the Python template (line 292: `elif node_type in ("resource", "priority_resource")`), so it inherits the fix automatically. | `codeGenerator.ts` (`snapshot_stats`, `do_resource_service`) | 5 / 7 |
| 20 | `totalCompleted` counting differs fundamentally between engines for dead-end nodes. In the JS engine (`legacyWorker.ts`), if an entity reaches a node with no outgoing edges, it is instantly treated as completed (`this.totalCompleted++`) and vanishes (e.g. an open-ended queue acts as a sink). In the Python engine (`codeGenerator.ts`), `totalCompleted` is strictly calculated by summing `entitiesOut` ONLY for nodes explicitly typed as `"sink"`. A graph with no sink node reports 0 completed in Python, but logs massive completions in JS. This is a pre-existing discrepancy from the original Cmul8.zip codebase, not introduced by Phase 1 fixes. | `legacyWorker.ts` / `codeGenerator.ts` | 5 |
## Missing functionality the synopsis promises but the code doesn't deliver

| # | Gap | Synopsis reference | Module |
|---|---|---|---|
| 7 | No project **rename** exists anywhere in the app, despite Module 2's synopsis line explicitly promising "Create, save, rename, delete" | Section 5, Module 2 | 2 |
| 8 | No **Export & Share** functionality exists at all (no CSV/JSON export, no shareable link) | Section 5, Module 9 | 9 (new) |
| 9 | No **User Profile & Settings** page/route exists at all | Section 5, Module 10 | 10 (new) |
| 10 | No **Real-Time Collaboration** exists at all (no Supabase Realtime channel, no presence, no live cursors) | Section 5, Module 11 | 11 (new) |
| 11 | Synopsis states "13 node types"; the engine actually implements 15 | Section 5, Module 3 | 3 |

## Data that's generated but never persisted

| # | Gap | Module |
|---|---|---|
| 12 | AI Assistant chat history exists only in React state — lost on every page refresh; a `chat_history` table exists in one schema file but is never written to | 6 |
| 13 | Simulation results are never saved to the database — a `simulation_runs` table exists in one schema file (for exactly this) but is never written to; refreshing the page loses all results permanently | 7 |

## Repository hygiene issues (not behavioral bugs, but worth cleaning up)

| # | Issue | Detail |
|---|---|---|
| 14 | Two different, conflicting SQL schema files both claim to define `projects` (different ID defaults, different `graph_json` column type, different extra tables) | `justcmul8-app/supabase-schema.sql` vs `supabase_schema.sql` (repo root) |
| 15 | `GEMINI_API_KEY` is read via `process.env.GEMINI_API_KEY!` but is absent from the included `.env.local` — the AI Assistant would fail at runtime unless it's set elsewhere in deployment | `.env.local` / `route.ts` |
| 16 | The dashboard's simulation-domain list (`SIM_TYPES` constant) is hand-duplicated in `dashboard/page.tsx` rather than imported from `simTypeRegistry.ts`, which its own doc comment calls "the single source of truth" | `dashboard/page.tsx` |
| 17 | `pythonEngineStub.ts` (`PythonSimEngine`, an SSE-based backend client) is fully written but never instantiated anywhere in the app — a documented-as-future extension point, not dead code to delete, but worth knowing it does nothing today | `pythonEngineStub.ts` |

## How to use this document
Per the project's own ground rules (see `docs/01-architecture.md` and the original
chat brief): **none of these were fixed silently.** Before implementing any fix,
confirm with your project supervisor whether it counts as:
- **Correctness restoration** (gaps 1–6, 11) — arguably in-scope for "100%
  functional correctness," since the code's own stated intent (comments, unused
  fields, synopsis wording) says this behavior *should* exist.
- **New feature completion** (gaps 7–10) — already agreed in scope, being built as
  Modules 9, 10, 11 (plus rename folded into Module 2's rebuild).
- **Explicitly out of scope** (leave as-is, just documented) — a valid choice for
  any item here if time-constrained; the honest documentation itself has value for
  a final-year project defense regardless of whether every gap gets closed.
