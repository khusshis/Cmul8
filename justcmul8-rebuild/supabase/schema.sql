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
