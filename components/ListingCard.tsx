/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { categoryEmoji, deliveryLabels, pounds } from "@/lib/shop";
import { HeartIcon } from "./icons";

export type CardListing = {
  id: string;
  title: string;
  category: string;
  price_pence: number;
  unit: string;
  is_organic: boolean;
  is_perishable: boolean;
  shops: { name: string; delivery_options: { method: string }[] };
  listing_images: { url: string; position: number }[];
};

export default function ListingCard({ l }: { l: CardListing }) {
  const first = [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position)[0];
  const labels = deliveryLabels(l.shops?.delivery_options ?? [], l.is_perishable);

  return (
    <div className="group relative">
      <Link href={`/listing/${l.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-green-50">
          {first ? (
            <img src={first.url} alt={l.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-7xl">{categoryEmoji[l.category] ?? "🧺"}</div>
          )}
          {l.is_organic && (
            <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              Certified organic
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{l.title}</h3>
        <p className="text-xs text-green-900/70">{l.shops?.name}</p>
        <p className="mt-0.5 font-bold">
          {pounds(l.price_pence)} <span className="text-xs font-normal text-green-900/70">{l.unit}</span>
        </p>
        {labels.length > 0 && <p className="text-xs font-semibold text-green-700">{labels.join(" · ")}</p>}
      </Link>
      <button
        type="button"
        aria-label="Save to favourites (coming soon)"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-green-900 shadow hover:scale-105"
      >
        <HeartIcon />
      </button>
    </div>
  );
}
