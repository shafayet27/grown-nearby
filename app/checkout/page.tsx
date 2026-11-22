import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import CheckoutForm from "@/components/CheckoutForm";
import { stripeTestMode } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout – Grown Nearby" };

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-green-900/70">Loading…</p>
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

async function CheckoutContent() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>
          Please <Link href="/login?next=/checkout" className="font-semibold text-green-700 underline">sign in</Link> or{" "}
          <Link href="/signup" className="font-semibold text-green-700 underline">create an account</Link> to check out.
          Your basket will still be here.
        </p>
      </main>
    );
  }

  const name = (claims as { user_metadata?: { full_name?: string } }).user_metadata?.full_name ?? "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-extrabold text-green-900">Checkout</h1>
      <CheckoutForm defaultName={name} testMode={stripeTestMode()} />
    </main>
  );
}
