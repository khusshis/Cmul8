# Module 2 — Project Management

## 1. Purpose
The "home base" for a logged-in user: list their saved simulation projects, create
new ones (choosing a name + one of 6 simulation domains), open a project into the
Workspace, and delete projects they no longer need.

## 2. Files owned by this module
| File | Role |
|---|---|
| `src/app/dashboard/page.tsx` (215 lines) | The dashboard: project grid, create-project modal, delete-confirmation modal, logout |
| `src/components/layout/Navbar.tsx` | Shared top navigation bar rendered on the dashboard (and landing page) |
| `supabase-schema.sql` / `supabase_schema.sql` | Two **different** SQL schema files defining the `projects` table (see Section 5 — this is a flagged inconsistency, not a design choice) |

## 3. Algorithm / logic
1. **Load** (`loadData()`): confirms a user session exists (redirects to `/login`
   if not — belt-and-suspenders alongside the middleware), then
   `supabase.from("projects").select("*").order("updated_at", {ascending:false})`.
   Row-Level Security means this query only ever returns the current user's rows
   even though there's no explicit `.eq("user_id", ...)` filter in the client code
   — the database enforces it.
2. **Create** (`createProject()`): inserts a new row with `name`, `sim_type`, an
   **empty graph** (`{"nodes":[],"edges":[]}` stringified), and `user_id` from the
   current session. On success, immediately routes to
   `/dashboard/project/{new_id}` — a new project is created and opened in one step,
   there's no separate "draft" state.
3. **Delete** (`deleteProject(id)`): `supabase.from("projects").delete().eq("id",
   id)`, then removes it from local React state. Confirmed via a modal
   ("This action cannot be undone") before the delete call fires.
4. **Logout**: `supabase.auth.signOut()` then redirect to `/`.
5. The 6 simulation domains shown in the "create project" modal
   (`SIM_TYPES` constant, hardcoded in this file) are: Human Queue, Vehicle,
   Liquid/Material, Manufacturing, Logistics, Network/Signal — matching synopsis
   Section 5. **Note:** these are duplicated inline here rather than imported from
   `simTypeRegistry.ts` (the module described as "single source of truth" in its
   own doc comment) — the dashboard's list must be kept in sync by hand if the
   registry ever changes. Worth consolidating during the rebuild (a genuine
   improvement opportunity, since it doesn't change behavior — it removes a
   duplicate source of truth).

## 4. ⚠️ Gap flagged: rename is promised but not implemented
The synopsis (Section 5, Module 2) explicitly states: *"Create, save, rename,
delete simulation projects."* Auditing the actual code (`dashboard/page.tsx` and
a full-repo search for "rename") turns up **no rename functionality anywhere** —
only Create, auto-Save (inside the Workspace, not here), and Delete exist. A
project's name is set once at creation time and can never be changed afterward in
the original app.

This gap sits at the boundary between "rebuild what exists" and "Module 10:
Profile & Settings," which we've already agreed to build for real. Recommendation:
add project rename as part of the Project Management rebuild (it's explicitly
promised by Module 2's own synopsis line, not just implied), most naturally as an
inline-editable title in the dashboard card or the Workspace toolbar. Flagging
here rather than silently adding it, per project rules — confirm with your
supervisor whether this counts as "fixing a documented gap" (in scope) versus "new
feature" (needs sign-off) before implementing.

## 5. ⚠️ Gap flagged: two conflicting database schema files
The repository contains two different SQL files that both claim to define the
`projects` table, with real structural differences:

| | `justcmul8-app/supabase-schema.sql` | `supabase_schema.sql` (project root) |
|---|---|---|
| ID default | `uuid_generate_v4()` (needs `uuid-ossp` extension) | `gen_random_uuid()` (built into modern Postgres, no extension needed) |
| `graph_json` column type | `text` | `jsonb` |
| Extra table | `chat_history` (project_id, role, message) | `simulation_runs` (project_id, ran_at, result_json, logs_json — a run-history log) |

**Neither `chat_history` nor `simulation_runs` is ever read or written anywhere in
the actual application code** (confirmed via full-repo search) — the AI Assistant's
chat messages live only in React state (lost on page refresh, see Module 6 doc),
and there is no simulation run history feature in the UI at all. Both extra tables
appear to be leftover/planned-but-unbuilt schema. During the rebuild, pick **one**
canonical schema file (recommend the root `supabase_schema.sql`'s approach —
`gen_random_uuid()` and `jsonb` are both better practice than the alternative) and
delete the other to avoid confusion about which one is "real."

## 6. Design notes for the rebuild
- Keep Create/Open/Delete logic and the Supabase queries identical.
- Restyle: replace the neon `glass-panel`/`glass-panel-heavy` cards with
  `.card-surface` (design tokens), replace the emoji-based sim-type icons'
  neon-glow treatment with the flat `--color-node-*` accents, and rename
  "OPERATOR CONSOLE" / "MY SIMULATIONS" copy to something like "Dashboard" /
  "Your Simulations."
- Empty state ("NO SIMULATIONS YET") and loading state should keep their exact
  conditions, just restyled.

## 7. Connections to other modules
- **Authentication (Module 1)**: gates access to this whole page.
- **Template Gallery (Module 8)**: the domain picked at creation time here
  determines which starter-graph scenarios and node palette the Workspace shows.
- **Visual Graph Editor / Workspace**: "Open" navigates to
  `/dashboard/project/[id]`, which loads this same `projects` row's `graph_json`.
- **Export & Share (Module 9, new)** and **Profile & Settings (Module 10, new)**
  will both need UI entry points added to this dashboard (e.g. a "Share" and
  "Settings" action per project/account) — none exist today.

## 8. Database tables touched
- `projects` — full CRUD from this module (`select`, `insert`, `update` via
  auto-save happens in Workspace not here, `delete`). RLS policies (from either
  schema file) restrict every operation to rows where `auth.uid() = user_id`.
