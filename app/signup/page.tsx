import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create an account – Grown Nearby" };

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16"><p>Loading…</p></main>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
