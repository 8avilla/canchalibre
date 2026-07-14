"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db, isUniqueConstraintError } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/session-guards";
import { logAdminAction } from "@/lib/admin/audit";
import { confirmBookingPayment } from "@/lib/booking/actions";
import { OPENING_HOUR, CLOSING_HOUR } from "@/lib/booking/availability";
import { NotificationService } from "@/lib/notifications";
import {
  BookingStatus,
  CancelledBy,
  canTransition,
  computeBlockingSlotKey,
  computeReleasedSlotKey,
  isValidCustomerName,
  isValidCustomerPhone,
} from "@/lib/booking/state-machine";
import { buildSlotLockKeys, getVenueUnitIds, releaseSlotLocks } from "@/lib/booking/slot-locks";
import { businessDayStart } from "@/lib/time/business-day";

const openShiftSchema = z.object({
  orgSlug: z.string().min(1),
  openingCash: z.coerce.number().int().min(0),
});

export async function openCashShift(formData: FormData): Promise<void> {
  const parsed = openShiftSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    openingCash: formData.get("openingCash"),
  });
  if (!parsed.success) {
    notFound();
  }

  const session = await requireStaffSession(parsed.data.orgSlug);
  const org = await db.organization.findUnique({ where: { slug: parsed.data.orgSlug } });
  if (!org) {
    notFound();
  }

  const existingShift = await db.cashShift.findFirst({
    where: { orgId: org.id, status: "ABIERTO" },
  });

  if (!existingShift) {
    await db.cashShift.create({
      data: {
        orgId: org.id,
        employeeId: session.user.id,
        openingCash: parsed.data.openingCash,
      },
    });
  }

  redirect(`/${parsed.data.orgSlug}/pos`);
}

function slotEndTime(startTime: string): string {
  const hour = Number(startTime.slice(0, 2));
  return `${String(hour + 1).padStart(2, "0")}:00`;
}

const createWalkInBookingSchema = z.object({
  orgSlug: z.string().min(1),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/), // hora en punto — mismo grid de 1h fijo del resto de la app
  customerName: z.string().trim(),
  customerPhone: z.string().trim(),
});

// Reserva manual/walk-in (negocio.md §6.4: "Crear/asignar reserva manual" — Sí para Empleado y
// Admin). El cliente ya está presencial y ya pagó, así que se crea directo en CONFIRMADA, sin Bold ni
// comprobante — a diferencia de createBookingShell (flujo público), que arranca en PENDIENTE_PAGO.
export async function createWalkInBooking(formData: FormData): Promise<void> {
  const parsed = createWalkInBookingSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    venueId: formData.get("venueId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
  });
  if (
    !parsed.success ||
    !isValidCustomerName(parsed.data.customerName) ||
    !isValidCustomerPhone(parsed.data.customerPhone)
  ) {
    redirect(`/${formData.get("orgSlug")}/pos?error=datos_invalidos`);
  }

  const { orgSlug, venueId, date, startTime, customerName, customerPhone } = parsed.data;

  const hour = Number(startTime.slice(0, 2));
  if (hour < OPENING_HOUR || hour >= CLOSING_HOUR) {
    notFound();
  }

  const session = await requireStaffSession(orgSlug);

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== org.id || !venue.active) {
    notFound();
  }

  const dateObj = businessDayStart(date);
  const endTime = slotEndTime(startTime);

  const walkInData = {
    orgId: org.id,
    venueId: venue.id,
    customerName,
    customerPhone,
    date: dateObj,
    startTime,
    endTime,
    status: BookingStatus.CONFIRMADA,
    blockingSlotKey: computeBlockingSlotKey(venue.id, dateObj, startTime),
    totalAmount: venue.hourlyRate,
    depositAmount: venue.hourlyRate, // pagado de contado en persona, sin saldo pendiente
  };

  // Cancha combinable (ver Venue.linkedVenueIds y lib/booking/slot-locks.ts) — mismo mecanismo que
  // createBookingShell (flujo público).
  const unitIds = getVenueUnitIds(venue);
  const isCombinable = !(unitIds.length === 1 && unitIds[0] === venue.id);

  try {
    if (!isCombinable) {
      await db.booking.create({ data: walkInData });
    } else {
      const slotLockKeys = buildSlotLockKeys(unitIds, dateObj, startTime);
      await db.$transaction(async (tx) => {
        const booking = await tx.booking.create({ data: walkInData });
        for (const key of slotLockKeys) {
          await tx.slotLock.create({ data: { key, bookingId: booking.id } });
        }
      });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect(`/${orgSlug}/pos?error=cupo_no_disponible`);
    }
    throw error;
  }

  await logAdminAction({
    orgId: org.id,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.createWalkIn",
    summary: `Creó reserva walk-in para ${customerName} en ${venue.name} el ${date} ${startTime}`,
  });

  redirect(`/${orgSlug}/pos?walkin=creada`);
}

const bookingActionSchema = z.object({
  orgSlug: z.string().min(1),
  bookingId: z.string().min(1),
});

export async function markGroupInCourt(formData: FormData): Promise<void> {
  const parsed = bookingActionSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireStaffSession(parsed.data.orgSlug);

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.EN_CURSO)) {
    notFound();
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.EN_CURSO },
  });

  redirect(`/${parsed.data.orgSlug}/pos`);
}

export async function approveManualReceipt(formData: FormData): Promise<void> {
  const parsed = bookingActionSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireStaffSession(parsed.data.orgSlug);
  await confirmBookingPayment(parsed.data.bookingId);

  redirect(`/${parsed.data.orgSlug}/pos`);
}

export async function rejectManualReceipt(formData: FormData): Promise<void> {
  const parsed = bookingActionSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
  });
  if (!parsed.success) {
    notFound();
  }

  const session = await requireStaffSession(parsed.data.orgSlug);

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.CANCELADA)) {
    notFound();
  }

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELADA,
      blockingSlotKey: computeReleasedSlotKey(booking.id),
      cancelledAt: new Date(),
      cancelledBy: session.user.role === "EMPLOYEE" ? CancelledBy.EMPLOYEE : CancelledBy.ADMIN,
    },
  });
  await releaseSlotLocks(booking.id);

  redirect(`/${parsed.data.orgSlug}/pos`);
}

const addItemSchema = z.object({
  orgSlug: z.string().min(1),
  bookingId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
});

export async function addConsumptionItem(formData: FormData): Promise<void> {
  const parsed = addItemSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireStaffSession(parsed.data.orgSlug);
  const { bookingId, productId, quantity } = parsed.data;

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== BookingStatus.EN_CURSO) {
    notFound();
  }

  const stockCrossedThreshold = await db.$transaction(async (tx) => {
    const product = await tx.consumptionItem.findUnique({ where: { id: productId } });
    if (!product || product.orgId !== booking.orgId || !product.active || product.stock < quantity) {
      throw new Error("Producto no disponible o sin stock suficiente");
    }

    const updatedProduct = await tx.consumptionItem.update({
      where: { id: product.id },
      data: { stock: { decrement: quantity } },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        consumptionLines: {
          push: {
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity,
          },
        },
        consumptionTotal: { increment: product.price * quantity },
      },
    });

    const crossedThreshold =
      product.stock >= product.lowStockThreshold && updatedProduct.stock < updatedProduct.lowStockThreshold;

    return crossedThreshold ? updatedProduct : null;
  });

  if (stockCrossedThreshold) {
    const admin = await db.user.findFirst({ where: { orgId: booking.orgId, role: "ADMIN" } });
    if (admin) {
      await NotificationService.sendLowStockAlert({
        adminEmail: admin.email,
        productName: stockCrossedThreshold.name,
        stock: stockCrossedThreshold.stock,
        threshold: stockCrossedThreshold.lowStockThreshold,
      });
    }
  }

  redirect(`/${parsed.data.orgSlug}/pos/reservas/${bookingId}`);
}

const closeAccountSchema = bookingActionSchema.extend({
  settlementMethod: z.enum(["EFECTIVO", "TRANSFERENCIA", "DATAFONO"]),
});

export async function closeAccount(formData: FormData): Promise<void> {
  const parsed = closeAccountSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
    settlementMethod: formData.get("settlementMethod"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireStaffSession(parsed.data.orgSlug);

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.FINALIZADA)) {
    notFound();
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.FINALIZADA, settlementMethod: parsed.data.settlementMethod },
  });
  await releaseSlotLocks(booking.id);

  redirect(`/${parsed.data.orgSlug}/pos`);
}
