"use client";

import { useState } from "react";
import Link from "next/link";
import { addToBasket } from "@/lib/basket";

const stepBtn =
  "grid h-12 w-12 place-items-center rounded-full border-2 border-green-700 text-2xl font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40";

export default function AddToBasket({ listingId }: { listingId: string }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-semibold">Quantity</span>
        <button type="button" aria-label="Fewer" disabled={qty <= 1} onClick={() => { setQty(qty - 1); setAdded(false); }} className={stepBtn}>
          −
        </button>
        <span className="w-8 text-center text-lg font-bold" aria-live="polite">{qty}</span>
        <button type="button" aria-label="More" disabled={qty >= 20} onClick={() => { setQty(qty + 1); setAdded(false); }} className={stepBtn}>
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          addToBasket(listingId, qty);
          setAdded(true);
        }}
        className="w-full rounded-full bg-green-700 px-5 py-3.5 font-semibold text-white hover:bg-green-800"
      >
        Add to basket
      </button>

      {added && (
        <p role="status" className="rounded-xl bg-green-100 p-3 text-sm text-green-900">
          Added to your basket.{" "}
          <Link href="/basket" className="font-semibold underline">View basket</Link>
        </p>
      )}
    </div>
  );
}
