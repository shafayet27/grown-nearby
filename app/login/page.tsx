import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in – Grown Nearby" };

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16"><p>Loading…</p></main>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
