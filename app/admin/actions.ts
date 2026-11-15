"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";

export type ReviewState = { error?: string; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reviewListing(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "You don’t have access to this." };

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const verified = Boolean(formData.get("organic_verified"));

  if (!UUID.test(id)) return { error: "That listing couldn’t be found." };
  if (decision !== "approve" && decision !== "reject") return { error: "Please choose approve or reject." };
  if (decision === "reject" && note.length < 3) {
    return { error: "Please add a short reason so the seller knows what to fix." };
  }

  const { error } = await supabase.rpc("review_listing", {
    p_listing: id,
    p_status: decision === "approve" ? "approved" : "rejected",
    p_note: note,
    p_organic_verified: verified,
  });
  if (error) return { error: "We couldn’t save that decision. Please try again." };

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { message: decision === "approve" ? "Approved." : "Rejected." };
}
