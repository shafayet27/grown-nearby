import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import ReviewForm, { type PendingListing } from "@/components/ReviewForm";

export const metadata: Metadata = { title: "Review listings – Grown Nearby" };

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-green-900/70">Loading…</p>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>
          Please <Link href="/login?next=/admin" className="font-semibold text-green-700 underline">sign in</Link>.
        </p>
      </main>
    );
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-green-900">No access</h1>
        <p className="mt-2">This page is for the Grown Nearby team.</p>
      </main>
    );
  }

  const { data } = await supabase
    .from("listings")
    .select(
      "id,title,description,category,price_pence,unit,allergens,is_perishable,is_organic,organic_cert_ref,shops(name,area),listing_images(url,position)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const pending = (data ?? []) as unknown as PendingListing[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold text-green-900">Review listings</h1>
      <p className="mt-1 text-green-900/70">
        {pending.length === 0 ? "Nothing waiting. All caught up." : `${pending.length} waiting, oldest first.`}
      </p>
      <div className="mt-6 space-y-5">
        {pending.map((l) => (
          <ReviewForm key={l.id} l={l} />
        ))}
      </div>
    </main>
  );
}
