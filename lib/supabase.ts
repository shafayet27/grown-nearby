import { createClient } from "@supabase/supabase-js";

// Uses the publishable key only. Never put the secret key in this file.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
