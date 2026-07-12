# Module 1 — User Authentication

## 1. Purpose
Lets a user create an account, log in, and keeps every other module's data scoped
to "the current user only." Nothing else in the app works without this module,
since Project Management, the Workspace, and (once built) Profile/Settings all
require a known `user_id`.

## 2. Files owned by this module
| File | Role |
|---|---|
| `src/lib/supabase/client.ts` | Creates a **browser-side** Supabase client (`createBrowserClient`), used in any `"use client"` component (login/signup forms, dashboard, workspace) |
| `src/lib/supabase/server.ts` | Creates a **server-side** Supabase client (`createServerClient`) that reads/writes auth cookies via Next.js's `cookies()` API — used in Server Components and Route Handlers |
| `src/middleware.ts` | Runs on every request matching `/dashboard/:path*` (see `config.matcher`); refreshes the Supabase session cookie and **redirects unauthenticated users to `/login`**, preserving the originally-requested path in a `?redirect=` query param |
| `src/app/login/page.tsx` | Email/password login form + Google/GitHub OAuth buttons |
| `src/app/signup/page.tsx` | Email/password signup form + OAuth buttons; shows a "check your email" confirmation state |
| `src/app/auth/callback/route.ts` | OAuth/email-confirmation callback route — exchanges the `code` query param for a real session via `supabase.auth.exchangeCodeForSession(code)`, then redirects to `?redirect=` (defaulting to `/dashboard`) |

## 3. Algorithm / logic
1. **Email/password login** (`login/page.tsx`): calls
   `supabase.auth.signInWithPassword({ email, password })` directly from the
   browser client. On success, `router.push(redirect)` sends the user to wherever
   middleware originally redirected them from (or `/dashboard` by default).
2. **Email/password signup** (`signup/page.tsx`): calls `supabase.auth.signUp(...)`
   with `emailRedirectTo` pointing at `/auth/callback`. Supabase sends a
   confirmation email; the UI shows a static success state rather than
   auto-logging the user in (since the account isn't confirmed yet).
3. **OAuth (Google/GitHub)**: `supabase.auth.signInWithOAuth({ provider, options:
   { redirectTo } })` — this redirects the whole browser tab to the provider's
   consent screen, then back to `/auth/callback?code=...`.
4. **The callback route** (`auth/callback/route.ts`) is a plain Next.js Route
   Handler (not a page) — it runs server-side, exchanges the one-time `code` for a
   session (setting the Supabase auth cookies via the server client), and issues an
   HTTP redirect. If the exchange fails, it redirects to `/login?error=auth_failed`.
5. **Middleware route protection**: `src/middleware.ts` runs before any matched
   request reaches a page. It builds a server Supabase client bound to the
   *request's* cookies (not `next/headers`, since middleware runs in the Edge
   runtime), calls `supabase.auth.getUser()`, and if there's no user AND the path
   starts with `/dashboard`, redirects to `/login`. Critically, **only
   `/dashboard/:path*` is protected** (see `config.matcher` — a single-entry
   array). The workspace routes live under `/dashboard/project/[id]`, so they
   inherit this protection automatically.

## 4. Design notes for the rebuild
- Keep the exact same Supabase Auth flows (password + Google + GitHub OAuth) — no
  logic changes.
- Restyle only: replace the "SYSTEM LOGIN" / "AUTHENTICATE TO ACCESS YOUR
  SIMULATION WORKSPACE" cyberpunk copy with plain, friendly copy ("Log in" /
  "Welcome back — sign in to continue"), replace the neon input/button classes
  (`input-cyber`, `btn-cyber-primary`, `btn-cyber-ghost`) with the new design-token
  based components, and drop the scanline/cyber-grid decorative overlays.
- The password field enforces `minLength={8}` on signup only (not on login) —
  preserve this exactly, it's a real validation rule, not styling.

## 5. Connections to other modules
- **Project Management (Module 2)**: the dashboard's very first action on mount is
  `supabase.auth.getUser()` — if there's no user, it redirects to `/login` as a
  second layer of protection beyond middleware.
- **Row-Level Security everywhere**: every Supabase query for `projects` (and,
  once built, `project_shares`/`profiles`) is filtered server-side by
  `auth.uid() = user_id` — Authentication is what makes `auth.uid()` non-null.
- **Profile & Settings (Module 10, new)**: will read/update the same
  `supabase.auth` user object this module creates (email, password change) — see
  that module's doc once built.

## 6. Database tables touched
- `auth.users` (Supabase-managed, not defined in the app's own schema file) — read
  via `supabase.auth.getUser()`, written via `signUp`/OAuth flows.
- No RLS policy needed here specifically — `auth.users` is Supabase's own protected
  schema, not queried directly by app code beyond the `.auth.*` helper methods.
