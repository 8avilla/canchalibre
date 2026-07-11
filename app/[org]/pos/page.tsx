import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/session-guards";
import { openCashShift } from "@/lib/pos/actions";
import { getOpenShift, getTodayBookings } from "@/lib/pos/queries";
import { QueryToast } from "@/app/components/QueryToast";
import { BookingsList } from "./BookingsList";
import { WalkInBookingForm } from "./WalkInBookingForm";

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa los datos ingresados (nombre y WhatsApp de 10 dígitos).",
  cupo_no_disponible: "Ese horario ya tiene una reserva.",
};

export default async function PosHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ error?: string; walkin?: string }>;
}) {
  const { org: orgSlug } = await params;
  const { error, walkin } = await searchParams;

  const session = await requireStaffSession(orgSlug);

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const openShift = await getOpenShift(organization.id);

  if (!openShift) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-xl font-semibold">Abrir turno de caja</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ingresa la base de efectivo para habilitar las ventas ({session.user.name}).
        </p>
        <form action={openCashShift} className="mt-6 grid gap-4">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <label className="grid gap-1 text-sm">
            Base de efectivo
            <input
              type="number"
              inputMode="numeric"
              name="openingCash"
              min={0}
              required
              className="rounded-md border border-gray-300 px-3 py-3"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800"
          >
            Abrir turno
          </button>
        </form>
      </main>
    );
  }

  const bookings = await getTodayBookings(organization.id);
  const venues = await db.venue.findMany({
    where: { orgId: organization.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 pb-24 sm:pb-10">
      {error && ERROR_MESSAGES[error] && <QueryToast type="error" message={ERROR_MESSAGES[error]} />}
      {walkin === "creada" && <QueryToast type="success" message="Reserva creada correctamente." />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recepción — {organization.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Turno abierto por {session.user.name} · base ${openShift.openingCash.toLocaleString("es-CO")}
          </p>
        </div>
        <Link
          href={`/${orgSlug}/pos/cierre`}
          className="hidden shrink-0 rounded-md bg-gray-900 px-3 py-3 text-sm font-medium text-white hover:bg-gray-800 sm:block"
        >
          Solicitar cierre de turno
        </Link>
      </div>

      <WalkInBookingForm orgSlug={orgSlug} venues={venues} />

      <BookingsList
        orgSlug={orgSlug}
        initialBookings={bookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          startTime: booking.startTime,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          receiptUrl: booking.receiptUrl,
          venueName: booking.venue.name,
        }))}
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3 sm:hidden">
        <Link
          href={`/${orgSlug}/pos/cierre`}
          className="block rounded-md bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
        >
          Solicitar cierre de turno
        </Link>
      </div>
    </main>
  );
}
