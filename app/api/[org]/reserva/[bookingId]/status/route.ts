import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { confirmBookingPayment } from "@/lib/booking/actions";
import { BookingStatus } from "@/lib/booking/state-machine";
import { getTransactionStatus, isBoldConfigured } from "@/lib/payments/bold";

// Mientras la reserva sigue PENDIENTE_PAGO, además de responder el estado actual, aprovecha para
// consultar la API de Bold y confirmar el pago si ya está aprobado — así el cliente ve la reserva
// confirmarse tras el redirect de Bold sin depender únicamente del webhook (que en ambiente de
// pruebas no se envía automáticamente).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ org: string; bookingId: string }> },
): Promise<Response> {
  const { org: orgSlug, bookingId } = await params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.orgId !== organization.id) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  if (booking.status === BookingStatus.PENDIENTE_PAGO && !booking.receiptUrl && isBoldConfigured()) {
    const transaction = await getTransactionStatus(bookingId);
    if (transaction?.status === "APPROVED") {
      await confirmBookingPayment(bookingId, transaction.transactionId);
      return NextResponse.json({ status: BookingStatus.CONFIRMADA });
    }
  }

  return NextResponse.json({ status: booking.status });
}
