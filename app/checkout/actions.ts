"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";
import { checkArea, tidyPostcode } from "@/lib/postcode";
import { startCheckout } from "@/lib/payments";
import { stripeConfigured } from "@/lib/stripe";

export type PlaceInput = {
  name: string;
  phone: string;
  address1: string;
  address2: string;
  postcode: string;
  note: string;
  groups: { shop_id: string; method: string; items: { listing_id: string; quantity: number }[] }[];
};

// On success the browser is sent to this Stripe payment page
export type PlaceResult = { error?: string; url?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS = ["collection", "seller_delivery", "courier"];

export async function placeOrders(input: PlaceInput): Promise<PlaceResult> {
  if (!stripeConfigured()) {
    return { error: "Payments aren’t switched on yet. Please try again later." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { error: "Please sign in first." };

  const name = String(input?.name ?? "").trim();
  const phone = String(input?.phone ?? "").trim();
  const note = String(input?.note ?? "").trim();
  const groups = Array.isArray(input?.groups) ? input.groups : [];

  if (groups.length === 0 || groups.length > 10) return { error: "Your basket is empty." };
  for (const g of groups) {
    const items = Array.isArray(g?.items) ? g.items : [];
    if (!UUID.test(String(g?.shop_id)) || !METHODS.includes(String(g?.method)) || items.length === 0 || items.length > 30) {
      return { error: "Something is wrong with your basket. Please check it and try again." };
    }
    for (const it of items) {
      if (!UUID.test(String(it?.listing_id)) || !Number.isInteger(it?.quantity) || it.quantity < 1 || it.quantity > 20) {
        return { error: "Something is wrong with your basket. Please check it and try again." };
      }
    }
  }

  if (name.length < 2 || name.length > 80) return { error: "Please enter your name." };
  if (phone.replace(/[^\d]/g, "").length < 10 || phone.length > 20) {
    return { error: "Please enter a phone number the seller can reach you on." };
  }
  if (note.length > 300) return { error: "Please keep your note under 300 characters." };

  // Delivery and courier orders need an address in Birmingham
  let address = "";
  let postcode = "";
  if (groups.some((g) => g.method !== "collection")) {
    const line1 = String(input.address1 ?? "").trim();
    const line2 = String(input.address2 ?? "").trim();
    const pc = tidyPostcode(String(input.postcode ?? ""));
    if (line1.length < 3 || line1.length > 100) return { error: "Please enter your delivery address." };
    if (line2.length > 100) return { error: "Address line 2 is too long." };
    if (!pc) return { error: "Please enter a valid postcode." };
    const area = await checkArea(pc);
    if (!area.ok) return { error: area.error };
    address = [line1, line2, "Birmingham"].filter(Boolean).join(", ");
    postcode = pc;
  }

  // The database re-checks everything with the real prices and creates one order per seller
  const { data: group, error } = await supabase.rpc("place_orders", {
    p_name: name,
    p_phone: phone,
    p_address: address,
    p_postcode: postcode,
    p_note: note,
    p_groups: groups,
  });

  if (error || !group) {
    if (error?.code === "P0001") return { error: error.message };
    return { error: "We couldn’t place your order. Please try again." };
  }

  revalidatePath("/orders");

  try {
    const res = await startCheckout(supabase, String(group), claims.sub, claims.email as string | undefined);
    if (res.url) return { url: res.url };
    return { error: res.error ?? "We couldn’t start the payment. You can pay from My orders." };
  } catch {
    return { error: "We couldn’t reach the payment service. Your order is saved. You can pay from My orders." };
  }
}
