// Catálogo real de características por cancha (Venue.amenities) — reemplaza el texto fijo por TIPO
// que había antes en type-info.ts. El admin marca cuáles aplican a cada cancha desde el panel de
// edición; las páginas públicas leen esos slugs reales en vez de inventar servicios por tipo.
export const VENUE_AMENITIES = [
  { slug: "iluminacion_led", icon: "💡", label: "Iluminación LED" },
  { slug: "cerramiento", icon: "🧱", label: "Cerramiento" },
  { slug: "parqueadero", icon: "🅿️", label: "Parqueadero" },
  { slug: "duchas", icon: "🚿", label: "Duchas" },
  { slug: "bancas", icon: "🪑", label: "Bancas" },
  { slug: "cafeteria", icon: "☕", label: "Cafetería" },
] as const;

export const VENUE_AMENITY_LABEL: Record<string, string> = Object.fromEntries(
  VENUE_AMENITIES.map((a) => [a.slug, a.label]),
);

export const VENUE_AMENITY_ICON: Record<string, string> = Object.fromEntries(
  VENUE_AMENITIES.map((a) => [a.slug, a.icon]),
);

export const VENUE_SURFACE_OPTIONS = ["Césped sintético", "Césped natural", "Cemento", "Cristal"] as const;

export const VENUE_COVERAGE_OPTIONS = ["Al aire libre", "Cubierta", "Semi-cubierta"] as const;
