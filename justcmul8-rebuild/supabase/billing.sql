-- ═══════════════════════════════════════════════════════════════════════════
-- 13. Onboarding, plans and credits (Razorpay)
-- Run once in the Supabase SQL editor. Everything above the backfill is safe to
-- re-run; the backfill marks every not-yet-onboarded user as onboarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- Onboarding answers. Users may edit these themselves (existing profile policies).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_size text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_cases text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Plan + credit balance. Users can READ their row; only SECURITY DEFINER functions
-- below and the server (service role, after verifying Razorpay) can change it.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  billing_interval text check (billing_interval in ('monthly', 'yearly')),
  trial_ends_at timestamptz,
  trial_used boolean not null default false,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  razorpay_subscription_id text unique,
  credits int not null default 100 check (credits >= 0),
  credits_reset_at timestamptz not null default now() + interval '1 month',
  updated_at timestamptz default now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON public.credit_ledger (user_id, created_at desc);
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can view own credit ledger" ON public.credit_ledger FOR SELECT USING (auth.uid() = user_id);

-- Monthly allowance per plan. Keep in sync with src/lib/billing/plans.ts.
CREATE OR REPLACE FUNCTION public.plan_credits(p text) RETURNS int AS $$
  SELECT CASE p WHEN 'pro' THEN 500 WHEN 'enterprise' THEN 2000 ELSE 100 END;
$$ LANGUAGE sql IMMUTABLE;

-- Creates the row if missing, applies a lapsed cancellation, and refills the
-- balance to the plan allowance once a month (refill, not accumulate).
CREATE OR REPLACE FUNCTION public._billing_refresh(uid uuid) RETURNS void AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.subscriptions
     SET plan = 'free', status = 'cancelled', cancel_at_period_end = false,
         credits = least(credits, public.plan_credits('free')), updated_at = now()
   WHERE user_id = uid AND plan <> 'free' AND cancel_at_period_end
     AND current_period_end IS NOT NULL AND current_period_end < now();

  UPDATE public.subscriptions
     SET credits = public.plan_credits(plan), credits_reset_at = now() + interval '1 month', updated_at = now()
   WHERE user_id = uid AND credits_reset_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atomic spend: fails with INSUFFICIENT_CREDITS instead of going negative.
CREATE OR REPLACE FUNCTION public._spend_credits(uid uuid, amount int, reason text) RETURNS int AS $$
DECLARE remaining int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF amount IS NULL OR amount <= 0 OR amount > 1000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  PERFORM public._billing_refresh(uid);
  UPDATE public.subscriptions SET credits = credits - amount, updated_at = now()
   WHERE user_id = uid AND credits >= amount
   RETURNING credits INTO remaining;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: % credits needed', amount USING ERRCODE = 'P0402';
  END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason) VALUES (uid, -amount, left(reason, 60));
  RETURN remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Callable by signed-in users: spends from their own balance only.
CREATE OR REPLACE FUNCTION public.spend_credits(amount int, reason text) RETURNS int AS $$
  SELECT public._spend_credits(auth.uid(), amount, reason);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Refresh and return the caller's billing row.
CREATE OR REPLACE FUNCTION public.my_billing() RETURNS SETOF public.subscriptions AS $$
BEGIN
  PERFORM public._billing_refresh(auth.uid());
  RETURN QUERY SELECT * FROM public.subscriptions WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Server-only: give back credits when an AI call failed after charging.
CREATE OR REPLACE FUNCTION public.refund_credits(uid uuid, amount int, reason text) RETURNS void AS $$
BEGIN
  IF amount <= 0 OR amount > 1000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  UPDATE public.subscriptions SET credits = credits + amount, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.credit_ledger (user_id, delta, reason) VALUES (uid, amount, left(reason, 60));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Supabase grants EXECUTE on new functions to anon/authenticated by default; lock the internals.
REVOKE EXECUTE ON FUNCTION public._billing_refresh(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._spend_credits(uuid, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_credits(int, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits(int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_billing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, int, text) TO service_role;

-- Projects are inserted straight from the browser, so the charge lives in the DB.
CREATE OR REPLACE FUNCTION public.charge_project_create() RETURNS trigger AS $$
BEGIN
  PERFORM public._spend_credits(NEW.user_id, 40, 'create_simulation');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS charge_project_create ON public.projects;
CREATE TRIGGER charge_project_create
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.charge_project_create();

-- New users: profile + free plan row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.subscriptions (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill: existing users get a free row and skip onboarding.
INSERT INTO public.subscriptions (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;
UPDATE public.profiles SET onboarded_at = now() WHERE onboarded_at IS NULL;
UPDATE auth.users
   SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"onboarded": true}'::jsonb
 WHERE NOT coalesce((raw_user_meta_data->>'onboarded')::boolean, false);

NOTIFY pgrst, 'reload schema';
