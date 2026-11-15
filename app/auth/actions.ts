"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";

export type AuthState = { error?: string; message?: string };

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

// Only allow sending people to pages on our own site
function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const s = String(value ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // The role only decides where we send the person next. It is not a permission:
  // what really makes someone a seller is having a shop.
  const role = formData.get("role") === "seller" ? "seller" : "buyer";

  if (name.length < 2 || name.length > 80) return { error: "Please enter your name." };
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role } },
  });
  if (error) return { error: error.message };

  // If email confirmation is switched on in Supabase, there is no session yet
  if (!data.session) {
    return {
      message:
        role === "seller"
          ? "Account created. Check your email to confirm it, then sign in to open your shop."
          : "Account created. Check your email to confirm it, then sign in.",
    };
  }
  redirect(role === "seller" ? "/sell/setup" : "/");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!emailOk(email) || !password) return { error: "Please enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password don’t match. Please try again." };

  redirect(safeNext(formData.get("next"), "/dashboard"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
