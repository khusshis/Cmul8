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
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  message text not null,
  created_at timestamptz default now()
);

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
END $$;

-- 6. Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);

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
