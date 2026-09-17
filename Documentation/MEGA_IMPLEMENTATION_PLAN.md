# JustCmul8 — Mega Implementation Plan (Remaining 40–50%)

**Prepared for:** Antigravity (AI coding agent), executing sequentially, one numbered step at a time.
**How to use this document:** Every task below is broken into atomic, ordered steps. Each step names the exact file, the exact function/line/JSX region to touch, and either the literal code to write or a fully-specified description of it (props, types, return values). Do not redesign, reorder, or "improve" a step — if a step seems questionable, flag it in your Step 4 explanation (per the project's own operating loop in `Documentation/ANTIGRAVITY_MASTER_PROMPT.md`) rather than silently deviating. Execute tasks in the order they appear — later tasks assume earlier ones are done.

---

## 0. Ground truth — verified by reading the actual code (not the stale docs)

`Documentation/01-architecture.md`'s status line says "Module 0 scaffold complete," but that is **out of date**. I read the live source in `justcmul8-rebuild/src/` directly. Confirmed DONE — do not re-plan or re-touch these unless a task below explicitly names the file:

- Landing, Auth (login/signup/forgot-password/update-password), Canvas rendering, Glossary, Results panel shell.
- `NodePalette.tsx` — reskinned as **"Block Palette"**, category-grouped (CORE/RESOURCES/ROUTING/ADVANCED).
- `NodePropertiesPanel.tsx` — glossary-clean; technical strings (`"source"`, `"queue"`, etc.) appear only as internal object keys at lines 476–490, never as visible UI text.
- `simTypeRegistry.ts` — all 6 domains fully populated, including `aiSystemPrompt` and `kpiMetrics` per domain.
- `api/ai/generate/route.ts` — teaches Gemini all 15 node types (lines 31–45); injects `SIM_TYPE_REGISTRY[simType].aiSystemPrompt` at line 57.
- `codeGenerator.ts` — `container`/`channel`/`broadcaster` implemented in the Python/SimPy template (lines 162, 378, 408, 417, 597, 601).
- `NodeCanvas.tsx` — all 15 node types have color tokens (lines 37–41 confirmed: `channel`, `broadcaster`, `any_of`, `all_of`, `interrupter`).
- `dashboard/page.tsx` — project rename exists (lines 91–102); no hardcoded `SIM_TYPES` constant (domain list is registry-driven).
- `AIChatPanel.tsx` — chat messages inserted into `chat_history` on send/receive (lines 25, 62, 86).
- `TemplateGallery.tsx` — exists, wired into `project/[id]/page.tsx` (shown when canvas empty, dismissible), modal pattern: `fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4` + `framer-motion` scale/opacity entrance on a `bg-white rounded-[24px] shadow-2xl` panel. **Reuse this exact pattern for every new modal in this plan (Phase 3.4's `ShareExportModal`).**
- `supabase/schema.sql` — one canonical file, `gen_random_uuid()` + `jsonb` graph_json, RLS on all 3 existing tables (`projects`, `simulation_runs`, `chat_history`).

**The real glossary source of truth is `NODE_LABELS` in `simTypeRegistry.ts` (around line ~100–113), NOT the table in Part 5 of the master prompt** — the master prompt's table is an older draft. Confirmed live values include: `source`→"Start Point", `queue`→"Waiting Line", `resource`→"Limited Counter" (or a domain override like "Teller" in palette), `service`→"Counter", `decision`→"Decision Block", `sink`→"Exit Point". Every new UI string you write in this plan must pull from `NODE_LABELS` / `NODE_TYPE_CONFIG`'s `label` field, never hardcode a rephrased term.

Confirmed genuinely **NOT done** — this is the real scope of every task below:

| Gap ID | What's missing | Where I verified it |
|---|---|---|
| G5 | `kpiMetrics` registry field defined but never read | `SimResultsPanel.tsx` lines 115–176: 3 `ChartPanel`s hardcoded for every domain; only `simConfig.entityName` (a string) is read from the registry, never `simConfig.kpiMetrics` (the array) |
| G13 | Simulation results never persisted | Zero matches for `simulation_runs` anywhere under `src/`, despite the table existing with the right columns in `schema.sql` |
| G8 / Module 9 | No Export & Share | No CSV/JSON export code, no `project_shares` table, no `/share/[token]` route |
| G9 / Module 10 | No Profile & Settings | No `/settings` route, no `profiles` table; `Navbar.tsx` lines 207–224 render 4 profile-menu buttons ("Profile Settings", "Account Settings", "Billing & Subscription", "Help & Support") with **no `onClick`/navigation at all** — confirmed by reading lines 195–239 |
| G10 / Module 11 | No Real-Time Collaboration | No Supabase Realtime channel anywhere in `src/` |
| G2 | Pause silently no-ops on Pyodide | `project/[id]/page.tsx` lines 186–197: `handlePause` calls `engine.pause()` then only `console.warn`s — the Pause button (lines 358–364) stays enabled and looks like it did something |
| New | Block Palette click-to-add is dead | `NodePalette.tsx`: rows are `draggable` with `onDragStart` (lines 78–82) but the `onAddNode` prop is never called anywhere in the file; `project/[id]/page.tsx` line 401 passes `onAddNode={() => {}}` — a literal no-op stub |
| New | Config panel has no header/title chrome | `project/[id]/page.tsx` lines 418–429: `<NodePropertiesPanel>` is rendered with zero wrapping container — no title, no border, no empty-state when nothing is selected (line 421 passes `nodes.find(...) || {}`, an empty object, straight into the panel) |

---

## Phase 1: Architecture & State Management Updates

### Task 1.1 — Export `KpiMetricDef` at module scope so other files can import it

**File:** `src/lib/simulation/simTypeRegistry.ts`

Step 1. Open the file, locate the existing declaration (already found, around line 43):
```ts
export interface KpiMetricDef {
  key: keyof import("./types").NodeStats | "totalArrived" | "totalCompleted" | "bottleneck";
  label: string;
  unit: string;
  chartType: "bar" | "line" | "pie" | "kpi_card";
  nodeTypes?: NodeType[];
}
```
Step 2. It is already `export`ed — confirm no change needed here. Do NOT redefine it elsewhere; every file in Phase 3 must `import type { KpiMetricDef } from "@/lib/simulation/simTypeRegistry";`.
Step 3. In `src/lib/simulation/types.ts`, confirm `NodeStats` (already defined, has fields `entitiesIn`, `entitiesOut`, `currentDepth`, `utilization`, `avgWaitTime`, `avgServiceTime`, `level?`, `renegeCount?`, `breakdownCount?`, `totalDowntime?`, `droppedCount?`, `lateCount?`, `avgLatency?`) is exported — it already is. No edit needed; this step is a verification checkpoint only, so Phase 3.1 can safely do `stats[metric.key as keyof NodeStats]`.
Step 4. No file is modified in this task if both checks pass. If either export is missing, add the `export` keyword and stop — do not change the shape of either interface.

### Task 1.2 — Add a pure mapper from `SimResult` to a `simulation_runs` insert row

**New file:** `src/lib/simulation/resultPersistence.ts`

Step 1. Create the file with this exact content:
```ts
import type { SimResult } from "./types";

export interface SimulationRunInsert {
  project_id: string;
  user_id: string;
  duration_seconds: number;
  sim_time_seconds: number;
  total_arrived: number;
  total_completed: number;
  bottleneck_node: string | null;
  result_json: SimResult;
  logs_json: SimResult["logs"];
}

export function toSimulationRunRow(
  projectId: string,
  userId: string,
  result: SimResult,
  durationSeconds: number
): SimulationRunInsert {
  return {
    project_id: projectId,
    user_id: userId,
    duration_seconds: Math.round(durationSeconds),
    sim_time_seconds: result.totalSimTime,
    total_arrived: result.totalArrived,
    total_completed: result.totalCompleted,
    bottleneck_node: result.bottleneckNodeId || null,
    result_json: result,
    logs_json: result.logs,
  };
}
```
Step 2. Do not add any Supabase import or `await` call inside this file — it must stay a pure function with zero side effects. The actual `.insert(...)` call happens in Task 2.1, inside `project/[id]/page.tsx`, which imports this function.
Step 3. `result_json` stores the entire `SimResult` object (including `nodeStats` and `timeline`) as one `jsonb` blob — matches the column type already declared in `schema.sql` (`result_json jsonb`). Do not try to normalize `nodeStats` into separate rows/columns; the schema was intentionally designed as one JSON blob per run.

### Task 1.3 — Add DB-row-shaped types for the two new tables

**File:** `src/lib/simulation/types.ts`

Step 1. Open the file, find the end of the existing type exports (after `SimResult`, `SimLog`, etc.).
Step 2. Append these three new exported interfaces verbatim:
```ts
export interface SimulationRunRecord {
  id: string;
  project_id: string;
  user_id: string;
  ran_at: string;
  duration_seconds: number | null;
  sim_time_seconds: number | null;
  total_arrived: number | null;
  total_completed: number | null;
  bottleneck_node: string | null;
  result_json: SimResult | null;
  logs_json: SimLog[] | null;
}

export interface ProjectShare {
  id: string;
  project_id: string;
  share_token: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_sim_type: SimTypeId;
  updated_at: string;
}
```
Step 3. Confirm `SimLog` is already an exported type in this file (it's referenced by `SimResult.logs` already) — if it isn't currently exported (only used locally), add `export` to its declaration. Do not change its shape.
Step 4. These three interfaces are typing-only — nothing in this task calls Supabase. Tasks 2.1–2.3 and 3.4–3.5 will import them.

### Task 1.4 — Do not introduce Zustand; keep local component state; add one small hook for presence only

Step 1. Confirm (by grepping `src/` for `zustand`) that no global store exists today — state is local `useState` inside `project/[id]/page.tsx`. **Do not migrate this to Zustand.** The canvas autosave (`triggerAutoSave`/`autoSave`, lines 132–145) already works correctly against this local-state pattern; introducing a new state architecture here is out of scope and is the single easiest way to break working autosave/undo behavior.
Step 2. The only new shared-state need in this whole plan is Realtime presence (Task 2.4/3.6), which needs to be read by both the canvas overlay and the toolbar avatar strip. For that alone, create **new file** `src/lib/realtime/usePresence.ts` (full content specified in Task 2.4, Step 4 below) — a plain React hook, not a store. Do not build this hook yet in this task; this step only records the decision so later tasks don't second-guess it.

---

## Phase 2: Backend API & Database Hookups

### Task 2.1 — Persist every finished simulation run (closes G13)

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. Add this import near the top of the file, alongside the other `@/lib/simulation/*` imports (after line 10):
```ts
import { toSimulationRunRow } from "@/lib/simulation/resultPersistence";
```
Step 2. Add a `runStartTimeRef` to measure wall-clock duration. Immediately after the existing `const engineRef = useRef<SimulationEngine | null>(null);` (line 58), add:
```ts
const runStartTimeRef = useRef<number>(0);
```
Step 3. In `handleRun` (currently lines 164–184), inside the `if (engineRef.current && project) { ... }` block, immediately before `engineRef.current.start({...})`, add:
```ts
runStartTimeRef.current = Date.now();
```
Step 4. Locate the engine's completion callback, currently at lines 63–66:
```ts
engine.onComplete((result) => {
  setSimState("idle");
  setSimResult(result);
});
```
Replace it with:
```ts
engine.onComplete(async (result) => {
  setSimState("idle");
  setSimResult(result);

  if (project) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const durationSeconds = (Date.now() - runStartTimeRef.current) / 1000;
      const row = toSimulationRunRow(project.id, user.id, result, durationSeconds);
      const { error } = await supabase.from("simulation_runs").insert(row);
      if (error) {
        console.warn("Failed to save simulation run to history:", error.message);
      } else {
        setRunSavedPulse(true);
        setTimeout(() => setRunSavedPulse(false), 2000);
      }
    }
  }
});
```
Step 5. Add the new `runSavedPulse` state used above. Immediately after `const [simResult, setSimResult] = useState<SimResult | null>(null);` (line 50), add:
```ts
const [runSavedPulse, setRunSavedPulse] = useState(false);
```
Step 6. Add the visual feedback. In the toolbar's "Saved Status" pill block (currently lines 284–296), add a second small pill right after it (still inside the same `<div className="flex items-center gap-3">` at line 281) — insert this new block immediately after the closing `</div>` of the Saved Status pill (after line 296):
```tsx
{runSavedPulse && (
  <div className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-blue-50 border border-blue-100/60 text-blue-600 text-[12.5px] font-bold shadow-sm animate-pulse">
    <Check size={12} />
    Run saved to history
  </div>
)}
```
`Check` is already imported at the top of the file (line 6, `lucide-react`) — no new icon import needed.
Step 7. Do not add any UI for browsing past runs in this task — that's explicitly out of scope here (no "history" list view was requested); this task only makes the writes happen so Phase 3.4's CSV export (Task 3.4) has real data to read.

### Task 2.2 — Export & Share database schema (Module 9 backend, part 1 of 3)

**File:** `supabase/schema.sql` (append — do not touch sections 1–7, which are already correct and live)

Step 1. Open the file, scroll to the very end (after the `NOTIFY pgrst, 'reload schema';` line).
Step 2. Append this new section, matching the file's existing numbered-comment style exactly:
```sql

-- 8. Project Shares table (read-only public links)
CREATE TABLE IF NOT EXISTS public.project_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own shares') THEN
        CREATE POLICY "Users can manage their own shares" ON public.project_shares
          FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_shares_token ON public.project_shares(share_token);

-- 9. Public read function for a single shared project (never grant anon direct table SELECT)
CREATE OR REPLACE FUNCTION public.get_shared_project(token text)
RETURNS TABLE (name text, sim_type text, graph_json jsonb) AS $$
  SELECT p.name, p.sim_type, p.graph_json
  FROM public.projects p
  JOIN public.project_shares s ON s.project_id = p.id
  WHERE s.share_token = token AND s.revoked_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_shared_project(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
```
Step 3. This intentionally does **not** grant `anon` a `SELECT` policy on `project_shares` or `projects` — the only public read path is the `SECURITY DEFINER` function, which checks `revoked_at IS NULL` itself. This is the correct pattern to prevent token enumeration via RLS-exposed listing endpoints. Do not add an `anon` `SELECT` policy anywhere as a "simpler" alternative.
Step 4. Run this migration against the Supabase project (via the SQL editor, same as the existing `schema.sql` was run) before writing any code in Task 2.2's remaining steps or Task 3.4 — the API routes below assume this table and function already exist.

### Task 2.2 (continued) — Export & Share API routes (Module 9 backend, part 2 of 3)

**New file:** `src/app/api/projects/[id]/share/route.ts`

Step 1. Create the file with this exact structure:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("project_shares")
    .select("share_token")
    .eq("project_id", params.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ url: `/share/${existing.share_token}` });
  }

  const { data: created, error: insertError } = await supabase
    .from("project_shares")
    .insert({ project_id: params.id, created_by: user.id })
    .select("share_token")
    .single();
  if (insertError || !created) {
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }

  return NextResponse.json({ url: `/share/${created.share_token}` });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", params.id)
    .eq("created_by", user.id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("project_shares")
    .select("share_token")
    .eq("project_id", params.id)
    .eq("created_by", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  return NextResponse.json({ url: data ? `/share/${data.share_token}` : null });
}
```
Step 2. Check `src/lib/supabase/server.ts`'s exact exported function name/signature before writing the import above — the existing `auth/callback/route.ts` already imports it; copy that exact import path and call pattern (e.g. it may be `createClient()` synchronous, not `async`/`await` — match whatever the existing server client actually exports, do not assume `await` is needed if the real signature is sync).
Step 3. `POST` is idempotent — calling it twice while a link is already active returns the same existing link rather than creating a duplicate row. This matches the "one active share link per project" UX implied by Task 3.4's UI (a single toggle, not a list).

**New file:** `src/app/api/projects/[id]/export/route.ts`

Step 4. Create the file:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") || "json";

  const { data: project, error } = await supabase
    .from("projects")
    .select("name, sim_type, graph_json")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (format === "json") {
    const body = JSON.stringify({ name: project.name, sim_type: project.sim_type, graph_json: project.graph_json }, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "_")}.json"`,
      },
    });
  }

  // format === "csv" — pull the most recent run's node stats
  const { data: run } = await supabase
    .from("simulation_runs")
    .select("result_json")
    .eq("project_id", params.id)
    .eq("user_id", user.id)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run?.result_json) {
    return NextResponse.json({ error: "No simulation results yet for this project — run a simulation first." }, { status: 404 });
  }

  const stats = run.result_json.nodeStats as Record<string, any>;
  const rows = [["Block", "Type", "In", "Out", "Utilization %", "Avg Wait (s)"]];
  for (const s of Object.values(stats)) {
    rows.push([
      s.label,
      s.nodeType,
      String(s.entitiesIn ?? ""),
      String(s.entitiesOut ?? ""),
      s.utilization != null ? String(Math.round(s.utilization * 100)) : "",
      s.avgWaitTime != null ? s.avgWaitTime.toFixed(1) : "",
    ]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "_")}_results.csv"`,
    },
  });
}
```
Step 5. The CSV column order (`Block, Type, In, Out, Utilization %, Avg Wait`) intentionally matches the "BLOCK STATS" table already rendered in `SimResultsPanel.tsx` (lines 184–190) so the exported file matches what the user already saw on screen. Do not add or reorder columns.
Step 6. This route depends on Task 2.1 having actually run at least once for a project — if `simulation_runs` is empty for that project, the route correctly returns a 404 with a human-readable message (surfaced by Task 3.4's UI, not a generic error).

### Task 2.3 — Profile & Settings database schema (Module 10 backend, part 1 of 2)

**File:** `supabase/schema.sql` (append after Task 2.2's additions)

Step 1. Append:
```sql

-- 10. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_sim_type text default 'human_queue',
  updated_at timestamptz default now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- 11. Auto-create a profile row whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
```
Step 2. Because this trigger only fires on **new** signups, existing users (created before this migration) will have no `profiles` row. Handle this in the Settings page itself (Task 3.5, Step 3) with an `upsert` on first load rather than a plain `select` that could return nothing.
Step 3. Run this migration in Supabase before writing Task 3.5's UI.

### Task 2.3 (continued) — Account deletion API route (Module 10 backend, part 2 of 2)

**New file:** `src/app/api/account/delete/route.ts`

Step 1. Confirm `SUPABASE_SERVICE_ROLE_KEY` exists as an env var (check `.env.local` / deployment config). If it's missing, add a line for it now (value obtained from the Supabase project settings → API → service_role key) — **never** expose this key to any client-side file; it must only ever be read inside this one server route via `process.env.SUPABASE_SERVICE_ROLE_KEY`.
Step 2. Create the file:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```
Step 3. Deleting the `auth.users` row cascades to `profiles`, `projects`, `simulation_runs`, `chat_history`, and `project_shares` automatically — every one of those tables' foreign keys is already declared `on delete cascade` (confirmed in `schema.sql` for the existing three, and written that way in Tasks 2.2/2.3's new tables above). Do not write any manual cleanup queries here; the cascade handles it.
Step 4. This route must be called from the client with the user still authenticated (their session cookie), then the client must immediately call `supabase.auth.signOut()` and redirect to `/` after a success response — wire that part in Task 3.5, Step 6.

### Task 2.4 — Real-Time Collaboration backend (Module 11)

No new tables. This uses Supabase Realtime Broadcast + Presence on an ephemeral channel, not Postgres storage.

**New file:** `src/lib/realtime/usePresence.ts`

Step 1. Create the hook with this exact shape:
```ts
"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

export interface GraphOp {
  kind: "nodes" | "edges";
  changes: any[];
  fromUserId: string;
}

const CURSOR_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5"];

export function usePresence(projectId: string, selfId: string, selfName: string) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const opHandlerRef = useRef<((op: GraphOp) => void) | null>(null);

  useEffect(() => {
    if (!projectId || !selfId) return;
    const color = CURSOR_COLORS[Math.abs(hashCode(selfId)) % CURSOR_COLORS.length];
    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: selfId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const list: PresenceUser[] = Object.values(state)
        .map((entries) => entries[0])
        .filter((u) => u.id !== selfId);
      setUsers(list);
    });

    channel.on("broadcast", { event: "graph-op" }, ({ payload }) => {
      if (payload.fromUserId !== selfId && opHandlerRef.current) {
        opHandlerRef.current(payload as GraphOp);
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ id: selfId, name: selfName, color });
      }
    });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [projectId, selfId, selfName]);

  function broadcastOp(op: Omit<GraphOp, "fromUserId">) {
    channelRef.current?.send({
      type: "broadcast",
      event: "graph-op",
      payload: { ...op, fromUserId: selfId },
    });
  }

  function onRemoteOp(handler: (op: GraphOp) => void) {
    opHandlerRef.current = handler;
  }

  return { users, broadcastOp, onRemoteOp };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}
```
Step 2. `THEME_COLORS`/`CURSOR_COLORS` here duplicates the array already defined in `SimResultsPanel.tsx` line 12. This duplication is intentional and acceptable (it's a 6-item literal array, not worth a shared-constants file for this alone) — do not refactor `SimResultsPanel.tsx` to import from here or vice versa.
Step 3. Wiring this hook into the canvas and toolbar happens in Task 3.6 — this task only builds the hook itself. Do not call it from anywhere yet.
Step 4. Regression note carried forward to Phase 4.3: `broadcastOp` must only be called from the **local** change handlers, and `onRemoteOp`'s handler must apply changes without re-triggering `broadcastOp` — this guard is implemented in Task 3.6, Step 3, not here.

---

## Phase 3: Remaining Frontend UI Components (Config Panels, Dashboards, AI)

### Task 3.1 — Make the KPI Dashboard domain-aware (closes G5)

**File:** `src/components/workspace/SimResultsPanel.tsx`

Step 1. Add a new import at the top (after line 10):
```ts
import type { KpiMetricDef } from "@/lib/simulation/simTypeRegistry";
```
Step 2. Delete the fixed `utilizationData`, `queueData`, `pieData` variables at lines 42–62 — these become metric-driven instead of hardcoded to "resource/service/priority_resource" and "queue/store" filters.
Step 3. Replace them with one generic builder function, placed right before the `return (` (before line 68):
```ts
function buildChartData(metric: KpiMetricDef, statsEntries: [string, any][]) {
  const filtered = metric.nodeTypes && metric.nodeTypes.length > 0
    ? statsEntries.filter(([, s]) => metric.nodeTypes!.includes(s.nodeType))
    : statsEntries;
  return filtered.map(([id, s]) => {
    const raw = s[metric.key];
    const value = typeof raw === "number"
      ? (metric.unit === "%" ? Math.round(raw * 100) : parseFloat(raw.toFixed(2)))
      : raw;
    return {
      name: s.label.length > 12 ? s.label.substring(0, 12) + "…" : s.label,
      value,
    };
  });
}
```
Note: `metric.unit === "%"` triggers the `*100` conversion because `utilization` is stored as a 0–1 fraction in `NodeStats` but the registry's `utilization` metric declares `unit: "%"` — this exactly matches the existing hand-written logic at old line 46 (`Math.round((s.utilization ?? 0) * 100)`), just generalized.
Step 4. Replace the three hardcoded `{utilizationData.length > 0 && (<ChartPanel...>)}` blocks (old lines 116–176) with one loop over `simConfig.kpiMetrics`, skipping any `chartType: "kpi_card"` entries (those render as pills, handled separately in Step 6) and any metric with an empty data array:
```tsx
{simConfig.kpiMetrics.filter((m) => m.chartType !== "kpi_card").map((metric) => {
  const data = buildChartData(metric, statsEntries);
  if (data.length === 0) return null;
  const width = metric.chartType === "pie" ? 200 : 260;
  return (
    <ChartPanel key={metric.key} title={`${metric.label.toUpperCase()} (${metric.unit})`} width={width}>
      <ResponsiveContainer width="100%" height="100%">
        {metric.chartType === "bar" ? (
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 16, left: -10 }}>
            <XAxis dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name={metric.label} radius={[2, 2, 0, 0]}>
              {data.map((d, i) => {
                const color = metric.unit === "%"
                  ? (d.value > 80 ? "var(--color-error)" : d.value > 50 ? "var(--color-warning)" : "var(--color-success)")
                  : "var(--color-warning)";
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        ) : metric.chartType === "line" ? (
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 16, left: -10 }}>
            <XAxis dataKey="name" tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="value" stroke="var(--color-info)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value" nameKey="name" paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={THEME_COLORS[i % THEME_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px", color: "var(--color-text-secondary)" }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </ChartPanel>
  );
})}
```
Step 5. `Cell` requires importing from `recharts` for the `PieChart` case above — it's already imported at line 5. `Line`/`LineChart` need to be added to the existing recharts import at the top of the file (currently line 3–6 imports `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend` — confirm `LineChart`/`Line` are already there; if the current file's import list is missing either, add them).
Step 6. Handle `chartType: "kpi_card"` metrics (e.g. `human_queue`'s `totalCompleted` entry) by adding them into the existing inline KPI-pill row (old lines 92–100, the `KpiPill` row next to "ARRIVED"/"COMPLETED"/"EFFICIENCY"/"BOTTLENECK"). Insert one more mapped block right after the existing `{result.bottleneckNodeId && (...)}` line:
```tsx
{simConfig.kpiMetrics.filter((m) => m.chartType === "kpi_card").map((metric) => {
  const raw = (result as any)[metric.key];
  if (raw == null) return null;
  return (
    <KpiPill key={metric.key} icon={<Activity size={12} />} label={metric.label.toUpperCase()} value={String(raw)} color="var(--color-info)" />
  );
})}
```
Step 7. Keep the "BLOCK STATS" table (old lines 178–219) and its bottleneck-highlighting/utilization-coloring exactly as-is — it is domain-agnostic by construction and correctly uses `NODE_LABELS`. Do not modify that block at all.
Step 8. After this change, `human_queue`'s panel will show: Avg Wait Time (bar, queue nodes), Staff Utilization (pie, resource nodes), Queue Length (line, queue nodes), Avg Service Time (bar, resource+service nodes), plus a "TOTAL SERVED" kpi-card pill — different domains will show a different mix automatically because they read their own `kpiMetrics` array. Manually verify at least 2 domains (e.g. `human_queue` and `vehicle`) render distinct chart sets after this change, since that's the entire point of the fix.

### Task 3.2 — Fix Block Palette click-to-add (new bug, not in the original gap list)

**File:** `src/components/workspace/NodeCanvas.tsx`

Step 1. This file owns `reactFlowInstance` and the node-creation logic (`onDrop`, lines 374–403) — click-to-add needs the same ID-generation and default-params logic, but triggered without a drag event. Expose an imperative method via `forwardRef`.
Step 2. Find the current `export default function NodeCanvas(...)` wrapper (the outer component that wraps `NodeCanvasInner` in a `ReactFlowProvider`, likely near the bottom of the file after `NodeCanvasInner`'s closing brace). Change it to a `forwardRef` so the parent page can call an `addNode` method:
```ts
import { forwardRef, useImperativeHandle } from "react";

export interface NodeCanvasHandle {
  addNode: (nodeType: string) => void;
}

const NodeCanvas = forwardRef<NodeCanvasHandle, NodeCanvasProps>(function NodeCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner {...props} exposedRef={ref} />
    </ReactFlowProvider>
  );
});
export default NodeCanvas;
```
(Match whatever the existing `ReactFlowProvider` wrapper already looks like — do not remove any existing provider/context wrapping, only add the `forwardRef`/`useImperativeHandle` layer around it.)
Step 3. Inside `NodeCanvasInner` (which needs to now also accept an `exposedRef` prop, or take the ref directly if you restructure so `NodeCanvasInner` itself is what's wrapped in `forwardRef` — pick whichever requires touching fewer lines given the file's actual current structure, but the imperative method must ultimately call `setNodes`/`onNodesChange` from inside `NodeCanvasInner` where `reactFlowInstance` lives), add:
```ts
useImperativeHandle(exposedRef, () => ({
  addNode: (nodeType: string) => {
    if (!reactFlowInstance) return;
    const viewport = reactFlowInstance.getViewport();
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const centerScreen = {
      x: (bounds?.width ?? 800) / 2,
      y: (bounds?.height ?? 600) / 2,
    };
    const position = reactFlowInstance.screenToFlowPosition(centerScreen);
    const maxId = nodes.reduce((max, n) => {
      const match = n.id.match(/\d+/);
      return match ? Math.max(max, parseInt(match[0], 10)) : max;
    }, 0);
    const newNodeId = `node_${Math.max(nodeIdCounter++, maxId + 1)}`;
    const newNode: Node = {
      id: newNodeId,
      type: "simNode",
      position: { x: position.x + Math.random() * 40 - 20, y: position.y + Math.random() * 40 - 20 },
      data: { label: NODE_LABELS[nodeType] || nodeType, nodeType, params: {} },
    };
    onNodesChange([{ type: "add", item: newNode }]);
  },
}), [reactFlowInstance, nodes, onNodesChange]);
```
This deliberately duplicates the ID-generation logic from `onDrop` (lines 384–401) rather than extracting a shared helper — the two call sites (drag-drop vs click-add) have different position-calculation inputs (mouse event vs viewport center) and forcing a shared helper would need an awkward union-type parameter for no real benefit; a few duplicated lines here is the simpler, more honest option. The small random jitter (`± 20px`) avoids stacking every click-added node at the exact same pixel.
Step 4. **File:** `src/app/dashboard/project/[id]/page.tsx` — add a ref and wire it up.
- Add near the other refs (after line 58): `const canvasRef = useRef<NodeCanvasHandle>(null);`
- Import the type: add `import type { NodeCanvasHandle } from "@/components/workspace/NodeCanvas";` near the other workspace imports.
- Attach the ref to the existing `<NodeCanvas ... />` JSX (around line 405): add `ref={canvasRef}` as a prop.
- Change line 401 from `onAddNode={() => {}}` to `onAddNode={(type) => canvasRef.current?.addNode(type)}`.
Step 5. **File:** `src/components/workspace/NodePalette.tsx` — actually call the prop. In the palette row `div` (lines 78–82), add `onClick={() => onAddNode(n.type)}` alongside the existing `draggable`/`onDragStart` attributes:
```tsx
<div
  key={n.type}
  draggable
  onDragStart={(e) => onDragStart(e, n.type)}
  onClick={() => onAddNode(n.type)}
  className={`p-3.5 flex items-start gap-3.5 cursor-grab active:cursor-grabbing hover:bg-bg-surface-sunken transition-colors group ${!isLast ? 'border-b border-border/60' : ''}`}
>
```
Step 6. Manual test after this task: click three different palette rows in a row with no drag — confirm three new nodes appear on canvas at slightly offset positions near the viewport center, each correctly typed and labeled. Then confirm drag-and-drop still works exactly as before (this task must not regress it).

### Task 3.3 — Add "Block Configuration" title/chrome to the properties panel

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. Locate the `activeRightPanel === "properties"` branch (currently lines 418–429):
```tsx
<div className="relative">
  {activeRightPanel === "properties" ? (
    <NodePropertiesPanel
      node={nodes.find((n) => n.id === selectedNodeId) || {}}
      simType={project?.sim_type || "human_queue"}
      onUpdate={(id, partialData) => { ... }}
    />
  ) : (
    <AIChatPanel ... />
  )}
</div>
```
Step 2. Replace the `activeRightPanel === "properties"` branch with a wrapped, titled version:
```tsx
{activeRightPanel === "properties" ? (
  <div className="w-[320px] border-l border-border bg-surface h-full flex flex-col overflow-hidden">
    <div className="p-4 pb-3 flex items-center justify-between border-b border-border">
      <h2 className="text-[15px] font-bold text-text-primary">Block Configuration</h2>
      <button
        onClick={() => setActiveRightPanel("ai")}
        className="p-1 hover:bg-bg-surface-sunken rounded-md text-text-secondary transition-colors"
      >
        <X size={16} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-4">
      {selectedNodeId && nodes.find((n) => n.id === selectedNodeId) ? (
        <NodePropertiesPanel
          node={nodes.find((n) => n.id === selectedNodeId)!}
          simType={project?.sim_type || "human_queue"}
          onUpdate={(id, partialData) => {
            onUpdateNodes((prev) =>
              prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...partialData } } : n))
            );
          }}
        />
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-text-secondary px-6">
          <Settings size={28} className="opacity-40" />
          <p className="text-[13px] leading-relaxed">Select a block on the canvas to configure it.</p>
        </div>
      )}
    </div>
  </div>
) : (
  <AIChatPanel
    project={{ id: project?.id || "", name: project?.name || "", sim_type: project?.sim_type || "human_queue" }}
    nodes={nodes}
    edges={edges}
    onApplyChanges={(newNodes, newEdges) => {
      setNodes(newNodes);
      setEdges(newEdges);
      setSaved(false);
    }}
  />
)}
```
Step 3. Add the two new icon imports to the existing `lucide-react` import line (line 6): add `X` and `Settings` to the destructured list (`ArrowLeft, Play, Pause, Square, Save, Loader2, Home, ChevronRight, ChevronDown, Edit2, Check, X, Settings`).
Step 4. This wrapper's `w-[320px] border-l border-border bg-surface` mirrors `NodePalette.tsx`'s own `w-[280px] border-r border-border bg-surface` (line 49) — the two side panels are now a visually matched pair (Block Palette on the left, Block Configuration on the right), which was your explicit naming/consistency requirement.
Step 5. **File:** `src/components/workspace/NodePropertiesPanel.tsx` — add a glossary-label eyebrow to each per-type sub-component. At the top of every `function XProperties({...}) { return ( ... ) }` block (e.g. `SourceProperties` at line 51, `QueueProperties` at line 151, etc.), the very first element inside the returned JSX fragment should be:
```tsx
<div className="text-[11px] font-bold tracking-widest uppercase text-[var(--color-accent)] mb-3">
  {NODE_LABELS[nodeType]} Settings
</div>
```
Since each sub-component doesn't currently receive `nodeType` as a prop (only `params`, `nodeId`, `onUpdate`, and for one case `isPriorityNode` — confirmed from the earlier read of lines 51/151/193/239/259/287/302/326/359), add `nodeType: NodeType` to every one of these sub-components' prop destructuring, and pass it down from wherever they're invoked (the parent switch/dispatch inside the main exported `NodePropertiesPanel` function, which already knows `node.data.nodeType`). Import `NODE_LABELS` and `NodeType` at the top of the file if not already imported (`import { NODE_LABELS } from "@/lib/simulation/simTypeRegistry";` and `import type { NodeType } from "@/lib/simulation/types";`).
Step 6. Do not change the actual field logic/inputs inside any `XProperties` component in this task — this is a pure additive heading, not a refactor of the form fields themselves.

### Task 3.4 — Export & Share UI (Module 9 frontend)

**New file:** `src/components/ui/Modal.tsx` — a shared modal primitive, extracted from `TemplateGallery.tsx`'s existing pattern so it isn't duplicated a third time.

Step 1. Create:
```tsx
"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({
  open, onClose, title, maxWidth = "max-w-md", children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`w-full ${maxWidth} bg-white rounded-[24px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden`}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-[#111827] tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 hover:text-gray-700 transition-colors shadow-sm"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```
This is the exact visual language of `TemplateGallery.tsx`'s modal shell (lines 19–30), factored out so it's reusable.

**New file:** `src/components/workspace/ShareExportModal.tsx`

Step 2. Create:
```tsx
"use client";
import React, { useState, useEffect } from "react";
import { Download, Link2, Copy, Check, Loader2, FileJson, FileSpreadsheet } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function ShareExportModal({
  open, onClose, projectId,
}: { open: boolean; onClose: () => void; projectId: string }) {
  const [tab, setTab] = useState<"export" | "share">("export");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (open && tab === "share") {
      fetch(`/api/projects/${projectId}/share`).then((r) => r.json()).then((d) => setShareUrl(d.url));
    }
  }, [open, tab, projectId]);

  async function createLink() {
    setLoadingShare(true);
    const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
    const data = await res.json();
    setShareUrl(data.url);
    setLoadingShare(false);
  }

  async function revokeLink() {
    setLoadingShare(true);
    await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
    setShareUrl(null);
    setLoadingShare(false);
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function download(format: "csv" | "json") {
    setExportError(null);
    const res = await fetch(`/api/projects/${projectId}/export?format=${format}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Export failed" }));
      setExportError(err.error || "Export failed");
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="(.+)"/);
    const filename = match ? match[1] : `export.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={onClose} title="Share & Export">
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-full p-1">
        {(["export", "share"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-full text-[13px] font-bold capitalize transition-colors ${tab === t ? "bg-white shadow-sm text-[#111827]" : "text-gray-500"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "export" ? (
        <div className="space-y-3">
          <button
            onClick={() => download("json")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-[#5742FF]/40 hover:bg-[#5742FF]/5 transition-colors text-left"
          >
            <FileJson size={20} className="text-[#5742FF]" />
            <div className="flex-1">
              <div className="font-bold text-[13.5px] text-[#111827]">Download as JSON</div>
              <div className="text-[11.5px] text-gray-500">Full graph — can be re-imported later</div>
            </div>
            <Download size={16} className="text-gray-400" />
          </button>
          <button
            onClick={() => download("csv")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-[#5742FF]/40 hover:bg-[#5742FF]/5 transition-colors text-left"
          >
            <FileSpreadsheet size={20} className="text-emerald-600" />
            <div className="flex-1">
              <div className="font-bold text-[13.5px] text-[#111827]">Download as CSV</div>
              <div className="text-[11.5px] text-gray-500">Latest simulation results, block by block</div>
            </div>
            <Download size={16} className="text-gray-400" />
          </button>
          {exportError && <p className="text-[12px] text-red-500 px-1">{exportError}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Anyone with this link can view a read-only copy of your simulation canvas. They cannot edit it or see your other projects.
          </p>
          {shareUrl ? (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <Link2 size={14} className="text-gray-400 flex-shrink-0" />
                <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}${shareUrl}`} className="flex-1 bg-transparent text-[12.5px] text-gray-700 outline-none" />
                <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-500" />}
                </button>
              </div>
              <button onClick={revokeLink} disabled={loadingShare} className="text-[12.5px] font-bold text-red-500 hover:text-red-600 transition-colors">
                {loadingShare ? <Loader2 size={12} className="animate-spin inline" /> : "Revoke link"}
              </button>
            </>
          ) : (
            <button
              onClick={createLink}
              disabled={loadingShare}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#5742FF] text-white font-bold text-[13.5px] hover:bg-[#4531E5] disabled:opacity-50 transition-colors"
            >
              {loadingShare ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Create shareable link
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
```
Step 3. **File:** `src/app/dashboard/project/[id]/page.tsx` — wire the trigger button and modal state.
- Add state near the other UI-state variables (after `const [galleryDismissed, setGalleryDismissed] = useState(false);`, line 45): `const [shareModalOpen, setShareModalOpen] = useState(false);`
- Import the component: `import ShareExportModal from "@/components/workspace/ShareExportModal";`
- Add a Share button to the toolbar, placed between the "Right Divider" (line 376) and the "Avatar" block (lines 379–384):
```tsx
<button
  onClick={() => setShareModalOpen(true)}
  className="flex items-center justify-center h-[34px] gap-1.5 px-4 rounded-full bg-white border border-gray-200 text-[#111827] text-[13.5px] font-bold hover:bg-gray-50 transition-colors shadow-sm"
>
  <Share2 size={14} /> Share
</button>
```
Add `Share2` to the existing `lucide-react` import (line 6).
- Render the modal at the end of the component's JSX, just before the outermost closing `</div>` of the whole page:
```tsx
<ShareExportModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} projectId={project?.id || ""} />
```

**New file:** `src/app/share/[token]/page.tsx` — public read-only viewer.

Step 4. Create:
```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ShareViewer from "@/components/workspace/ShareViewer";

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_project", { token: params.token });
  const project = Array.isArray(data) ? data[0] : data;
  if (error || !project) notFound();

  return <ShareViewer name={project.name} simType={project.sim_type} graph={project.graph_json} />;
}
```
Step 5. **New file:** `src/components/workspace/ShareViewer.tsx` — client component that renders the canvas in read-only mode plus a CTA banner:
```tsx
"use client";
import React from "react";
import Link from "next/link";
import NodeCanvas from "@/components/workspace/NodeCanvas";
import { Rocket } from "lucide-react";

export default function ShareViewer({ name, simType, graph }: { name: string; simType: string; graph: { nodes: any[]; edges: any[] } }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-surface-sunken">
      <div className="flex-shrink-0 h-14 flex items-center justify-between px-5 bg-white border-b border-gray-100">
        <div className="font-bold text-[#111827] text-[14px]">{name} <span className="text-gray-400 font-medium">(view only)</span></div>
        <Link href="/signup" className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#5742FF] text-white text-[12.5px] font-bold hover:bg-[#4531E5] transition-colors">
          <Rocket size={14} /> Build your own simulation
        </Link>
      </div>
      <div className="flex-1 relative">
        <NodeCanvas
          nodes={graph.nodes || []}
          edges={graph.edges || []}
          simType={simType}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          selectedNodeId={null}
          onSelectNode={() => {}}
          simState="idle"
          readOnly
        />
      </div>
    </div>
  );
}
```
Step 6. **File:** `src/components/workspace/NodeCanvas.tsx` — add the `readOnly` prop used above.
- Add `readOnly?: boolean;` to `NodeCanvasProps` (line 329, right after `bottleneckNodeId?: string;`).
- Destructure it in `NodeCanvasInner`'s params (line 337): add `readOnly = false` to the destructured props.
- Find wherever the `<ReactFlow ...>` element sets `nodesDraggable`/`nodesConnectable`/`elementsSelectable` (or add these props if not currently set) and make them `!readOnly`. If the component currently drives dragging purely through `onNodesChange`, at minimum pass `nodesDraggable={!readOnly}` and `elementsSelectable={!readOnly}` on the `<ReactFlow>` element, and short-circuit `onDrop`/`onConnect` at their top with `if (readOnly) return;`.
Step 7. **File:** `src/middleware.ts` — confirm `/share/:path*` is never matched by the auth-redirect logic. The current `config.matcher` (line 35) is `["/dashboard/:path*"]`, which already does not include `/share` — no change needed here, but explicitly verify this after creating the route (this is the one route in the whole plan that must stay outside the auth gate; regressing this would make shared links unusable for logged-out viewers).

### Task 3.5 — Profile & Settings UI (Module 10 frontend)

**New file:** `src/app/settings/page.tsx`

Step 1. Create the page with four `GlassCard`-based sections, reusing the existing `src/components/ui/GlassCard.tsx` primitive (already confirmed to render `bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] border border-[var(--color-border)]` — exactly the "soft drop shadow, modern" look required):
```tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GlassCard from "@/components/ui/GlassCard";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { Loader2, Check, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultSimType, setDefaultSimType] = useState<SimTypeId>("human_queue");
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);
    setEmail(user.email || "");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profile) {
      setDisplayName(profile.display_name || "");
      setDefaultSimType(profile.default_sim_type || "human_queue");
    } else {
      await supabase.from("profiles").upsert({ id: user.id, display_name: "" });
    }
    setLoading(false);
  }

  async function saveProfile() {
    await supabase.from("profiles").upsert({
      id: userId, display_name: displayName, default_sim_type: defaultSimType, updated_at: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    setPasswordMsg(null);
    if (newPassword.length < 8) { setPasswordMsg("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg("Passwords don't match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Password updated.");
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/");
    } else {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[var(--color-info)]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)] tracking-tight mb-2">Account Settings</h1>

        <GlassCard className="p-6" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-4">Profile</h2>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-surface w-full mb-4" />
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email</label>
          <input value={email} disabled className="input-surface w-full opacity-60 mb-4" />
          <button onClick={saveProfile} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] text-white font-bold text-[13px] hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2">
            {saved ? <><Check size={14} /> Saved</> : "Save Profile"}
          </button>
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-4">Preferences</h2>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Default Simulation Domain</label>
          <select value={defaultSimType} onChange={(e) => setDefaultSimType(e.target.value as SimTypeId)} className="input-surface w-full">
            {Object.values(SIM_TYPE_REGISTRY).map((cfg) => (
              <option key={cfg.id} value={cfg.id}>{cfg.label}</option>
            ))}
          </select>
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-4">Security</h2>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-surface w-full mb-3" />
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-surface w-full mb-3" />
          {passwordMsg && <p className="text-[12.5px] text-[var(--color-text-secondary)] mb-3">{passwordMsg}</p>}
          <button onClick={changePassword} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] font-bold text-[13px] hover:bg-[var(--color-border)] transition-colors">
            Change Password
          </button>
        </GlassCard>

        <GlassCard className="p-6 border-[var(--color-error)]/30" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-error)] mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> Danger Zone
          </h2>
          <p className="text-[12.5px] text-[var(--color-text-secondary)] mb-4">Deleting your account permanently removes all your projects, simulation history, and chat history. This cannot be undone.</p>
          {!deleteConfirmOpen ? (
            <button onClick={() => setDeleteConfirmOpen(true)} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-accent-soft)] text-[var(--color-error)] font-bold text-[13px] hover:bg-[var(--color-error)]/20 transition-colors">
              Delete Account
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={deleteAccount} disabled={deleting} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-error)] text-white font-bold text-[13px] disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : "Yes, permanently delete"}
              </button>
              <button onClick={() => setDeleteConfirmOpen(false)} className="px-4 py-2 text-[13px] font-bold text-[var(--color-text-secondary)]">Cancel</button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
```
Step 2. Check `input-surface` is an existing utility class (it's already used verbatim in `NodePropertiesPanel.tsx` line 14: `const inputCls = "input-surface w-full mt-1";`) — confirm it's defined in `globals.css`; if not, it's already relied upon elsewhere so it must exist, no action needed.
Step 3. This form intentionally does not include avatar upload — per the plan, avatar stays a simple `avatar_url` column with no UI input field in this pass, since building Supabase Storage bucket config is a separate concern not requested. Do not add a file-upload widget here.

Step 4. **File:** `src/components/layout/Navbar.tsx` — wire the two real menu items, leave the two placeholder ones inert-but-honest.
- Add `Link` usage (already imported at line 4) to the profile-menu items array (lines 208–212). Change the array from plain objects into ones carrying an optional `href`:
```tsx
{[
  { icon: User, title: "Profile Settings", sub: "Update your personal information", href: "/settings" },
  { icon: Settings, title: "Account Settings", sub: "Manage your account preferences", href: "/settings" },
  { icon: CreditCard, title: "Billing & Subscription", sub: "View invoices and payment methods", href: null },
  { icon: HelpCircle, title: "Help & Support", sub: "Get help and view documentation", href: null }
].map((item, idx) => (
  item.href ? (
    <Link key={idx} href={item.href} onClick={() => setProfileOpen(false)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group text-left">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
        <item.icon size={16} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <h6 className="font-bold text-[#111827] text-[13px]">{item.title}</h6>
        <p className="text-[11px] text-gray-500">{item.sub}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
    </Link>
  ) : (
    <button key={idx} disabled className="flex items-center gap-4 p-3 rounded-xl opacity-50 cursor-not-allowed text-left">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
        <item.icon size={16} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <h6 className="font-bold text-gray-500 text-[13px]">{item.title}</h6>
        <p className="text-[11px] text-gray-400">Coming soon</p>
      </div>
    </button>
  )
))}
```
Rationale: "Billing & Subscription" and "Help & Support" have no backend/content in scope for this plan (billing was never in the 11-module roadmap; help/support has no docs site to link to) — marking them visibly disabled with "Coming soon" is more honest than linking to `/settings` for everything, and avoids inventing a billing page that was never asked for.

### Task 3.6 — Real-Time Collaboration UI (Module 11 frontend)

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. Import and initialize the hook from Task 2.4. Add near the top:
```ts
import { usePresence } from "@/lib/realtime/usePresence";
```
Inside the component body, after `project` is loaded (add this near the other hooks, but it needs `project?.id` and the current user's id/email — fetch/store the user once on mount, e.g. add `const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);` and set it inside `loadProject()`, right after `const { data: { user } } = await supabase.auth.getUser();` at line 85, add `setCurrentUser({ id: user.id, email: user.email || "" });`).
Then:
```ts
const { users: remoteUsers, broadcastOp, onRemoteOp } = usePresence(
  project?.id || "",
  currentUser?.id || "",
  currentUser?.email?.split("@")[0] || "Someone"
);
```
Step 2. Broadcast local changes. Modify `handleNodesChange` and `handleEdgesChange` (currently lines 124–130):
```ts
function handleNodesChange(changes: NodeChange[]) {
  onUpdateNodes((prev) => applyNodeChanges(changes, prev));
  broadcastOp({ kind: "nodes", changes });
}

function handleEdgesChange(changes: EdgeChange[]) {
  onUpdateEdges((prev) => applyEdgeChanges(changes, prev));
  broadcastOp({ kind: "edges", changes });
}
```
Step 3. Apply remote changes without re-broadcasting (the critical anti-echo-loop guard called out in Phase 4.3). Add one `useEffect` that registers the remote-op handler once:
```ts
useEffect(() => {
  onRemoteOp((op) => {
    if (op.kind === "nodes") {
      onUpdateNodes((prev) => applyNodeChanges(op.changes, prev));
    } else {
      onUpdateEdges((prev) => applyEdgeChanges(op.changes, prev));
    }
  });
}, [onRemoteOp]);
```
This calls `onUpdateNodes`/`onUpdateEdges` directly (the raw state setters), never `handleNodesChange`/`handleEdgesChange` — that's precisely what prevents the echo (if it called `handleNodesChange` instead, it would call `broadcastOp` again, which would bounce back from the other client, forever).
Step 4. Presence avatar strip — add to the toolbar, inside the "Right Actions" div, right before the "Right Divider" (before line 376):
```tsx
{remoteUsers.length > 0 && (
  <div className="flex items-center -space-x-2">
    {remoteUsers.slice(0, 4).map((u) => (
      <div
        key={u.id}
        title={u.name}
        className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white"
        style={{ background: u.color }}
      >
        {u.name.charAt(0).toUpperCase()}
      </div>
    ))}
  </div>
)}
```
Step 5. Live cursors — **new file** `src/components/workspace/LiveCursor.tsx`:
```tsx
"use client";
import React from "react";

export default function LiveCursor({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  return (
    <div className="absolute pointer-events-none z-50 transition-transform duration-75" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill={color}><path d="M0 0 L16 6 L7 8 L5 16 Z" /></svg>
      <div className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm whitespace-nowrap" style={{ background: color }}>
        {name}
      </div>
    </div>
  );
}
```
Step 6. Track and broadcast the local mouse position over the canvas, and render remote cursors. In `project/[id]/page.tsx`, wrap the canvas `<div className="flex-1 relative">` (line 404) to also render cursors:
```tsx
<div
  className="flex-1 relative"
  onMouseMove={(e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    broadcastOp({ kind: "cursor" as any, changes: [{ x: e.clientX - bounds.left, y: e.clientY - bounds.top }] } as any);
  }}
>
  <NodeCanvas ... />
  {remoteUsers.filter((u) => u.cursor).map((u) => (
    <LiveCursor key={u.id} x={u.cursor!.x} y={u.cursor!.y} name={u.name} color={u.color} />
  ))}
</div>
```
Step 7. This requires `usePresence`'s `GraphOp["kind"]` type (Task 2.4) to also accept `"cursor"`, and the hook's presence-sync handler to store the latest cursor position per user rather than only `{id, name, color}`. Go back and widen `usePresence.ts`'s `GraphOp.kind` union to `"nodes" | "edges" | "cursor"`, and in the `channel.on("broadcast", ...)` handler, special-case `kind === "cursor"` to update `users` state's matching entry's `cursor` field (via `setUsers`) instead of calling `opHandlerRef.current`. Throttle the `onMouseMove` broadcast to at most ~20 calls/second (wrap the handler body in a simple `requestAnimationFrame`-gated flag, or a 50ms `setTimeout` debounce) — do not broadcast on every raw `mousemove` event, which fires far more often than needed and will flood the channel.
Step 8. Cursor colors reuse the same `CURSOR_COLORS`/`THEME_COLORS` 6-value array already established in Task 2.4 — do not introduce a third color list.

---

## Phase 4: Final Integration, Routing, & Polish

### Task 4.1 — Route protection additions

**File:** `src/middleware.ts`

Step 1. Current matcher (line 35): `matcher: ["/dashboard/:path*"]`. Change to also cover `/settings`:
```ts
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
```
Step 2. Update the redirect check (currently line 27, `if (!user && request.nextUrl.pathname.startsWith("/dashboard"))`) to also cover settings:
```ts
if (!user && (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/settings"))) {
```
Step 3. Do **not** add `/share` to the matcher — that route must stay public. Confirm this explicitly by visiting `/share/<a-real-token>` in an incognito/logged-out browser session after Task 3.4 is complete; it must render, not redirect to `/login`.
Step 4. The three new API routes (`/api/projects/[id]/share`, `/api/projects/[id]/export`, `/api/account/delete`) do not need middleware entries — they already each check `supabase.auth.getUser()` internally and return `401` (Tasks 2.2/2.3) — this is intentionally defense-in-depth at the route level, not the middleware level, since middleware matchers on dynamic API segments are easy to get wrong with `:path*` globbing and a missed case here would be a security bug, not just a redirect bug.

### Task 4.2 — Final toolbar order confirmation

**File:** `src/app/dashboard/project/[id]/page.tsx`

Step 1. After Tasks 2.1, 3.4, and 3.6 have all landed, the "Right Actions" toolbar div (originally lines 281–386) should read, left to right: Saved Status pill → (conditional) Run-saved-to-history pulse pill (Task 2.1) → Engine Status pill → Run+Speed control → Pause → Stop → Share button (Task 3.4) → Presence avatar strip (Task 3.6) → Right Divider → existing user Avatar dropdown. Do not reorder the pre-existing five items (Saved/Engine/Run/Pause/Stop) — only insert the three new elements at the positions specified in their own tasks. Visually confirm this order in the browser once all three tasks land; if any new element visually collides with the speed dropdown's `absolute` positioning (lines 332–354), nudge only the new element's margin, never the pre-existing dropdown's positioning.

### Task 4.3 — Regression-test canvas persistence + realtime interaction (highest-risk item in this whole plan)

Step 1. With Realtime Collaboration (Task 3.6) live, open the same project in two separate browser sessions (e.g. one normal window, one incognito, two different logged-in users if possible — or the same user in two tabs if multi-session isn't easily testable).
Step 2. In tab A, drag a node. Confirm: (a) it moves in tab A immediately, (b) it moves in tab B within ~1 second via the broadcast, (c) tab A's autosave (`triggerAutoSave`/`autoSave`, lines 132–145) still fires and the "Saved status" pill still flips to "Saving..." → "Saved just now" correctly.
Step 3. In tab B, add a node via the palette (Task 3.2's click-to-add). Confirm it appears in tab A without tab A re-broadcasting it back to tab B (watch the browser network/console — no infinite ping-pong of `graph-op` messages). This is the specific failure mode Task 3.6 Step 3's `onUpdateNodes`-not-`handleNodesChange` guard exists to prevent — if you see repeated oscillating broadcasts, the guard was implemented wrong; fix it by re-checking that the remote-apply path never calls `broadcastOp`.
Step 4. Close tab B, reopen the project fresh in a new tab. Confirm the graph reflects the final merged state from both tabs' edits (last-write-wins on the autosave `graph_json` write is acceptable — do not expect operational-transform-level correctness, per the master prompt's explicit "no CRDTs" instruction).
Step 5. Run a full simulation (Run → let it finish) and confirm: (a) `SimResultsPanel` renders (Task 3.1's domain-aware charts), (b) a `simulation_runs` row now exists for this project (check via Supabase table editor or the "Run saved to history" pulse from Task 2.1), (c) the Share modal's CSV export (Task 3.4) successfully downloads and its rows match what's in the Block Stats table on screen.
Step 6. Only mark Phases 2.4/3.6 "done" after all five checks above pass. If any fails, fix it before moving to Task 4.4 — do not proceed with a known-broken realtime layer, since it's the last thing built and the easiest to leave silently half-working.

### Task 4.4 — Documentation closeout

Step 1. **File:** `Documentation/01-architecture.md` — replace the stale status line (near the bottom, currently "Status: **Module 0 (scaffold) complete.** ...") with an accurate one reflecting that Modules 1–8 are functionally complete and Modules 9–11 were just built in this pass.
Step 2. **File:** `Documentation/14-audit-findings.md` — in the "Correctness gaps" and "Missing functionality" tables, mark these rows as closed with a short note on how/when: G1, G3, G4, G6, G7, G12, G14, G16 (all were already closed before this plan — note "closed prior to this plan, verified during audit"), and G5, G13, G8, G9, G10 (closed by this plan's Phases 1–3). Leave G2, G11, G15, G17 exactly as currently documented (deferred, with reasons already stated) — do not mark them closed, since nothing in this plan touches pause-on-Pyodide, the node-type-count discrepancy note, or the Python engine stub.
Step 3. Add one new row to the gaps table for the palette click-to-add bug found during this audit: `G18 | Block Palette rows were draggable but clicking did nothing (onAddNode prop unused) | closed in Task 3.2`.
Step 4. Create the three previously-only-registered-by-filename doc files: `Documentation/11-module-09-export-share.md`, `12-module-10-profile-settings.md`, `13-module-11-realtime-collaboration.md`, each following the structure already used by the existing module docs (Purpose, Files owned table, Algorithm/logic, Gaps flagged, Connections, DB tables + RLS summary) — populate each from what was actually built in Phases 2–3 above, not from this plan's prose.

### Task 4.5 — Final sweep

Step 1. Run `grep -rn "#[0-9a-fA-F]\{3,6\}" src/components/workspace/ShareExportModal.tsx src/app/settings src/app/share src/components/workspace/LiveCursor.tsx src/lib/realtime` — any hardcoded hex literal found outside of the deliberately-inline `CURSOR_COLORS` array (Task 2.4) or the `--color-accent`-style CSS variable references must be converted to the matching `var(--color-*)` token before this task is considered done.
Step 2. Run `grep -rniE "\"(source|queue|resource|service|decision|sink|container|store|event_trigger|priority_resource|channel|broadcaster|any_of|all_of|interrupter)\"" src/app/settings src/app/share src/components/workspace/ShareExportModal.tsx` — any hit that appears as **visible UI text** (not an internal key/type string) must be replaced with its `NODE_LABELS` glossary term. Internal object keys and type annotations are fine and expected to match.
Step 3. Confirm both new required env vars are documented wherever the project's existing env vars (`GEMINI_API_KEY`, per gap G15) are already documented: `SUPABASE_SERVICE_ROLE_KEY` (Task 2.3) must be listed as required-for-deployment, server-only, never exposed to the client bundle.
Step 4. Confirm every new page (`/settings`, `/share/[token]`) renders correctly at 400px viewport width (phone width) — the existing dashboard/project pages are desktop-oriented multi-panel layouts and may not need this, but `/settings` (a simple stacked-card form) and `/share/[token]` (a public marketing-adjacent page) are exactly the kind of page a first-time visitor might open on mobile from a shared link — verify no horizontal overflow on either.

---

## Execution order summary (unchanged from before, now with full step detail behind each item)
1. Phase 1 (Tasks 1.1–1.4) — types/utilities, no visible UI change, unblocks everything else.
2. Task 2.1 — persist runs, closes G13, no new UI beyond one pulse pill.
3. Tasks 3.1 + 3.2 + 3.3 — KPI fix, palette click-fix, Block Configuration chrome. All inside files already owned, zero new tables/routes, highest polish-per-effort, do these before any new-module work.
4. Tasks 2.2 + 3.4 together — Export & Share, full stack (schema → routes → modal → public share page).
5. Tasks 2.3 + 3.5 together — Profile & Settings, full stack (schema → routes → settings page → navbar wiring).
6. Tasks 2.4 + 3.6 together — Realtime Collaboration, full stack, **last**, then immediately run Task 4.3's five-point regression check before touching anything else.
7. Tasks 4.1, 4.2, 4.4, 4.5 — routing confirmation, toolbar order confirmation, docs closeout, final sweep.
