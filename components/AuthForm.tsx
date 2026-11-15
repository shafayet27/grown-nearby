"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";

const field =
  "w-full rounded-xl border-2 border-green-200 bg-white px-4 py-3 text-base focus:border-green-600 focus:outline-none";

type Mode = "login" | "signup" | "seller";

const copy: Record<Mode, { title: string; intro: string; button: string }> = {
  login: { title: "Sign in", intro: "Welcome back to Grown Nearby.", button: "Sign in" },
  signup: {
    title: "Create your account",
    intro: "Buy home-grown food from Birmingham sellers.",
    button: "Create account",
  },
  seller: {
    title: "Create your seller account",
    intro: "You’ll set up your shop in the next steps.",
    button: "Create account and continue",
  },
};

export default function AuthForm({ mode }: { mode: Mode }) {
  const isLogin = mode === "login";
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(isLogin ? signIn : signUp, {});
  const c = copy[mode];

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      {mode === "seller" && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-green-700">Step 1 of 5</p>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i === 0 ? "bg-green-700" : "bg-green-100"}`} />
            ))}
          </div>
        </div>
      )}

      <h1 className="text-3xl font-extrabold text-green-900">{c.title}</h1>
      <p className="mt-2 text-green-900/80">{c.intro}</p>

      <form action={formAction} className="mt-6 space-y-4">
        {!isLogin && (
          <div>
            <label htmlFor="name" className="mb-1 block font-semibold">
              {mode === "seller" ? "Your full name" : "Your name"}
            </label>
            <input id="name" name="name" autoComplete="name" required maxLength={80} className={field} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block font-semibold">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={field} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block font-semibold">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 8}
            required
            className={field}
          />
          {!isLogin && <p className="mt-1 text-sm text-green-900/70">At least 8 characters.</p>}
        </div>

        <input type="hidden" name="role" value={mode === "seller" ? "seller" : "buyer"} />
        {isLogin && next && <input type="hidden" name="next" value={next} />}

        {state.error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
        )}
        {state.message && (
          <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">{state.message}</p>
        )}

        <button
          disabled={pending}
          className="w-full rounded-full bg-green-700 px-5 py-3.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {pending ? "Please wait…" : c.button}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm">
        {mode === "login" && (
          <>
            <p>New here? <Link href="/signup" className="font-semibold text-green-700 underline">Create an account</Link></p>
            <p>Want to sell? <Link href="/sell" className="font-semibold text-green-700 underline">Open a shop</Link></p>
          </>
        )}
        {mode === "signup" && (
          <>
            <p>Already have an account? <Link href="/login" className="font-semibold text-green-700 underline">Sign in</Link></p>
            <p>Want to sell your food? <Link href="/sell" className="font-semibold text-green-700 underline">Open a shop</Link></p>
          </>
        )}
        {mode === "seller" && (
          <p>
            Already have an account?{" "}
            <Link href="/login?next=/sell/setup" className="font-semibold text-green-700 underline">Sign in</Link>
          </p>
        )}
      </div>
    </main>
  );
}
