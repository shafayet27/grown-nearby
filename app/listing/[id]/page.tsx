import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CARD_SELECT,
  availableOptions,
  categoryEmoji,
  describeOption,
  pounds,
  type DeliveryOption,
} from "@/lib/shop";
import Gallery from "@/components/Gallery";
import AddToBasket from "@/components/AddToBasket";
import ListingCard, { type CardListing } from "@/components/ListingCard";

type Listing = {
  id: string;
  shop_id: string;
  title: string;
  description: string | null;
  category: string;
  price_pence: number;
  unit: string;
  is_organic: boolean;
  organic_verified: boolean;
  organic_cert_ref: string | null;
  is_perishable: boolean;
  allergens: string | null;
  shops: { name: string; description: string | null; delivery_options: DeliveryOption[] };
  listing_images: { url: string; position: number }[];
};

type Params = Promise<{ id: string }>;

export default function ListingPage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-10">
          <p className="text-green-900/70">Loading…</p>
        </main>
      }
    >
      <ListingContent params={params} />
    </Suspense>
  );
}

async function ListingContent({ params }: { params: Params }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("listings")
    .select(
      "id,shop_id,title,description,category,price_pence,unit,is_organic,organic_verified,organic_cert_ref,is_perishable,allergens," +
        "shops(name,description,delivery_options(id,method,fee_pence,courier,notes)),listing_images(url,position)"
    )
    .eq("id", id)
    .eq("active", true)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !data) notFound();
  const l = data as unknown as Listing;

  const allOptions = l.shops.delivery_options ?? [];
  const options = availableOptions(allOptions, l.is_perishable);
  const courierHidden = l.is_perishable && allOptions.some((o) => o.method === "courier");
  const images = [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position).map((i) => i.url);

  const { data: moreData } = await supabase
    .from("listings")
    .select(CARD_SELECT)
    .eq("shop_id", l.shop_id)
    .neq("id", l.id)
    .eq("active", true)
    .eq("status", "approved")
    .limit(4);
  const more = (moreData ?? []) as unknown as CardListing[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-4 md:py-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-green-900/70">
        <Link href="/" className="hover:underline">Home</Link>
        {" / "}
        <Link href={`/?cat=${encodeURIComponent(l.category)}`} className="hover:underline">{l.category}</Link>
      </nav>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-10">
        {/* 1. Photos */}
        <div className="md:col-start-1 md:row-start-1">
          <Gallery images={images} emoji={categoryEmoji[l.category] ?? "🧺"} title={l.title} />
        </div>

        {/* 2. Buy box: under the photos on mobile, sticky on the right on desktop */}
        <section className="space-y-4 md:col-start-2 md:row-span-2 md:row-start-1 md:sticky md:top-32 md:self-start">
          <p className="text-sm font-medium text-green-700">{l.shops.name}</p>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">{l.title}</h1>
          <p className="text-3xl font-extrabold">
            {pounds(l.price_pence)}{" "}
            <span className="text-base font-normal text-green-900/70">{l.unit}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            {l.organic_verified && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                Certified organic
              </span>
            )}
            {l.is_perishable && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                Fresh food
              </span>
            )}
          </div>

          <div>
            <h2 className="font-bold">How you can get it</h2>
            <ul className="mt-2 divide-y divide-green-100 rounded-xl border border-green-100">
              {options.length === 0 && <li className="p-3 text-sm">This seller hasn’t set up delivery yet.</li>}
              {options.map((o) => {
                const d = describeOption(o);
                return (
                  <li key={o.id} className="flex items-start justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-semibold">{d.title}</p>
                      {o.notes && <p className="text-xs text-green-900/70">{o.notes}</p>}
                    </div>
                    <p className="text-sm font-semibold text-green-700">{d.fee}</p>
                  </li>
                );
              })}
            </ul>
            {courierHidden && (
              <p className="mt-2 text-xs text-green-900/70">
                Courier delivery isn’t offered for this item because it’s fresh food.
              </p>
            )}
          </div>

          <AddToBasket listingId={l.id} />
        </section>

        {/* 3. Details */}
        <div className="space-y-8 md:col-start-1 md:row-start-2">
          <section>
            <h2 className="text-xl font-bold">About this item</h2>
            {l.description && <p className="mt-2">{l.description}</p>}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="font-semibold">Category</dt>
              <dd>{l.category}</dd>
              <dt className="font-semibold">Allergens</dt>
              <dd>{l.allergens || "Not provided"}</dd>
              <dt className="font-semibold">Storage</dt>
              <dd>{l.is_perishable ? "Fresh. Keep cool and use soon." : "Ambient. Store in a cool, dry place."}</dd>
              {l.organic_verified && (
                <>
                  <dt className="font-semibold">Organic</dt>
                  <dd>Certificate on file{l.organic_cert_ref ? ` (${l.organic_cert_ref})` : ""}</dd>
                </>
              )}
            </dl>
          </section>

          <section>
            <h2 className="text-xl font-bold">Reviews</h2>
            <p className="mt-2 text-sm text-green-900/70">No reviews yet. Reviews arrive in a later stage.</p>
          </section>

          <section className="rounded-2xl bg-green-50 p-5">
            <h2 className="text-xl font-bold">Meet the seller</h2>
            <p className="mt-1 font-semibold text-green-700">{l.shops.name}</p>
            {l.shops.description && <p className="mt-1 text-sm">{l.shops.description}</p>}
          </section>
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold">More from {l.shops.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {more.map((m) => (
              <ListingCard key={m.id} l={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
