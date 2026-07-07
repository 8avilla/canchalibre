import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente de la pasarela Bold (Colombia). Aislado del resto de la app para que, cuando falten
 * credenciales, el flujo de reservas caiga automáticamente al comprobante manual (negocio.md §6.2)
 * en vez de romperse.
 *
 * Verificado contra la documentación oficial (developers.bold.co) el 2026-07-06:
 * - Botón de pagos: https://developers.bold.co/pagos-en-linea/boton-de-pagos/integracion-manual/integracion-manual
 * - Webhooks: https://developers.bold.co/webhook
 */

// "Llave de identidad" (pública, identifica el comercio) y "llave secreta" (privada, nunca se
// expone al cliente) — https://developers.bold.co/pagos-en-linea/llaves-de-integracion
const BOLD_API_KEY = process.env.NEXT_PUBLIC_BOLD_API_KEY;
const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY;

export function isBoldConfigured(): boolean {
  return Boolean(BOLD_API_KEY && BOLD_SECRET_KEY);
}

export interface BoldCheckoutParams {
  orderId: string;
  amount: number;
  currency?: string;
  description: string;
  redirectionUrl: string;
}

export interface BoldCheckoutPayload {
  apiKey: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  redirectionUrl: string;
  integritySignature: string;
}

// Firma de integridad del botón de pagos: SHA-256 (no HMAC) de "{orderId}{amount}{currency}{secretKey}"
// concatenados sin separadores, en ese orden exacto.
export function buildCheckoutPayload(params: BoldCheckoutParams): BoldCheckoutPayload {
  if (!isBoldConfigured() || !BOLD_API_KEY || !BOLD_SECRET_KEY) {
    throw new Error("Bold no está configurado (faltan NEXT_PUBLIC_BOLD_API_KEY/BOLD_SECRET_KEY en .env)");
  }

  const currency = params.currency ?? "COP";
  const integritySignature = createHash("sha256")
    .update(`${params.orderId}${params.amount}${currency}${BOLD_SECRET_KEY}`)
    .digest("hex");

  return {
    apiKey: BOLD_API_KEY,
    orderId: params.orderId,
    amount: params.amount,
    currency,
    description: params.description,
    redirectionUrl: params.redirectionUrl,
    integritySignature,
  };
}

// Verificación de webhook: HMAC-SHA256 (hex) del cuerpo crudo codificado en Base64, usando la
// llave secreta. Header: x-bold-signature. En ambiente de pruebas Bold firma con string vacío.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!BOLD_SECRET_KEY || !signatureHeader) {
    return false;
  }

  const encodedBody = Buffer.from(rawBody, "utf-8").toString("base64");
  const expected = createHmac("sha256", BOLD_SECRET_KEY).update(encodedBody).digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signatureHeader, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Eventos documentados: SALE_APPROVED / SALE_REJECTED (estructura CloudEvents v1.0). El order-id
// que pusimos en el botón (booking.id) vuelve en data.metadata.reference; data.payment_id es el id
// de la transacción de Bold.
export interface BoldWebhookEvent {
  type: "SALE_APPROVED" | "SALE_REJECTED";
  paymentId: string;
  bookingId: string;
}

export function parseWebhookEvent(payload: unknown): BoldWebhookEvent | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const root = payload as Record<string, unknown>;

  if (root.type !== "SALE_APPROVED" && root.type !== "SALE_REJECTED") {
    return null;
  }

  if (typeof root.data !== "object" || root.data === null) {
    return null;
  }
  const data = root.data as Record<string, unknown>;

  const paymentId = data.payment_id;
  if (typeof paymentId !== "string") {
    return null;
  }

  if (typeof data.metadata !== "object" || data.metadata === null) {
    return null;
  }
  const reference = (data.metadata as Record<string, unknown>).reference;
  if (typeof reference !== "string") {
    return null;
  }

  return { type: root.type, paymentId, bookingId: reference };
}

export type BoldTransactionStatus =
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "VOIDED"
  | "PROCESSING"
  | "PENDING"
  | "NO_TRANSACTION_FOUND";

export interface BoldTransaction {
  status: BoldTransactionStatus;
  transactionId: string;
}

// Consulta el estado definitivo de una transacción por order-id (nuestro booking.id).
// https://developers.bold.co/pagos-en-linea/consulta-de-transacciones — Bold advierte que el
// `bold-tx-status` que llega en la URL de redirección "puede no ser el definitivo" (y además
// cualquiera podría fabricar esa URL a mano), así que la confirmación real de un pago SIEMPRE debe
// pasar por aquí o por el webhook firmado, nunca por el query param solo.
export async function getTransactionStatus(orderId: string): Promise<BoldTransaction | null> {
  if (!BOLD_API_KEY) {
    return null;
  }

  const response = await fetch(`https://payments.api.bold.co/v2/payment-voucher/${orderId}`, {
    headers: { Authorization: `x-api-key ${BOLD_API_KEY}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const { payment_status: status, transaction_id: transactionId } = data as Record<string, unknown>;

  if (typeof status !== "string" || typeof transactionId !== "string") {
    return null;
  }

  return { status: status as BoldTransactionStatus, transactionId };
}
