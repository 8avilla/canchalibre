import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BookingStatus, CancelledBy, computeReleasedSlotKey } from "@/lib/booking/state-machine";
import { releaseSlotLocks } from "@/lib/booking/slot-locks";
import { businessDateTimeInstant, businessDayStart, todayBusinessDate } from "@/lib/time/business-day";

// negocio.md §6.1/§6.2: "no_show: Hora llegada, el grupo nunca se presentó ni canceló... la reserva
// pasa a no_show automáticamente al cierre de la ventana horaria." Mismo patrón de autenticación que
// expire-bookings; solo toca CONFIRMADA (expire-bookings solo toca PENDIENTE_PAGO — conjuntos
// disjuntos, sin conflicto entre los dos crons).
export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const now = new Date();

  // Pre-filtro barato en Mongo (date es la medianoche Bogotá del turno, así que "hoy o antes" ya
  // acota bastante); la comparación fina contra endTime se hace en memoria sobre ese subconjunto.
  const candidates = await db.booking.findMany({
    where: { status: BookingStatus.CONFIRMADA, date: { lte: businessDayStart(todayBusinessDate()) } },
    select: { id: true, date: true, endTime: true },
  });

  const overdue = candidates.filter(
    (booking) => businessDateTimeInstant(booking.date.toISOString().slice(0, 10), booking.endTime) < now,
  );

  await Promise.all(
    overdue.map(async (booking) => {
      await db.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.NO_SHOW,
          blockingSlotKey: computeReleasedSlotKey(booking.id),
          cancelledAt: now,
          cancelledBy: CancelledBy.SYSTEM,
          cancellationReason: "no_show",
        },
      });
      await releaseSlotLocks(booking.id);
    }),
  );

  return NextResponse.json({ noShow: overdue.length });
}
