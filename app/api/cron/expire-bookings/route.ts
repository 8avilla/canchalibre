import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BookingStatus, computeReleasedSlotKey } from "@/lib/booking/state-machine";

// Pensado para Vercel Cron (llama por GET con `Authorization: Bearer $CRON_SECRET`), pero cualquier
// scheduler externo sirve mientras mande ese header.
export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  // Las reservas con comprobante manual subido quedan "en verificación": su aprobación/rechazo es
  // manual desde el POS de recepción (Fase 2), no se expiran automáticamente aquí.
  const expiredCandidates = await db.booking.findMany({
    where: {
      status: BookingStatus.PENDIENTE_PAGO,
      receiptUrl: null,
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
  });

  await Promise.all(
    expiredCandidates.map((booking) =>
      db.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRADA, blockingSlotKey: computeReleasedSlotKey(booking.id) },
      }),
    ),
  );

  return NextResponse.json({ expired: expiredCandidates.length });
}
