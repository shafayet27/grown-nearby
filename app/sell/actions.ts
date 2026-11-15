"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";

export type ShopState = { error?: string };

export type LookupResult =
  | { ok: true; postcode: string; addresses: string[]; manual: boolean }
  | { ok: false; error: string };

type Option = { method: string; fee_pence: number; courier?: string; notes: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// "2.50" -> 250. Returns NaN for anything silly.
function pence(fd: FormData, key: string) {
  const n = Math.round(parseFloat(text(fd, key) || "0") * 100);
  return Number.isFinite(n) && n >= 0 && n <= 5000 ? n : NaN;
}

const UK_POSTCODE = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;

// "b147aa" -> "B14 7AA", or null if it isn't shaped like a UK postcode
function tidyPostcode(raw: string) {
  const pc = raw.toUpperCase().replace(/\s+/g, "");
  return UK_POSTCODE.test(pc) ? `${pc.slice(0, -3)} ${pc.slice(-3)}` : null;
}

// Free check with postcodes.io: does the postcode exist, and is it in Birmingham?
// If that service is down we carry on, because the database applies its own Birmingham check too.
async function checkArea(pc: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^B[0-9]/.test(pc)) {
    return { ok: false, error: "Grown Nearby is only open in Birmingham for now. Please enter a Birmingham postcode." };
  }
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      return { ok: false, error: "We couldn’t find that postcode. Please check it and try again." };
    }
    if (res.ok) {
      const json = await res.json();
      const district: string | undefined = json?.result?.admin_district;
      if (district && district !== "Birmingham") {
        return { ok: false, error: `That postcode is in ${district}. Grown Nearby is only open in Birmingham for now.` };
      }
    }
  } catch {
    // service unavailable: fall through
  }
  return { ok: true };
}

function formatAddress(a: unknown): string | null {
  if (typeof a === "string") {
    return a.split(",").map((s) => s.trim()).filter(Boolean).join(", ") || null;
  }
  if (a && typeof a === "object") {
    const o = a as Record<string, unknown>;
    const parts = Array.isArray(o.formatted_address)
      ? o.formatted_address
      : [o.line_1, o.line_2, o.line_3, o.line_4, o.town_or_city, o.county];
    const s = parts
      .filter((p): p is string => typeof p === "string" && p.trim() !== "")
      .map((p) => p.trim())
      .join(", ");
    return s || null;
  }
  return null;
}

// Step 2 of shop setup: check the postcode and (if an address service is set up) list its addresses
export async function lookupAddresses(raw: string): Promise<LookupResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "Please sign in first." };

  const pc = tidyPostcode(raw);
  if (!pc) return { ok: false, error: "That doesn’t look like a UK postcode." };

  const area = await checkArea(pc);
  if (!area.ok) return area;

  // Full address lists come from a paid service. Without a key, the seller types their address.
  const key = process.env.ADDRESS_API_KEY;
  if (!key) return { ok: true, postcode: pc, addresses: [], manual: true };

  try {
    const url = `https://api.getaddress.io/find/${encodeURIComponent(pc.replace(" ", ""))}?api-key=${encodeURIComponent(key)}&expand=true`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: true, postcode: pc, addresses: [], manual: true };
    const json = await res.json();
    const list: unknown[] = Array.isArray(json?.addresses) ? json.addresses : [];
    const addresses = list.map(formatAddress).filter((a): a is string => Boolean(a));
    return { ok: true, postcode: pc, addresses, manual: addresses.length === 0 };
  } catch {
    return { ok: true, postcode: pc, addresses: [], manual: true };
  }
}

export async function createShop(_prev: ShopState, formData: FormData): Promise<ShopState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Please sign in first." };

  const name = text(formData, "name");
  const description = text(formData, "description");
  const address = text(formData, "address");
  const pc = tidyPostcode(text(formData, "postcode"));

  if (name.length < 3 || name.length > 60) return { error: "Your shop name needs to be 3 to 60 characters." };
  if (description.length > 500) return { error: "Please keep the description under 500 characters." };
  if (address.length < 5 || address.length > 200) return { error: "Please enter your address (it stays private)." };
  if (!pc) return { error: "Please enter a valid postcode." };
  if (!formData.get("confirm_food")) {
    return { error: "Please confirm your food business registration to open your shop." };
  }

  const area = await checkArea(pc);
  if (!area.ok) return { error: area.error };

  const options: Option[] = [];

  if (formData.get("collection")) {
    options.push({ method: "collection", fee_pence: 0, notes: text(formData, "collection_notes").slice(0, 200) });
  }
  if (formData.get("delivery")) {
    const fee = pence(formData, "delivery_fee");
    if (Number.isNaN(fee)) return { error: "Please enter a delivery fee between £0 and £50." };
    options.push({ method: "seller_delivery", fee_pence: fee, notes: text(formData, "delivery_notes").slice(0, 200) });
  }
  if (formData.get("courier")) {
    const provider = text(formData, "courier_provider");
    if (provider !== "evri" && provider !== "dpd") return { error: "Please choose Evri or DPD." };
    const fee = pence(formData, "courier_fee");
    if (Number.isNaN(fee)) return { error: "Please enter a postage charge between £0 and £50." };
    options.push({ method: "courier", fee_pence: fee, courier: provider, notes: text(formData, "courier_notes").slice(0, 200) });
  }

  if (options.length === 0) return { error: "Choose at least one way for buyers to get your food." };

  const { error } = await supabase.rpc("create_shop", {
    p_name: name,
    p_description: description,
    p_address: address,
    p_postcode: pc,
    p_options: options,
  });

  if (error) {
    if (error.code === "P0001") return { error: error.message }; // our own friendly messages
    if (error.code === "23505") return { error: "You already have a shop." };
    return { error: "Something went wrong setting up your shop. Please try again." };
  }

  redirect("/dashboard");
}
