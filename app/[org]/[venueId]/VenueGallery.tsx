"use client";

import { useRef, useState } from "react";

// Galería deslizable (scroll-snap nativo, sin librería) con contador "1/5" y puntos — la tarjeta de
// Booking.com usa una grilla de miniaturas pensada para desktop; en móvil un carrusel de una foto a
// la vez con swipe es más natural y no compite en ancho con el resto del contenido.
export function VenueGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(i);
  }

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex h-48 snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- fotos externas arbitrarias pegadas por el admin
          <img
            key={src + i}
            src={src}
            alt={`${alt} — foto ${i + 1}`}
            className="h-48 w-full flex-shrink-0 snap-start object-cover"
          />
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            {index + 1}/{photos.length}
          </span>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
