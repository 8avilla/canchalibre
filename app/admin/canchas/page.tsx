import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createVenue } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { getVenuePhotos } from "@/lib/venues/photos";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";

const ERROR_MESSAGES: Record<string, string> = {
  foto_formato_invalido: "Formato de foto no soportado. Usa PNG, JPG o WEBP.",
  foto_muy_grande: "Cada foto debe pesar máximo 5 MB.",
  demasiadas_fotos: "Máximo 8 fotos por cancha.",
};

const STATUS_LABEL: Record<string, string> = { ACTIVA: "Activa", MANTENIMIENTO: "Mantenimiento", INACTIVA: "Inactiva" };
const STATUS_BADGE: Record<string, string> = {
  ACTIVA: "bg-emerald-600 text-white",
  MANTENIMIENTO: "bg-amber-600 text-white",
  INACTIVA: "bg-gray-700 text-white",
};

const SORT_OPTIONS = [
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "precio_asc", label: "Tarifa (menor a mayor)" },
  { value: "precio_desc", label: "Tarifa (mayor a menor)" },
] as const;

export default async function CanchasPage({
  searchParams,
}: {
  searchParams: Promise<{
    actualizado?: string;
    creada?: string;
    error?: string;
    q?: string;
    type?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { actualizado, creada, error, q, type, status, sort } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  const activeCount = venues.filter((v) => v.status === "ACTIVA").length;
  const maintenanceCount = venues.filter((v) => v.status === "MANTENIMIENTO").length;
  const averageRate =
    venues.length > 0 ? Math.round(venues.reduce((sum, v) => sum + v.hourlyRate, 0) / venues.length) : 0;

  // "Combina con" es de doble vía: si A lista a B en linkedVenueIds, a B le mostramos "Combina con:
  // A" de solo lectura. No tiene nada que ver con VenueType: cualquier cancha se puede combinar con
  // cualquier otra.
  const referencedBy = new Map<string, string[]>();
  for (const venue of venues) {
    for (const linkedId of venue.linkedVenueIds) {
      referencedBy.set(linkedId, [...(referencedBy.get(linkedId) ?? []), venue.name]);
    }
  }

  const query = q?.trim().toLowerCase() ?? "";
  const typeFilter = type && type in VENUE_TYPE_LABEL ? type : "";
  const statusFilter = status && status in STATUS_LABEL ? status : "";
  const activeSort = SORT_OPTIONS.find((s) => s.value === sort)?.value ?? "nombre";

  const filteredVenues = venues
    .filter((v) => !query || v.name.toLowerCase().includes(query))
    .filter((v) => !typeFilter || v.type === typeFilter)
    .filter((v) => !statusFilter || v.status === statusFilter)
    .sort((a, b) => {
      if (activeSort === "precio_asc") return a.hourlyRate - b.hourlyRate;
      if (activeSort === "precio_desc") return b.hourlyRate - a.hourlyRate;
      return a.name.localeCompare(b.name);
    });

  const hasActiveFilters = Boolean(query || typeFilter || statusFilter || sort);

  return (
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Canchas y tarifas</h1>
      </div>

      {actualizado && <div className="mt-4"><Banner type="success" message="Cancha actualizada correctamente." /></div>}
      {creada && <div className="mt-4"><Banner type="success" message="Cancha creada correctamente." /></div>}
      {error && ERROR_MESSAGES[error] && <div className="mt-4"><Banner type="error" message={ERROR_MESSAGES[error]} /></div>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-gray-900">{venues.length}</div>
          <div className="text-xs text-gray-500">Total de canchas</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-emerald-700">{activeCount}</div>
          <div className="text-xs text-gray-500">Activas</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-amber-700">{maintenanceCount}</div>
          <div className="text-xs text-gray-500">En mantenimiento</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-gray-900">${averageRate.toLocaleString("es-CO")}</div>
          <div className="text-xs text-gray-500">Tarifa promedio/hora</div>
        </div>
      </div>

      <form
        method="get"
        className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4"
      >
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-500">Buscar</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nombre de la cancha…"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Tipo</label>
          <select name="type" defaultValue={typeFilter} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
            <option value="">Todos</option>
            {Object.entries(VENUE_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Estado</label>
          <select name="status" defaultValue={statusFilter} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Ordenar por</label>
          <select name="sort" defaultValue={activeSort} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-3 sm:col-span-4">
          <SubmitButton pendingLabel="Filtrando…" className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
            Filtrar
          </SubmitButton>
          {hasActiveFilters && (
            <Link href="/admin/canchas" className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
          <span className="ml-auto self-center text-sm text-gray-500">
            {filteredVenues.length} {filteredVenues.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </form>

      <ul className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {filteredVenues.map((venue) => {
          const [coverPhoto] = getVenuePhotos(venue);
          const combinedWith = referencedBy.get(venue.id);

          return (
            <li key={venue.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <Link href={`/admin/canchas/${venue.id}`} className="block">
                <div className="relative h-36 bg-gradient-to-br from-emerald-700 to-emerald-950">
                  {coverPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto subida a Azure Blob por el admin
                    <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-gray-800">
                    {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
                  </span>
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[venue.status]}`}>
                    {STATUS_LABEL[venue.status]}
                  </span>
                </div>

                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{venue.name}</h2>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xl font-bold text-emerald-700">${venue.hourlyRate.toLocaleString("es-CO")}</div>
                      <div className="text-xs text-gray-500">por hora</div>
                    </div>
                  </div>
                  {venue.capacity && <p className="mt-0.5 text-xs text-gray-500">👥 {venue.capacity} jugadores</p>}
                  {combinedWith && <p className="mt-1 text-xs text-gray-500">🔗 Combina con: {combinedWith.join(", ")}</p>}
                </div>
              </Link>

              <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
                <Link
                  href={`/admin/canchas/${venue.id}?editar=1`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Editar
                </Link>
                <Link
                  href={`/admin/canchas/${venue.id}?tab=fotos`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Fotos
                </Link>
                <Link
                  href={`/admin/canchas/${venue.id}?tab=horarios`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Horarios
                </Link>
              </div>
            </li>
          );
        })}

        {filteredVenues.length === 0 && venues.length > 0 && (
          <li className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 lg:col-span-2 xl:col-span-3">
            <div className="text-3xl">🔍</div>
            <p className="mt-2">Sin canchas para estos filtros.</p>
          </li>
        )}

        {venues.length === 0 && (
          <li className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 lg:col-span-2 xl:col-span-3">
            <div className="text-3xl">🏟️</div>
            <p className="mt-2">Sin canchas todavía.</p>
            <p className="text-gray-400">Creá la primera con el formulario de abajo.</p>
          </li>
        )}
      </ul>

      <form
        action={createVenue}
        className="mt-8 grid max-w-xl gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">➕ Nueva cancha</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nombre
            <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-2.5" />
          </label>
          <label className="grid gap-1 text-sm">
            Tipo
            <select name="type" required className="rounded-md border border-gray-300 px-3 py-2.5">
              <option value="FUTBOL_5">Fútbol 5</option>
              <option value="FUTBOL_7">Fútbol 7</option>
              <option value="FUTBOL_8">Fútbol 8</option>
              <option value="FUTBOL_9">Fútbol 9</option>
              <option value="PADEL">Pádel</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Tarifa por hora
          <input
            type="number"
            inputMode="numeric"
            name="hourlyRate"
            min={0}
            required
            className="rounded-md border border-gray-300 px-3 py-2.5"
          />
        </label>
        <SubmitButton className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
          Crear cancha
        </SubmitButton>
      </form>
    </main>
  );
}
