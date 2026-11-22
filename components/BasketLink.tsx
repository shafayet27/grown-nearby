"use client";

import Link from "next/link";
import { BagIcon } from "./icons";
import { basketCount, useBasket } from "@/lib/basket";

export default function BasketLink({ className }: { className: string }) {
  const count = basketCount(useBasket());
  return (
    <Link
      href="/basket"
      aria-label={count > 0 ? `Basket, ${count} item${count === 1 ? "" : "s"}` : "Basket"}
      className={`${className} relative`}
    >
      <BagIcon />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-green-700 px-1 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
