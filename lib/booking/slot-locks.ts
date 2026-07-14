import { db } from "@/lib/db";
import { computeBlockingSlotKey } from "./state-machine";

// Franjas físicas que ocupa esta cancha al reservarse — su propio id si es una cancha "atómica"
// (el caso normal), o las de linkedVenueIds si es una cancha compuesta (ej. Fútbol 9 armada sobre
// 2 de Fútbol 7) que no tiene franja propia. Ver prisma/schema.prisma (Venue.linkedVenueIds) y el
// modelo SlotLock para el porqué de este diseño.
export function getVenueUnitIds(venue: { id: string; linkedVenueIds: string[] }): string[] {
  return venue.linkedVenueIds.length > 0 ? venue.linkedVenueIds : [venue.id];
}

export function buildSlotLockKeys(unitIds: string[], date: Date, startTime: string): string[] {
  return unitIds.map((unitId) => computeBlockingSlotKey(unitId, date, startTime));
}

// Libera las franjas físicas reclamadas por una reserva — llamar siempre que una reserva pase a un
// estado terminal (CANCELADA/EXPIRADA/NO_SHOW/FINALIZADA). No-op para canchas que nunca combinan
// (nunca generaron filas acá).
export async function releaseSlotLocks(bookingId: string): Promise<void> {
  await db.slotLock.deleteMany({ where: { bookingId } });
}
