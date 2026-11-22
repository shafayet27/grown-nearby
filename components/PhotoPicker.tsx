"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { MAX_PHOTOS, checkFile } from "@/lib/photos";

export type Staged = { file: File; url: string };

// Lets a seller choose photos on the "add a listing" page, before anything is saved
export default function PhotoPicker({
  items,
  onChange,
  disabled,
  error,
}: {
  items: Staged[];
  onChange: (items: Staged[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [note, setNote] = useState("");
  const room = MAX_PHOTOS - items.length;

  function add(list: FileList | null) {
    setNote("");
    if (!list || list.length === 0) return;

    let problem = "";
    const usable = Array.from(list).filter((f) => {
      const msg = checkFile(f);
      if (msg) problem = msg;
      return !msg;
    });
    const take = usable.slice(0, room);
    if (usable.length > take.length) problem = `Only ${MAX_PHOTOS} photos fit, so some weren’t added.`;
    setNote(problem);

    if (take.length > 0) {
      onChange([...items, ...take.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    }
  }

  function remove(i: number) {
    URL.revokeObjectURL(items[i].url);
    onChange(items.filter((_, n) => n !== i));
  }

  function makeMain(i: number) {
    onChange([items[i], ...items.filter((_, n) => n !== i)]);
  }

  return (
    <div>
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((p, i) => (
            <li key={p.url} className="relative overflow-hidden rounded-2xl border border-green-100 bg-green-50">
              <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  Main photo
                </span>
              )}
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-2">
                {i > 0 ? (
                  <button type="button" disabled={disabled} onClick={() => makeMain(i)} className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-green-800 shadow hover:bg-green-50 disabled:opacity-50">
                    Make main
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" disabled={disabled} onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`} className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-red-700 shadow hover:bg-red-50 disabled:opacity-50">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {room > 0 ? (
        <div className={items.length > 0 ? "mt-4" : ""}>
          <label
            htmlFor="staged-photos"
            className={`block cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center hover:bg-green-50 ${
              error ? "border-red-400" : "border-green-300"
            } ${disabled ? "pointer-events-none opacity-60" : ""}`}
          >
            <span className="block font-semibold text-green-800">
              {items.length === 0 ? "Add photos" : "Add more photos"}
            </span>
            <span className="mt-1 block text-sm text-green-900/70">
              Tap to choose or take photos. You can pick several at once, up to {room} more. The first is the main photo.
            </span>
          </label>
          <input
            id="staged-photos"
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-green-900/70">You’ve added the maximum of {MAX_PHOTOS} photos.</p>
      )}

      {(error || note) && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error || note}</p>
      )}
    </div>
  );
}
