import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import { ORDER_SELECT, type OrderRow } from "@/lib/orders";
import OrderCard from "@/components/OrderCard";

export const metadata: Metadata = { title: "Shop orders – Grown Nearby" };

export default function ShopOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-green-900/70">Loading orders…</p>
        </main>
      }
    >
      <ShopOrdersContent />
    </Suspense>
  );
}

async function ShopOrdersContent() {
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>
          Please <Link href="/login?next=/dashboard/orders" className="font-semibold text-green-700 underline">sign in</Link>.
        </p>
      </main>
    );
  }

  const { data: shop } = await supabase.from("shops").select("id,name").eq("owner_id", userId).maybeSingle();
  if (!shop) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-green-900">Shop orders</h1>
        <p className="mt-2">You don’t have a shop yet.</p>
        <Link href="/sell/setup" className="mt-6 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">
          Open my shop
        </Link>
      </main>
    );
  }

  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];
  const active = orders.filter((o) => ["placed", "confirmed", "ready"].includes(o.status));
  const past = orders.filter((o) => !["placed", "confirmed", "ready"].includes(o.status));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="text-green-700 underline">← Back to my shop</Link>
      <h1 className="mt-4 text-3xl font-extrabold text-green-900">Shop orders</h1>

      {orders.length === 0 && (
        <p className="mt-6 rounded-2xl bg-green-50 p-6">No orders yet. They’ll appear here when someone buys from {shop.name}.</p>
      )}

      {active.length > 0 && (
        <section className="mt-6 space-y-5">
          <h2 className="text-xl font-bold">To do ({active.length})</h2>
          {active.map((o) => (
            <OrderCard key={o.id} order={o} role="seller" />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-10 space-y-5">
          <h2 className="text-xl font-bold">Finished</h2>
          {past.map((o) => (
            <OrderCard key={o.id} order={o} role="seller" />
          ))}
        </section>
      )}
    </main>
  );
}
