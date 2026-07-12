# JustCmul8 — System Architecture

## 1. What this document is
A map of all 11 modules from the project synopsis, what each one owns, and how they
talk to each other. Read this first before opening any module's individual doc file
in this `docs/` folder.

## 2. Tech stack (unchanged from synopsis Section 6)

| Layer | Technology | Role |
|---|---|---|
| Frontend framework | Next.js 16 (App Router) + React 19 | Pages, routing, server + client components |
| Language | TypeScript (strict mode) | Type safety across frontend and API routes |
| Simulation engine | Python SimPy, run via Pyodide (WebAssembly) | Real discrete-event simulation, in-browser |
| Graph editor | React Flow (`@xyflow/react`) | Drag-and-drop node canvas |
| AI | Google Gemini 2.0 Flash | Natural language → simulation graph |
| Database & Auth | Supabase (Postgres + Row-Level Security + Realtime) | Users, projects, live collaboration channel |
| Charts | Recharts | KPI dashboards |
| 2D animation | Pixi.js | Animated playback viewport |
| Styling | Tailwind CSS v4 | Utility-first styling, professional theme (see `docs/02-design-system.md`) |
| State | Zustand | Client-side simulation/canvas state |

## 3. The 11 modules and what each one owns

```
                          ┌─────────────────────────┐
                          │   1. Authentication      │  Supabase Auth, middleware.ts,
                          │      (login/signup)      │  route protection
                          └────────────┬─────────────┘
                                       │ logged-in user
                                       ▼
                          ┌─────────────────────────┐
                          │  2. Project Management    │  Dashboard: list/create/rename/
                          │      (dashboard)          │  delete projects → `projects` table
                          └────────────┬─────────────┘
                                       │ open a project
                                       ▼
        ┌──────────────────────────────────────────────────────────┐
        │                     WORKSPACE  (one project)               │
        │                                                            │
        │  ┌───────────────┐   ┌────────────────┐   ┌─────────────┐ │
        │  │ 8. Template    │──▶│ 3. Visual Graph │◀─▶│ 4. Node     │ │
        │  │    Gallery     │   │    Editor       │   │  Config     │ │
        │  │ (starter graph)│   │  (canvas/edges) │   │   Panel     │ │
        │  └───────────────┘   └────────┬────────┘   └─────────────┘ │
        │                               │  ▲                          │
        │                               │  │ generates/edits graph    │
        │                               │  │                          │
        │                     ┌─────────▼──┴────────┐                │
        │                     │  6. AI Assistant      │                │
        │                     │  (Gemini → graph JSON)│                │
        │                     └───────────────────────┘                │
        │                               │                              │
        │                               │ Run                          │
        │                               ▼                              │
        │                     ┌───────────────────────┐                │
        │                     │  5. Simulation Engine   │               │
        │                     │  (codeGenerator →       │               │
        │                     │   Pyodide/SimPy, or     │               │
        │                     │   legacyWorker fallback)│               │
        │                     └───────────┬─────────────┘               │
        │                                 │ results                     │
        │                                 ▼                             │
        │                     ┌───────────────────────┐                │
        │                     │  7. KPI Dashboard &     │               │
        │                     │     Results             │               │
        │                     └───────────┬─────────────┘               │
        │                                 │                              │
        │                     ┌───────────┴─────────────┐                │
        │                     ▼                          ▼                │
        │           ┌─────────────────┐        ┌───────────────────┐    │
        │           │ 9. Export &      │        │ 11. Real-Time      │   │
        │           │    Share         │        │     Collaboration  │   │
        │           │ (CSV/JSON, link) │        │ (Supabase Realtime)│   │
        │           └─────────────────┘        └───────────────────┘    │
        └──────────────────────────────────────────────────────────────┘
                                       ▲
                                       │
                          ┌────────────┴─────────────┐
                          │ 10. User Profile &         │
                          │     Settings               │
                          └───────────────────────────┘
```

## 4. Data flow summary
1. A user signs in (**Module 1**) → lands on the **Dashboard** (**Module 2**), which
   lists their projects from the `projects` table (filtered by Supabase Row-Level
   Security, so users only ever see their own data).
2. Opening/creating a project loads the **Workspace**, seeded either from a
   **Template Gallery** starter graph (**Module 8**) or from scratch.
3. Inside the Workspace, the user builds a model on the **Visual Graph Editor**
   (**Module 3**) using nodes configured via the **Node Config Panel** (**Module 4**),
   or describes it in English to the **AI Assistant** (**Module 6**), which returns
   graph JSON that gets loaded onto the same canvas.
4. Pressing "Run" hands the graph to the **Simulation Engine** (**Module 5**), which
   compiles it into Python (SimPy) code and executes it via Pyodide in the browser
   (falling back to a pure-JS engine if Pyodide fails to load).
5. Results stream into the **KPI Dashboard** (**Module 7**).
6. From the dashboard, results/graphs can be pushed through **Export & Share**
   (**Module 9**) as CSV/JSON downloads or a read-only public link.
7. Account-level actions (name, password, default simulation type) live in
   **Profile & Settings** (**Module 10**), independent of any one project.
8. While a project is open, **Real-Time Collaboration** (**Module 11**) keeps every
   connected teammate's canvas in sync via a Supabase Realtime channel scoped to
   that project's ID, and shows live cursors/presence.

## 5. Module documentation index
Each module has its own file in this folder, written as we build it:

- `03-module-01-authentication.md`
- `04-module-02-project-management.md`
- `05-module-03-visual-graph-editor.md`
- `06-module-04-node-config-panel.md`
- `07-module-05-simulation-engine.md`
- `08-module-06-ai-assistant.md`
- `09-module-07-kpi-dashboard.md`
- `10-module-08-template-gallery.md`
- `11-module-09-export-share.md`
- `12-module-10-profile-settings.md`
- `13-module-11-realtime-collaboration.md`

*(Filenames are pre-registered here even before each file exists, so the numbering
stays stable as we build. This file itself will be updated if the build order changes.)*

---
Status: **Module 0 (scaffold) complete.** Next: Module 5 first in the *build sequence*
(Simulation Engine is built before Auth/Dashboard because the Workspace depends on it —
see roadmap message in chat), though it's numbered "05" here to match the synopsis's
own module numbering, not the build order.
