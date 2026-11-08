import Link from "next/link";

export default function ComingSoon() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold text-green-900">Coming soon</h1>
      <p className="mt-3 text-green-900/80">
        This part of Grown Nearby is still being built. Sign-in, selling and baskets arrive in the next stages.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
      >
        Back to listings
      </Link>
    </main>
  );
}
