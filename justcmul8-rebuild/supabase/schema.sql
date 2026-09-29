-- JustCmul8 Unified Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sim_type text not null default 'human_queue',
  graph_json jsonb default '{"nodes": [], "edges": []}'::jsonb,
  updated_at timestamptz default now()
);

-- 2. Simulation Runs table (for History)
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ran_at timestamptz default now(),
  duration_seconds integer,
  sim_time_seconds numeric,
  total_arrived integer,
  total_completed integer,
  bottleneck_node text,
  result_json jsonb,
  logs_json jsonb
);

-- 3. Chat History table
CREATE TABLE IF NOT EXISTS public.chat_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Migration helpers for existing databases:
-- ALTER TABLE public.chat_history RENAME COLUMN message TO content;
-- ALTER TABLE public.chat_history DROP CONSTRAINT IF EXISTS chat_history_role_check;
-- ALTER TABLE public.chat_history ADD CONSTRAINT chat_history_role_check CHECK (role IN ('user', 'assistant'));
-- ALTER TABLE public.chat_history ADD COLUMN IF NOT EXISTS metadata jsonb;
-- ALTER TABLE public.chat_history ALTER COLUMN user_id DROP NOT NULL;

-- 4. Enable Row-Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- 5. Create policies
-- NOTE: Both `simulation_runs` and `chat_history` have a direct `user_id` column.
-- Because this direct relationship exists, the RLS policies can safely use the `auth.uid() = user_id`
-- pattern without needing a complex join/subquery on the `projects` table. This is a validated pattern,
-- deliberately chosen to maintain simplicity and performance.

DO $$ 
BEGIN
    -- Projects Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own projects') THEN
        CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own projects') THEN
        CREATE POLICY "Users can insert their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own projects') THEN
        CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own projects') THEN
        CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Simulation Runs Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own runs') THEN
        CREATE POLICY "Users can view their own runs" ON public.simulation_runs FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own runs') THEN
        CREATE POLICY "Users can insert their own runs" ON public.simulation_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own runs') THEN
        CREATE POLICY "Users can delete their own runs" ON public.simulation_runs FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Chat History Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own chat') THEN
        CREATE POLICY "Users can view their own chat" ON public.chat_history FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own chat') THEN
        CREATE POLICY "Users can insert their own chat" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own chat') THEN
        CREATE POLICY "Users can delete their own chat" ON public.chat_history FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Realtime Messages Authorization Policy (Task 5)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'realtime' AND table_name = 'messages') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'project members can access their project realtime channel') THEN
            CREATE POLICY "project members can access their project realtime channel"
            ON realtime.messages
            FOR SELECT
            TO authenticated
            USING (
              realtime.topic() = 'project:' || (
                SELECT p.id::text FROM public.projects p WHERE p.id::text = split_part(realtime.topic(), ':', 2)
                AND (p.user_id = auth.uid())
              )
            );
        END IF;
    END IF;
END $$;

-- 6. Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);

-- 7. Force Supabase to refresh its schema cache so the Next.js API instantly recognizes the columns
NOTIFY pgrst, 'reload schema';

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

-- 9b. Public status check for a share token (so the viewer page can tell an
-- invalid link apart from a valid-but-revoked one, without exposing any
-- project_shares row data beyond that single status word).
CREATE OR REPLACE FUNCTION public.get_share_status(token text)
RETURNS text AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.project_shares WHERE share_token = token) THEN 'invalid'
    WHEN EXISTS (SELECT 1 FROM public.project_shares WHERE share_token = token AND revoked_at IS NOT NULL) THEN 'revoked'
    ELSE 'active'
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_share_status(text) TO anon, authenticated;

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

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. Collaboration: per-email invites, link access, role-aware RLS
-- Run after schema.sql (also appended there). Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- Invited people (by email, so invites work before the person signs up).
-- source = 'link' rows were created by opening an "Anyone with the link" URL and
-- are removed again when the owner restricts or resets the link.
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('viewer', 'editor')),
  source text not null default 'invite' check (source in ('invite', 'link')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (project_id, email)
);
CREATE INDEX IF NOT EXISTS idx_project_members_email ON public.project_members(email);

-- Link settings ("General access"). Existing links were public view-only, so the defaults keep that behaviour.
ALTER TABLE public.project_shares ADD COLUMN IF NOT EXISTS link_access text not null default 'anyone' check (link_access in ('restricted', 'anyone'));
ALTER TABLE public.project_shares ADD COLUMN IF NOT EXISTS link_role text not null default 'viewer' check (link_role in ('viewer', 'editor'));

-- The caller's role on a project: 'owner' | 'editor' | 'viewer' | NULL.
-- Invites match on the caller's *confirmed* email so nobody can claim an invite with an unverified address.
CREATE OR REPLACE FUNCTION public.project_role(pid uuid)
RETURNS text AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects WHERE id = pid AND user_id = auth.uid()) THEN 'owner'
    ELSE (
      SELECT m.role FROM public.project_members m
      JOIN auth.users u ON u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = m.email
      WHERE m.project_id = pid
    )
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.project_role(uuid) TO authenticated;

-- Everyone with access to a project (owner first, then invites; user_id is NULL for people who have not signed up yet).
CREATE OR REPLACE FUNCTION public.project_collaborators(pid uuid)
RETURNS TABLE (user_id uuid, email text, role text, display_name text) AS $$
  SELECT p.user_id, u.email::text, 'owner'::text, pr.display_name
  FROM public.projects p
  JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.id = pid AND public.project_role(pid) IS NOT NULL
  UNION ALL
  SELECT u.id, m.email, m.role, pr.display_name
  FROM public.project_members m
  LEFT JOIN auth.users u ON lower(u.email) = m.email AND u.email_confirmed_at IS NOT NULL
  LEFT JOIN public.profiles pr ON pr.id = u.id
  WHERE m.project_id = pid AND public.project_role(pid) IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.project_collaborators(uuid) TO authenticated;

-- Called when a logged-in user opens /share/<token>. Returns the project id if they
-- have (or, via an "anyone" link, now get) access; NULL otherwise.
CREATE OR REPLACE FUNCTION public.accept_share_link(token text)
RETURNS uuid AS $$
DECLARE
  s public.project_shares;
  em text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.project_shares WHERE share_token = token AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF public.project_role(s.project_id) IS NOT NULL THEN RETURN s.project_id; END IF;
  IF s.link_access <> 'anyone' THEN RETURN NULL; END IF;

  SELECT lower(email) INTO em FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF em IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.project_members (project_id, email, role, source, invited_by)
  VALUES (s.project_id, em, s.link_role, 'link', s.created_by)
  ON CONFLICT (project_id, email) DO NOTHING;
  RETURN s.project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.accept_share_link(text) TO authenticated;

-- Anonymous read-only preview only for "anyone with the link" shares.
CREATE OR REPLACE FUNCTION public.get_shared_project(token text)
RETURNS TABLE (name text, sim_type text, graph_json jsonb) AS $$
  SELECT p.name, p.sim_type, p.graph_json
  FROM public.projects p
  JOIN public.project_shares s ON s.project_id = p.id
  WHERE s.share_token = token AND s.revoked_at IS NULL AND s.link_access = 'anyone'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Editors may change the graph but never take ownership.
CREATE OR REPLACE FUNCTION public.projects_lock_owner()
RETURNS trigger AS $$
BEGIN
  IF new.user_id IS DISTINCT FROM old.user_id THEN
    RAISE EXCEPTION 'Project owner cannot be changed';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_lock_owner ON public.projects;
CREATE TRIGGER projects_lock_owner BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_lock_owner();

-- Role-aware project policies (replace the owner-only SELECT/UPDATE ones).
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Collaborators can view projects" ON public.projects;
DROP POLICY IF EXISTS "Owners and editors can update projects" ON public.projects;
CREATE POLICY "Collaborators can view projects" ON public.projects
  FOR SELECT USING (public.project_role(id) IS NOT NULL);
CREATE POLICY "Owners and editors can update projects" ON public.projects
  FOR UPDATE USING (public.project_role(id) IN ('owner', 'editor'))
  WITH CHECK (public.project_role(id) IN ('owner', 'editor'));

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Collaborators can view members" ON public.project_members;
DROP POLICY IF EXISTS "Owners manage members" ON public.project_members;
CREATE POLICY "Collaborators can view members" ON public.project_members
  FOR SELECT USING (public.project_role(project_id) IS NOT NULL);
CREATE POLICY "Owners manage members" ON public.project_members
  FOR ALL USING (public.project_role(project_id) = 'owner')
  WITH CHECK (public.project_role(project_id) = 'owner');

-- Realtime: every collaborator may receive AND send (presence, cursors, edits) on project:<id>.
-- Clients drop graph edits whose sender is not an owner/editor; the DB UPDATE policy is the hard wall.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'realtime' AND table_name = 'messages') THEN
    DROP POLICY IF EXISTS "project members can access their project realtime channel" ON realtime.messages;
    DROP POLICY IF EXISTS "collaborators read project channel" ON realtime.messages;
    DROP POLICY IF EXISTS "collaborators write project channel" ON realtime.messages;
    CREATE POLICY "collaborators read project channel" ON realtime.messages
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.projects p
        WHERE 'project:' || p.id::text = realtime.topic() AND public.project_role(p.id) IS NOT NULL
      ));
    CREATE POLICY "collaborators write project channel" ON realtime.messages
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.projects p
        WHERE 'project:' || p.id::text = realtime.topic() AND public.project_role(p.id) IS NOT NULL
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
