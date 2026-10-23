-- ═══════════════════════════════════════════════════════════════════════════
-- JustCmul8 security hardening. Run AFTER schema.sql (collaboration + billing
-- included) in the Supabase SQL editor. Safe to re-run. The app works before
-- this is run (rate limits fall back to per-instance memory, webhook dedupe is
-- skipped), but the share-link fix in section 1 closes a live hole: run it now.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. project_shares: only the project OWNER may create or change links ────
-- The old policy only checked created_by = auth.uid(), so any signed-in user who
-- knew a project id (it is in every /dashboard/project/<id> URL) could insert an
-- "anyone / editor" link for someone else's project, open it, and become editor.

-- Clean up anything created through that hole: link-joined members whose link
-- was not made by the owner (accept_share_link sets invited_by = link creator),
-- then the links themselves.
DELETE FROM public.project_members m
 USING public.projects p
 WHERE p.id = m.project_id AND m.source = 'link' AND m.invited_by IS DISTINCT FROM p.user_id;
DELETE FROM public.project_shares s
 USING public.projects p
 WHERE p.id = s.project_id AND s.created_by <> p.user_id;

DROP POLICY IF EXISTS "Users can manage their own shares" ON public.project_shares;
DROP POLICY IF EXISTS "Owners manage project shares" ON public.project_shares;
CREATE POLICY "Owners manage project shares" ON public.project_shares
  FOR ALL USING (public.project_role(project_id) = 'owner')
  WITH CHECK (public.project_role(project_id) = 'owner' AND created_by = auth.uid());

-- ─── 2. Share link expiry + search_path on the public share functions ────────
-- NULL = never expires (current behaviour). Set a value per link to expire it.
ALTER TABLE public.project_shares ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- These two were SECURITY DEFINER without a pinned search_path.
CREATE OR REPLACE FUNCTION public.get_shared_project(token text)
RETURNS TABLE (name text, sim_type text, graph_json jsonb)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT p.name, p.sim_type, p.graph_json
  FROM public.projects p
  JOIN public.project_shares s ON s.project_id = p.id
  WHERE s.share_token = token AND s.revoked_at IS NULL AND s.link_access = 'anyone'
    AND (s.expires_at IS NULL OR s.expires_at > now())
  LIMIT 1;
$$;

-- An expired link reports 'revoked', which the share page already handles.
CREATE OR REPLACE FUNCTION public.get_share_status(token text)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.project_shares WHERE share_token = token) THEN 'invalid'
    WHEN EXISTS (
      SELECT 1 FROM public.project_shares
      WHERE share_token = token AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'active'
    ELSE 'revoked'
  END;
$$;

CREATE OR REPLACE FUNCTION public.accept_share_link(token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.project_shares;
  em text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.project_shares
   WHERE share_token = token AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF public.project_role(s.project_id) IS NOT NULL THEN RETURN s.project_id; END IF;
  IF s.link_access <> 'anyone' THEN RETURN NULL; END IF;

  SELECT lower(u.email) INTO em FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF em IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.project_members (project_id, email, role, source, invited_by)
  VALUES (s.project_id, em, s.link_role, 'link', s.created_by)
  ON CONFLICT (project_id, email) DO NOTHING;
  RETURN s.project_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_project(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_share_status(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_share_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_project(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_share_link(text) TO authenticated;

-- ─── 3. Rate limiting shared across serverless instances ─────────────────────
-- Fixed window per key. Called only by the server with the service role
-- (src/lib/supabase/rateLimit.ts): if users could call it they could reset their
-- own counters by passing a 1-second window.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY; -- no policies: no direct access
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(key text, window_seconds int, max_hits int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  n int;
BEGIN
  IF rate_limit_hit.key IS NULL OR length(rate_limit_hit.key) > 200
     OR window_seconds IS NULL OR window_seconds < 1 OR max_hits IS NULL OR max_hits < 1 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT';
  END IF;
  INSERT INTO public.rate_limits AS r (key, window_start, hits)
  VALUES (rate_limit_hit.key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN r.window_start <= now() - make_interval(secs => window_seconds) THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start <= now() - make_interval(secs => window_seconds) THEN now() ELSE r.window_start END
  RETURNING r.hits INTO n;
  IF random() < 0.01 THEN -- ~1 call in 100 sweeps counters idle for a day
    DELETE FROM public.rate_limits r WHERE r.window_start < now() - interval '1 day';
  END IF;
  RETURN n <= max_hits;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, int, int) TO service_role;

-- ─── 4. Razorpay webhook replay protection ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id text PRIMARY KEY,               -- x-razorpay-event-id
  source text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY; -- service role only
REVOKE ALL ON public.webhook_events FROM anon, authenticated;

-- ─── 5. Size caps on collaborator-writable project data ──────────────────────
-- Editors write graph_json straight from the browser. NOT VALID: existing rows are
-- not checked, new writes are.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_graph_json_size') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_graph_json_size
      CHECK (pg_column_size(graph_json) <= 5 * 1024 * 1024) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_name_length') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_name_length
      CHECK (char_length(name) <= 200) NOT VALID;
  END IF;
END $$;

-- ─── 6. Realtime: only editors may broadcast graph edits ─────────────────────
-- The old write policy let every collaborator send on project:<id>, and the app
-- trusted the sender id inside the payload, which the sender writes itself. A
-- viewer could forge an owner's id and push a graph that editors then saved.
-- Now: project:<id> (graph edits) is writable by owners/editors only;
-- project-presence:<id> (presence, cursors, sync requests) by every member.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'realtime' AND table_name = 'messages') THEN
    DROP POLICY IF EXISTS "collaborators read project channel" ON realtime.messages;
    DROP POLICY IF EXISTS "collaborators write project channel" ON realtime.messages;
    DROP POLICY IF EXISTS "members read project channels" ON realtime.messages;
    DROP POLICY IF EXISTS "members write project channels" ON realtime.messages;
    CREATE POLICY "members read project channels" ON realtime.messages
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(realtime.topic(), ':', 2)
          AND split_part(realtime.topic(), ':', 1) IN ('project', 'project-presence')
          AND public.project_role(p.id) IS NOT NULL
      ));
    CREATE POLICY "members write project channels" ON realtime.messages
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(realtime.topic(), ':', 2)
          AND CASE split_part(realtime.topic(), ':', 1)
                WHEN 'project' THEN public.project_role(p.id) IN ('owner', 'editor')
                WHEN 'project-presence' THEN public.project_role(p.id) IS NOT NULL
                ELSE false
              END
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─── Audit notes (no change needed) ──────────────────────────────────────────
-- SECURITY DEFINER functions with search_path = public and auth checks:
--   project_role, project_collaborators (only for callers with a role),
--   _billing_refresh / _spend_credits / refund_credits (EXECUTE revoked from
--   users; refund is service_role only), spend_credits / my_billing (auth.uid()),
--   charge_project_create, handle_new_user (triggers).
-- RLS is enabled on every public table: projects, simulation_runs, chat_history,
--   project_shares, profiles, project_members, subscriptions, credit_ledger,
--   rate_limits, webhook_events. No storage buckets are used.
-- Share tokens: encode(gen_random_bytes(16), 'hex') = 128 bits.
