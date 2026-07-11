import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createVenue, updateVenue } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { getVenuePhotos } from "@/lib/venues/photos";

const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_8: "Fútbol 8",
  PADEL: "Pádel",
};

const ERROR_MESSAGES: Record<string, string> = {
  foto_formato_invalido: "Formato de foto no soportado. Usa PNG, JPG o WEBP.",
  foto_muy_grande: "Cada foto debe pesar máximo 5 MB.",
  demasiadas_fotos: "Máximo 8 fotos por cancha.",
};

export default async function CanchasPage({
  searchParams,
}: {
  searchParams: Promise<{ actualizado?: string; creada?: string; error?: string }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { actualizado, creada, error } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Canchas y tarifas</h1>

      {actualizado && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Cancha actualizada correctamente.</p>}
      {creada && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Cancha creada correctamente.</p>}
      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <ul className="mt-6 grid gap-4">
        {venues.map((venue) => {
          const photos = getVenuePhotos(venue);
          const justUpdated = actualizado === venue.id;

          return (
            <li
              key={venue.id}
              className={`rounded-lg border p-4 ${justUpdated ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {venue.name} <span className="text-sm text-gray-500">({VENUE_TYPE_LABEL[venue.type]})</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    venue.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {venue.active ? "Activa" : "Inactiva"}
                </span>
              </div>

              <form action={updateVenue} className="mt-3 grid gap-4">
                <input type="hidden" name="venueId" value={venue.id} />

                <div>
                  <span className="text-sm font-medium text-gray-700">Fotos ({photos.length}/8)</span>

                  {photos.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {photos.map((url) => (
                        <label key={url} className="group relative block cursor-pointer overflow-hidden rounded-md border border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element -- foto subida a Azure Blob por el admin */}
                          <img src={url} alt="" className="aspect-square w-full object-cover" />
                          <input
                            type="checkbox"
                            name="removePhotos"
                            value={url}
                            className="absolute right-1 top-1 h-4 w-4 accent-red-600"
                          />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-medium text-white opacity-0 group-has-[:checked]:opacity-100">
                            Eliminar
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  <input
                    type="file"
                    name="photos"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="mt-2 block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
                  />
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1 text-sm">
                    Tarifa/hora
                    <input
                      type="number"
                      inputMode="numeric"
                      name="hourlyRate"
                      min={0}
                      defaultValue={venue.hourlyRate}
                      className="rounded-md border border-gray-300 px-3 py-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Jugadores (opcional)
                    <input
                      type="number"
                      inputMode="numeric"
                      name="capacity"
                      min={0}
                      defaultValue={venue.capacity ?? ""}
                      placeholder="Ej: 10"
                      className="w-24 rounded-md border border-gray-300 px-3 py-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Estado
                    <select
                      name="active"
                      defaultValue={venue.active ? "true" : "false"}
                      className="rounded-md border border-gray-300 px-3 py-3"
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </label>
                  <button type="submit" className="rounded-md bg-gray-900 px-4 py-3 text-sm text-white hover:bg-gray-800">
                    Guardar
                  </button>
                </div>
              </form>
            </li>
          );
        })}

        {venues.length === 0 && <li className="text-sm text-gray-500">Sin canchas todavía.</li>}
      </ul>

      <form action={createVenue} className="mt-8 grid gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium">Nueva cancha</h2>
        <label className="grid gap-1 text-sm">
          Nombre
          <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Tipo
          <select name="type" required className="rounded-md border border-gray-300 px-3 py-3">
            <option value="FUTBOL_5">Fútbol 5</option>
            <option value="FUTBOL_8">Fútbol 8</option>
            <option value="PADEL">Pádel</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tarifa por hora
          <input
            type="number"
            inputMode="numeric"
            name="hourlyRate"
            min={0}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <button type="submit" className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
          Crear cancha
        </button>
      </form>
    </main>
  );
}
