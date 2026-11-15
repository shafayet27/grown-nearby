"use client";
/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import { reviewListing, type ReviewState } from "@/app/admin/actions";
import { pounds } from "@/lib/shop";

export type PendingListing = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price_pence: number;
  unit: string;
  allergens: string | null;
  is_perishable: boolean;
  is_organic: boolean;
  organic_cert_ref: string | null;
  shops: { name: string; area: string };
  listing_images: { url: string; position: number }[];
};

export default function ReviewForm({ l }: { l: PendingListing }) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(reviewListing, {});
  const photos = [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-green-100 p-4 sm:p-5">
      <input type="hidden" name="id" value={l.id} />

      <div className="flex flex-col gap-4 sm:flex-row">
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto sm:w-56 sm:shrink-0 sm:flex-wrap">
            {photos.map((p, i) => (
              <img key={p.url} src={p.url} alt={`Photo ${i + 1} of ${l.title}`} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:w-56 sm:shrink-0">No photos added yet.</p>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-bold">{l.title}</h2>
          <p className="text-sm text-green-900/70">{l.shops.name} · Birmingham {l.shops.area}</p>
          <p className="font-semibold text-green-700">{pounds(l.price_pence)} {l.unit}</p>
          <p className="text-sm">{l.category} · {l.is_perishable ? "Fresh" : "Keeps without refrigeration"}</p>
          {l.description && <p className="break-words text-sm">{l.description}</p>}
          <p className="break-words text-sm"><strong>Allergens:</strong> {l.allergens || "Not provided"}</p>
          {l.is_organic && (
            <p className="break-words rounded-lg bg-green-50 p-2 text-sm">
              <strong>Organic claim.</strong> Certificate: {l.organic_cert_ref || "none given"}
            </p>
          )}
        </div>
      </div>

      {l.is_organic && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="organic_verified" className="mt-0.5 h-5 w-5 shrink-0 accent-green-700" />
          <span>I’ve checked this certificate. Show the “Certified organic” badge.</span>
        </label>
      )}

      <div>
        <label htmlFor={`note-${l.id}`} className="mb-1 block text-sm font-semibold">Note to seller (needed if rejecting)</label>
        <input id={`note-${l.id}`} name="note" maxLength={300} className="w-full rounded-xl border-2 border-green-200 px-4 py-2.5 text-base focus:border-green-600 focus:outline-none" placeholder="e.g. Please add a clearer photo" />
      </div>

      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-green-100 p-3 text-sm text-green-900">{state.message}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button name="decision" value="approve" disabled={pending} className="rounded-full bg-green-700 px-8 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          Approve
        </button>
        <button name="decision" value="reject" disabled={pending} className="rounded-full border-2 border-red-600 px-8 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
          Reject
        </button>
      </div>
    </form>
  );
}
