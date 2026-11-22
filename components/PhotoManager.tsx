"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteListingPhoto } from "@/app/dashboard/listings/actions";
import { MAX_PHOTOS, checkFile, uploadPhotos } from "@/lib/photos";

type Photo = { id: number; url: string; position: number };

// Manages the photos of a listing that already exists
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
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const sorted = [...photos].sort((a, b) => a.position - b.position);
  const room = MAX_PHOTOS - sorted.length;
  const busy = progress !== "";

  async function onPick(files: FileList | null) {
    setError("");
    if (!files || files.length === 0) return;

    let problem = "";
    const usable = Array.from(files).filter((f) => {
      const msg = checkFile(f);
      if (msg) problem = msg;
      return !msg;
    });
    const chosen = usable.slice(0, room);
    if (usable.length > chosen.length) problem = `Only ${MAX_PHOTOS} photos fit, so some weren’t added.`;

    if (chosen.length > 0) {
      setProgress("Uploading…");
      const failed = await uploadPhotos(chosen, listingId, userId, (done, total) =>
        setProgress(`Uploading photo ${Math.min(done + 1, total)} of ${total}…`)
      );
      if (failed) problem = failed;
      setProgress("");
    }

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
              {busy ? progress : sorted.length === 0 ? "Add photos" : "Add more photos"}
            </span>
            <span className="mt-1 block text-sm text-green-900/70">
              Tap to choose or take photos. You can pick several at once, up to {room} more.
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
