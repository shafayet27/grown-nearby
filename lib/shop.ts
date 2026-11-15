export type DeliveryOption = {
  id: number;
  method: "collection" | "seller_delivery" | "courier";
  fee_pence: number;
  courier: "evri" | "dpd" | null;
  notes: string | null;
};

export const categories = ["Veg & fruit", "Eggs & dairy", "Honey & preserves", "Bakes"];

export const categoryEmoji: Record<string, string> = {
  "Veg & fruit": "🥕",
  "Eggs & dairy": "🥚",
  "Honey & preserves": "🍯",
  Bakes: "🍞",
};

export function pounds(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

// Perishable items can never be sent by courier.
export function availableOptions(options: DeliveryOption[], perishable: boolean) {
  return options.filter((o) => !(perishable && o.method === "courier"));
}

export function describeOption(o: DeliveryOption) {
  const fee = o.fee_pence === 0 ? "Free" : pounds(o.fee_pence);
  if (o.method === "collection") return { title: "Collection", fee };
  if (o.method === "seller_delivery") return { title: "Delivered by the seller", fee };
  const name = o.courier === "dpd" ? "DPD" : "Evri";
  return { title: `Courier (${name})`, fee };
}

// Short labels shown on listing cards
export function deliveryLabels(options: { method: string }[], perishable: boolean) {
  const has = (m: string) => options.some((o) => o.method === m);
  const out: string[] = [];
  if (has("collection")) out.push("Collection");
  if (has("seller_delivery")) out.push("Local delivery");
  if (has("courier") && !perishable) out.push("Courier");
  return out;
}

// Fields needed to draw a listing card (used by the home page and "more from this shop")
export const CARD_SELECT =
  "id,title,category,price_pence,unit,is_organic,organic_verified,is_perishable," +
  "shops(name,delivery_options(method)),listing_images(url,position)";
