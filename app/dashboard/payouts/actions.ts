"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getOrigin } from "@/lib/payments";
import { stripe, stripeConfigured, stripeTestMode } from "@/lib/stripe";

// Writes the real reason to the terminal. In Stripe test mode it is also shown on the page,
// to help while building. Visitors never see it once you switch to live keys.
// Stripe's account links must use https. On a local test site (http) we swap the prefix, so after
// Stripe sends you back, change https to http in the address bar if the page doesn't load.
function secure(origin: string) {
  return origin.replace(/^http:\/\//, "https://");
}

function failure(e: unknown): string {
  console.error("Payout set-up problem:", e);
  const message = e instanceof Error ? e.message : "Unknown problem";
  return stripeTestMode() ? `/dashboard?payouts=error&detail=${encodeURIComponent(message.slice(0, 300))}` : "/dashboard?payouts=error";
}

async function myShop() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=/dashboard");
  const { data: shop } = await supabase.from("shops").select("id,name").eq("owner_id", userId).maybeSingle();
  if (!shop) redirect("/sell/setup");
  return { shop, email: data?.claims?.email as string | undefined };
}

// Sends the seller to Stripe, which collects their identity and bank details. We never see them.
export async function startPayoutSetup(): Promise<void> {
  if (!stripeConfigured()) redirect("/dashboard?payouts=unavailable");
  const { shop, email } = await myShop();

  let url: string | undefined;
  let problem = "/dashboard?payouts=error";
  try {
    const admin = createAdminClient();
    const { data: row, error: readError } = await admin
      .from("shop_payouts")
      .select("stripe_account_id")
      .eq("shop_id", shop.id)
      .maybeSingle();
    if (readError) throw new Error(`Database: ${readError.message}`);
    let accountId = row?.stripe_account_id as string | undefined;

    if (!accountId) {
      const account = await stripe.createAccount({ email, name: shop.name, shopId: shop.id }, `account-v2-${shop.id}`);
      accountId = account.id;
      const { error: saveError } = await admin.from("shop_payouts").upsert({ shop_id: shop.id, stripe_account_id: accountId });
      if (saveError) throw new Error(`Database: ${saveError.message}`);
    }

    const origin = secure(await getOrigin());
    const link = await stripe.createAccountLink(accountId, `${origin}/dashboard?payouts=retry`, `${origin}/dashboard?payouts=return`);
    url = link.url;
  } catch (e) {
    problem = failure(e);
    url = undefined;
  }

  if (!url) redirect(problem);
  redirect(url);
}

// Opens the seller's own Stripe dashboard (payouts, bank details)
export async function openStripeDashboard(): Promise<void> {
  if (!stripeConfigured()) redirect("/dashboard?payouts=unavailable");
  const { shop } = await myShop();

  let url: string | undefined;
  let problem = "/dashboard?payouts=error";
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("shop_payouts").select("stripe_account_id").eq("shop_id", shop.id).maybeSingle();
    const origin = secure(await getOrigin());
    if (row?.stripe_account_id) url = (await stripe.createDashboardLink(row.stripe_account_id, `${origin}/dashboard`)).url;
  } catch (e) {
    problem = failure(e);
    url = undefined;
  }

  if (!url) redirect(problem);
  redirect(url);
}
