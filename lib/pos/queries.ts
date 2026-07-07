import { db } from "@/lib/db";
import { businessDayRange, todayBusinessDate } from "@/lib/time/business-day";

export async function getOpenShift(orgId: string) {
  return db.cashShift.findFirst({ where: { orgId, status: "ABIERTO" } });
}

export async function getTodayBookings(orgId: string) {
  const { start, end } = businessDayRange(todayBusinessDate());

  return db.booking.findMany({
    where: {
      orgId,
      date: { gte: start, lt: end },
      status: { not: "EXPIRADA" },
    },
    include: { venue: true },
    orderBy: { startTime: "asc" },
  });
}
