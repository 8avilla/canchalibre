import { businessDayStart } from "@/lib/time/business-day";

export interface VenuePriceRuleLike {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  price: number;
}

export const DAY_OF_WEEK_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Precio real de un turno: la primera excepción que matchee día de la semana + hora, o la tarifa por
// defecto de la cancha. Nunca hay ambigüedad entre reglas porque el guardado rechaza solapes (ver
// rulesOverlap) — no hace falta una regla de desempate "gana la más específica".
export function resolveVenuePrice(
  venue: { hourlyRate: number },
  priceRules: VenuePriceRuleLike[],
  dateIso: string,
  startTime: string,
): number {
  const dayOfWeek = businessDayStart(dateIso).getUTCDay();
  const rule = priceRules.find(
    (r) => r.dayOfWeek === dayOfWeek && r.startTime <= startTime && startTime < r.endTime,
  );
  return rule?.price ?? venue.hourlyRate;
}

export function rulesOverlap(
  a: { dayOfWeek: number; startTime: string; endTime: string },
  b: { dayOfWeek: number; startTime: string; endTime: string },
): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime;
}
