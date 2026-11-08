import Link from "next/link";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { CARD_SELECT, categories, categoryEmoji } from "@/lib/shop";
import ListingCard, { type CardListing } from "@/components/ListingCard";

type SearchParams = Promise<{ q?: string; cat?: string; organic?: string }>;

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-10">
          <p className="text-green-900/70">Loading listings…</p>
        </main>
      }
    >
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: { searchParams: SearchParams }) {
  const { q, cat, organic } = await searchParams;

  let query = supabase
    .from("listings")
    .select(CARD_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("title", `%${q.replace(/[%,]/g, "")}%`);
  if (cat && categories.includes(cat)) query = query.eq("category", cat);
  if (organic === "1") query = query.eq("is_organic", true);

  const { data, error } = await query;
  const listings = (data ?? []) as unknown as CardListing[];
  const filtered = Boolean(q || cat || organic);

  const toggleOrganic = () => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (cat) sp.set("cat", cat);
    if (organic !== "1") sp.set("organic", "1");
    const s = sp.toString();
    return s ? `/?${s}` : "/";
  };

  const heading = q ? `Results for “${q}”` : cat ? cat : "Fresh this week";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {!filtered && (
        <>
          <section className="rounded-3xl bg-green-50 px-6 py-8 sm:py-12">
            <h1 className="max-w-2xl text-3xl font-extrabold text-green-900 sm:text-5xl">
              Food grown a few streets away.
            </h1>
            <p className="mt-3 max-w-xl text-green-900/80 sm:text-lg">
              Buy eggs, veg, honey and bakes from Birmingham growers and home cooks.
            </p>
          </section>

          <ul className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2 md:justify-center">
            {categories.map((c) => (
              <li key={c} className="shrink-0">
                <Link
                  href={`/?cat=${encodeURIComponent(c)}`}
                  className="group flex w-24 flex-col items-center gap-2 text-center"
                >
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-green-50 text-4xl ring-2 ring-transparent group-hover:ring-green-600">
                    {categoryEmoji[c]}
                  </span>
                  <span className="text-sm font-medium">{c}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{heading}</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={toggleOrganic()}
            className={`rounded-full border px-4 py-1.5 font-medium ${
              organic === "1" ? "border-green-700 bg-green-700 text-white" : "border-green-200 hover:bg-green-50"
            }`}
          >
            Certified organic
          </Link>
          {filtered && (
            <Link href="/" className="rounded-full px-3 py-1.5 font-medium text-green-700 underline">
              Clear
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">Couldn’t load listings: {error.message}</p>
      )}

      <p className="mt-2 text-sm text-green-900/70">
        {listings.length} listing{listings.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
        {listings.map((l) => (
          <ListingCard key={l.id} l={l} />
        ))}
      </div>

      {!error && listings.length === 0 && (
        <p className="mt-6">No listings match. Try a different search or clear the filters.</p>
      )}
    </main>
  );
}
