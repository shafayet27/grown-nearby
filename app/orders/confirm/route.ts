import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/auth/server";
import { finalizeSession } from "@/lib/payments";

// Stripe sends the buyer back here after paying. We check with Stripe that it really was paid.
export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return go("/orders");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return go("/login?next=/orders");

  try {
    const result = await finalizeSession(sessionId, userId);
    if (result.paid) return go(`/orders?placed=${Math.max(result.count, 1)}`);
  } catch {
    // fall through to the "still checking" message
  }
  return go("/orders?payment=pending");
}
