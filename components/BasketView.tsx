"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { categoryEmoji, pounds } from "@/lib/shop";
import { removeFromBasket, setQuantity } from "@/lib/basket";
import { useBasketRows } from "@/lib/useBasketRows";
import type { BasketRow } from "@/app/basket/actions";

const stepBtn =
  "grid h-9 w-9 place-items-center rounded-full border-2 border-green-700 text-lg font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40";

export default function BasketView() {
  const { items, rows, loading } = useBasketRows();

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-green-50 p-8 text-center">
        <h2 className="text-xl font-bold">Your basket is empty</h2>
        <p className="mt-1 text-green-900/80">Find something grown or made nearby.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">
          Browse listings
        </Link>
      </div>
    );
  }
  if (loading) return <p className="text-green-900/70">Loading your basket…</p>;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = items.filter((i) => !byId.has(i.id));
  const groups = new Map<string, { name: string; lines: { row: BasketRow; qty: number }[] }>();
  for (const i of items) {
    const row = byId.get(i.id);
    if (!row) continue;
    const g = groups.get(row.shop.id) ?? { name: row.shop.name, lines: [] };
    g.lines.push({ row, qty: i.qty });
    groups.set(row.shop.id, g);
  }
  const total = Array.from(groups.values()).reduce(
    (sum, g) => sum + g.lines.reduce((s, l) => s + l.row.price_pence * l.qty, 0),
    0
  );

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">Some items are no longer available.</p>
          <ul className="mt-2 space-y-2">
            {missing.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span>An item that has been hidden or removed by the seller</span>
                <button type="button" onClick={() => removeFromBasket(m.id)} className="font-semibold underline">Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.from(groups.entries()).map(([shopId, g]) => {
        const subtotal = g.lines.reduce((s, l) => s + l.row.price_pence * l.qty, 0);
        return (
          <section key={shopId} className="rounded-2xl border border-green-100">
            <h2 className="border-b border-green-100 px-4 py-3 font-bold text-green-800">{g.name}</h2>
            <ul className="divide-y divide-green-100">
              {g.lines.map(({ row, qty }) => (
                <li key={row.id} className="flex gap-3 p-4">
                  <Link href={`/listing/${row.id}`} className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-green-50 text-4xl">
                    {row.photo ? <img src={row.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : categoryEmoji[row.category] ?? "🧺"}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/listing/${row.id}`} className="block font-semibold hover:underline">{row.title}</Link>
                    <p className="text-sm text-green-900/70">{pounds(row.price_pence)} {row.unit}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Fewer ${row.title}`} disabled={qty <= 1} onClick={() => setQuantity(row.id, qty - 1)} className={stepBtn}>−</button>
                        <span className="w-6 text-center font-bold">{qty}</span>
                        <button type="button" aria-label={`More ${row.title}`} disabled={qty >= 20} onClick={() => setQuantity(row.id, qty + 1)} className={stepBtn}>+</button>
                      </div>
                      <button type="button" onClick={() => removeFromBasket(row.id)} className="text-sm font-semibold text-red-700 underline">Remove</button>
                    </div>
                  </div>
                  <p className="shrink-0 font-bold">{pounds(row.price_pence * qty)}</p>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-green-100 px-4 py-3 text-sm">
              <span>Items from {g.name}</span>
              <span className="font-semibold">{pounds(subtotal)}</span>
            </p>
          </section>
        );
      })}

      <div className="rounded-2xl bg-green-50 p-5">
        <p className="flex justify-between text-lg font-bold">
          <span>Items total</span>
          <span>{pounds(total)}</span>
        </p>
        <p className="mt-1 text-sm text-green-900/70">Delivery or collection is chosen at checkout.</p>
        {missing.length > 0 ? (
          <p className="mt-4 text-sm text-amber-900">Please remove the unavailable items to continue.</p>
        ) : (
          <Link href="/checkout" className="mt-4 block rounded-full bg-green-700 px-6 py-3.5 text-center font-semibold text-white hover:bg-green-800">
            Go to checkout
          </Link>
        )}
      </div>
    </div>
  );
}
