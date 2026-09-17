# Audit Findings — Known Gaps in the Original Codebase

This document consolidates every discrepancy found while writing the module
documentation, by directly reading the original source in `Cmul8.zip` (not
inferred from file names or the synopsis). Each item is also noted in its
relevant module's own doc file; this page exists as a single reference for
project review/viva purposes.

## Correctness gaps (behavior doesn't match what the code implies it should do)

| # | Gap | Where | Module |
|---|---|---|---|
| 1 | `container`, `channel`, `broadcaster` node types are fully implemented in the JS fallback engine (`legacyWorker.ts`) but **not implemented at all** in the primary Python/SimPy code generator (`codeGenerator.ts`) — they silently pass through with none of their special behavior when Pyodide loads successfully (the normal case) | closed prior to this plan, verified during audit |
| 2 | Pause is not supported when running on the Pyodide/SimPy path (`env.run()` is synchronous once started) but the toolbar shows a Pause button unconditionally | `pyodideWorker.ts` | 5 |
| 3 | The AI Assistant's system prompt only teaches Gemini 10 of the 15 node types — `channel`, `broadcaster`, `any_of`, `all_of`, `interrupter` are never mentioned, so the AI can't generate graphs using them | closed prior to this plan, verified during audit |
| 4 | `simTypeRegistry.ts` defines a per-domain `aiSystemPrompt` field explicitly documented as meant to be injected into the Gemini route — it is never referenced there; every domain gets one generic prompt | closed prior to this plan, verified during audit |
| 5 | `simTypeRegistry.ts` also defines a per-domain `kpiMetrics` array meant to drive which charts the results panel shows — never referenced; the panel has one hardcoded 3-chart layout for every domain | closed by this plan's Phases 1–3 |
| 6 | `NodeCanvas.tsx`'s color/label lookup maps cover only 12 of 15 node types — `any_of`, `all_of`, `interrupter` fall back to a default color and their raw technical name as label | closed prior to this plan, verified during audit |

## Missing functionality the synopsis promises but the code doesn't deliver

| # | Gap | Synopsis reference | Module |
|---|---|---|---|
| 7 | No project **rename** exists anywhere in the app, despite Module 2's synopsis line explicitly promising "Create, save, rename, delete" | closed prior to this plan, verified during audit |
| 8 | No **Export & Share** functionality exists at all (no CSV/JSON export, no shareable link) | closed by this plan's Phases 1–3 |
| 9 | No **User Profile & Settings** page/route exists at all | closed by this plan's Phases 1–3 |
| 10 | No **Real-Time Collaboration** exists at all (no Supabase Realtime channel, no presence, no live cursors) | closed by this plan's Phases 1–3 |
| 11 | Synopsis states "13 node types"; the engine actually implements 15 | Section 5, Module 3 | 3 |
| 18 | Block Palette rows were draggable but clicking did nothing (onAddNode prop unused) | closed in Task 3.2 |

## Data that's generated but never persisted

| # | Gap | Module |
|---|---|---|
| 12 | AI Assistant chat history exists only in React state — lost on every page refresh; a `chat_history` table exists in one schema file but is never written to | closed prior to this plan, verified during audit |
| 13 | Simulation results are never saved to the database — a `simulation_runs` table exists in one schema file (for exactly this) but is never written to; refreshing the page loses all results permanently | closed by this plan's Phases 1–3 |

## Repository hygiene issues (not behavioral bugs, but worth cleaning up)

| # | Issue | Detail |
|---|---|---|
| 14 | Two different, conflicting SQL schema files both claim to define `projects` (different ID defaults, different `graph_json` column type, different extra tables) | closed prior to this plan, verified during audit |
| 15 | `GEMINI_API_KEY` is read via `process.env.GEMINI_API_KEY!` but is absent from the included `.env.local` — the AI Assistant would fail at runtime unless it's set elsewhere in deployment | `.env.local` / `route.ts` |
| 16 | The dashboard's simulation-domain list (`SIM_TYPES` constant) is hand-duplicated in `dashboard/page.tsx` rather than imported from `simTypeRegistry.ts`, which its own doc comment calls "the single source of truth" | closed prior to this plan, verified during audit |
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
