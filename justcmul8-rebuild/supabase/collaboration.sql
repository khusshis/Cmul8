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
