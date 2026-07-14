// Cancha Libre opera únicamente en Colombia (America/Bogota, UTC-5 fijo, sin horario de verano). Un
// offset constante alcanza; si algún día se opera en una zona con DST, esto necesita una librería
// de zonas horarias real (Intl o dayjs+timezone) en vez de un offset fijo.
const BUSINESS_UTC_OFFSET = "-05:00";
const BUSINESS_UTC_OFFSET_HOURS = 5;

export function businessDateFromInstant(instant: Date): string {
  const bogotaInstant = new Date(instant.getTime() - BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return bogotaInstant.toISOString().slice(0, 10);
}

export function todayBusinessDate(): string {
  return businessDateFromInstant(new Date());
}

// Hora actual en Bogotá como "HH:mm" — para comparar contra Booking.startTime (mismo formato) sin
// tener que reconstruir un Date. Usado por la línea "ahora" de la agenda y por "Próximas reservas"
// (que solo muestra turnos que aún no empezaron cuando se está viendo el día de hoy).
export function businessTimeNow(): string {
  const bogotaInstant = new Date(Date.now() - BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return bogotaInstant.toISOString().slice(11, 16);
}

export function businessDayStart(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
}

// Combina el "día del turno" (dateIso, medianoche Bogotá tal como vive en Booking.date) con una hora
// "HH:mm" del mismo turno (startTime/endTime) en un instante real — usado para calcular la ventana de
// cancelación (computeCancellationOutcome) y para detectar reservas cuya franja horaria ya pasó
// (cron de no-show).
export function businessDateTimeInstant(dateIso: string, time: string): Date {
  return new Date(`${dateIso}T${time}:00.000${BUSINESS_UTC_OFFSET}`);
}

export function businessDayRange(dateIso: string): { start: Date; end: Date } {
  const start = businessDayStart(dateIso);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function addBusinessDays(dateIso: string, delta: number): string {
  const date = businessDayStart(dateIso);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "America/Bogota" });
const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat("es-CO", { day: "numeric", timeZone: "America/Bogota" });
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "America/Bogota" });

export function formatBusinessDayLabel(dateIso: string): { weekday: string; day: string; month: string } {
  const date = businessDayStart(dateIso);
  return {
    weekday: WEEKDAY_FORMATTER.format(date).replace(".", ""),
    day: DAY_NUMBER_FORMATTER.format(date),
    month: MONTH_FORMATTER.format(date).replace(".", ""),
  };
}
