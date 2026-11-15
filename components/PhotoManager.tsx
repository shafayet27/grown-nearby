"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/auth/client";
import { deleteListingPhoto, saveListingPhoto } from "@/app/dashboard/listings/actions";

const BUCKET = "listing-photos";
const MAX_PHOTOS = 6;
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;

type Photo = { id: number; url: string; position: number };

// Phone photos are huge. Shrink them in the browser before uploading, so
// uploads are fast on mobile data and pages load quickly for buyers.
async function shrink(file: File): Promise<Blob> {
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

export default function PhotoManager({
  listingId,
  userId,
  photos,
}: {
  listingId: string;
  userId: string;
  photos: Photo[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const sorted = [...photos].sort((a, b) => a.position - b.position);
  const room = MAX_PHOTOS - sorted.length;

  async function onPick(files: FileList | null) {
    setError("");
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, room);
    const skipped = files.length - chosen.length;

    setBusy(true);
    const supabase = createClient();
    let problem = skipped > 0 ? `Only ${MAX_PHOTOS} photos fit, so ${skipped} weren’t added.` : "";

    for (const file of chosen) {
      if (!file.type.startsWith("image/")) {
        problem = "Please choose image files only.";
        continue;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        problem = "One photo was too large (over 20 MB).";
        continue;
      }
      try {
        const blob = await shrink(file);
        const path = `${userId}/${listingId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) {
          problem = "A photo couldn’t be uploaded. Please try again.";
          continue;
        }
        const res = await saveListingPhoto(listingId, path);
        if (res.error) problem = res.error;
      } catch {
        problem = "We couldn’t read one of those photos. Try a JPEG or PNG.";
      }
    }

    setBusy(false);
    setError(problem);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  function remove(id: number) {
    setError("");
    startTransition(async () => {
      const res = await deleteListingPhoto(id);
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div>
      {sorted.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((p, i) => (
            <li key={p.id} className="relative overflow-hidden rounded-2xl border border-green-100 bg-green-50">
              <img src={p.url} alt={`Photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  Main photo
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending || busy}
                aria-label={`Delete photo ${i + 1}`}
                className="absolute right-2 top-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-red-700 shadow hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {room > 0 ? (
        <div className={sorted.length > 0 ? "mt-4" : ""}>
          <label
            htmlFor="photos"
            className={`block cursor-pointer rounded-2xl border-2 border-dashed border-green-300 p-6 text-center hover:bg-green-50 ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            <span className="block font-semibold text-green-800">
              {busy ? "Uploading…" : sorted.length === 0 ? "Add photos" : "Add more photos"}
            </span>
            <span className="mt-1 block text-sm text-green-900/70">
              Tap to choose or take photos. Up to {room} more. The first one is the main photo.
            </span>
          </label>
          <input
            ref={input}
            id="photos"
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(e) => onPick(e.target.files)}
            className="sr-only"
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-green-900/70">You’ve added the maximum of {MAX_PHOTOS} photos.</p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}
    </div>
  );
}
