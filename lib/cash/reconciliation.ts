import { db } from "@/lib/db";
import { BookingStatus } from "@/lib/booking/state-machine";
import { businessDateFromInstant, businessDayRange } from "@/lib/time/business-day";

export interface ExpectedTotals {
  courtsTotal: number;
  barTotal: number;
  cash: number;
  transfer: number;
  card: number;
}

// negocio.md §4: suma de canchas, suma de barra y desglose por método de pago. Solo lo que entra
// como efectivo físico (settlementMethod EFECTIVO) participa en el conteo ciego — transferencias y
// datáfono se verifican por extracto bancario, no contando billetes.
export async function computeExpectedTotals(orgId: string, referenceInstant: Date): Promise<ExpectedTotals> {
  const { start, end } = businessDayRange(businessDateFromInstant(referenceInstant));

  const bookings = await db.booking.findMany({
    where: {
      orgId,
      date: { gte: start, lt: end },
      status: { in: [BookingStatus.CONFIRMADA, BookingStatus.EN_CURSO, BookingStatus.FINALIZADA] },
    },
  });

  const totals: ExpectedTotals = { courtsTotal: 0, barTotal: 0, cash: 0, transfer: 0, card: 0 };

  for (const booking of bookings) {
    totals.courtsTotal += booking.totalAmount;
    totals.barTotal += booking.consumptionTotal;

    if (booking.paymentMethod === "COMPROBANTE_MANUAL") {
      totals.transfer += booking.depositAmount;
    } else if (booking.paymentMethod === "BOLD") {
      totals.card += booking.depositAmount;
    }

    if (booking.status === BookingStatus.FINALIZADA) {
      const remainder = booking.totalAmount - booking.depositAmount + booking.consumptionTotal;
      if (booking.settlementMethod === "EFECTIVO") {
        totals.cash += remainder;
      } else if (booking.settlementMethod === "TRANSFERENCIA") {
        totals.transfer += remainder;
      } else if (booking.settlementMethod === "DATAFONO") {
        totals.card += remainder;
      }
    }
  }

  return totals;
}
