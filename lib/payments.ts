import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/auth/server";
import { stripe } from "@/lib/stripe";

// SERVER ONLY. Everything here moves money or marks orders as paid.

type Admin = ReturnType<typeof createAdminClient>;

export type PaidOrder = {
  id: string;
  shop_id: string;
  payment_status: string;
  total_pence: number;
  seller_amount_pence: number;
  payment_group: string | null;
  stripe_payment_intent: string | null;
  stripe_charge: string | null;
};

export async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type CheckoutOrder = {
  id: string;
  delivery_fee_pence: number;
  shops: { name: string };
  order_items: { title: string; unit: string; price_pence: number; quantity: number }[];
};

// Creates a Stripe Checkout page for all unpaid orders in one basket
export async function startCheckout(
  db: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  userId: string,
  email: string | undefined
): Promise<{ url?: string; error?: string }> {
  const { data } = await db
    .from("orders")
    .select("id,delivery_fee_pence,shops(name),order_items(title,unit,price_pence,quantity)")
    .eq("payment_group", groupId)
    .eq("buyer_id", userId)
    .eq("payment_status", "unpaid")
    .eq("status", "placed");
  const orders = (data ?? []) as unknown as CheckoutOrder[];
  if (orders.length === 0) return { error: "There’s nothing left to pay for in that order." };

  const lineItems = orders.flatMap((o) => [
    ...o.order_items.map((i) => ({
      price_data: {
        currency: "gbp",
        unit_amount: i.price_pence,
        product_data: { name: `${i.title} (${o.shops.name})`, description: i.unit },
      },
      quantity: i.quantity,
    })),
    ...(o.delivery_fee_pence > 0
      ? [
          {
            price_data: {
              currency: "gbp",
              unit_amount: o.delivery_fee_pence,
              product_data: { name: `Delivery from ${o.shops.name}` },
            },
            quantity: 1,
          },
        ]
      : []),
  ]);

  const origin = await getOrigin();
  const session = await stripe.createCheckoutSession({
    mode: "payment",
    line_items: lineItems,
    success_url: `${origin}/orders/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/orders`,
    client_reference_id: groupId,
    customer_email: email,
    metadata: { group: groupId, buyer_id: userId, order_ids: orders.map((o) => o.id).join(",") },
    payment_intent_data: { transfer_group: groupId, metadata: { group: groupId } },
  });

  return session.url ? { url: session.url } : { error: "We couldn’t start the payment. Please try again." };
}

// Asks Stripe whether a checkout was paid (never trusts the browser), then marks the orders paid.
// Safe to run more than once, from the return page and from the webhook.
export async function finalizeSession(
  sessionId: string,
  expectedBuyer?: string
): Promise<{ paid: boolean; count: number }> {
  const s = await stripe.getCheckoutSession(sessionId);
  if (s.payment_status !== "paid") return { paid: false, count: 0 };
  if (expectedBuyer && s.metadata?.buyer_id !== expectedBuyer) return { paid: false, count: 0 };

  const ids = (s.metadata?.order_ids ?? "").split(",").filter(Boolean);
  const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
  if (!pi || ids.length === 0) return { paid: false, count: 0 };

  const admin = createAdminClient();
  const { data: rows } = await admin.from("orders").select("id,status,payment_status,total_pence").in("id", ids);

  for (const o of rows ?? []) {
    if (o.payment_status !== "unpaid") continue; // already handled

    if (o.status === "placed") {
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent: pi.id,
          stripe_charge: pi.latest_charge,
        })
        .eq("id", o.id)
        .eq("payment_status", "unpaid");
    } else {
      // The buyer cancelled this order while the payment was in progress: give the money back
      try {
        await stripe.createRefund({ payment_intent: pi.id, amount: o.total_pence, metadata: { order_id: o.id } }, `refund-${o.id}`);
        await admin.from("orders").update({ payment_status: "refunded" }).eq("id", o.id);
      } catch {
        // left as unpaid and cancelled: an admin can see it needs attention
      }
    }
  }
  return { paid: true, count: ids.length };
}

// A paid order was cancelled: refund the buyer in full
export async function refundOrder(admin: Admin, order: PaidOrder) {
  if (!order.stripe_payment_intent) return;
  try {
    await stripe.createRefund(
      { payment_intent: order.stripe_payment_intent, amount: order.total_pence, metadata: { order_id: order.id } },
      `refund-${order.id}`
    );
    await admin.from("orders").update({ payment_status: "refunded" }).eq("id", order.id);
  } catch {
    // stays "paid" and "cancelled", which the order card shows as "refund pending"
  }
}

// An order was completed: pay the seller their share (items minus commission, plus delivery fee)
export async function transferToSeller(admin: Admin, order: PaidOrder) {
  const fail = () => admin.from("orders").update({ payout_status: "failed" }).eq("id", order.id);

  const { data: payout } = await admin
    .from("shop_payouts")
    .select("stripe_account_id,payouts_enabled")
    .eq("shop_id", order.shop_id)
    .maybeSingle();

  if (!payout?.stripe_account_id || order.seller_amount_pence <= 0) {
    await fail();
    return;
  }

  try {
    const t = await stripe.createTransfer(
      {
        amount: order.seller_amount_pence,
        currency: "gbp",
        destination: payout.stripe_account_id,
        transfer_group: order.payment_group,
        source_transaction: order.stripe_charge,
        metadata: { order_id: order.id },
      },
      `transfer-${order.id}`
    );
    await admin.from("orders").update({ payout_status: "paid", stripe_transfer_id: t.id }).eq("id", order.id);
  } catch {
    await fail();
  }
}

// Keeps our copy of a seller's payout status in line with Stripe
export async function refreshPayoutStatus(shopId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("shop_payouts").select("stripe_account_id").eq("shop_id", shopId).maybeSingle();
  if (!row?.stripe_account_id) return null;

  const status = await stripe.getTransfersStatus(row.stripe_account_id);
  const ready = status === "active";
  await admin
    .from("shop_payouts")
    .update({ details_submitted: ready, payouts_enabled: ready, updated_at: new Date().toISOString() })
    .eq("shop_id", shopId);
  return { stripe_account_id: row.stripe_account_id, details_submitted: ready, payouts_enabled: ready };
}
