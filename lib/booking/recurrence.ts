import { addBusinessDays } from "@/lib/time/business-day";

export const MAX_RECURRING_OCCURRENCES = 52;

// Todas las fechas semanales entre startDate y endDate (ambas inclusive), comparadas como string
// "YYYY-MM-DD" — es válido porque ambas tienen el mismo formato de ancho fijo. Función pura,
// compartida entre createRecurringBooking (lib/admin/actions.ts) y la vista previa en vivo del
// wizard de reserva recurrente (RecurrenceWizard.tsx) para que nunca calculen ocurrencias distintas.
export function buildWeeklyOccurrenceDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addBusinessDays(current, 7);
  }
  return dates;
}
