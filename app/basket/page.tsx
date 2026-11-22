import type { Metadata } from "next";
import BasketView from "@/components/BasketView";

export const metadata: Metadata = { title: "Your basket – Grown Nearby" };

export default function BasketPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-extrabold text-green-900">Your basket</h1>
      <BasketView />
    </main>
  );
}
