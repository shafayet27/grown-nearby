import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import ListingForm from "@/components/ListingForm";

export const metadata: Metadata = { title: "Add a listing – Grown Nearby" };

export default function NewListingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-green-900/70">Loading…</p>
        </main>
      }
    >
      <NewListingContent />
    </Suspense>
  );
}

async function NewListingContent() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p>
          Please <Link href="/login?next=/dashboard/listings/new" className="font-semibold text-green-700 underline">sign in</Link>.
        </p>
      </main>
    );
  }

  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  if (!shop) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-green-900">Open your shop first</h1>
        <p className="mt-2">You need a shop before you can add listings.</p>
        <Link href="/sell/setup" className="mt-6 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">
          Open my shop
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="text-green-700 underline">← Back to my shop</Link>
      <h1 className="mt-4 text-3xl font-extrabold text-green-900">Add a listing</h1>
      <p className="mt-2 mb-8 text-green-900/80">
        Fill in the details first, then add photos. Our team checks every listing before it appears in the shop.
      </p>
      <ListingForm />
    </main>
  );
}
