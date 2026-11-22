"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { pounds, availableOptions, describeOption } from "@/lib/shop";
import { useBasketRows } from "@/lib/useBasketRows";
import { placeOrders } from "@/app/checkout/actions";
import type { BasketRow } from "@/app/basket/actions";

const field =
  "w-full rounded-xl border-2 border-green-200 bg-white px-4 py-3 text-base focus:border-green-600 focus:outline-none";
const label = "mb-1 block font-semibold";

export default function CheckoutForm({ defaultName, testMode }: { defaultName: string; testMode: boolean }) {
  const { items, rows, loading } = useBasketRows();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (items.length === 0 && !saving) {
    return (
      <div className="rounded-2xl bg-green-50 p-8 text-center">
        <h2 className="text-xl font-bold">Your basket is empty</h2>
        <Link href="/" className="mt-4 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">
          Browse listings
        </Link>
      </div>
    );
  }
  if (loading) return <p className="text-green-900/70">Loading your basket…</p>;

  const byId = new Map(rows.map((r) => [r.id, r]));
  if (items.some((i) => !byId.has(i.id))) {
    return (
      <div role="alert" className="rounded-2xl bg-amber-50 p-6 text-amber-900">
        <p className="font-semibold">Some items in your basket are no longer available.</p>
        <Link href="/basket" className="mt-3 inline-block font-semibold underline">Go back to your basket</Link>
      </div>
    );
  }

  // One order per seller
  const groups = new Map<string, { shop: BasketRow["shop"]; lines: { row: BasketRow; qty: number }[] }>();
  for (const i of items) {
    const row = byId.get(i.id)!;
    const g = groups.get(row.shop.id) ?? { shop: row.shop, lines: [] };
    g.lines.push({ row, qty: i.qty });
    groups.set(row.shop.id, g);
  }

  const plan = Array.from(groups.values()).map((g) => {
    const perishable = g.lines.some((l) => l.row.is_perishable);
    const options = availableOptions(g.shop.options, perishable);
    const method = chosen[g.shop.id] && options.some((o) => o.method === chosen[g.shop.id]) ? chosen[g.shop.id] : options[0]?.method;
    const option = options.find((o) => o.method === method);
    const subtotal = g.lines.reduce((s, l) => s + l.row.price_pence * l.qty, 0);
    return { ...g, options, method, option, subtotal, fee: option?.fee_pence ?? 0 };
  });

  const blocked = plan.some((p) => !p.option);
  const needsAddress = plan.some((p) => p.method && p.method !== "collection");
  const grandTotal = plan.reduce((s, p) => s + p.subtotal + p.fee, 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "").trim();

    setSaving(true);
    const res = await placeOrders({
      name: text("name"),
      phone: text("phone"),
      address1: text("address1"),
      address2: text("address2"),
      postcode: text("postcode"),
      note: text("note"),
      groups: plan.map((p) => ({
        shop_id: p.shop.id,
        method: p.method!,
        items: p.lines.map((l) => ({ listing_id: l.row.id, quantity: l.qty })),
      })),
    });

    if (res.error || !res.url) {
      setError(res.error ?? "We couldn’t place your order. Please try again.");
      setSaving(false);
      return;
    }
    // On to Stripe's secure payment page. The basket is emptied once payment is confirmed.
    window.location.assign(res.url);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {testMode && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Test mode:</strong> no real money is taken. On the payment page, use the test card 4242 4242 4242 4242 with any future date and any 3-digit code.
        </p>
      )}

      {plan.map((p) => (
        <section key={p.shop.id} className="rounded-2xl border border-green-100">
          <h2 className="border-b border-green-100 px-4 py-3 font-bold text-green-800">Order from {p.shop.name}</h2>
          <ul className="divide-y divide-green-100 px-4">
            {p.lines.map(({ row, qty }) => (
              <li key={row.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{qty} × {row.title}</span>
                <span className="shrink-0 font-semibold">{pounds(row.price_pence * qty)}</span>
              </li>
            ))}
          </ul>

          <fieldset className="border-t border-green-100 p-4">
            <legend className="mb-2 font-semibold">How would you like to get it?</legend>
            {p.options.length === 0 ? (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                This seller has no way to deliver these items yet. Please <Link href="/basket" className="underline">remove them from your basket</Link>.
              </p>
            ) : (
              <div className="space-y-2">
                {p.options.map((o) => {
                  const d = describeOption(o);
                  return (
                    <label key={o.id} className="flex items-start gap-3 rounded-xl border border-green-100 p-3">
                      <input
                        type="radio"
                        name={`method-${p.shop.id}`}
                        checked={p.method === o.method}
                        onChange={() => setChosen({ ...chosen, [p.shop.id]: o.method })}
                        className="mt-1 h-5 w-5 accent-green-700"
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{d.title}</span>
                        {o.notes && <span className="block text-sm text-green-900/70">{o.notes}</span>}
                      </span>
                      <span className="font-semibold text-green-700">{d.fee}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <p className="flex justify-between border-t border-green-100 px-4 py-3 text-sm font-semibold">
            <span>Order total ({pounds(p.subtotal)} + {p.fee === 0 ? "free" : pounds(p.fee)} delivery)</span>
            <span>{pounds(p.subtotal + p.fee)}</span>
          </p>
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Your details</h2>
        <p className="text-sm text-green-900/80">Sellers see your name and phone number so they can arrange collection or delivery.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={label}>Name</label>
            <input id="name" name="name" defaultValue={defaultName} required maxLength={80} autoComplete="name" className={field} />
          </div>
          <div>
            <label htmlFor="phone" className={label}>Phone number</label>
            <input id="phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" className={field} placeholder="07123 456789" />
          </div>
        </div>

        {needsAddress && (
          <div className="space-y-4 rounded-2xl bg-green-50 p-4">
            <h3 className="font-bold">Delivery address (Birmingham)</h3>
            <div>
              <label htmlFor="address1" className={label}>Address line 1</label>
              <input id="address1" name="address1" required maxLength={100} autoComplete="address-line1" className={field} placeholder="House number and street" />
            </div>
            <div>
              <label htmlFor="address2" className={label}>Address line 2 (optional)</label>
              <input id="address2" name="address2" maxLength={100} autoComplete="address-line2" className={field} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className={label}>Town or city</label>
                <input id="city" value="Birmingham" readOnly className={`${field} bg-white/60`} />
              </div>
              <div>
                <label htmlFor="postcode" className={label}>Postcode</label>
                <input id="postcode" name="postcode" required autoComplete="postal-code" className={field} placeholder="B14 7AA" />
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="note" className={label}>Note for the seller (optional)</label>
          <textarea id="note" name="note" rows={3} maxLength={300} className={field} placeholder="e.g. Any allergies, or a good time to collect" />
        </div>
      </section>

      <div className="rounded-2xl bg-green-50 p-5">
        <p className="flex justify-between text-lg font-bold">
          <span>Total to pay</span>
          <span>{pounds(grandTotal)}</span>
        </p>
        <p className="mt-1 text-sm text-green-900/70">You’ll pay securely with Stripe on the next page.</p>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        <button
          disabled={saving || blocked}
          className="mt-4 w-full rounded-full bg-green-700 px-6 py-3.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {saving ? "Taking you to payment…" : "Continue to payment"}
        </button>
      </div>
    </form>
  );
}
