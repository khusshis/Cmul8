# JustCmul8 — Master Rebuild Prompt for Antigravity

Paste this entire document as your project brief. It is self-contained. Also
upload the original `justCmul8`folder alongside this prompt — you must read and
reference the real original source code, not reconstruct logic from description
alone, wherever this document says "port from original."

---

## PART 1 — THE OPERATING LOOP (follow this for the entire project)

Do not write the whole project in one uninterrupted pass. Work in small,
explainable increments, in this exact repeating cycle, for every phase in the
roadmap (Part 3):

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — ANALYZE                                                 │
│  Before writing any new code for the current phase, open and read │
│  the corresponding file(s) in the original Cmul8.zip source.      │
│  Understand: what it does, what algorithm/logic it implements,    │
│  what state it owns, what other files it imports from/is imported │
│  by, and any TODOs, unused code, or inconsistencies you notice.   │
│  Do not skip this even if the file "looks simple."                │
├─────────────────────────────────────────────────────────────────┤
│  STEP 2 — PLAN OUT LOUD                                           │
│  Before writing code, state in 3-6 sentences: what you're about   │
│  to build, which original file(s) it replaces/ports, and whether  │
│  the logic is being kept identical, restyled only, or changed     │
│  (if changed — STOP and flag it per the rules in Part 2 before    │
│  proceeding; do not silently change logic).                       │
├─────────────────────────────────────────────────────────────────┤
│  STEP 3 — BUILD ONE OR TWO PIECES OF LOGIC AT A TIME               │
│  Write ONE file, or a tightly coupled pair of files (e.g. a        │
│  component + the hook it depends on), not an entire module at     │
│  once. Use the design tokens (Part 4) and glossary (Part 5) —      │
│  never a hardcoded color or a raw technical term in UI copy.       │
├─────────────────────────────────────────────────────────────────┤
│  STEP 4 — EXPLAIN WHAT YOU JUST BUILT                              │
│  Immediately after writing the file(s), explain in plain English:  │
│    a) Purpose — what problem this file solves                      │
│    b) Algorithm/logic — step-by-step, referencing actual function  │
│       names/line behavior, not a vague summary                     │
│    c) Connections — which files it imports, which files import it, │
│       what data flows in and out                                   │
│    d) If ported from the original: what, if anything, changed and  │
│       why (styling-only changes don't need justification; logic    │
│       changes do, and must be flagged per Part 2)                  │
├─────────────────────────────────────────────────────────────────┤
│  STEP 5 — WRITE/UPDATE THE MODULE'S DOC FILE                       │
│  Append or create the relevant file in docs/ (see Part 6 for the   │
│  required structure) capturing what Step 4 just explained, so the  │
│  documentation is built incrementally alongside the code, never    │
│  as an afterthought at the end.                                    │
├─────────────────────────────────────────────────────────────────┤
│  STEP 6 — CHECKPOINT, THEN REPEAT                                  │
│  Move to the next file/logic pair in the current phase and repeat  │
│  from Step 1. Once every file in a phase is done, update           │
│  docs/01-architecture.md's status line, then move to the next      │
│  phase in Part 3.                                                  │
└─────────────────────────────────────────────────────────────────┘
```

This loop applies to every phase below without exception, including the 3 brand
new modules (Export & Share, Profile & Settings, Real-Time Collaboration) — for
those, Step 1 ("analyze the original") will find nothing, which is itself the
finding: state explicitly "no original implementation exists for this — building
from the specification in Part 3 instead," then continue to Step 2.

---

## PART 2 — HARD RULES (apply throughout the entire loop, every phase)

1. **Never silently change simulation logic, formulas, or node behavior.** If you
   find a genuine bug or gap while analyzing the original (Step 1), you MUST state
   it explicitly in your Step 4 explanation and in the module's doc file — never
   fix it without flagging it first. A pre-identified list of known gaps is in
   Part 7 — treat discovering a *new* one the same way.
2. **Do not invent features beyond the 11 modules in Part 3.**
3. **Every user-facing label uses the glossary term (Part 5), not the internal
   technical term.** Code/database keep technical names.
4. **Every color/radius/shadow/font comes from the design tokens (Part 4).** No
   hardcoded hex values in components.
5. **Domain strategy: keep all 6 simulation domains** (Human Queue, Vehicle,
   Liquid/Material Flow, Manufacturing, Logistics/Warehouse, Network/Signal) via
   **one shared engine + one config registry** (`simTypeRegistry.ts` pattern) —
   never fork the engine per domain, never drop a domain. Domain differences are
   presentation-layer only: labels, starter graphs, sprites, KPI charts, AI
   prompts.
6. **Build the Human Queue domain to full polish first**, using it as the
   reference implementation for UI components, docs style, and correctness
   verification. Only once Human Queue works end-to-end do you extend the *same*
   components to the other 5 domains by filling in their registry config entries
   — this should be config/content work, not new component code, since the
   registry pattern is what makes this cheap. See Part 3, Phase 6b.

---

## PART 3 — FULL ROADMAP (phases, in dependency order)

### Phase 0 — Scaffold & Foundation
- Next.js 16 + React 19 + TypeScript (strict) + Tailwind CSS v4 project init.
- Folder structure:
  ```
  src/
    app/                    → Next.js App Router pages + API routes
    components/
      workspace/              → canvas, palette, properties panel, AI chat, results
      layout/                  → navbar, shared chrome
      ui/                       → design-system primitives (buttons, cards, inputs)
    lib/
      simulation/               → engine: types, distributions, code generator, workers
      supabase/                  → client.ts, server.ts
    stores/                    → Zustand stores
  docs/                       → one .md file per module + glossary + architecture
  public/sim-assets/            → sprite sheets per domain
  ```
- Create `docs/00-glossary.md`, `docs/01-architecture.md`, `docs/02-design-system.md`
  using Part 4/5/6 content as the starting point — these are living documents,
  update them as you go, don't treat them as "done" after Phase 0.
- Implement `src/app/globals.css` with the design tokens (Part 4) via Tailwind
  v4's `@theme` directive.

### Phase 1 — Simulation Engine (synopsis Module 5)
Analyze (Step 1 of the loop) these original files in order, porting each with the
loop: `types.ts` → `distributions.ts` → `simTypeRegistry.ts` → `codeGenerator.ts`
→ `pyodideWorker.ts` → `pyodideEngine.ts` → `legacyWorker.ts` → `clientEngine.ts`.

**While porting `codeGenerator.ts`, fix known gap G1 (Part 7): implement
`container`, `channel`, and `broadcaster` node types in the Python/SimPy
generator** (they already exist in `legacyWorker.ts` — port that logic's
*behavior*, translated to SimPy constructs, into the Python template). This is a
correctness restoration, not a new feature — flag it explicitly per Part 2 rule 1,
citing gap G1.

Keep all 15 node types, all 4 distributions, both execution engines
(Pyodide-primary with JS-fallback), exactly as documented in the original
architecture.

### Phase 2 — Authentication (Module 1)
Port `middleware.ts`, `lib/supabase/client.ts` + `server.ts`, `login/page.tsx`,
`signup/page.tsx`, `auth/callback/route.ts`. Logic identical; restyle only
(remove cyberpunk copy/classes, apply design tokens).

### Phase 3 — Project Management (Module 2)
Port `dashboard/page.tsx` (Create/Open/Delete + Supabase `projects` table).
**Add project rename** (gap G7, Part 7) — synopsis explicitly promises it and it
doesn't exist in the original; flag as a gap-closure, not scope creep, per the
existing project decision. **Resolve the two conflicting schema files** (gap G14)
— pick one canonical `projects` table definition (recommend `gen_random_uuid()` +
`jsonb` for `graph_json`) and note the decision in the module doc.

### Phase 4 — Template Gallery (Module 8)
Port `simTypeRegistry.ts`'s `subScenarios` data and the scenario-loading UI
(originally embedded in the Node Palette — Part 3's Phase 6 will build the actual
palette component; this phase is about the *data* and `onLoadScenario` logic).
Preserve every starter graph's nodes/edges/params exactly — do not alter the
domain-expertise numbers baked into them.

### Phase 5 — Visual Graph Editor (Module 3)
Port `NodeCanvas.tsx` (React Flow canvas, custom node/edge rendering, live-stats
overlay, `validateGraphConnectivity`) and `NodePalette.tsx`. **Fix gap G6** (Part
7): ensure the node color/label lookup covers all 15 node types, not just 12
(`any_of`, `all_of`, `interrupter` were missing colors/labels in the original).
Replace the dark/neon canvas background with the light dotted-grid
`.workspace-canvas` style from Phase 0's tokens.

### Phase 6 — Node Configuration Panel (Module 4)
Port `NodePropertiesPanel.tsx` in full, including the arrival-schedule builder,
patience/renege fields, store filter fields, and interrupter target fields. Every
label routed through the glossary (Part 5) — this module has the highest density
of raw technical terms in the original UI, so this is where glossary discipline
matters most.

### Phase 6b — Extend Graph Editor + Config Panel + Template Gallery to remaining 5 domains
Only after Phases 4–6 are fully working and polished for the Human Queue domain:
fill in the `paletteNodes`, `subScenarios`, and any domain-specific labels for
Vehicle, Liquid/Material Flow, Manufacturing, Logistics/Warehouse, and
Network/Signal in `simTypeRegistry.ts`. This should require zero new component
code — if you find yourself writing domain-specific component logic here, stop
and reconsider whether the registry pattern is being bypassed.

### Phase 7 — AI Assistant (Module 6)
Port `api/ai/generate/route.ts` and `AIChatPanel.tsx`. **Fix gap G3 and G4**
(Part 7): update the system prompt to teach Gemini all 15 node types (not 10),
and actually inject each domain's `aiSystemPrompt` from `simTypeRegistry.ts` into
the route (it's defined but was never wired in the original). Do this for Human
Queue in Phase 7 proper; extend to the other 5 domains' prompts during Phase 6b's
counterpart for this module (fill in each domain's `aiSystemPrompt` content).

### Phase 8 — KPI Dashboard & Results (Module 7)
Port `SimResultsPanel.tsx`. **Fix gap G5**: wire the per-domain `kpiMetrics`
registry field into the panel so chart selection is domain-aware instead of one
hardcoded 3-chart layout for every domain. Keep bottleneck-detection and
utilization-based coloring logic identical to the original, mapped to the new
status-color tokens.

### Phase 9 — Export & Share (Module 9) — NEW, no original code exists
- CSV export of KPI results + logs (native `Blob`/`URL.createObjectURL`).
- JSON export of the full graph, round-trippable (re-importable).
- Shareable read-only public link: a `project_shares` table (project_id,
  share_token, created_at, revoked_at) + a public `/share/[token]` route that
  reads via the token only, never exposes edit access, respects RLS.
- **This also requires closing gap G13** (Part 7): simulation results are never
  persisted in the original, so "share/export past results" needs a
  `simulation_runs` insert added when a run completes — state this dependency
  explicitly before building, since it means touching Phase 8's completion
  handler too.

### Phase 10 — User Profile & Settings (Module 10) — NEW, no original code exists
- `/settings` route: display name, email, avatar, password change, default
  simulation domain preference, account deletion.
- Reads/writes Supabase `auth.users` metadata + a `profiles` table if needed.

### Phase 11 — Real-Time Collaboration (Module 11) — NEW, no original code exists
- Supabase Realtime channel scoped per project (`realtime:project:{id}`).
- Broadcast node/edge add/move/delete events between connected clients.
- Presence: connected collaborators' names/avatars + live cursor positions.
- Last-write-wins conflict resolution is acceptable — do not over-engineer CRDTs.

### Phase 12 — Final Pass
- Update `docs/01-architecture.md` with the final as-built diagram.
- Confirm every glossary term introduced across all 11 modules is captured.
- Full sweep: zero hardcoded colors, zero raw technical terms in UI copy.
- Confirm every gap in Part 7 is either closed (and documented as such) or
  explicitly left open with a stated reason.

---

## PART 4 — Design Tokens (n8n-inspired professional theme)

```css
@theme {
  --color-bg: #f7f7fa;
  --color-surface: #ffffff;
  --color-surface-sunken: #f0f0f4;
  --color-border: #e2e2e8;
  --color-text-primary: #1a1a24;
  --color-text-secondary: #6b6b7b;
  --color-accent: #ff6d5a;
  --color-accent-hover: #e85a47;
  --color-accent-soft: #ffe8e5;
  --color-success: #12a150;
  --color-warning: #d9a400;
  --color-error: #d9463f;
  --color-info: #2f6fed;
  --radius-card: 12px;
  --radius-control: 8px;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

Node-type accent colors: source `#2f6fed`, queue `#8b5cf6`, resource `#12a150`,
service `#0ea5a5`, decision `#d9a400`, sink `#6b6b7b`, container `#2563eb`, store
`#7c3aed`, event_trigger `#db2777`, priority_resource `#059669`, channel
`#0891b2`, broadcaster `#ea580c`, any_of `#ca8a04`, all_of `#b45309`,
interrupter `#dc2626`.

Canvas: light dotted grid on `--color-surface-sunken`, dot color `#d6d6de`. Status
colors always paired with an icon/shape, never color alone.

---

## PART 5 — Glossary (Technical term → UI term)

| Technical | UI Term | Technical | UI Term |
|---|---|---|---|
| `source` | Arrival Point | `channel` | Transmission Link |
| `queue` | Waiting Line | `broadcaster` | Broadcast Hub |
| `resource` | Staff / Machine | `any_of` | Wait For Any |
| `service` | Processing Step | `all_of` | Wait For All |
| `decision` | Split Path | `interrupter` | Interrupt Signal |
| `sink` | Exit Point | `exponential` | Random (typical spacing) |
| `container` | Tank / Reservoir | `normal` | Random (around an average) |
| `store` | Storage Buffer | `uniform` | Random (equally likely range) |
| `event_trigger` | Condition Watcher | `constant` | Fixed (always the same) |
| `priority_resource` | Priority Staff/Machine | Utilization | Busy % |
| FIFO discipline | Serve in arrival order | Throughput | Completed per hour |
| LIFO discipline | Serve most recent first | Bottleneck | Slowest Step |
| PRIORITY discipline | Serve most urgent first | Preemptive | Can interrupt lower-priority work |

Domains: `human_queue`→People & Service Lines, `vehicle`→Traffic & Vehicles,
`liquid`→Liquid & Material Flow, `manufacturing`→Manufacturing Line,
`logistics`→Warehouse & Logistics, `network_signal`→Network & Signals.

Note: synopsis states 13 node types; the real engine has 15 — keep all 15 for full
functional parity; note the discrepancy in your final report.

---

## PART 6 — Documentation File Requirements

Filenames (pre-registered, keep numbering stable):
```
docs/00-glossary.md
docs/01-architecture.md
docs/02-design-system.md
docs/03-module-01-authentication.md
docs/04-module-02-project-management.md
docs/05-module-03-visual-graph-editor.md
docs/06-module-04-node-config-panel.md
docs/07-module-05-simulation-engine.md
docs/08-module-06-ai-assistant.md
docs/09-module-07-kpi-dashboard.md
docs/10-module-08-template-gallery.md
docs/11-module-09-export-share.md
docs/12-module-10-profile-settings.md
docs/13-module-11-realtime-collaboration.md
docs/14-audit-findings.md   → running log of every gap found/closed (Part 7 is the seed)
```

Each module doc must contain: **Purpose**, **Files owned** (table), **Algorithm/
logic** (plain English, step-by-step, referencing real function names),
**Gaps flagged in this module** (if any, cross-referenced to Part 7's IDs),
**Connections** to other modules, **Database tables touched** + RLS summary.

---

## PART 7 — Known Gaps to Flag/Address (seed list — add to this, don't remove from it)

| ID | Gap | Phase it's addressed in |
|---|---|---|
| G1 | `container`/`channel`/`broadcaster` node types unimplemented in the Python/SimPy code generator (only in the JS fallback) | Phase 1 |
| G2 | Pause unsupported on the Pyodide execution path; toolbar doesn't reflect this | Phase 1 (flag; fixing is optional — note the limitation in the UI if not fixed) |
| G3 | AI Assistant system prompt only covers 10 of 15 node types | Phase 7 |
| G4 | Per-domain `aiSystemPrompt` field defined in registry, never wired into the AI route | Phase 7 / 6b |
| G5 | Per-domain `kpiMetrics` field defined in registry, never wired into results panel | Phase 8 / 6b |
| G6 | Node color/label lookup in the canvas covers only 12 of 15 node types | Phase 5 |
| G7 | Project rename promised in synopsis, absent from original code | Phase 3 |
| G8 | No Export & Share functionality exists | Phase 9 |
| G9 | No Profile & Settings page exists | Phase 10 |
| G10 | No Real-Time Collaboration exists | Phase 11 |
| G11 | Synopsis says 13 node types; engine has 15 | Note in report; keep 15 |
| G12 | AI chat history never persisted (lost on refresh) | Optional — flag if not fixed |
| G13 | Simulation results never persisted to DB | Phase 9 (dependency) |
| G14 | Two conflicting SQL schema files in the original repo | Phase 3 |
| G15 | `GEMINI_API_KEY` read from env but absent from included `.env.local` | Phase 7 — ensure it's documented as a required deployment env var |
| G16 | Dashboard's domain list hardcoded separately from `simTypeRegistry.ts` | Phase 3 — import from registry instead |
| G17 | `pythonEngineStub.ts` (future SSE backend client) exists but is never instantiated anywhere | Note as a documented future extension point, not dead code |

---

## PART 8 — Definition of Done
- All 11 modules functional across all 6 domains via the shared registry pattern.
- Every gap in Part 7 is either closed (documented how) or explicitly deferred
  (documented why).
- Zero hardcoded colors outside the token file; zero raw technical terms in UI copy.
- Every module has an accurate, code-referencing doc file, built incrementally
  per the Part 1 loop — not written after the fact from memory.
- `docs/01-architecture.md` and `docs/14-audit-findings.md` reflect the final
  as-built state.
