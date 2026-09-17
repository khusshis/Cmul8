# Module 10: Profile & Settings

## Purpose
Allows users to manage their account-level preferences, such as their display name, default simulation domain, password, and the ability to permanently delete their account.

## Files Owned
| File | Role |
|---|---|
| `src/app/settings/page.tsx` | The UI for the Settings form, divided into Profile, Preferences, Security, and Danger Zone. |
| `src/app/api/account/delete/route.ts` | The API endpoint responsible for securely deleting a user's account and all associated data. |

## Algorithm / Logic
- **Profile Fetching:** Reads the authenticated user's ID and loads extra metadata from the `profiles` table.
- **Security Updates:** Interacts directly with the Supabase Auth API (`updateUser`) to change the password securely.
- **Account Deletion:** Since standard Supabase client APIs cannot self-delete, the API route uses `SUPABASE_SERVICE_ROLE_KEY` via `@supabase/supabase-js`'s Admin API to permanently purge the user from auth and cascade delete their data.

## Gaps Flagged & Addressed
- **Gap 9:** No User Profile & Settings page existed in the original codebase. Implemented fully in Phase 3.

## Connections
- **Module 1 (Authentication):** Deletion requires admin-level access. Profile loading depends on an active session.
- **Module 2 (Project Management):** When a user is deleted, all their projects are automatically removed via database foreign key cascading.

## DB Tables & RLS
- **`profiles` table:** Contains `id` (references `auth.users`), `display_name`, and `default_sim_type`.
- **RLS:** Users can `SELECT`, `INSERT`, and `UPDATE` only their own row based on `auth.uid() = id`.
- **Cascading:** Configured to `ON DELETE CASCADE` so deleting the auth user removes the profile.
