import { NextResponse } from "next/server";
import { confirmBookingPayment } from "@/lib/booking/actions";
import { parseWebhookEvent, verifyWebhookSignature } from "@/lib/payments/bold";

// Bold espera un 200 en <2s para confirmar recepción y reintenta si no lo recibe — por eso
// respondemos "received: true" incluso para eventos que no nos interesan (ej. SALE_REJECTED),
// en vez de tratarlos como error.
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-bold-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const event = parseWebhookEvent(payload);
  if (!event) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  if (event.type === "SALE_APPROVED") {
    // confirmBookingPayment es idempotente (solo actúa si la reserva sigue PENDIENTE_PAGO), así
    // que un reintento del webhook no causa problema.
    await confirmBookingPayment(event.bookingId, event.paymentId);
  }

  return NextResponse.json({ received: true });
}
