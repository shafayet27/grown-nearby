"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { refundOrder, startCheckout, transferToSeller, type PaidOrder } from "@/lib/payments";
import { stripeConfigured } from "@/lib/stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}

// Buyers (cancel) and sellers (confirm, ready, complete, cancel) change an order's status here.
// The database decides who may do what. Money moves afterwards: refunds on cancel, payout on complete.
export async function setOrderStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  // Only people who can already see this order may change it
  const { data: visible } = await supabase.from("orders").select("id").eq("id", id).maybeSingle();
  if (!visible) return;

  const admin = createAdminClient();
  const { data: updated, error } = await admin.rpc("admin_set_order_status", {
    p_order: id,
    p_status: status,
    p_actor: userId,
  });
  if (error || !updated) {
    refresh();
    return;
  }

  const order = updated as PaidOrder & { status: string };
  if (order.payment_status === "paid" && stripeConfigured()) {
    if (status === "cancelled") await refundOrder(admin, order);
    if (status === "completed") await transferToSeller(admin, order);
  }
  refresh();
}

// Pays for an order that was placed but not paid yet
export async function payNow(formData: FormData): Promise<void> {
  const group = String(formData.get("group") ?? "");
  if (!UUID.test(group)) redirect("/orders");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login?next=/orders");
  if (!stripeConfigured()) redirect("/orders?payment=unavailable");

  let url: string | undefined;
  try {
    const res = await startCheckout(supabase, group, claims.sub, claims.email as string | undefined);
    url = res.url;
  } catch {
    url = undefined;
  }
  if (!url) redirect("/orders?payment=error");
  redirect(url);
}

// If a seller's payout didn't go through, try again
export async function retryPayout(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return;

  // RLS only lets the shop's owner (or the buyer) see the order
  const { data: mine } = await supabase.from("shops").select("id").eq("owner_id", data.claims.sub).maybeSingle();
  if (!mine || !stripeConfigured()) return;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,shop_id,payment_status,total_pence,seller_amount_pence,payment_group,stripe_payment_intent,stripe_charge,status,payout_status")
    .eq("id", id)
    .eq("shop_id", mine.id)
    .maybeSingle();

  if (order && order.status === "completed" && order.payment_status === "paid" && order.payout_status !== "paid") {
    await transferToSeller(admin, order as PaidOrder);
  }
  refresh();
}
