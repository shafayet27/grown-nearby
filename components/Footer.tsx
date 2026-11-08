import Link from "next/link";
import { categories } from "@/lib/shop";

const col = "space-y-2 text-sm";
const link = "hover:underline";

export default function Footer() {
  return (
    <footer className="mt-16">
      <div className="bg-green-100 px-4 py-8 text-center">
        <p className="mx-auto max-w-3xl text-lg font-semibold text-green-900">
          Real food from real neighbours in Birmingham.
        </p>
      </div>

      <div className="bg-green-900 text-green-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="mb-3 font-bold">Shop</h2>
            <ul className={col}>
              {categories.map((c) => (
                <li key={c}>
                  <Link href={`/?cat=${encodeURIComponent(c)}`} className={link}>{c}</Link>
                </li>
              ))}
              <li><Link href="/?organic=1" className={link}>Certified organic</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-bold">Sell</h2>
            <ul className={col}>
              <li><Link href="/coming-soon" className={link}>Sell on Grown Nearby</Link></li>
              <li><Link href="/coming-soon" className={link}>Seller guide</Link></li>
              <li><Link href="/coming-soon" className={link}>Delivery and collection</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-bold">About</h2>
            <ul className={col}>
              <li><Link href="/coming-soon" className={link}>Our story</Link></li>
              <li><Link href="/coming-soon" className={link}>Food safety</Link></li>
              <li><Link href="/coming-soon" className={link}>Where we deliver</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 font-bold">Help</h2>
            <ul className={col}>
              <li><Link href="/coming-soon" className={link}>Help centre</Link></li>
              <li><Link href="/coming-soon" className={link}>Contact us</Link></li>
              <li><Link href="/coming-soon" className={link}>Orders and returns</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-green-50/20">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
            <span className="rounded-full bg-green-50/10 px-3 py-1">Birmingham, United Kingdom</span>
            <span>© 2026 Grown Nearby (early testing, sample sellers only)</span>
            <span className="flex gap-4">
              <Link href="/coming-soon" className={link}>Terms</Link>
              <Link href="/coming-soon" className={link}>Privacy</Link>
              <Link href="/coming-soon" className={link}>Cookies</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
