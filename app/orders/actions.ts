"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Used by both buyers (cancel) and sellers (confirm, ready, complete, cancel).
// The database decides who may make which change.
export async function setOrderStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  await supabase.rpc("set_order_status", { p_order: id, p_status: status });

  revalidatePath("/orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}
