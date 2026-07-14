// Textos/íconos de referencia por tipo de cancha, compartidos entre la página de una cancha y el
// buscador principal. La superficie y las características reales viven por cancha (Venue.surface,
// Venue.amenities) — ver lib/venues/amenities.ts.
export const VENUE_TYPE_ICON: Record<string, string> = {
  FUTBOL_5: "⚽",
  FUTBOL_7: "⚽",
  FUTBOL_8: "⚽",
  FUTBOL_9: "⚽",
  PADEL: "🎾",
};

export const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_7: "Fútbol 7",
  FUTBOL_8: "Fútbol 8",
  FUTBOL_9: "Fútbol 9",
  PADEL: "Pádel",
};
