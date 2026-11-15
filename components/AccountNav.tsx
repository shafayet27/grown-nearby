import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/auth/server";
import { signOut } from "@/app/auth/actions";
import { BagIcon, HeartIcon, UserIcon } from "./icons";

const iconLink = "grid h-10 w-10 place-items-center rounded-full text-green-900 hover:bg-green-50";
const textLink = "hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-green-50";

// Pure layout: used as the loading placeholder (signed out) and as the real thing
export function AccountLinks({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="ml-auto flex items-center gap-1 md:ml-0" aria-label="Account">
      <Link href={signedIn ? "/dashboard" : "/sell"} className={`${textLink} lg:block`}>
        {signedIn ? "My account" : "Sell on Grown Nearby"}
      </Link>
      {signedIn ? (
        <form action={signOut} className="hidden md:block">
          <button className="rounded-full px-3 py-2 text-sm font-medium hover:bg-green-50">Sign out</button>
        </form>
      ) : (
        <Link href="/login" className={`${textLink} md:block`}>Sign in</Link>
      )}
      <Link href="/coming-soon" aria-label="Favourites" className={iconLink}>
        <HeartIcon />
      </Link>
      <Link
        href={signedIn ? "/dashboard" : "/login"}
        aria-label={signedIn ? "My account" : "Sign in"}
        className={`${iconLink} md:hidden`}
      >
        <UserIcon />
      </Link>
      <Link href="/coming-soon" aria-label="Basket" className={iconLink}>
        <BagIcon />
      </Link>
    </nav>
  );
}

// Depends on who is visiting, so it must wait for the real request (and sit inside <Suspense>)
export async function AccountNav() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <AccountLinks signedIn={Boolean(data?.claims)} />;
}
