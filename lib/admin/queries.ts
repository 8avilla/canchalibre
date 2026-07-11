import { db } from "@/lib/db";
import { BookingStatus } from "@/lib/booking/state-machine";
import { addBusinessDays, businessDayRange, todayBusinessDate } from "@/lib/time/business-day";

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
}

// Extraído de getDashboardMetrics para poder reutilizarlo también en /admin/alertas sin repetir el
// filtro "stock < umbral" (que Mongo/Prisma no puede expresar como where — se compara en JS).
export async function getLowStockProducts(orgId: string): Promise<LowStockProduct[]> {
  const products = await db.consumptionItem.findMany({ where: { orgId, active: true } });

  return products
    .filter((product) => product.stock < product.lowStockThreshold)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
    }));
}

export interface DashboardMetrics {
  bookingsByStatus: Record<string, number>;
  courtsRevenueToday: number;
  barRevenueToday: number;
  lowStockProducts: LowStockProduct[];
  openShift: boolean;
}

export async function getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const [bookings, lowStockProducts, openShift] = await Promise.all([
    db.booking.findMany({ where: { orgId, date: { gte: start, lt: end } } }),
    getLowStockProducts(orgId),
    db.cashShift.findFirst({ where: { orgId, status: "ABIERTO" } }),
  ]);

  const bookingsByStatus: Record<string, number> = {};
  let courtsRevenueToday = 0;
  let barRevenueToday = 0;

  for (const booking of bookings) {
    bookingsByStatus[booking.status] = (bookingsByStatus[booking.status] ?? 0) + 1;
    if (booking.status === BookingStatus.FINALIZADA) {
      courtsRevenueToday += booking.totalAmount;
      barRevenueToday += booking.consumptionTotal;
    }
  }

  return {
    bookingsByStatus,
    courtsRevenueToday,
    barRevenueToday,
    lowStockProducts,
    openShift: openShift !== null,
  };
}

export interface PendingPaymentBooking {
  id: string;
  venueName: string;
  customerName: string;
  startTime: string;
}

// Mismo scope de fecha (hoy) que getAdminAlertCounts — la lista real detrás del conteo de la
// campanita, para /admin/alertas.
export async function getPendingPaymentBookings(orgId: string): Promise<PendingPaymentBooking[]> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const bookings = await db.booking.findMany({
    where: { orgId, date: { gte: start, lt: end }, status: BookingStatus.PENDIENTE_PAGO },
    include: { venue: true },
    orderBy: { startTime: "asc" },
    take: 20,
  });

  return bookings.map((booking) => ({
    id: booking.id,
    venueName: booking.venue.name,
    customerName: booking.customerName || "Sin nombre todavía",
    startTime: booking.startTime,
  }));
}

export interface AdminAlertCounts {
  lowStockCount: number;
  pendingPaymentCount: number;
}

// Conteo liviano para el badge de notificaciones de la topbar (se corre en cada página del admin,
// vía el layout compartido) — separado de getDashboardMetrics porque ese trae TODAS las reservas
// de hoy con sus montos, más de lo que hace falta solo para un número en una campanita.
export async function getAdminAlertCounts(orgId: string): Promise<AdminAlertCounts> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const [products, pendingPaymentCount] = await Promise.all([
    db.consumptionItem.findMany({
      where: { orgId, active: true },
      select: { stock: true, lowStockThreshold: true },
    }),
    db.booking.count({
      where: { orgId, date: { gte: start, lt: end }, status: BookingStatus.PENDIENTE_PAGO },
    }),
  ]);

  const lowStockCount = products.filter((product) => product.stock < product.lowStockThreshold).length;

  return { lowStockCount, pendingPaymentCount };
}

export interface DailyRevenue {
  date: string;
  courtsTotal: number;
  barTotal: number;
  finalizadas: number;
  canceladas: number;
  noShow: number;
  statusCounts: Record<string, number>;
}

export async function getRevenueReport(orgId: string, days: number): Promise<DailyRevenue[]> {
  const today = todayBusinessDate();
  const results: DailyRevenue[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dateIso = addBusinessDays(today, -i);
    const { start, end } = businessDayRange(dateIso);

    const bookings = await db.booking.findMany({ where: { orgId, date: { gte: start, lt: end } } });

    let courtsTotal = 0;
    let barTotal = 0;
    let finalizadas = 0;
    let canceladas = 0;
    let noShow = 0;
    const statusCounts: Record<string, number> = {};

    for (const booking of bookings) {
      statusCounts[booking.status] = (statusCounts[booking.status] ?? 0) + 1;

      if (booking.status === BookingStatus.FINALIZADA) {
        courtsTotal += booking.totalAmount;
        barTotal += booking.consumptionTotal;
        finalizadas += 1;
      } else if (booking.status === BookingStatus.CANCELADA) {
        canceladas += 1;
      } else if (booking.status === BookingStatus.NO_SHOW) {
        noShow += 1;
      }
    }

    results.push({ date: dateIso, courtsTotal, barTotal, finalizadas, canceladas, noShow, statusCounts });
  }

  return results;
}

export interface PaymentMethodBreakdown {
  cash: number;
  transfer: number;
  card: number;
}

// Suma lo que cada turno de caja CERRADO en el rango ya calculó como esperado por método — negocio.md
// §4 clasifica el cierre en Efectivo/Transferencia/Datáfono, dato que hoy solo se ve turno a turno.
export async function getPaymentMethodBreakdown(orgId: string, days: number): Promise<PaymentMethodBreakdown> {
  const today = todayBusinessDate();
  const { start } = businessDayRange(addBusinessDays(today, -(days - 1)));
  const { end } = businessDayRange(today);

  const shifts = await db.cashShift.findMany({
    where: { orgId, status: "CERRADO", closedAt: { gte: start, lt: end } },
    select: { expectedCash: true, expectedTransfer: true, expectedCard: true },
  });

  return shifts.reduce(
    (totals, shift) => ({
      cash: totals.cash + (shift.expectedCash ?? 0),
      transfer: totals.transfer + (shift.expectedTransfer ?? 0),
      card: totals.card + (shift.expectedCard ?? 0),
    }),
    { cash: 0, transfer: 0, card: 0 },
  );
}
