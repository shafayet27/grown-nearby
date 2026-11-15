"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";
import { categories } from "@/lib/shop";
import { ALLERGENS, UNITS, buildAllergenText } from "@/lib/listing";

export type ListingState = { error?: string; message?: string };
export type PhotoResult = { error?: string };

const BUCKET = "listing-photos";
const MAX_PHOTOS = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

type Values = {
  title: string;
  description: string | null;
  category: string;
  price_pence: number;
  unit: string;
  is_perishable: boolean;
  allergens: string;
  is_organic: boolean;
  organic_cert_ref: string | null;
};

function parse(fd: FormData): { error: string } | { values: Values } {
  const title = text(fd, "title");
  if (title.length < 3 || title.length > 80) return { error: "The title needs to be 3 to 80 characters." };

  const description = text(fd, "description");
  if (description.length > 1000) return { error: "Please keep the description under 1000 characters." };

  const category = text(fd, "category");
  if (!categories.includes(category)) return { error: "Please choose a category." };

  const price = Math.round(parseFloat(text(fd, "price")) * 100);
  if (!Number.isFinite(price) || price < 10 || price > 50000) {
    return { error: "Please enter a price between £0.10 and £500." };
  }

  const unit = text(fd, "unit");
  if (!UNITS.includes(unit)) return { error: "Please choose what the price is for (for example per dozen)." };

  const perishable = text(fd, "perishable");
  if (perishable !== "fresh" && perishable !== "keeps") {
    return { error: "Please say whether this item is fresh or keeps without refrigeration." };
  }

  const none = Boolean(fd.get("no_allergens"));
  const selected = fd.getAll("allergen").map(String).filter((a) => ALLERGENS.includes(a));
  if (none && selected.length > 0) return { error: "Please either tick “None” or choose allergens, not both." };
  if (!none && selected.length === 0) {
    return { error: "Please choose the allergens in this item, or tick “None of the 14 main allergens”." };
  }
  const notes = text(fd, "allergen_notes");
  if (notes.length > 200) return { error: "Please keep the extra allergen notes under 200 characters." };

  const organic = Boolean(fd.get("is_organic"));
  const cert = text(fd, "organic_cert_ref");
  if (organic && cert.length < 3) return { error: "Please enter your organic certificate number." };
  if (cert.length > 60) return { error: "The certificate number is too long." };

  return {
    values: {
      title,
      description: description || null,
      category,
      price_pence: price,
      unit,
      is_perishable: perishable === "fresh",
      allergens: buildAllergenText(selected, none, notes),
      is_organic: organic,
      organic_cert_ref: organic ? cert : null,
    },
  };
}

export async function createListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Please sign in first." };

  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  if (!shop) return { error: "Please open your shop first." };

  const { data: row, error } = await supabase
    .from("listings")
    .insert({ shop_id: shop.id, ...parsed.values })
    .select("id")
    .single();

  if (error || !row) return { error: "We couldn’t save your listing. Please try again." };

  revalidatePath("/dashboard");
  redirect(`/dashboard/listings/${row.id}?new=1`);
}

export async function updateListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Please sign in first." };

  const id = text(formData, "id");
  if (!UUID.test(id)) return { error: "That listing couldn’t be found." };

  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data: rows, error } = await supabase.from("listings").update(parsed.values).eq("id", id).select("id");
  if (error) return { error: "We couldn’t save your changes. Please try again." };
  if (!rows || rows.length === 0) return { error: "That listing couldn’t be found." };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/listings/${id}`);
  return { message: "Saved. If you changed the title, description, category, allergens or organic details, the listing will be checked again before it shows." };
}

export async function setListingActive(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = text(formData, "id");
  if (!UUID.test(id)) return;
  const active = text(formData, "active") === "1";
  await supabase.from("listings").update({ active }).eq("id", id);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/listings/${id}`);
}

export async function deleteListing(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = text(formData, "id");
  if (!UUID.test(id)) return;

  // Remember the photo files so they can be removed from storage too
  const { data: images } = await supabase.from("listing_images").select("url").eq("listing_id", id);
  const marker = `/object/public/${BUCKET}/`;
  const paths = (images ?? [])
    .map((i) => {
      const at = i.url.indexOf(marker);
      return at >= 0 ? i.url.slice(at + marker.length) : null;
    })
    .filter((p): p is string => Boolean(p));

  const { data: deleted } = await supabase.from("listings").delete().eq("id", id).select("id");
  if (deleted && deleted.length > 0 && paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Called after the browser has uploaded a (resized) photo to storage
export async function saveListingPhoto(listingId: string, path: string): Promise<PhotoResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Please sign in first." };
  if (!UUID.test(listingId)) return { error: "That listing couldn’t be found." };
  if (!path.startsWith(`${userId}/${listingId}/`) || path.includes("..")) return { error: "That photo couldn’t be saved." };

  const { data: existing } = await supabase
    .from("listing_images")
    .select("position")
    .eq("listing_id", listingId)
    .order("position", { ascending: false });
  const count = existing?.length ?? 0;
  if (count >= MAX_PHOTOS) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `You can add up to ${MAX_PHOTOS} photos.` };
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  const position = count > 0 ? (existing![0].position as number) + 1 : 0;

  const { error } = await supabase.from("listing_images").insert({ listing_id: listingId, url, position });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "We couldn’t save that photo. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/listings/${listingId}`);
  return {};
}

export async function deleteListingPhoto(imageId: number): Promise<PhotoResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Please sign in first." };
  if (!Number.isInteger(imageId)) return { error: "That photo couldn’t be found." };

  // The database rules only allow the shop owner to delete, so an empty result means "not yours"
  const { data: removed } = await supabase.from("listing_images").delete().eq("id", imageId).select("listing_id,url");
  if (!removed || removed.length === 0) return { error: "That photo couldn’t be found." };

  const marker = `/object/public/${BUCKET}/`;
  const at = removed[0].url.indexOf(marker);
  if (at >= 0) await supabase.storage.from(BUCKET).remove([removed[0].url.slice(at + marker.length)]);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/listings/${removed[0].listing_id}`);
  return {};
}
