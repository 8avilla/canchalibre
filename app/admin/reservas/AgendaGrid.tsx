import { CLOSING_HOUR, OPENING_HOUR } from "@/lib/booking/availability";
import { STATUS_BLOCK_STYLE, STATUS_ICON } from "@/lib/booking/status-display";
import { businessTimeNow, todayBusinessDate } from "@/lib/time/business-day";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import type { AgendaBooking, AgendaVenue } from "@/lib/admin/queries";

const OPERATING_SPAN = CLOSING_HOUR - OPENING_HOUR;
const HOURS = Array.from({ length: OPERATING_SPAN + 1 }, (_, i) => OPENING_HOUR + i);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// % desde el borde izquierdo de la pista horaria — server component, se calcula una sola vez por
// request (sin polling; ver decisión de producto en el plan: el admin ya no usa client state salvo
// donde es indispensable, y una línea "ahora" que se desfasa unos minutos entre refrescos es aceptable).
function timeToPct(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  const decimal = hh + mm / 60;
  return Math.min(100, Math.max(0, ((decimal - OPENING_HOUR) / OPERATING_SPAN) * 100));
}

export function AgendaGrid({
  venues,
  bookingsByVenue,
  dateIso,
}: {
  venues: AgendaVenue[];
  bookingsByVenue: Record<string, AgendaBooking[]>;
  dateIso: string;
}) {
  const isToday = dateIso === todayBusinessDate();
  const nowPct = isToday ? timeToPct(businessTimeNow()) : null;

  if (venues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Todavía no hay canchas creadas.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px]">
        <div className="flex">
          <div className="w-40 shrink-0" />
          <div className="relative h-6 flex-1">
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute -translate-x-1/2 text-[11px] text-gray-400"
                style={{ left: `${timeToPct(`${pad(h)}:00`)}%` }}
              >
                {pad(h)}:00
              </span>
            ))}
            {nowPct !== null && (
              <span
                className="absolute -translate-x-1/2 rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ left: `${nowPct}%` }}
              >
                {businessTimeNow()}
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {venues.map((venue) => (
            <div key={venue.id} className="flex items-stretch">
              <div className="w-40 shrink-0 border-r border-gray-100 p-3">
                <div className="text-sm font-medium text-gray-900">
                  {VENUE_TYPE_ICON[venue.type] ?? "🏟️"} {venue.name}
                </div>
                <div className="text-xs text-gray-500">{VENUE_TYPE_LABEL[venue.type] ?? venue.type}</div>
                {venue.capacity ? (
                  <div className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                    {venue.capacity} jug.
                  </div>
                ) : null}
              </div>

              <div className="relative min-h-[72px] flex-1">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-y-0 border-l border-gray-100"
                    style={{ left: `${timeToPct(`${pad(h)}:00`)}%` }}
                  />
                ))}

                {nowPct !== null && (
                  <div className="absolute inset-y-0 w-px bg-emerald-600" style={{ left: `${nowPct}%` }} />
                )}

                {(bookingsByVenue[venue.id] ?? []).map((booking) => {
                  const left = timeToPct(booking.startTime);
                  const width = Math.max(timeToPct(booking.endTime) - left, 3);
                  return (
                    <div
                      key={booking.id}
                      title={`${booking.startTime}-${booking.endTime} · ${booking.customerName}`}
                      className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 py-1 text-[11px]
                        leading-tight ${STATUS_BLOCK_STYLE[booking.status] ?? STATUS_BLOCK_STYLE.PENDIENTE_PAGO}`}
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                    >
                      <div className="flex items-center gap-1 truncate font-medium">
                        <span aria-hidden="true">{STATUS_ICON[booking.status] ?? "•"}</span>
                        {booking.startTime}-{booking.endTime}
                        {booking.recurringBookingId && <span title="Reserva recurrente">🔁</span>}
                      </div>
                      <div className="truncate">{booking.customerName || "Sin nombre"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
