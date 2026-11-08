"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

type Slide = { url?: string; tint: string };

const tints = ["bg-green-50", "bg-green-100", "bg-emerald-50"];

export default function Gallery({
  images,
  emoji,
  title,
}: {
  images: string[];
  emoji: string;
  title: string;
}) {
  // With no photos yet, show three placeholder tiles so the gallery layout can be tested
  const slides: Slide[] = images.length
    ? images.map((url, i) => ({ url, tint: tints[i % 3] }))
    : tints.map((tint) => ({ tint }));

  const [active, setActive] = useState(0);
  const current = Math.min(active, slides.length - 1);

  const show = (s: Slide, big: boolean) =>
    s.url ? (
      <img src={s.url} alt={title} loading={big ? "eager" : "lazy"} className="h-full w-full object-cover" />
    ) : (
      <span className={big ? "text-9xl" : "text-3xl"}>{emoji}</span>
    );

  return (
    <div>
      {/* Mobile: full-width swipeable photos with dots */}
      <div className="-mx-4 md:hidden">
        <div
          onScroll={(e) => {
            const el = e.currentTarget;
            setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {slides.map((s, i) => (
            <div key={i} className={`grid aspect-square min-w-full snap-center place-items-center ${s.tint}`}>
              {show(s, i === 0)}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
          {slides.map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i === current ? "bg-green-700" : "bg-green-200"}`} />
          ))}
        </div>
      </div>

      {/* Desktop: thumbnails on the left, large photo on the right */}
      <div className="hidden gap-3 md:flex">
        <div className="flex w-16 shrink-0 flex-col gap-2">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === current}
              className={`grid aspect-square place-items-center overflow-hidden rounded-lg border-2 ${s.tint} ${
                i === current ? "border-green-700" : "border-transparent"
              }`}
            >
              {show(s, false)}
            </button>
          ))}
        </div>
        <div
          className={`grid aspect-square flex-1 place-items-center overflow-hidden rounded-2xl ${slides[current].tint}`}
        >
          {show(slides[current], true)}
        </div>
      </div>
    </div>
  );
}
