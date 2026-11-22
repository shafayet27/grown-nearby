import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. This client uses your Supabase secret key and bypasses all security rules.
// Never import it into a component that runs in the browser, and never expose the key.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("The Supabase secret key is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
