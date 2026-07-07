import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDaySlots, parseDateParam, todayIso } from "@/lib/booking/availability";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { getVenuePhotos } from "@/lib/venues/photos";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { DaySelector } from "./DaySelector";
import { DateJumpInput } from "./DateJumpInput";
import { VenueGallery } from "./VenueGallery";

const VENUE_TYPE_ICON: Record<string, string> = {
  FUTBOL_5: "⚽",
  FUTBOL_8: "⚽",
  PADEL: "🎾",
};

const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_8: "Fútbol 8",
  PADEL: "Pádel",
};

// Superficie típica por tipo de cancha — no es un dato real por cancha (no existe ese campo en el
// modelo todavía), es solo un texto de referencia en el frontend hasta que se agregue de verdad.
const VENUE_TYPE_SURFACE: Record<string, string> = {
  FUTBOL_5: "Grama sintética",
  FUTBOL_8: "Grama sintética",
  PADEL: "Cristal y césped sintético",
};

// Servicios genéricos por tipo de cancha — igual que la superficie, es un texto de referencia en el
// frontend (no hay un campo real de servicios todavía). Ajústalo si algún servicio no aplica.
const VENUE_TYPE_SERVICES: Record<string, { icon: string; label: string }[]> = {
  FUTBOL_5: [
    { icon: "🅿️", label: "Parqueadero" },
    { icon: "🚻", label: "Baños" },
    { icon: "💡", label: "Iluminación nocturna" },
    { icon: "🥤", label: "Cafetería" },
  ],
  FUTBOL_8: [
    { icon: "🅿️", label: "Parqueadero" },
    { icon: "🚻", label: "Baños" },
    { icon: "💡", label: "Iluminación nocturna" },
    { icon: "🥤", label: "Cafetería" },
  ],
  PADEL: [
    { icon: "🅿️", label: "Parqueadero" },
    { icon: "🚻", label: "Baños" },
    { icon: "💡", label: "Iluminación nocturna" },
    { icon: "🎾", label: "Alquiler de raquetas" },
  ],
};

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; venueId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { org: orgSlug, venueId } = await params;
  const { date: dateParam } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== organization.id) {
    notFound();
  }

  const dateIso = parseDateParam(dateParam);
  const slots = await getDaySlots(venue.id, dateIso);
  const { weekday, day, month } = formatBusinessDayLabel(dateIso);
  const photos = getVenuePhotos(venue);
  const services = VENUE_TYPE_SERVICES[venue.type];

  return (
    <main className="mx-auto max-w-2xl pb-10">
      <div className="relative bg-gray-100">
        {photos.length > 0 ? (
          <VenueGallery photos={photos} alt={venue.name} />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <span className="text-6xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</span>
          </div>
        )}
        <Link
          href={`/${orgSlug}`}
          className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700"
        >
          ←
        </Link>
        <div className="absolute left-3 top-14 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700">
            {VENUE_TYPE_ICON[venue.type] ?? "🏟️"} {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
          </span>
          {VENUE_TYPE_SURFACE[venue.type] && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700">
              {VENUE_TYPE_SURFACE[venue.type]}
            </span>
          )}
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow">
          ${venue.hourlyRate.toLocaleString("es-CO")}/h
        </span>
      </div>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold text-gray-900">{venue.name}</h1>

        {services && services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
            {services.map((service) => (
              <span key={service.label} className="flex items-center gap-1">
                <span aria-hidden="true">{service.icon}</span> {service.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <DateJumpInput orgSlug={orgSlug} venueId={venue.id} selectedDateIso={dateIso} />
        </div>

        <div className="mt-2">
          <DaySelector basePath={`/${orgSlug}/${venue.id}`} selectedDateIso={dateIso} />
        </div>

        <p className="mt-4 text-sm font-medium text-gray-700">
          {weekday} {day} de {month}
        </p>

        <AvailabilityGrid
          orgSlug={orgSlug}
          venueId={venue.id}
          dateIso={dateIso}
          hourlyRate={venue.hourlyRate}
          initialSlots={slots}
        />

        {dateIso === todayIso() && (
          <p className="mt-4 text-xs text-gray-400">● en vivo — se actualiza solo cada pocos segundos</p>
        )}
      </div>
    </main>
  );
}
