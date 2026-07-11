import { $Enums } from "@/lib/generated/prisma";

export const BookingStatus = $Enums.BookingStatus;
export type BookingStatus = $Enums.BookingStatus;

export const PaymentMethod = $Enums.PaymentMethod;
export type PaymentMethod = $Enums.PaymentMethod;

export const SettlementMethod = $Enums.SettlementMethod;
export type SettlementMethod = $Enums.SettlementMethod;

export const CancelledBy = $Enums.CancelledBy;
export type CancelledBy = $Enums.CancelledBy;

// Estados que bloquean el cupo en la agenda (negocio.md §6.1 y §6.3).
const BLOCKING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.PENDIENTE_PAGO,
  BookingStatus.CONFIRMADA,
  BookingStatus.EN_CURSO,
]);

export function isBlockingStatus(status: BookingStatus): boolean {
  return BLOCKING_STATUSES.has(status);
}

// Transiciones permitidas de la máquina de estados (negocio.md §6.1).
const ALLOWED_TRANSITIONS: Record<BookingStatus, ReadonlyArray<BookingStatus>> = {
  [BookingStatus.PENDIENTE_PAGO]: [BookingStatus.CONFIRMADA, BookingStatus.EXPIRADA, BookingStatus.CANCELADA],
  [BookingStatus.CONFIRMADA]: [BookingStatus.EN_CURSO, BookingStatus.CANCELADA, BookingStatus.NO_SHOW],
  [BookingStatus.EN_CURSO]: [BookingStatus.FINALIZADA],
  [BookingStatus.FINALIZADA]: [],
  [BookingStatus.CANCELADA]: [],
  [BookingStatus.NO_SHOW]: [],
  [BookingStatus.EXPIRADA]: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function computeBlockingSlotKey(venueId: string, date: Date, startTime: string): string {
  return `${venueId}_${date.toISOString().slice(0, 10)}_${startTime}`;
}

// Usado al mover una reserva a un estado terminal: libera el cupo sin violar el índice @unique
// de blockingSlotKey (Prisma no soporta índices únicos sparse/parciales en MongoDB).
export function computeReleasedSlotKey(bookingId: string): string {
  return `released_${bookingId}`;
}

export interface CancellationPolicy {
  cancellationWindowHours: number;
}

export type CancellationOutcome =
  | { refundable: true; reason: "within_window" }
  | { refundable: false; reason: "late_cancellation" | "no_show" };

// negocio.md §6.2: cancelación con antelación vs. tardía vs. no-show.
export function computeCancellationOutcome(
  bookingStart: Date,
  now: Date,
  policy: CancellationPolicy,
): CancellationOutcome {
  const hoursUntilStart = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilStart < 0) {
    return { refundable: false, reason: "no_show" };
  }

  if (hoursUntilStart >= policy.cancellationWindowHours) {
    return { refundable: true, reason: "within_window" };
  }

  return { refundable: false, reason: "late_cancellation" };
}

// Solo letras (con tildes/ñ) y espacios — sin dígitos ni símbolos.
const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:\s[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;
// Exactamente 10 dígitos numéricos (celular colombiano sin indicativo).
const PHONE_PATTERN = /^\d{10}$/;

export function isValidCustomerName(customerName: string): boolean {
  const trimmed = customerName.trim();
  return trimmed.length >= 3 && NAME_PATTERN.test(trimmed);
}

export function isValidCustomerPhone(customerPhone: string): boolean {
  return PHONE_PATTERN.test(customerPhone.trim());
}

// ¿Ya tiene nombre/teléfono válidos? Función pura (sin DB), usada tanto por el botón de pago en el
// cliente (para decidir si deja pasar el clic real de Bold o pide completar los datos) como por el
// servidor (para no aceptar un comprobante manual sin datos de contacto válidos).
export function isContactComplete(customerName: string, customerPhone: string): boolean {
  return isValidCustomerName(customerName) && isValidCustomerPhone(customerPhone);
}
