import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cancelConfirmedBooking } from "@/lib/admin/actions";
import { getAgendaBookings, getReservasStatCards, getUpcomingBookings } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { BookingStatus } from "@/lib/booking/state-machine";
import { LEGEND_STATUSES, STATUS_BADGE_STYLE, STATUS_LABEL } from "@/lib/booking/status-display";
import { businessDayRange, formatBusinessDayLabel, addBusinessDays, todayBusinessDate } from "@/lib/time/business-day";
import { Prisma, VenueType } from "@/lib/generated/prisma";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { SubmitButton } from "@/app/components/SubmitButton";
import { AgendaGrid } from "./AgendaGrid";
import { BookingsTable, BOOKING_LIST_LIMIT } from "./BookingsTable";
import { NuevaReservaDrawer } from "./NuevaReservaDrawer";

const RECURRING_ERROR_MESSAGES: Record<string, string> = {
  recurrente_rango_invalido: "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
  recurrente_demasiadas_ocurrencias: "Ese rango genera demasiadas fechas (máximo 52 semanas). Acorta el rango.",
  recurrente_cupo_no_disponible:
    "Uno o más horarios de esa serie ya están ocupados. No se creó ninguna reserva — ajusta el " +
    "horario o el rango de fechas.",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_BADGE_STYLE[status] ?? "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default async function AdminReservasPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    fecha?: string;
    nueva?: string;
    creada?: string;
    dateFrom?: string;
    dateTo?: string;
    venueId?: string;
    type?: string;
    status?: string;
    name?: string;
    phone?: string;
    error?: string;
    recurrente?: string;
    cancelada?: string;
  }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const params = await searchParams;
  const {
    vista: vistaParam,
    fecha: fechaParam,
    nueva,
    creada,
    dateFrom: dateFromParam,
    dateTo: dateToParam,
    venueId: venueIdParam,
    type: typeParam,
    status: statusParam,
    name: nameParam,
    phone: phoneParam,
    error,
    recurrente,
    cancelada,
  } = params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });
  const venueIds = new Set(venues.map((venue) => venue.id));

  const vista: "agenda" | "lista" = vistaParam === "lista" ? "lista" : "agenda";
  const fecha = fechaParam && DATE_RE.test(fechaParam) ? fechaParam : todayBusinessDate();
  const isToday = fecha === todayBusinessDate();
  const { weekday, day, month } = formatBusinessDayLabel(fecha);

  // Params que se preservan al abrir/cerrar el drawer o cambiar de vista, para no perder el día que
  // el admin estaba viendo.
  const baseQuery = new URLSearchParams({ vista, fecha });
  const drawerHref = `/admin/reservas?${new URLSearchParams({ ...Object.fromEntries(baseQuery), nueva: "1" })}`;
  const closeDrawerHref = `/admin/reservas?${baseQuery}`;

  const statCards = await getReservasStatCards(organization.id, fecha);

  let agendaData: Awaited<ReturnType<typeof getAgendaBookings>> | null = null;
  let upcoming: Awaited<ReturnType<typeof getUpcomingBookings>> = [];
  let bookingsTableProps: {
    bookings: Prisma.BookingGetPayload<{ include: { venue: true } }>[];
    truncated: boolean;
    isSingleDay: boolean;
    filters: Record<string, string | undefined>;
    hasActiveFilters: boolean;
  } | null = null;

  if (vista === "agenda") {
    [agendaData, upcoming] = await Promise.all([
      getAgendaBookings(organization.id, fecha),
      getUpcomingBookings(organization.id, fecha),
    ]);
  } else {
    // Sin parámetros de fecha en absoluto = primera visita a la vista lista → default a "hoy". Una
    // vez el admin usa el formulario (aunque deje ambos campos vacíos), sí se respeta lo que haya
    // puesto — vacío significa "sin límite" en ese extremo del rango.
    const dateParamsPresent = dateFromParam !== undefined || dateToParam !== undefined;
    const dateFromFilter = dateFromParam && DATE_RE.test(dateFromParam) ? dateFromParam : undefined;
    const dateToFilter = dateToParam && DATE_RE.test(dateToParam) ? dateToParam : undefined;
    const effectiveDateFrom = dateParamsPresent ? dateFromFilter : todayBusinessDate();
    const effectiveDateTo = dateParamsPresent ? dateToFilter : todayBusinessDate();
    const isSingleDay = Boolean(effectiveDateFrom && effectiveDateFrom === effectiveDateTo);

    const venueIdFilter = venueIdParam && venueIds.has(venueIdParam) ? venueIdParam : undefined;
    const typeFilter =
      typeParam && (Object.values(VenueType) as string[]).includes(typeParam) ? (typeParam as VenueType) : undefined;
    const statusFilter =
      statusParam && (Object.values(BookingStatus) as string[]).includes(statusParam)
        ? (statusParam as BookingStatus)
        : undefined;
    const nameFilter = nameParam?.trim() || undefined;
    const phoneFilter = phoneParam?.trim() || undefined;

    const where: Prisma.BookingWhereInput = { orgId: organization.id };
    if (effectiveDateFrom || effectiveDateTo) {
      where.date = {
        ...(effectiveDateFrom ? { gte: businessDayRange(effectiveDateFrom).start } : {}),
        ...(effectiveDateTo ? { lt: businessDayRange(effectiveDateTo).end } : {}),
      };
    }
    if (venueIdFilter) where.venueId = venueIdFilter;
    if (typeFilter) where.venue = { type: typeFilter };
    if (statusFilter) where.status = statusFilter;
    if (nameFilter) where.customerName = { contains: nameFilter, mode: "insensitive" };
    if (phoneFilter) where.customerPhone = { contains: phoneFilter, mode: "insensitive" };

    const bookings = await db.booking.findMany({
      where,
      include: { venue: true },
      orderBy: isSingleDay ? [{ startTime: "asc" }] : [{ date: "asc" }, { startTime: "asc" }],
      take: BOOKING_LIST_LIMIT,
    });

    bookingsTableProps = {
      bookings,
      truncated: bookings.length === BOOKING_LIST_LIMIT,
      isSingleDay,
      filters: {
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        venueId: venueIdFilter,
        type: typeFilter,
        status: statusFilter,
        name: nameFilter,
        phone: phoneFilter,
      },
      hasActiveFilters: Boolean(venueIdFilter || typeFilter || statusFilter || nameFilter || phoneFilter),
    };
  }

  return (
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="mt-1 text-sm text-gray-500">Gestiona las reservas de tus canchas y controla la ocupación en tiempo real.</p>
        </div>

        <div className="flex items-center gap-2">
          {vista === "agenda" && (
            <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1.5">
              <Link
                href={`/admin/reservas?vista=agenda&fecha=${addBusinessDays(fecha, -1)}`}
                aria-label="Día anterior"
                className="px-1.5 text-gray-400 hover:text-gray-700"
              >
                ‹
              </Link>
              <span className="px-1 text-sm font-medium text-gray-700 capitalize">
                {isToday ? "Hoy" : weekday}, {day} {month}
              </span>
              <Link
                href={`/admin/reservas?vista=agenda&fecha=${addBusinessDays(fecha, 1)}`}
                aria-label="Día siguiente"
                className="px-1.5 text-gray-400 hover:text-gray-700"
              >
                ›
              </Link>
            </div>
          )}

          <Link
            href="/admin/reservas/recurrente"
            className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            🔁 Reserva recurrente
          </Link>

          <Link
            href={drawerHref}
            className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            + Nueva reserva
          </Link>
        </div>
      </div>

      {error && RECURRING_ERROR_MESSAGES[error] && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <span>⚠️</span>
          <span>{RECURRING_ERROR_MESSAGES[error]}</span>
        </p>
      )}
      {recurrente === "creada" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Reserva recurrente creada: se generaron todas las ocurrencias, ya confirmadas.</span>
        </p>
      )}
      {creada === "1" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Reserva creada correctamente.</span>
        </p>
      )}
      {cancelada === "1" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Reserva cancelada correctamente.</span>
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-lg">📅</div>
          <div className="mt-3 text-xl font-semibold text-gray-900">{statCards.reservasHoy}</div>
          <div className="text-sm text-gray-500">Reservas {isToday ? "hoy" : "ese día"}</div>
          {statCards.reservasHoyDeltaPct !== null && (
            <div className={`mt-1 text-xs ${statCards.reservasHoyDeltaPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {statCards.reservasHoyDeltaPct >= 0 ? "+" : ""}
              {statCards.reservasHoyDeltaPct}% vs día anterior
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-lg">💵</div>
          <div className="mt-3 text-xl font-semibold text-gray-900">${statCards.ingresosHoy.toLocaleString("es-CO")}</div>
          <div className="text-sm text-gray-500">Ingresos {isToday ? "hoy" : "ese día"}</div>
          {statCards.ingresosHoyDeltaPct !== null && (
            <div className={`mt-1 text-xs ${statCards.ingresosHoyDeltaPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {statCards.ingresosHoyDeltaPct >= 0 ? "+" : ""}
              {statCards.ingresosHoyDeltaPct}% vs día anterior
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-lg">📊</div>
          <div className="mt-3 text-xl font-semibold text-gray-900">{Math.round(statCards.ocupacionPromedio * 100)}%</div>
          <div className="text-sm text-gray-500">Ocupación promedio</div>
          <div className="mt-1 text-xs text-gray-500">{statCards.ocupacionLabel}</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-lg">🕒</div>
          <div className="mt-3 text-xl font-semibold text-gray-900">{statCards.reservasPendientes}</div>
          <div className="text-sm text-gray-500">Reservas pendientes</div>
          {statCards.reservasPendientes > 0 && <div className="mt-1 text-xs text-amber-600">Requieren atención</div>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
          <Link
            href={`/admin/reservas?vista=agenda&fecha=${fecha}`}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              vista === "agenda" ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Vista agenda
          </Link>
          <Link
            href="/admin/reservas?vista=lista"
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              vista === "lista" ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Vista lista
          </Link>
        </div>

        {vista === "agenda" && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {LEGEND_STATUSES.map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    status === "CONFIRMADA"
                      ? "bg-emerald-500"
                      : status === "PENDIENTE_PAGO"
                        ? "bg-amber-500"
                        : status === "CANCELADA"
                          ? "bg-red-500"
                          : "bg-gray-400"
                  }`}
                />
                {STATUS_LABEL[status]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        {vista === "agenda" && agendaData ? (
          <AgendaGrid venues={agendaData.venues} bookingsByVenue={agendaData.bookingsByVenue} dateIso={fecha} />
        ) : bookingsTableProps ? (
          <BookingsTable
            venues={venues}
            bookings={bookingsTableProps.bookings}
            truncated={bookingsTableProps.truncated}
            isSingleDay={bookingsTableProps.isSingleDay}
            filters={bookingsTableProps.filters}
            hasActiveFilters={bookingsTableProps.hasActiveFilters}
          />
        ) : null}
      </div>

      {vista === "agenda" && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Próximas reservas</h2>
          </div>

          {upcoming.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              {isToday ? "No quedan reservas por comenzar hoy." : "Sin reservas ese día."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="w-16 shrink-0">
                    <div className="text-sm font-semibold text-gray-900">{booking.startTime}</div>
                    <div className="text-xs text-gray-400">{isToday ? "Hoy" : fecha}</div>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span aria-hidden="true">{VENUE_TYPE_ICON[booking.venueType] ?? "🏟️"}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{booking.venueName}</div>
                      <div className="truncate text-xs text-gray-500">{VENUE_TYPE_LABEL[booking.venueType] ?? booking.venueType}</div>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900">{booking.customerName || "Sin nombre"}</div>
                    <div className="truncate text-xs text-gray-500">{booking.customerPhone}</div>
                  </div>

                  <div className="hidden text-sm text-gray-500 sm:block">
                    {formatDuration(booking.startTime, booking.endTime)} · {booking.startTime}-{booking.endTime}
                  </div>

                  <StatusBadge status={booking.status} />

                  {booking.status === BookingStatus.CONFIRMADA ? (
                    <details className="group relative">
                      <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
                        ⋮
                      </summary>
                      <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg">
                        <form action={cancelConfirmedBooking}>
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <input type="hidden" name="vista" value="agenda" />
                          <input type="hidden" name="fecha" value={fecha} />
                          <SubmitButton
                            confirmMessage="¿Cancelar esta reserva confirmada?"
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Cancelar reserva
                          </SubmitButton>
                        </form>
                      </div>
                    </details>
                  ) : (
                    <span className="w-7" />
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 px-4 py-3 text-center">
            <Link href="/admin/reservas?vista=lista" className="text-sm font-medium text-emerald-700 hover:underline">
              Ver todas las reservas →
            </Link>
          </div>
        </div>
      )}

      {nueva === "1" && (
        <NuevaReservaDrawer
          venues={venues.map((v) => ({ id: v.id, name: v.name, hourlyRate: v.hourlyRate }))}
          defaultDate={fecha}
          closeHref={closeDrawerHref}
          error={error}
        />
      )}
    </main>
  );
}
