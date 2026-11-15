import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sell on Grown Nearby" };

const reasons = [
  {
    title: "Reach your neighbours",
    text: "Birmingham people looking for eggs, veg, honey and bakes made close to home.",
  },
  {
    title: "You choose how it gets there",
    text: "Offer collection, deliver it yourself, or post items that keep using Evri or DPD.",
  },
  {
    title: "Your address stays private",
    text: "Buyers only see your general area, never your full address.",
  },
];

const steps = [
  "Create your seller account",
  "Name your shop",
  "Add your location",
  "Choose how buyers get their food",
  "Review and open your shop",
];

export default function SellPage() {
  return (
    <main>
      <section className="bg-green-50">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold text-green-900 sm:text-6xl">
            Sell your home-grown food on Grown Nearby
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-green-900/80">
            Open a shop in a few minutes and start selling to people in Birmingham.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/sell/signup"
              className="w-full rounded-full bg-green-700 px-8 py-4 text-lg font-semibold text-white hover:bg-green-800 sm:w-auto"
            >
              Open your shop
            </Link>
            <p className="text-sm">
              Already have an account?{" "}
              <Link href="/login?next=/sell/setup" className="font-semibold text-green-700 underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Why sell here</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {reasons.map((r) => (
            <div key={r.title} className="rounded-2xl border border-green-100 p-6">
              <h3 className="text-lg font-bold text-green-800">{r.title}</h3>
              <p className="mt-2 text-green-900/80">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-green-50">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <ol className="mt-8 space-y-4">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-4 rounded-2xl bg-white p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-700 font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h2 className="text-xl font-bold">Before you start</h2>
        <p className="mt-2 text-green-900/80">
          Selling food means you need to be registered as a food business with your local council. If you
          haven’t registered yet, do it at least 28 days before you start trading. Grown Nearby is open to
          Birmingham sellers during our launch.
        </p>
        <Link
          href="/sell/signup"
          className="mt-6 inline-block w-full rounded-full bg-green-700 px-8 py-3.5 font-semibold text-white hover:bg-green-800 sm:w-auto"
        >
          Get started
        </Link>
      </section>
    </main>
  );
}
