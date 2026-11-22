import { createClient } from "@/lib/auth/client";
import { saveListingPhoto } from "@/app/dashboard/listings/actions";

export const BUCKET = "listing-photos";
export const MAX_PHOTOS = 6;
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;

// Phone photos are huge. Shrink them in the browser before uploading, so
// uploads are fast on mobile data and pages load quickly for buyers.
export async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image."))), "image/jpeg", 0.85)
  );
}

// Returns a message if a chosen file can't be used, or "" if it's fine
export function checkFile(file: File): string {
  if (!file.type.startsWith("image/")) return "Please choose image files only.";
  if (file.size > MAX_ORIGINAL_BYTES) return "One photo was too large (over 20 MB).";
  return "";
}

// Uploads photos one after another. Returns a message if any failed, or "".
export async function uploadPhotos(
  files: File[],
  listingId: string,
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<string> {
  const supabase = createClient();
  let problem = "";
  let done = 0;

  for (const file of files) {
    onProgress?.(done, files.length);
    try {
      const blob = await shrink(file);
      const path = `${userId}/${listingId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) {
        problem = "A photo couldn’t be uploaded. Please try again.";
      } else {
        const res = await saveListingPhoto(listingId, path);
        if (res.error) problem = res.error;
      }
    } catch {
      problem = "We couldn’t read one of those photos. Try a JPEG or PNG.";
    }
    done += 1;
    onProgress?.(done, files.length);
  }
  return problem;
}
