"use client";

import { useActionState, useState } from "react";
import { createListing, updateListing, type ListingState } from "@/app/dashboard/listings/actions";
import { categories } from "@/lib/shop";
import { ALLERGENS, UNITS, parseAllergenText } from "@/lib/listing";

const field =
  "w-full rounded-xl border-2 border-green-200 bg-white px-4 py-3 text-base focus:border-green-600 focus:outline-none";
const label = "mb-1 block font-semibold";

export type ListingDefaults = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price_pence: number;
  unit: string;
  is_perishable: boolean;
  allergens: string | null;
  is_organic: boolean;
  organic_cert_ref: string | null;
};

export default function ListingForm({ listing }: { listing?: ListingDefaults }) {
  const editing = Boolean(listing);
  const [state, formAction, pending] = useActionState<ListingState, FormData>(
    editing ? updateListing : createListing,
    {}
  );
  const parsed = parseAllergenText(listing?.allergens ?? null);
  const [none, setNone] = useState(parsed.none);
  const [organic, setOrganic] = useState(listing?.is_organic ?? false);

  return (
    <form action={formAction} className="space-y-6">
      {listing && <input type="hidden" name="id" value={listing.id} />}

      <div>
        <label htmlFor="title" className={label}>Title</label>
        <input id="title" name="title" defaultValue={listing?.title} maxLength={80} required className={field} placeholder="e.g. Free-range eggs, 12" />
      </div>

      <div>
        <label htmlFor="description" className={label}>Description</label>
        <textarea id="description" name="description" defaultValue={listing?.description ?? ""} rows={4} maxLength={1000} className={field} placeholder="What is it, how was it grown or made, when was it picked or baked?" />
      </div>

      <div>
        <label htmlFor="category" className={label}>Category</label>
        <select id="category" name="category" defaultValue={listing?.category ?? ""} required className={field}>
          <option value="" disabled>Choose a category…</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className={label}>Price (£)</label>
          <input id="price" name="price" type="number" min="0.10" max="500" step="0.01" inputMode="decimal" defaultValue={listing ? (listing.price_pence / 100).toFixed(2) : ""} required className={field} placeholder="3.80" />
        </div>
        <div>
          <label htmlFor="unit" className={label}>Price is</label>
          <select id="unit" name="unit" defaultValue={listing?.unit ?? ""} required className={field}>
            <option value="" disabled>Choose…</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={label}>How does it keep?</legend>
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-xl border border-green-100 p-3">
            <input type="radio" name="perishable" value="fresh" defaultChecked={listing ? listing.is_perishable : true} className="mt-1 h-5 w-5 accent-green-700" />
            <span><strong>Fresh.</strong> Needs keeping cool or goes off within days (eggs, veg, milk, fresh bakes). Collection or your own delivery only.</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-green-100 p-3">
            <input type="radio" name="perishable" value="keeps" defaultChecked={listing ? !listing.is_perishable : false} className="mt-1 h-5 w-5 accent-green-700" />
            <span><strong>Keeps without refrigeration.</strong> Honey, jam, sealed shelf-stable items. Can also be sent by courier if you offer it.</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Allergens</legend>
        <p className="mb-2 text-sm text-green-900/80">Tick every one of the 14 main allergens this item contains.</p>
        <label className="mb-3 flex items-center gap-3 rounded-xl bg-green-50 p-3 font-semibold">
          <input type="checkbox" name="no_allergens" checked={none} onChange={(e) => setNone(e.target.checked)} className="h-5 w-5 accent-green-700" />
          None of the 14 main allergens
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALLERGENS.map((a) => (
            <label key={a} className={`flex items-center gap-3 rounded-xl border border-green-100 p-3 ${none ? "opacity-50" : ""}`}>
              <input type="checkbox" name="allergen" value={a} disabled={none} defaultChecked={parsed.selected.includes(a)} className="h-5 w-5 accent-green-700" />
              {a}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <label htmlFor="allergen_notes" className={label}>Other allergen information (optional)</label>
          <input id="allergen_notes" name="allergen_notes" defaultValue={parsed.notes} maxLength={200} className={field} placeholder="e.g. Made in a kitchen that also handles nuts" />
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-green-100 p-4">
        <label className="flex items-center gap-3 font-semibold">
          <input type="checkbox" name="is_organic" checked={organic} onChange={(e) => setOrganic(e.target.checked)} className="h-5 w-5 accent-green-700" />
          This item is certified organic
        </label>
        {organic && (
          <div className="mt-3">
            <label htmlFor="organic_cert_ref" className={label}>Certificate number</label>
            <input id="organic_cert_ref" name="organic_cert_ref" defaultValue={listing?.organic_cert_ref ?? ""} maxLength={60} className={field} placeholder="From your certification body (e.g. Soil Association)" />
            <p className="mt-1 text-sm text-green-900/70">We check this before the “Certified organic” badge appears.</p>
          </div>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      )}
      {state.message && (
        <p role="status" className="rounded-xl bg-green-100 p-3 text-sm text-green-900">{state.message}</p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-full bg-green-700 px-8 py-3.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Saving…" : editing ? "Save changes" : "Save and add photos"}
      </button>
    </form>
  );
}
