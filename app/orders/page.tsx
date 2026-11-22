import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import { ORDER_SELECT, type OrderRow } from "@/lib/orders";
import OrderCard from "@/components/OrderCard";

export const metadata: Metadata = { title: "My orders – Grown Nearby" };

type SearchParams = Promise<{ placed?: string }>;

export default function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-green-900/70">Loading your orders…</p>
        </main>
      }
    >
      <OrdersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OrdersContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { placed } = await searchParams;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>
          Please <Link href="/login?next=/orders" className="font-semibold text-green-700 underline">sign in</Link> to see your orders.
        </p>
      </main>
    );
  }

  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold text-green-900">My orders</h1>

      {placed && (
        <p role="status" className="mt-4 rounded-xl bg-green-100 p-4 text-green-900">
          {Number(placed) > 1 ? `Your ${placed} orders have been placed.` : "Your order has been placed."} This was a test order, so no payment was taken. The seller will confirm it.
        </p>
      )}

      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-green-50 p-8 text-center">
          <p className="font-semibold">You haven’t placed any orders yet.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} role="buyer" />
          ))}
        </div>
      )}
    </main>
  );
}
