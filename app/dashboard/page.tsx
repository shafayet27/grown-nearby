import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import { signOut } from "@/app/auth/actions";
import { categoryEmoji, describeOption, pounds, type DeliveryOption } from "@/lib/shop";
import { statusChip } from "@/lib/listing";
import AddressForm from "@/components/AddressForm";

export const metadata: Metadata = { title: "My account – Grown Nearby" };

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-green-900/70">Loading your account…</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

type Shop = {
  id: string;
  name: string;
  description: string | null;
  area: string;
  delivery_options: DeliveryOption[];
};

type ListingRow = {
  id: string;
  title: string;
  price_pence: number;
  unit: string;
  category: string;
  status: string;
  active: boolean;
  review_note: string | null;
  listing_images: { url: string; position: number }[];
};

async function DashboardContent() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  const email = claims?.email as string | undefined;
  const name = (claims as { user_metadata?: { full_name?: string } } | undefined)?.user_metadata?.full_name;

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>
          Please <Link href="/login" className="font-semibold text-green-700 underline">sign in</Link>.
        </p>
      </main>
    );
  }

  const { data: shopData } = await supabase
    .from("shops")
    .select("id,name,description,area,delivery_options(id,method,fee_pence,courier,notes)")
    .eq("owner_id", userId)
    .maybeSingle();
  const shop = shopData as unknown as Shop | null;

  const { data: priv } = shop
    ? await supabase.from("shop_private").select("address,postcode").eq("shop_id", shop.id).maybeSingle()
    : { data: null };

  const { data: listingData } = shop
    ? await supabase
        .from("listings")
        .select("id,title,price_pence,unit,category,status,active,review_note,listing_images(url,position)")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
    : { data: null };
  const myListings = (listingData ?? []) as unknown as ListingRow[];
  const { count: newOrders } = shop
    ? await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("status", "placed")
    : { count: 0 };
  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-green-900">{shop ? "My shop" : "My account"}</h1>
          <p className="text-sm text-green-900/70">
            {name ? `Hello, ${name}. ` : ""}
            {email ? `Signed in as ${email}` : ""}
          </p>
        </div>
        <form action={signOut}>
          <button className="rounded-full border-2 border-green-700 px-5 py-2 font-semibold text-green-700 hover:bg-green-50">
            Sign out
          </button>
        </form>
      </div>

      {isAdmin && (
        <p className="mt-4">
          <Link href="/admin" className="font-semibold text-green-700 underline">Review listings (admin)</Link>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {shop && (
          <Link
            href="/dashboard/orders"
            className="rounded-full bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800"
          >
            Shop orders{newOrders ? ` (${newOrders} new)` : ""}
          </Link>
        )}
        <Link
          href="/orders"
          className="rounded-full border-2 border-green-700 px-5 py-2 font-semibold text-green-700 hover:bg-green-50"
        >
          My orders
        </Link>
      </div>

      {!shop ? (
        <section className="mt-8 rounded-2xl bg-green-50 p-6">
          <h2 className="text-xl font-bold">Want to sell your food?</h2>
          <p className="mt-1">Open a shop in a few minutes and start selling to people in Birmingham.</p>
          <Link
            href="/sell/setup"
            className="mt-4 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
          >
            Open my shop
          </Link>
        </section>
      ) : (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-green-100 p-5">
            <h2 className="text-2xl font-bold text-green-800">{shop.name}</h2>
            <p className="text-sm text-green-900/70">Birmingham {shop.area}</p>
            {shop.description && <p className="mt-2">{shop.description}</p>}
          </section>

          <section className="rounded-2xl border border-green-100 p-5">
            <h2 className="text-lg font-bold">How buyers get your food</h2>
            <ul className="mt-3 divide-y divide-green-100">
              {(shop.delivery_options ?? []).map((o) => {
                const d = describeOption(o);
                return (
                  <li key={o.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="font-semibold">{d.title}</p>
                      {o.notes && <p className="text-sm text-green-900/70">{o.notes}</p>}
                    </div>
                    <p className="font-semibold text-green-700">{d.fee}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {priv && (
            <section className="rounded-2xl bg-green-50 p-5">
              <h2 className="text-lg font-bold">Your private address</h2>
              <p className="mt-1 break-words">{priv.address}, {priv.postcode}</p>
              <p className="mt-1 text-sm text-green-900/70">Only you can see this. Buyers see just “{shop.area}”.</p>
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold text-green-700 underline">Edit address</summary>
                <AddressForm
                  defaultAddress={priv.address.replace(/,\s*Birmingham$/i, "")}
                  defaultPostcode={priv.postcode}
                />
              </details>
            </section>
          )}

          <section className="rounded-2xl border border-green-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">My listings</h2>
              <Link
                href="/dashboard/listings/new"
                className="rounded-full bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800"
              >
                Add a listing
              </Link>
            </div>
            {myListings.length === 0 ? (
              <p className="mt-3 text-green-900/80">
                You haven’t added any listings yet. Add your first one, then our team will check it before it appears in the shop.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-green-100">
                {myListings.map((l) => {
                  const chip = statusChip(l);
                  const photo = [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position)[0];
                  return (
                    <li key={l.id}>
                      <Link href={`/dashboard/listings/${l.id}`} className="flex items-center gap-3 py-3 hover:bg-green-50 sm:gap-4">
                        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-green-50 text-3xl">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            categoryEmoji[l.category] ?? "🧺"
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{l.title}</span>
                          <span className="block text-sm text-green-900/70">{pounds(l.price_pence)} {l.unit}</span>
                          {l.status === "rejected" && l.review_note && (
                            <span className="block truncate text-sm text-red-700">{l.review_note}</span>
                          )}
                        </span>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${chip.cls}`}>{chip.text}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
