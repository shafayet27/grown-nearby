import Link from "next/link";
import { categories } from "@/lib/shop";
import { BagIcon, HeartIcon, SearchIcon, UserIcon } from "./icons";

const iconLink =
  "grid h-10 w-10 place-items-center rounded-full text-green-900 hover:bg-green-50";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_#dcfce7]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-green-700">
          Grown Nearby
        </Link>

        <form
          action="/"
          role="search"
          className="order-last flex w-full items-center rounded-full border-2 border-green-700/30 bg-white focus-within:border-green-700 md:order-none md:w-auto md:flex-1"
        >
          <input
            name="q"
            aria-label="Search listings"
            placeholder="Search for eggs, honey, veg…"
            className="min-w-0 flex-1 bg-transparent px-5 py-2.5 outline-none"
          />
          <button
            aria-label="Search"
            className="m-1 grid h-9 w-9 place-items-center rounded-full bg-green-700 text-white hover:bg-green-800"
          >
            <SearchIcon />
          </button>
        </form>

        <nav className="ml-auto flex items-center gap-1 md:ml-0" aria-label="Account">
          <Link href="/coming-soon" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-green-50 lg:block">
            Sell on Grown Nearby
          </Link>
          <Link href="/coming-soon" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-green-50 md:block">
            Sign in
          </Link>
          <Link href="/coming-soon" aria-label="Favourites" className={iconLink}>
            <HeartIcon />
          </Link>
          <Link href="/coming-soon" aria-label="Sign in" className={`${iconLink} md:hidden`}>
            <UserIcon />
          </Link>
          <Link href="/coming-soon" aria-label="Basket" className={iconLink}>
            <BagIcon />
          </Link>
        </nav>
      </div>

      <nav aria-label="Categories" className="border-t border-green-100">
        <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 md:justify-center">
          {categories.map((c) => (
            <li key={c} className="shrink-0">
              <Link
                href={`/?cat=${encodeURIComponent(c)}`}
                className="block border-b-2 border-transparent px-3 py-2.5 text-sm font-medium hover:border-green-700"
              >
                {c}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
