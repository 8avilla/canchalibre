import { db } from "@/lib/db";
import { BookingStatus, isBlockingStatus } from "@/lib/booking/state-machine";
import { CLOSING_HOUR, OPENING_HOUR } from "@/lib/booking/availability";
import { addBusinessDays, businessDayRange, businessTimeNow, todayBusinessDate } from "@/lib/time/business-day";

const VENUE_STATS_WINDOW_DAYS = 30;
const COUNTED_BOOKING_STATUSES = [BookingStatus.CONFIRMADA, BookingStatus.EN_CURSO, BookingStatus.FINALIZADA];

export interface VenueStats30d {
  bookingsCount: number;
  hoursBooked: number;
  revenue: number;
  occupancyRate: number; // 0..1
}

// Últimos 30 días de una cancha puntual, para la página de detalle (/admin/canchas/[venueId]).
// "Horas reservadas" hoy coincide con "Reservas" porque cada turno dura 1 hora fija en este sistema
// — se muestran como dos métricas separadas por paridad con el mockup, aunque de momento son el
// mismo número. La ocupación es una métrica simple (no descuenta mantenimiento ni feriados):
// reservas contadas ÷ (30 días × horas de operación por día).
export async function getVenueStats30d(venueId: string): Promise<VenueStats30d> {
  const today = todayBusinessDate();
  const { start } = businessDayRange(addBusinessDays(today, -(VENUE_STATS_WINDOW_DAYS - 1)));
  const { end } = businessDayRange(today);

  const bookings = await db.booking.findMany({
    where: { venueId, date: { gte: start, lt: end }, status: { in: COUNTED_BOOKING_STATUSES } },
    select: { totalAmount: true },
  });

  const bookingsCount = bookings.length;
  const revenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const operatingHoursPerDay = CLOSING_HOUR - OPENING_HOUR;
  const occupancyRate = bookingsCount / (VENUE_STATS_WINDOW_DAYS * operatingHoursPerDay);

  return { bookingsCount, hoursBooked: bookingsCount, revenue, occupancyRate };
}

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

const REVENUE_COUNTED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMADA,
  BookingStatus.EN_CURSO,
  BookingStatus.FINALIZADA,
];

export interface ReservasStatCards {
  reservasHoy: number;
  reservasHoyDeltaPct: number | null; // null = sin dato de ayer para comparar (evita mostrar "+Infinity%")
  ingresosHoy: number;
  ingresosHoyDeltaPct: number | null;
  ocupacionPromedio: number; // 0..1
  ocupacionLabel: "Muy alta" | "Alta" | "Baja";
  reservasPendientes: number;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Las 4 stat cards del header de /admin/reservas (vista agenda). "Ocupación promedio" asume 1 hora
// fija por turno (igual que getVenueStats30d) — bookingsCount de estado bloqueante ÷ (canchas × horas
// de operación del día).
export async function getReservasStatCards(orgId: string, dateIso: string): Promise<ReservasStatCards> {
  const { start, end } = businessDayRange(dateIso);
  const { start: yStart, end: yEnd } = businessDayRange(addBusinessDays(dateIso, -1));

  const [venuesCount, todayBookings, yesterdayBookings] = await Promise.all([
    db.venue.count({ where: { orgId } }),
    db.booking.findMany({ where: { orgId, date: { gte: start, lt: end } } }),
    db.booking.findMany({ where: { orgId, date: { gte: yStart, lt: yEnd } } }),
  ]);

  const countActive = (bookings: typeof todayBookings) =>
    bookings.filter((b) => b.status !== BookingStatus.CANCELADA).length;
  const sumRevenue = (bookings: typeof todayBookings) =>
    bookings
      .filter((b) => REVENUE_COUNTED_STATUSES.includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

  const reservasHoy = countActive(todayBookings);
  const ingresosHoy = sumRevenue(todayBookings);

  const blockingHoy = todayBookings.filter((b) => isBlockingStatus(b.status)).length;
  const capacityHoy = venuesCount * (CLOSING_HOUR - OPENING_HOUR);
  const ocupacionPromedio = capacityHoy > 0 ? blockingHoy / capacityHoy : 0;
  const ocupacionLabel = ocupacionPromedio >= 0.8 ? "Muy alta" : ocupacionPromedio >= 0.5 ? "Alta" : "Baja";

  const reservasPendientes = todayBookings.filter((b) => b.status === BookingStatus.PENDIENTE_PAGO).length;

  return {
    reservasHoy,
    reservasHoyDeltaPct: deltaPct(reservasHoy, countActive(yesterdayBookings)),
    ingresosHoy,
    ingresosHoyDeltaPct: deltaPct(ingresosHoy, sumRevenue(yesterdayBookings)),
    ocupacionPromedio,
    ocupacionLabel,
    reservasPendientes,
  };
}

export interface AgendaVenue {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
}

export interface AgendaBooking {
  id: string;
  venueId: string;
  customerName: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  recurringBookingId: string | null;
}

export interface AgendaData {
  venues: AgendaVenue[];
  bookingsByVenue: Record<string, AgendaBooking[]>;
}

// Datos de la vista agenda (grid canchas × horas) para un solo día — incluye reservas canceladas
// (se muestran tachadas/rojas en el grid, igual que en el mockup) en vez de ocultarlas.
export async function getAgendaBookings(orgId: string, dateIso: string): Promise<AgendaData> {
  const { start, end } = businessDayRange(dateIso);

  const [venues, bookings] = await Promise.all([
    db.venue.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.booking.findMany({
      where: { orgId, date: { gte: start, lt: end } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const bookingsByVenue: Record<string, AgendaBooking[]> = {};
  for (const venue of venues) {
    bookingsByVenue[venue.id] = [];
  }
  for (const booking of bookings) {
    (bookingsByVenue[booking.venueId] ??= []).push({
      id: booking.id,
      venueId: booking.venueId,
      customerName: booking.customerName,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      recurringBookingId: booking.recurringBookingId,
    });
  }

  return {
    venues: venues.map((v) => ({ id: v.id, name: v.name, type: v.type, capacity: v.capacity })),
    bookingsByVenue,
  };
}

export interface UpcomingBooking {
  id: string;
  venueName: string;
  venueType: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

// Lista "Próximas reservas" bajo la agenda: si se está viendo el día de hoy, solo turnos que aún no
// empezaron; si se está viendo otro día, el día completo.
export async function getUpcomingBookings(orgId: string, dateIso: string, limit = 8): Promise<UpcomingBooking[]> {
  const { start, end } = businessDayRange(dateIso);
  const isToday = dateIso === todayBusinessDate();

  const bookings = await db.booking.findMany({
    where: {
      orgId,
      date: { gte: start, lt: end },
      status: { not: BookingStatus.CANCELADA },
      ...(isToday ? { startTime: { gte: businessTimeNow() } } : {}),
    },
    include: { venue: true },
    orderBy: { startTime: "asc" },
    take: limit,
  });

  return bookings.map((b) => ({
    id: b.id,
    venueName: b.venue.name,
    venueType: b.venue.type,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
  }));
}
