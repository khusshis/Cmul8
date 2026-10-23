// SERVER ONLY: the service-role key bypasses RLS. Never import from client code.
// (The `server-only` package is not installed; add `import "server-only"` here if it is.)
import { createClient } from "@supabase/supabase-js";

export const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
