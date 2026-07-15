# Module 2: Project Management

This module serves as the primary operator console (dashboard), enabling authenticated users to view, create, rename, and delete simulation projects. It establishes the global navigation structure and unifies the underlying database schema.

## Purpose
The Project Management module bridges authentication (Module 1) and the core workspace. It provides the UI for listing projects retrieved from Supabase and orchestrates the creation of new workspaces by persisting initial metadata and graph JSON.

## Component Walkthrough

### `supabase/schema.sql`
The unified database schema, consolidating previous fragmented schema files.
- **Tables**: Defines `projects`, `simulation_runs`, and `chat_history`.
- **Primary Keys**: Employs `gen_random_uuid()` rather than requiring external UUID extensions.
- **Data Types**: Enforces `jsonb` instead of raw `text` for `graph_json` payloads, optimizing storage and query capabilities.
- **Row-Level Security (RLS)**: 
  - All three tables explicitly possess a `user_id` column linked directly to `auth.users(id)`.
  - Because this direct relation exists universally, the RLS policies successfully use the `auth.uid() = user_id` pattern for `projects`, `simulation_runs`, and `chat_history`. This is a deliberate design choice bypassing the need for a complex join or subquery on the `projects` table for ownership validation, maintaining simplicity and query performance.

### `src/components/layout/Navbar.tsx`
The global navigation bar used across the landing page and the dashboard. 
- Restyled to utilize the modern design system (`var(--color-bg)`, `var(--color-border)`), removing the hardcoded cyberpunk glow effects and framer-motion heavy aesthetic.
- Displays context-aware CTAs ("Login" / "Get Started" vs "Dashboard" / "Logout") based on the current Supabase session.

### `src/app/dashboard/page.tsx`
The primary dashboard UI.
- **Project Listing**: Fetches the user's projects dynamically and displays them in a grid of cards mapped to their simulation domain styles.
- **Creation Flow**: Implements a modal that prompts for project name and simulation domain, dispatching an `insert` query and redirecting to the workspace on success.
- **Delete Flow**: Allows deletion of projects directly from the dashboard using an inline `.delete().eq('id', id)` Supabase call.
- **Styling**: Remapped from the legacy `cyber-grid` aesthetic to the clean UI system, implementing `card-surface` and modern modal overlay tokens.

## Resolved Gaps

- **[G7] Project Rename**: Integrated an inline "Rename" flow on the project cards. It validates the new name against empty strings and executes an `.update()` scoped safely to `.eq("id", id)`.
- **[G14] Conflicting Schema Files**: Merged `supabase_schema.sql` and `supabase-schema.sql` into a single canonical source of truth at `supabase/schema.sql`.
- **[G16] Dashboard Domain List Hardcoded**: Stripped out the locally hardcoded `SIM_TYPES` array in the dashboard and successfully imported `SIMULATION_DOMAINS` (`getAllSimTypes()`) directly from the simulation engine's registry (`simTypeRegistry.ts`), resolving the duplicate source of truth bug.
