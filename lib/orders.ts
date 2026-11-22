export type OrderItemRow = {
  id: number;
  title: string;
  unit: string;
  price_pence: number;
  quantity: number;
};

export type OrderRow = {
  id: string;
  number: number;
  status: string;
  payment_status: string;
  delivery_method: string;
  courier: string | null;
  delivery_fee_pence: number;
  subtotal_pence: number;
  total_pence: number;
  buyer_name: string;
  buyer_phone: string;
  delivery_address: string | null;
  delivery_postcode: string | null;
  note: string | null;
  created_at: string;
  shops: { name: string; area: string };
  order_items: OrderItemRow[];
};

export const ORDER_SELECT =
  "id,number,status,payment_status,delivery_method,courier,delivery_fee_pence,subtotal_pence,total_pence," +
  "buyer_name,buyer_phone,delivery_address,delivery_postcode,note,created_at," +
  "shops(name,area),order_items(id,title,unit,price_pence,quantity)";

// What "ready" means depends on how the order is being handed over
export function readyLabel(method: string) {
  if (method === "collection") return "Ready for collection";
  if (method === "seller_delivery") return "Out for delivery";
  return "Posted";
}

export function statusInfo(status: string, method: string) {
  switch (status) {
    case "placed":
      return { text: "Placed", cls: "bg-amber-100 text-amber-900" };
    case "confirmed":
      return { text: "Confirmed", cls: "bg-blue-100 text-blue-900" };
    case "ready":
      return { text: readyLabel(method), cls: "bg-green-100 text-green-800" };
    case "completed":
      return { text: "Completed", cls: "bg-green-200 text-green-900" };
    default:
      return { text: "Cancelled", cls: "bg-gray-100 text-gray-700" };
  }
}

export function methodLabel(method: string, courier: string | null) {
  if (method === "collection") return "Collection";
  if (method === "seller_delivery") return "Delivered by the seller";
  return `Courier (${courier === "dpd" ? "DPD" : "Evri"})`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}
