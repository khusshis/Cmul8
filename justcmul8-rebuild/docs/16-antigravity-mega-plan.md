# Mega Implementation Plan — Hand-off to Antigravity

**Repo:** `D:\Cmul8\justcmul8-rebuild` (Next.js 16 + React 19 + TypeScript, Supabase backend, Pyodide/SimPy simulation engine)
**Prepared:** 2026-09-18, based on a source-code audit against the original project synopsis (11 modules) and a follow-up line-by-line code audit.
**Audience:** Antigravity (autonomous coding agent). This file is the complete brief — no other context should be needed to execute it.

---

## 0. How to work through this plan

1. Treat each numbered **Task** below as an independent unit of work. Do them **in the order listed** — Task 2 fixes a data-corruption bug and should go first, Task 5 is a security hole and should go second, before purely cosmetic/UX tasks.
2. For every task:
   - Open the exact file(s) named and read the surrounding ~50 lines before editing — line numbers below are from the audit pass and may have drifted by the time you run this; use them as a search anchor, not gospel.
   - Use your codebase-wide search capability to confirm there are no *other* call sites of anything you change (e.g. if you rename a Supabase column, grep the whole repo for the old name first).
   - Make the change.
   - Run `npm run lint` and `npx tsc --noEmit` (or your build tool's equivalent) in `D:\Cmul8\justcmul8-rebuild` and fix any new errors before moving to the next task.
   - Where a task touches UI, use your browser/live-preview capability against `npm run dev` to actually click through the affected flow — do not mark a UI task done from reading code alone.
   - Where a task touches the database schema, add a **new** SQL migration file rather than editing `supabase/schema.sql` in place if the project has a migrations folder; if it only has the one `schema.sql`, edit it in place but call out in your commit message that existing Supabase projects need the ALTER statements run manually.
3. After all tasks, run the full verification checklist in Section 7 and report results.
4. Do not invent new abstractions, feature flags, or backwards-compatibility shims. Fix exactly what's described. If you find the actual code differs materially from what's quoted here, trust the live code and adapt the fix to match its real shape — the intent of each task (below) is what matters, not the literal diff.

---

## Task 1 — Wire per-domain KPI metrics into the results dashboard (dead code → live)

### Problem
`src/lib/simulation/simTypeRegistry.ts` defines a `kpiMetrics: KpiMetricDef[]` array for **every one of the 6 simulation domains** (human_queue, vehicle_traffic, material_flow, manufacturing, logistics, network_signals — confirm exact IDs in the file). Its shape:

```ts
export interface KpiMetricDef {
  key: keyof import("./types").NodeStats | "totalArrived" | "totalCompleted" | "bottleneck";
  label: string;
  unit: string;
  chartType: "bar" | "line" | "pie" | "kpi_card";
  nodeTypes?: NodeType[];
}
```

Example (human_queue domain):
```ts
kpiMetrics: [
  { key: "avgWaitTime",    label: "Avg Wait Time",     unit: "min",    chartType: "bar",      nodeTypes: ["queue"] },
  { key: "utilization",    label: "Staff Utilization", unit: "%",      chartType: "pie",      nodeTypes: ["resource"] },
  { key: "totalCompleted", label: "Total Served",      unit: "people", chartType: "kpi_card", nodeTypes: [] },
  { key: "currentDepth",   label: "Queue Length",      unit: "people", chartType: "line",     nodeTypes: ["queue"] },
  { key: "avgServiceTime", label: "Avg Service Time",  unit: "min",    chartType: "bar",      nodeTypes: ["resource", "service"] },
],
```

**Nobody reads this array.** `grep -rn "kpiMetrics" src/` should return zero hits outside its own definition file once you start. Instead:
- `src/components/workspace/SimResultsPanel.tsx` hardcodes every chart directly off `result.totalCompleted`, `result.nodeStats`, `result.timeline`, `waitTimePercentiles`, etc. — identical charts for all 6 domains.
- `src/components/workspace/results-dashboard/ExecutiveTab.tsx` (only reachable via the separate `AdvancedResultsDashboard.tsx` full-screen view, not the docked `SimResultsPanel`) renders a "Specific Performance Metrics" grid from `result.domainMetrics`, which comes from a **different, parallel** hardcoded per-domain switch statement in `src/lib/simulation/analyticsEngine.ts` (`computeDomainMetrics`).

So there are currently **two hardcoded systems** doing similar jobs, and the registry-driven `kpiMetrics` config is a third, unused one.

### What to build
Do not try to unify all three systems in one shot — that's a rewrite, not a fix, and risks breaking working charts. Instead, make `kpiMetrics` the actual source of truth for the "Specific Performance Metrics" section, since that's the one place explicitly meant to be domain-specific:

1. In `src/lib/simulation/analyticsEngine.ts`, read `computeDomainMetrics` in full first. Decide whether it's computing values that `kpiMetrics` metadata can't derive (e.g. custom formulas) — if so, keep the *value computation* there, but stop hardcoding *which* metrics to show per domain there.
2. Add a resolver utility, e.g. `src/lib/simulation/resolveKpiMetrics.ts`:

```ts
import type { KpiMetricDef } from "./simTypeRegistry";
import type { SimResult, NodeStats } from "./types";

export interface ResolvedKpi {
  label: string;
  unit: string;
  chartType: KpiMetricDef["chartType"];
  value: number | null;
  series?: { name: string; value: number }[]; // for bar/line/pie, one entry per matching node
}

export function resolveKpiMetrics(
  metrics: KpiMetricDef[],
  result: SimResult
): ResolvedKpi[] {
  return metrics.map((m) => {
    if (m.key === "totalArrived" || m.key === "totalCompleted") {
      return { label: m.label, unit: m.unit, chartType: m.chartType, value: result[m.key] ?? null };
    }
    if (m.key === "bottleneck") {
      return { label: m.label, unit: m.unit, chartType: m.chartType, value: null, series: undefined };
    }
    // node-level stat: pull from result.nodeStats, filtered by nodeTypes if given
    const entries = Object.entries(result.nodeStats ?? {})
      .filter(([, stats]) => !m.nodeTypes?.length || m.nodeTypes.includes((stats as NodeStats).type))
      .map(([nodeId, stats]) => ({
        name: (stats as NodeStats).label ?? nodeId,
        value: Number((stats as NodeStats)[m.key as keyof NodeStats] ?? 0),
      }));
    const avg = entries.length ? entries.reduce((s, e) => s + e.value, 0) / entries.length : null;
    return { label: m.label, unit: m.unit, chartType: m.chartType, value: avg, series: entries };
  });
}
```

   Adjust field names to whatever `SimResult`/`NodeStats` actually export — read `src/lib/simulation/types.ts` first.

3. In `ExecutiveTab.tsx`, replace the `domainMetrics` grid's data source: call `resolveKpiMetrics(simConfig.kpiMetrics, result)` instead of (or merged with) `result.domainMetrics`, and render each `ResolvedKpi` with the `chartType` it declares (`kpi_card` → simple stat tile, `bar`/`line`/`pie` → the existing Recharts components already imported in that file, just fed `series` instead of the old ad-hoc arrays).
4. In `SimResultsPanel.tsx`'s Overview section, add a small "Domain KPIs" row using the same resolver, so the docked panel (the one people actually see most) also becomes domain-aware, not just the rarely-opened `AdvancedResultsDashboard`.
5. Do this for all 6 domains — after wiring, switch the workspace between at least 2 different simulation domains and confirm the KPI cards actually change (not just labels — the underlying node-type filtering must produce different series).

### Acceptance criteria
- `grep -rn "kpiMetrics" src/` returns hits in `resolveKpiMetrics.ts` and its two consumers, not just the registry.
- Running a `human_queue` simulation and a `manufacturing` simulation shows visibly different KPI cards/charts (different labels, different node-type filters), not the same 5 generic charts relabeled.

---

## Task 2 — Fix the `chat_history` schema/code mismatch (data-loss bug, do this first)

### Problem
`src/components/workspace/AIChatPanel.tsx` inserts rows shaped like:
```ts
{ project_id, role: "user" | "assistant", content: string, metadata?: {...} }
```
But `supabase/schema.sql` (lines ~30-37) defines:
```sql
CREATE TABLE IF NOT EXISTS public.chat_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  message text not null,
  created_at timestamptz default now()
);
```
Concretely broken:
- Column is `message`, code writes `content` → insert fails or silently drops the field (depending on Supabase client strictness) on any project whose live DB matches this schema file.
- CHECK constraint only allows `role in ('user','ai')`; code writes `role: "assistant"` → constraint violation.
- `user_id` is `NOT NULL` with no default; code never sets it → NOT NULL violation.
- `metadata` column doesn't exist in schema at all; code reads/writes it anyway.
- RLS policies gate on `auth.uid() = user_id`, which is never populated client-side, so even if the insert succeeded, RLS would likely reject it (or over-permit if the policy is looser than expected — check the actual policy definitions in the file, lines ~79-86).

**Verify first**: check whether the live Supabase project's actual table already diverged from this SQL file (i.e. someone already ran manual ALTERs). If your DB access lets you introspect the live schema, do that before deciding which side (code or schema) is "correct". If you cannot introspect it, assume the code is the intended behavior (it's newer / more actively maintained) and migrate the schema to match it.

### What to build
1. Add a migration (new file, e.g. `supabase/migrations/xxxx_fix_chat_history.sql`, or edit `schema.sql` directly if no migrations folder exists) that reshapes the table to match the code's actual usage:

```sql
alter table public.chat_history rename column message to content;
alter table public.chat_history drop constraint if exists chat_history_role_check;
alter table public.chat_history add constraint chat_history_role_check check (role in ('user', 'assistant'));
alter table public.chat_history add column if not exists metadata jsonb;
alter table public.chat_history alter column user_id drop not null;
```
(Only drop the `user_id NOT NULL` constraint if you are not going to populate it from the client — see next step, which is the better fix.)

2. Better fix for `user_id`: in `AIChatPanel.tsx`, get the current user once (`const { data: { user } } = await supabase.auth.getUser();`) and include `user_id: user.id` in every insert, so the existing RLS policy (`auth.uid() = user_id`) actually works as designed instead of being neutered. Update the two insert call sites (user message insert, assistant message insert) accordingly.
3. Re-read the RLS policies in `schema.sql` for `chat_history` and confirm they still make sense after the column rename (policies referencing `message` need to reference `content` now).
4. Test: send a chat message in the AI Assistant panel, refresh the page, confirm history reloads (this exercises the `select` path too, which already used `content` — so it may have been silently returning no rows / erroring before your fix).

### Acceptance criteria
- Sending a message in `AIChatPanel` no longer throws a Supabase insert error (check browser console/network tab).
- Reloading the project page shows prior chat history restored, including assistant replies.
- `user_id` is populated on every new row.

---

## Task 3 — Fix the Pause button (currently a confusing, silent no-op on Pyodide runs)

### Problem
`src/app/dashboard/project/[id]/page.tsx`, Pause button (~line 536):
```tsx
<button
  onClick={handlePause}
  disabled={simState !== "running"}
  ...
>
  <Pause size={14} fill="currentColor" /> Pause
</button>
```
`disabled` only checks `simState`, never which engine is running the simulation. `handlePause` (~line 301):
```ts
function handlePause() {
  if (engineRef.current) {
    engineRef.current.pause();
    if (pyodideStatus.phase !== "error") {
      console.warn("Pause not supported on Pyodide. Engine continues running.");
    } else {
      setSimState("paused");
    }
  }
}
```
This logic is backwards: when Pyodide is healthy and actually running (`phase !== "error"`), it only logs a console warning and the UI stays stuck showing "Running" while the click did nothing. `setSimState("paused")` only fires in the (nonsensical) case where the engine is already in an error state.

Worker side confirms pause is a genuine no-op for Pyodide (`src/lib/simulation/pyodideWorker.ts`):
```ts
case "pause":
  emit({ type: "status", phase: "ready", message: "Pause not supported with SimPy sync mode" });
  break;
```
This is architecturally correct — `pyodide.runPythonAsync(python)` is one blocking synchronous SimPy `env.run()` call with no yield point to interrupt. But `src/lib/simulation/clientEngine.ts` (the non-Pyodide, tick-by-tick TS engine used for some sim types) has a real `pause()` that presumably works. Check which `simType`s / domains route to `clientEngine` vs `pyodideEngine` (search `engineRef.current =` assignments in the project page) before writing the fix.

### What to build
1. Determine at simulation-start time which engine kind is active (Pyodide vs client) and store it in state, e.g. `const [engineKind, setEngineKind] = useState<"pyodide" | "client">(...)`.
2. Update the Pause button:
```tsx
<button
  onClick={handlePause}
  disabled={simState !== "running" || engineKind === "pyodide"}
  title={engineKind === "pyodide" ? "Pause isn't supported for this simulation type" : undefined}
  ...
>
```
3. Fix `handlePause` to not silently do nothing when it *is* clickable — for the pyodide case it should now be unreachable (button disabled), so the function only needs to handle the client-engine path:
```ts
function handlePause() {
  if (engineRef.current && engineKind === "client") {
    engineRef.current.pause();
    setSimState("paused");
  }
}
```
4. If product intent is to still let users *attempt* pause on Pyodide runs (rather than disabling the button outright), instead show a toast/inline message ("This simulation type can't be paused mid-run — stop and restart instead") rather than a console-only warning — pick whichever matches how other transient messages are surfaced elsewhere in this file (search for existing toast/alert patterns before inventing a new one).

### Acceptance criteria
- Starting a Pyodide-backed simulation (e.g. human_queue if that's Pyodide-routed) shows the Pause button either disabled with a tooltip, or clicking it produces a visible user-facing message — never a silent no-op with the button still enabled and `simState` stuck on "running".
- Starting a client-engine-backed simulation (if any domain uses it) still pauses correctly and `simState` updates to `"paused"`.

---

## Task 4 — Add "+N" overflow chip to the presence avatar stack

### Problem
`src/app/dashboard/project/[id]/page.tsx` (~lines 581-594):
```tsx
{remoteUsers.length > 0 && (
  <div className="flex items-center -space-x-2">
    {remoteUsers.slice(0, 4).map((u) => (
      <div key={u.id} title={u.name} className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white" style={{ background: u.color }}>
        {u.name.charAt(0).toUpperCase()}
      </div>
    ))}
  </div>
)}
```
The 5th+ collaborator is silently dropped from the UI with no indication more people are present.

### What to build
```tsx
{remoteUsers.length > 0 && (
  <div className="flex items-center -space-x-2">
    {remoteUsers.slice(0, 4).map((u) => (
      <div key={u.id} title={u.name} className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white" style={{ background: u.color }}>
        {u.name.charAt(0).toUpperCase()}
      </div>
    ))}
    {remoteUsers.length > 4 && (
      <div
        title={remoteUsers.slice(4).map((u) => u.name).join(", ")}
        className="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white"
      >
        +{remoteUsers.length - 4}
      </div>
    )}
  </div>
)}
```
Match the exact class names / design tokens already used elsewhere in this file if they differ from the guess above — this project has a specific design system (see `docs/02-design-system.md`), don't introduce a new gray shade if a token already exists for it.

### Acceptance criteria
- With 5+ simulated collaborators present (you can fake this by pushing extra entries into `remoteUsers` state temporarily during testing, then reverting), a "+N" chip appears, and hovering it lists the overflowed names.

---

## Task 5 — Lock down the Realtime collaboration channel (security gap)

### Problem
`src/lib/realtime/usePresence.ts` joins a channel keyed only by project ID:
```ts
const channel = supabase.channel(`project:${projectId}`, { config: { presence: { key: selfId } } });
```
`grep -rn -i "realtime|broadcast|presence|publication" supabase/schema.sql` returns **zero matches** — there is no Realtime Authorization policy or app-level check restricting who can join a given project's presence/broadcast channel. Any client that knows or guesses a `projectId` (they're likely sequential or easily enumerable UUIDs — check `projects` table) can currently join that channel, see live cursors, see who's editing what, and potentially receive/inject `graph-op`/`nodeData` broadcast events for a project they don't own or collaborate on.

### What to build
Pick whichever of these two matches what the Supabase project version supports (check `@supabase/supabase-js` version in `package.json` — `^2.110.4` supports Realtime Authorization / private channels):

**Option A (preferred) — Realtime Authorization via RLS on `realtime.messages`:**
Add to `schema.sql`:
```sql
-- Require channel membership to check `topic` against a project the user can access
create policy "project members can access their project's realtime channel"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'project:' || (
    select p.id::text from public.projects p where p.id::text = split_part(realtime.topic(), ':', 2)
    and (p.owner_id = auth.uid() /* or your actual collaborator/ownership column */)
  )
);
```
Adjust the ownership/collaborator check to whatever column `projects` actually uses (read the table definition first — don't guess a column name that doesn't exist). Then mark the channel private on the client:
```ts
const channel = supabase.channel(`project:${projectId}`, {
  config: { private: true, presence: { key: selfId } },
});
```

**Option B (simpler, if Realtime Authorization isn't feasible in this Supabase plan/version) — app-level guard:**
Before calling `channel.subscribe()` in `usePresence.ts`, verify the current user has access to `projectId` via a normal Supabase query against `projects` (respecting existing RLS), and bail out (no subscribe, no track) if it fails:
```ts
const { data: project, error } = await supabase
  .from("projects")
  .select("id")
  .eq("id", projectId)
  .single();
if (error || !project) {
  console.error("No access to this project's realtime channel");
  return;
}
// ...then proceed to create/subscribe the channel as before
```
This doesn't stop someone from directly hitting the Supabase Realtime websocket with a valid JWT and a guessed topic string outside your app, but it does stop it through your app's own UI, and is a reasonable interim fix if Option A's server-side policy isn't available.

Also, in the same file, change the cleanup on unmount from:
```ts
return () => { channel.unsubscribe(); };
```
to:
```ts
return () => { supabase.removeChannel(channel); };
```
`removeChannel` is Supabase's documented full-teardown call (unsubscribes and removes internal references) — `unsubscribe()` alone can leave references that delay garbage collection and, per Supabase's own docs, is not the recommended cleanup path.

### Acceptance criteria
- A user who is not a collaborator/owner on Project A cannot see live cursors or presence from Project A, even if they know its `projectId` and open `usePresence` against it manually from devtools.
- Normal collaboration between two legitimate collaborators on the same project still works exactly as before.

---

## Task 6 — Two items to *verify only*, not fix (audit found them already correct)

Do not spend time rewriting these — just confirm they still hold after Tasks 1-5, since Task 1 touches `analyticsEngine.ts`/`simTypeRegistry.ts` which these also depend on:

1. **Per-domain AI system prompts are already wired.** `src/lib/ai/systemPrompt.ts`'s `buildSystemPrompt()` already interpolates `domain.aiSystemPrompt` from `simTypeRegistry.ts`, and both `src/app/api/ai/chat/route.ts` and `src/app/api/ai/generate/route.ts` already read `SIM_TYPE_REGISTRY[simType]?.aiSystemPrompt`. The two routes use *different* prompt-construction schemes (`buildSystemPrompt()` vs an inline `BASE_SYSTEM_PROMPT` in `generate/route.ts`) — if you have spare time after Tasks 1-5, consider unifying them so both endpoints build prompts the same way, but this is a nice-to-have, not a bug.
2. **NodeCanvas color/label maps are already complete for all 15 node types**, including `any_of`, `all_of`, `interrupter`, `channel`, `broadcaster` (see `NODE_BASE_COLORS` in `src/components/workspace/NodeCanvas.tsx` and `NODE_LABELS` in `simTypeRegistry.ts`). The only thing worth double-checking is that the corresponding CSS custom properties (`--color-node-any-of`, `--color-node-all-of`, `--color-node-interrupter`, etc.) are actually defined in the global stylesheet — if any are missing, the color falls back to `unset`/transparent even though the JS map itself is fine. Grep `globals.css` (or wherever `--color-node-*` tokens live) for all 15 and fill in any that are missing.

---

## 7. Final verification checklist

Run through all of this in the browser against `npm run dev` before considering the plan complete:

- [ ] `npm run lint` and `npx tsc --noEmit` pass with no new errors.
- [ ] Run a `human_queue` simulation → KPI dashboard (both docked panel and full-screen Executive view) shows queue/resource-specific charts.
- [ ] Run a `manufacturing` (or any other non-queue) simulation → KPI dashboard shows visibly different charts/labels than human_queue.
- [ ] Send an AI Assistant chat message → no console/network errors, message persists after a page refresh.
- [ ] Clear AI chat history → table actually empties (re-check via Supabase dashboard if available).
- [ ] Start a Pyodide-backed simulation → Pause button behaves sanely (disabled+tooltip, or clear user-facing message on click) — no silent no-op with a stuck "Running" state.
- [ ] Simulate 5+ presence users (temporarily) → "+N" chip appears with correct overflow names on hover.
- [ ] Attempt to join another project's realtime channel as a non-collaborator (via devtools console, calling the presence hook logic manually with a foreign `projectId`) → access is denied or the app-level guard blocks subscription.
- [ ] All 15 node types render with distinct colors and human-readable labels on the canvas.

Report back per-checklist-item pass/fail, and list any deviations you made from this plan because the live code didn't match what's quoted above.
