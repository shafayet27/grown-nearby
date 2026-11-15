import { createBrowserClient } from "@supabase/ssr";

// For code that runs in the browser (photo uploads). It uses the signed-in
// seller's own login, so the storage rules decide what they may do.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
