import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import SellerWizard from "@/components/SellerWizard";

export const metadata: Metadata = { title: "Open your shop – Grown Nearby" };

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-green-900/70">Loading…</p>
        </main>
      }
    >
      <SetupContent />
    </Suspense>
  );
}

async function SetupContent() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p>
          Please <Link href="/login?next=/sell/setup" className="font-semibold text-green-700 underline">sign in</Link> or{" "}
          <Link href="/sell/signup" className="font-semibold text-green-700 underline">create a seller account</Link> first.
        </p>
      </main>
    );
  }

  const { data: shop } = await supabase.from("shops").select("id,name").eq("owner_id", userId).maybeSingle();

  if (shop) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-green-900">You already have a shop</h1>
        <p className="mt-2">{shop.name} is set up.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
        >
          Go to my shop
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <SellerWizard />
    </main>
  );
}
