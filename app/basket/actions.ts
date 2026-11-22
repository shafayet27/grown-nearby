"use server";

import { supabase } from "@/lib/supabase";
import type { DeliveryOption } from "@/lib/shop";

export type BasketRow = {
  id: string;
  title: string;
  category: string;
  price_pence: number;
  unit: string;
  is_perishable: boolean;
  photo: string | null;
  shop: { id: string; name: string; area: string; options: DeliveryOption[] };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Looks up the current details and prices of the listings in a basket.
// Only listings that are live and approved come back, so anything else shows as unavailable.
export async function loadBasket(ids: string[]): Promise<BasketRow[]> {
  const clean = Array.from(new Set(ids.filter((i) => typeof i === "string" && UUID.test(i)))).slice(0, 50);
  if (clean.length === 0) return [];

  const { data } = await supabase
    .from("listings")
    .select(
      "id,title,category,price_pence,unit,is_perishable," +
        "shops(id,name,area,delivery_options(id,method,fee_pence,courier,notes)),listing_images(url,position)"
    )
    .in("id", clean)
    .eq("active", true)
    .eq("status", "approved");

  type Raw = {
    id: string;
    title: string;
    category: string;
    price_pence: number;
    unit: string;
    is_perishable: boolean;
    shops: { id: string; name: string; area: string; delivery_options: DeliveryOption[] };
    listing_images: { url: string; position: number }[];
  };

  return ((data ?? []) as unknown as Raw[]).map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category,
    price_pence: l.price_pence,
    unit: l.unit,
    is_perishable: l.is_perishable,
    photo: [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url ?? null,
    shop: { id: l.shops.id, name: l.shops.name, area: l.shops.area, options: l.shops.delivery_options ?? [] },
  }));
}
