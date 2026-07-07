import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cancelConfirmedBooking } from "@/lib/admin/actions";
import { BookingStatus } from "@/lib/booking/state-machine";
import { businessDayRange, todayBusinessDate } from "@/lib/time/business-day";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
  EXPIRADA: "Expirada",
};

export default async function AdminReservasPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const { start: dayStart, end: dayEnd } = businessDayRange(todayBusinessDate());

  const bookings = await db.booking.findMany({
    where: { orgId: organization.id, date: { gte: dayStart, lt: dayEnd } },
    include: { venue: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Reservas de hoy</h1>

      <ul className="mt-6 grid gap-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {booking.venue.name} — {booking.startTime}
              </span>
              <span className="text-xs text-gray-500">{STATUS_LABEL[booking.status] ?? booking.status}</span>
            </div>
            <div className="text-sm text-gray-500">
              {booking.customerName} · {booking.customerPhone}
            </div>

            {booking.status === BookingStatus.CONFIRMADA && (
              <form action={cancelConfirmedBooking} className="mt-3">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="bookingId" value={booking.id} />
                <button type="submit" className="rounded-md bg-red-600 px-3 py-1 text-sm text-white">
                  Cancelar reserva
                </button>
              </form>
            )}
          </li>
        ))}

        {bookings.length === 0 && <li className="text-sm text-gray-500">Sin reservas para hoy.</li>}
      </ul>
    </main>
  );
}
