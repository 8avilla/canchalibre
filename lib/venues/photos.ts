// Resuelve la galería de fotos de una cancha: prioriza imageUrls (nuevo, varias fotos) y cae a
// imageUrl (legado, una sola foto) para canchas configuradas antes de que existiera la galería.
// Ojo: en Mongo, los documentos creados antes de este campo no lo tienen en absoluto (no es que
// esté en `[]`, literalmente no existe la llave) — Prisma no hace backfill de @default() en datos
// viejos, así que puede llegar `undefined` en tiempo de ejecución aunque el tipo diga `string[]`.
export function getVenuePhotos(venue: { imageUrl: string | null; imageUrls?: string[] }): string[] {
  if (venue.imageUrls && venue.imageUrls.length > 0) {
    return venue.imageUrls;
  }
  return venue.imageUrl ? [venue.imageUrl] : [];
}
