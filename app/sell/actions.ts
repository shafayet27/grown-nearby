"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";

export type ShopState = { error?: string };
export type AddressState = { error?: string; message?: string };

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

export async function createShop(_prev: ShopState, formData: FormData): Promise<ShopState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Please sign in first." };

  const name = text(formData, "name");
  const description = text(formData, "description");
  const line1 = text(formData, "address_line1");
  const line2 = text(formData, "address_line2");
  const pc = tidyPostcode(text(formData, "postcode"));

  if (name.length < 3 || name.length > 60) return { error: "Your shop name needs to be 3 to 60 characters." };
  if (description.length > 500) return { error: "Please keep the description under 500 characters." };
  if (line1.length < 3 || line1.length > 100) return { error: "Please enter your house number and street." };
  if (line2.length > 100) return { error: "Address line 2 is too long." };
  if (!pc) return { error: "Please enter a valid postcode." };
  if (!formData.get("confirm_food")) {
    return { error: "Please confirm your food business registration to open your shop." };
  }

  const area = await checkArea(pc);
  if (!area.ok) return { error: area.error };

  const address = [line1, line2, "Birmingham"].filter(Boolean).join(", ");

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

// Lets a seller change their private address and postcode later (the public area updates with it)
export async function updateAddress(_prev: AddressState, formData: FormData): Promise<AddressState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Please sign in first." };

  const address = text(formData, "address");
  const pc = tidyPostcode(text(formData, "postcode"));

  if (address.length < 5 || address.length > 200) return { error: "Please enter your house number and street." };
  if (!pc) return { error: "Please enter a valid postcode." };

  const area = await checkArea(pc);
  if (!area.ok) return { error: area.error };

  const full = /,\s*Birmingham$/i.test(address) ? address : `${address}, Birmingham`;

  const { error } = await supabase.rpc("update_shop_address", { p_address: full, p_postcode: pc });
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    return { error: "We couldn’t save your address. Please try again." };
  }

  revalidatePath("/dashboard");
  return { message: "Address updated." };
}
