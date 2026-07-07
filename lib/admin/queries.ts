import { db } from "@/lib/db";
import { BookingStatus } from "@/lib/booking/state-machine";
import { addBusinessDays, businessDayRange, todayBusinessDate } from "@/lib/time/business-day";

export interface DashboardMetrics {
  bookingsByStatus: Record<string, number>;
  courtsRevenueToday: number;
  barRevenueToday: number;
  lowStockProducts: { id: string; name: string; stock: number; lowStockThreshold: number }[];
  openShift: boolean;
}

export async function getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const bookings = await db.booking.findMany({
    where: { orgId, date: { gte: start, lt: end } },
  });

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

  const lowStockProducts = await db.consumptionItem.findMany({
    where: { orgId, active: true },
  });

  const openShift = (await db.cashShift.findFirst({ where: { orgId, status: "ABIERTO" } })) !== null;

  return {
    bookingsByStatus,
    courtsRevenueToday,
    barRevenueToday,
    lowStockProducts: lowStockProducts
      .filter((product) => product.stock < product.lowStockThreshold)
      .map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
      })),
    openShift,
  };
}

export interface DailyRevenue {
  date: string;
  courtsTotal: number;
  barTotal: number;
  finalizadas: number;
  canceladas: number;
  noShow: number;
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

    for (const booking of bookings) {
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

    results.push({ date: dateIso, courtsTotal, barTotal, finalizadas, canceladas, noShow });
  }

  return results;
}
