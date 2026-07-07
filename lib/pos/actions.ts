"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/session-guards";
import { confirmBookingPayment } from "@/lib/booking/actions";
import { NotificationService } from "@/lib/notifications";
import { BookingStatus, canTransition, computeReleasedSlotKey } from "@/lib/booking/state-machine";

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

  await requireStaffSession(parsed.data.orgSlug);

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.CANCELADA)) {
    notFound();
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CANCELADA, blockingSlotKey: computeReleasedSlotKey(booking.id) },
  });

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

  redirect(`/${parsed.data.orgSlug}/pos`);
}
