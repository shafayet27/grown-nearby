import { pounds } from "@/lib/shop";
import { formatDate, methodLabel, readyLabel, statusInfo, type OrderRow } from "@/lib/orders";
import StatusButton from "./StatusButton";

export default function OrderCard({ order: o, role }: { order: OrderRow; role: "buyer" | "seller" }) {
  const chip = statusInfo(o.status, o.delivery_method);
  const open = o.status === "placed" || o.status === "confirmed" || o.status === "ready";

  return (
    <article className="rounded-2xl border border-green-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-green-100 px-4 py-3">
        <div>
          <h2 className="font-bold">Order #{o.number}</h2>
          <p className="text-sm text-green-900/70">{formatDate(o.created_at)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${chip.cls}`}>{chip.text}</span>
      </header>

      <div className="space-y-3 px-4 py-3 text-sm">
        {role === "buyer" ? (
          <p>From <strong>{o.shops.name}</strong> (Birmingham {o.shops.area})</p>
        ) : (
          <div className="rounded-xl bg-green-50 p-3">
            <p><strong>{o.buyer_name}</strong> · <a href={`tel:${o.buyer_phone.replace(/[^\d+]/g, "")}`} className="underline">{o.buyer_phone}</a></p>
            {o.delivery_address && <p className="mt-1 break-words">Deliver to: {o.delivery_address}, {o.delivery_postcode}</p>}
          </div>
        )}

        <ul className="divide-y divide-green-100">
          {o.order_items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>{i.quantity} × {i.title} <span className="text-green-900/60">({pounds(i.price_pence)} {i.unit})</span></span>
              <span className="shrink-0 font-semibold">{pounds(i.price_pence * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-green-100 pt-2">
          <p className="flex justify-between"><span>Items</span><span>{pounds(o.subtotal_pence)}</span></p>
          <p className="flex justify-between">
            <span>{methodLabel(o.delivery_method, o.courier)}</span>
            <span>{o.delivery_fee_pence === 0 ? "Free" : pounds(o.delivery_fee_pence)}</span>
          </p>
          <p className="flex justify-between text-base font-bold"><span>Total</span><span>{pounds(o.total_pence)}</span></p>
          <p className="text-xs text-green-900/60">
            {o.payment_status === "paid" ? "Paid" : "Test order: no payment taken"}
          </p>
        </div>

        {o.note && <p className="break-words rounded-xl bg-amber-50 p-3"><strong>Note:</strong> {o.note}</p>}
      </div>

      {role === "buyer" && o.status === "placed" && (
        <footer className="border-t border-green-100 px-4 py-3">
          <StatusButton id={o.id} status="cancelled" label="Cancel order" variant="danger" confirmText="Cancel this order?" />
        </footer>
      )}

      {role === "seller" && open && (
        <footer className="flex flex-col gap-3 border-t border-green-100 px-4 py-3 sm:flex-row">
          {o.status === "placed" && <StatusButton id={o.id} status="confirmed" label="Confirm order" />}
          {o.status === "confirmed" && <StatusButton id={o.id} status="ready" label={`Mark as: ${readyLabel(o.delivery_method)}`} />}
          {o.status === "ready" && <StatusButton id={o.id} status="completed" label="Mark as completed" />}
          <StatusButton id={o.id} status="cancelled" label={o.status === "placed" ? "Decline order" : "Cancel order"} variant="danger" confirmText="Cancel this order? The buyer will see it as cancelled." />
        </footer>
      )}
    </article>
  );
}
