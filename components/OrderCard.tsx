import { pounds } from "@/lib/shop";
import { formatDate, methodLabel, readyLabel, statusInfo, type OrderRow } from "@/lib/orders";
import { payNow, retryPayout } from "@/app/orders/actions";
import StatusButton from "./StatusButton";

function paymentLabel(o: OrderRow) {
  if (o.payment_status === "refunded") return "Refunded";
  if (o.payment_status === "paid") return o.status === "cancelled" ? "Cancelled: refund on its way" : "Paid";
  return o.status === "cancelled" ? "Cancelled" : "Awaiting payment";
}

export default function OrderCard({ order: o, role }: { order: OrderRow; role: "buyer" | "seller" }) {
  const chip = statusInfo(o.status, o.delivery_method);
  const paid = o.payment_status === "paid";
  const open = o.status === "placed" || o.status === "confirmed" || o.status === "ready";
  const awaitingPayment = o.payment_status === "unpaid" && o.status === "placed";

  return (
    <article className="rounded-2xl border border-green-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-green-100 px-4 py-3">
        <div>
          <h2 className="font-bold">Order #{o.number}</h2>
          <p className="text-sm text-green-900/70">{formatDate(o.created_at)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${awaitingPayment ? "bg-amber-100 text-amber-900" : chip.cls}`}>
          {awaitingPayment ? "Awaiting payment" : chip.text}
        </span>
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
          <p className="text-xs text-green-900/60">{paymentLabel(o)}</p>
        </div>

        {role === "seller" && paid && (
          <div className="space-y-1 rounded-xl bg-green-50 p-3">
            <p className="flex justify-between"><span>Commission ({Number(o.commission_percent)}% of items)</span><span>−{pounds(o.commission_pence)}</span></p>
            <p className="flex justify-between font-bold"><span>You receive</span><span>{pounds(o.seller_amount_pence)}</span></p>
            {o.status === "completed" && (
              <p className="text-xs text-green-900/70">
                {o.payout_status === "paid" ? "Paid out to your Stripe account." : o.payout_status === "failed" ? "The payout didn’t go through. Try again below." : "Payout in progress."}
              </p>
            )}
            {o.status !== "completed" && o.status !== "cancelled" && (
              <p className="text-xs text-green-900/70">You’re paid when you mark the order as completed.</p>
            )}
          </div>
        )}

        {o.note && <p className="break-words rounded-xl bg-amber-50 p-3"><strong>Note:</strong> {o.note}</p>}
      </div>

      {role === "buyer" && awaitingPayment && (
        <footer className="flex flex-col gap-3 border-t border-green-100 px-4 py-3 sm:flex-row">
          {o.payment_group && (
            <form action={payNow}>
              <input type="hidden" name="group" value={o.payment_group} />
              <button className="w-full rounded-full bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 sm:w-auto">Pay now</button>
            </form>
          )}
          <StatusButton id={o.id} status="cancelled" label="Cancel order" variant="danger" confirmText="Cancel this order?" />
        </footer>
      )}

      {role === "buyer" && paid && o.status === "placed" && (
        <footer className="border-t border-green-100 px-4 py-3">
          <StatusButton id={o.id} status="cancelled" label="Cancel and refund" variant="danger" confirmText="Cancel this order? You’ll be refunded in full." />
        </footer>
      )}

      {role === "seller" && paid && open && (
        <footer className="flex flex-col gap-3 border-t border-green-100 px-4 py-3 sm:flex-row">
          {o.status === "placed" && <StatusButton id={o.id} status="confirmed" label="Confirm order" />}
          {o.status === "confirmed" && <StatusButton id={o.id} status="ready" label={`Mark as: ${readyLabel(o.delivery_method)}`} />}
          {o.status === "ready" && <StatusButton id={o.id} status="completed" label="Mark as completed and get paid" />}
          <StatusButton id={o.id} status="cancelled" label={o.status === "placed" ? "Decline and refund" : "Cancel and refund"} variant="danger" confirmText="Cancel this order? The buyer will be refunded in full." />
        </footer>
      )}

      {role === "seller" && paid && o.status === "completed" && o.payout_status !== "paid" && (
        <footer className="border-t border-green-100 px-4 py-3">
          <form action={retryPayout}>
            <input type="hidden" name="id" value={o.id} />
            <button className="w-full rounded-full bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 sm:w-auto">Retry payout</button>
          </form>
        </footer>
      )}
    </article>
  );
}
