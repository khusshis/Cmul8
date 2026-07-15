-- 1. Create the projects table if it doesn't completely exist
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  sim_type text not null,
  graph_json jsonb default '{"nodes": [], "edges": []}'::jsonb,
  updated_at timestamptz default now()
);

-- 1b. If the table ALREADY exists, but is missing columns, gracefully add them:
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sim_type text DEFAULT 'human_queue';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS graph_json JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create the simulation_runs table (for History)
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  ran_at timestamptz default now(),
  duration_seconds integer,
  sim_time_seconds numeric,
  total_arrived integer,
  total_completed integer,
  bottleneck_node text,
  result_json jsonb,
  logs_json jsonb
);

-- 3. Enable Row-Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

-- 4. Create policies gracefully using PL/pgSQL to avoid the "already exists" error
DO $$ 
BEGIN
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
END $$;

-- 5. Force Supabase to refresh its schema cache so the Next.js API instantly recognizes the columns
NOTIFY pgrst, 'reload schema';
