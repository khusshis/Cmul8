# Module 1: Authentication

This module handles user identity and session management, providing the foundation for user accounts. It provides the plumbing to authenticate users so they can access their private simulation workspaces.

## Purpose
The authentication system secures access to the application, ensuring that only authenticated operators can access the simulation workspace (dashboard and projects). It supports traditional email/password login and OAuth providers (Google and GitHub).

## Component Walkthrough

### `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts`
These files provide the standard Supabase SSR (Server-Side Rendering) clients. 
- `client.ts` is used by client components (`"use client"`) to interact with Supabase.
- `server.ts` is used by server components, route handlers, and middleware. It manages the cookie-based session storage required by Next.js App Router.

### `src/middleware.ts`
The application traffic cop. It runs on every request to refresh the Supabase auth session. It actively protects the `/dashboard` route (and all its sub-routes) by checking for a valid `user` object. If an unauthenticated user attempts to access a protected route, it redirects them to `/login` and appends a `redirect` query parameter to return them to their original destination after successfully authenticating.

### `src/app/auth/callback/route.ts`
The OAuth callback handler. When a user authenticates via Google or GitHub, the provider redirects them back to this API route with an exchange code. The route takes that code, calls `exchangeCodeForSession` to establish the cookie session, and then redirects the user to the dashboard (or their intended destination).

### `src/app/login/page.tsx`
The login interface. It handles existing user sign-ins using `signInWithPassword` for email/password and `signInWithOAuth` for Google/GitHub. It reads the `redirect` query parameter from the URL (set by the middleware) to route users back to where they were trying to go.
*Porting note: Logic is identical to the original implementation. Styling was heavily refactored to replace the legacy cyberpunk aesthetic with the new clean design system tokens (`var(--color-bg)`, `card-surface`, etc.).*

### `src/app/signup/page.tsx`
The account creation interface. It uses `signUp` for new email/password registrations and `signInWithOAuth` for Google/GitHub. On successful email registration, it displays a success state asking the user to confirm their email address before logging in.
*Porting note: Logic is identical to the original implementation. Styling was updated to the new design system, matching the login page.*

## External Connections
- Relies heavily on the **Supabase Auth API** for identity management.
- Sets and reads cookies to maintain sessions across the Next.js App Router boundary.
- Will connect directly to Module 2 (Project Management) by guarding the `/dashboard` route.
