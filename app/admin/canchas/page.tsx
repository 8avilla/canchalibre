import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createVenue, updateVenue } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { getVenuePhotos } from "@/lib/venues/photos";
import { Banner } from "@/app/admin/Banner";
import { VENUE_TYPE_LABEL } from "@/lib/venues/type-info";

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

  // "Combina con" es de doble vía: si A lista a B en linkedVenueIds, a B le mostramos "Combina con:
  // A" de solo lectura — así el admin no termina editando el campo en la cancha equivocada. No tiene
  // nada que ver con VenueType: cualquier cancha se puede combinar con cualquier otra.
  const referencedBy = new Map<string, string[]>();
  for (const venue of venues) {
    for (const linkedId of venue.linkedVenueIds) {
      referencedBy.set(linkedId, [...(referencedBy.get(linkedId) ?? []), venue.name]);
    }
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-xl font-semibold">Canchas y tarifas</h1>

      {actualizado && <div className="mt-4"><Banner type="success" message="Cancha actualizada correctamente." /></div>}
      {creada && <div className="mt-4"><Banner type="success" message="Cancha creada correctamente." /></div>}
      {error && ERROR_MESSAGES[error] && <div className="mt-4"><Banner type="error" message={ERROR_MESSAGES[error]} /></div>}

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

                <div>
                  <span className="text-sm font-medium text-gray-700">Esta cancha combina con</span>
                  <p className="text-xs text-gray-500">
                    Marca las canchas que comparten el mismo espacio físico — reservar esta cancha
                    bloqueará esas, y reservar cualquiera de esas bloqueará esta (ej. una cancha de
                    Fútbol 9 que también se usa como 2 de Fútbol 7).
                  </p>
                  {venues.filter((v) => v.id !== venue.id).length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400">No hay otras canchas todavía.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {venues
                        .filter((v) => v.id !== venue.id)
                        .map((other) => (
                          <label key={other.id} className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              name="linkedVenueIds"
                              value={other.id}
                              defaultChecked={venue.linkedVenueIds.includes(other.id)}
                            />
                            {other.name} ({VENUE_TYPE_LABEL[other.type]})
                          </label>
                        ))}
                    </div>
                  )}
                  {referencedBy.get(venue.id) && (
                    <p className="mt-2 text-xs text-gray-500">
                      Combina con: {referencedBy.get(venue.id)!.join(", ")} (definido desde esa cancha)
                    </p>
                  )}
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
            <option value="FUTBOL_7">Fútbol 7</option>
            <option value="FUTBOL_8">Fútbol 8</option>
            <option value="FUTBOL_9">Fútbol 9</option>
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
