import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import { statusChip } from "@/lib/listing";
import ListingForm, { type ListingDefaults } from "@/components/ListingForm";
import PhotoManager from "@/components/PhotoManager";
import ListingActions from "@/components/ListingActions";

export const metadata: Metadata = { title: "Edit listing – Grown Nearby" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ new?: string }>;

export default function EditListingPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-green-900/70">Loading…</p>
        </main>
      }
    >
      <EditContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Row = ListingDefaults & {
  status: string;
  active: boolean;
  review_note: string | null;
  organic_verified: boolean;
  listing_images: { id: number; url: string; position: number }[];
};

async function EditContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await connection();
  const { id } = await params;
  const { new: isNew } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p>
          Please <Link href="/login" className="font-semibold text-green-700 underline">sign in</Link>.
        </p>
      </main>
    );
  }

  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  if (!shop) notFound();

  const { data: row } = await supabase
    .from("listings")
    .select(
      "id,title,description,category,price_pence,unit,is_perishable,allergens,is_organic,organic_cert_ref,organic_verified,status,active,review_note,listing_images(id,url,position)"
    )
    .eq("id", id)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!row) notFound();

  const l = row as unknown as Row;
  const chip = statusChip(l);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="text-green-700 underline">← Back to my shop</Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-green-900">{l.title}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${chip.cls}`}>{chip.text}</span>
      </div>

      {isNew && (
        <p role="status" className="mt-4 rounded-xl bg-green-100 p-4 text-green-900">
          Listing saved. Add some photos below. Our team will check it, and it appears in the shop once approved.
        </p>
      )}
      {l.status === "pending" && !isNew && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">
          This listing is waiting for approval. It isn’t visible to buyers yet.
        </p>
      )}
      {l.status === "rejected" && (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">
          Not approved{l.review_note ? `: ${l.review_note}` : "."} Make the changes below and save to send it for another check.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">Photos</h2>
        <p className="mb-3 text-sm text-green-900/70">
          Good photos help food sell. Adding a photo to an approved listing sends it for a quick re-check.
        </p>
        <PhotoManager
          listingId={l.id}
          userId={userId}
          photos={(l.listing_images ?? []).map((p) => ({ id: p.id, url: p.url, position: p.position }))}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">Details</h2>
        <ListingForm listing={l} />
      </section>

      <section className="mt-10 border-t border-green-100 pt-8">
        <h2 className="mb-4 text-xl font-bold">Visibility</h2>
        <ListingActions id={l.id} active={l.active} canToggle={l.status === "approved"} />
      </section>
    </main>
  );
}
