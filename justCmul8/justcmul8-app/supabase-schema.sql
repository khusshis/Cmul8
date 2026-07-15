-- JustCmul8 Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sim_type    text not null default 'human_queue',
  graph_json  text default '{"nodes":[],"edges":[]}',
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

-- RLS: users can only see their own projects
alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Chat history table
create table if not exists public.chat_history (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'ai')),
  message     text not null,
  created_at  timestamptz default now()
);

-- RLS for chat_history
alter table public.chat_history enable row level security;

create policy "Users can view own chat"
  on public.chat_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own chat"
  on public.chat_history for insert
  with check (auth.uid() = user_id);

-- Indexes for faster queries
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_updated_at on public.projects(updated_at desc);
create index if not exists idx_chat_history_project_id on public.chat_history(project_id);
