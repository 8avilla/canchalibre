"use server";

import { notFound, redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { BookingStatus, canTransition, computeReleasedSlotKey } from "@/lib/booking/state-machine";

const createVenueSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2),
  type: z.enum(["FUTBOL_5", "FUTBOL_8", "PADEL"]),
  hourlyRate: z.coerce.number().int().min(0),
});

export async function createVenue(formData: FormData): Promise<void> {
  const parsed = createVenueSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    name: formData.get("name"),
    type: formData.get("type"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  const org = await db.organization.findUnique({ where: { slug: parsed.data.orgSlug } });
  if (!org) {
    notFound();
  }

  await db.venue.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      type: parsed.data.type,
      hourlyRate: parsed.data.hourlyRate,
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/canchas`);
}

const updateVenueSchema = z.object({
  orgSlug: z.string().min(1),
  venueId: z.string().min(1),
  hourlyRate: z.coerce.number().int().min(0),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  active: z.enum(["true", "false"]),
});

export async function updateVenue(formData: FormData): Promise<void> {
  const parsed = updateVenueSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    venueId: formData.get("venueId"),
    hourlyRate: formData.get("hourlyRate"),
    imageUrl: formData.get("imageUrl"),
    capacity: formData.get("capacity"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  await db.venue.update({
    where: { id: parsed.data.venueId },
    data: {
      hourlyRate: parsed.data.hourlyRate,
      imageUrl: parsed.data.imageUrl || null,
      capacity: parsed.data.capacity ?? null,
      active: parsed.data.active === "true",
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/canchas`);
}

const createProductSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2),
  price: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
});

export async function createProduct(formData: FormData): Promise<void> {
  const parsed = createProductSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  const org = await db.organization.findUnique({ where: { slug: parsed.data.orgSlug } });
  if (!org) {
    notFound();
  }

  await db.consumptionItem.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      price: parsed.data.price,
      stock: parsed.data.stock,
      lowStockThreshold: parsed.data.lowStockThreshold,
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/inventario`);
}

const updateProductSchema = z.object({
  orgSlug: z.string().min(1),
  productId: z.string().min(1),
  price: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
  active: z.enum(["true", "false"]),
});

export async function updateProduct(formData: FormData): Promise<void> {
  const parsed = updateProductSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    productId: formData.get("productId"),
    price: formData.get("price"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  await db.consumptionItem.update({
    where: { id: parsed.data.productId },
    data: {
      price: parsed.data.price,
      lowStockThreshold: parsed.data.lowStockThreshold,
      active: parsed.data.active === "true",
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/inventario`);
}

const adjustStockSchema = z.object({
  orgSlug: z.string().min(1),
  productId: z.string().min(1),
  delta: z.coerce.number().int(),
});

// Entrada (o corrección) de almacén — negocio.md §6.4: "Ajustar inventario" es exclusivo de ADMIN.
export async function adjustStock(formData: FormData): Promise<void> {
  const parsed = adjustStockSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    productId: formData.get("productId"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  const product = await db.consumptionItem.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    notFound();
  }

  const newStock = Math.max(0, product.stock + parsed.data.delta);

  await db.consumptionItem.update({
    where: { id: product.id },
    data: { stock: newStock },
  });

  redirect(`/${parsed.data.orgSlug}/admin/inventario`);
}

const settingsSchema = z.object({
  orgSlug: z.string().min(1),
  depositPercentage: z.coerce.number().int().min(1).max(100),
  cancellationWindowHours: z.coerce.number().int().min(0),
  bookingHoldMinutes: z.coerce.number().int().min(1),
});

export async function updateOrganizationSettings(formData: FormData): Promise<void> {
  const parsed = settingsSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    depositPercentage: formData.get("depositPercentage"),
    cancellationWindowHours: formData.get("cancellationWindowHours"),
    bookingHoldMinutes: formData.get("bookingHoldMinutes"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  await db.organization.update({
    where: { slug: parsed.data.orgSlug },
    data: {
      depositPercentage: parsed.data.depositPercentage,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      bookingHoldMinutes: parsed.data.bookingHoldMinutes,
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/configuracion`);
}

const cancelBookingSchema = z.object({
  orgSlug: z.string().min(1),
  bookingId: z.string().min(1),
});

// negocio.md §6.4: "Cancelar reserva confirmada" — el empleado no puede, solo el ADMIN.
export async function cancelConfirmedBooking(formData: FormData): Promise<void> {
  const parsed = cancelBookingSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.CANCELADA)) {
    notFound();
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CANCELADA, blockingSlotKey: computeReleasedSlotKey(booking.id) },
  });

  redirect(`/${parsed.data.orgSlug}/admin/reservas`);
}

const createUserSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
});

export async function createUser(formData: FormData): Promise<void> {
  const parsed = createUserSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect(`/${formData.get("orgSlug")}/admin/usuarios?error=datos_invalidos`);
  }

  await requireAdminSession(parsed.data.orgSlug);

  const org = await db.organization.findUnique({ where: { slug: parsed.data.orgSlug } });
  if (!org) {
    notFound();
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    redirect(`/${parsed.data.orgSlug}/admin/usuarios?error=email_en_uso`);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await db.user.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/usuarios`);
}

const updateUserSchema = z.object({
  orgSlug: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  active: z.enum(["true", "false"]),
});

export async function updateUser(formData: FormData): Promise<void> {
  const parsed = updateUserSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    userId: formData.get("userId"),
    role: formData.get("role"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  const session = await requireAdminSession(parsed.data.orgSlug);

  // Un admin no puede quitarse a sí mismo el rol ni desactivar su propia cuenta — evita que la
  // organización se quede sin nadie que pueda entrar al panel.
  if (parsed.data.userId === session.user.id && (parsed.data.role !== "ADMIN" || parsed.data.active !== "true")) {
    redirect(`/${parsed.data.orgSlug}/admin/usuarios?error=no_autogestion`);
  }

  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.orgId !== session.user.orgId) {
    notFound();
  }

  await db.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role, active: parsed.data.active === "true" },
  });

  redirect(`/${parsed.data.orgSlug}/admin/usuarios`);
}

const resetPasswordSchema = z.object({
  orgSlug: z.string().min(1),
  userId: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function resetUserPassword(formData: FormData): Promise<void> {
  const parsed = resetPasswordSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    redirect(`/${formData.get("orgSlug")}/admin/usuarios?error=datos_invalidos`);
  }

  const session = await requireAdminSession(parsed.data.orgSlug);

  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.orgId !== session.user.orgId) {
    notFound();
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  redirect(`/${parsed.data.orgSlug}/admin/usuarios?ok=clave_actualizada`);
}

const blockSlotSchema = z.object({
  orgSlug: z.string().min(1),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional(),
});

// Bloquea un horario por mantenimiento (ej. luces dañadas) sin que exista una reserva real.
export async function blockSlot(formData: FormData): Promise<void> {
  const parsed = blockSlotSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    venueId: formData.get("venueId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession(parsed.data.orgSlug);

  const org = await db.organization.findUnique({ where: { slug: parsed.data.orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: parsed.data.venueId } });
  if (!venue || venue.orgId !== org.id) {
    notFound();
  }

  // Si ya hay una reserva real en ese horario, no se puede bloquear por mantenimiento.
  const dateObj = new Date(`${parsed.data.date}T00:00:00.000-05:00`);
  const existingBooking = await db.booking.findFirst({
    where: {
      venueId: venue.id,
      date: dateObj,
      startTime: parsed.data.startTime,
      status: { in: ["PENDIENTE_PAGO", "CONFIRMADA", "EN_CURSO"] },
    },
  });
  if (existingBooking) {
    redirect(
      `/${parsed.data.orgSlug}/admin/mantenimiento?venueId=${venue.id}&date=${parsed.data.date}&error=horario_ocupado`,
    );
  }

  await db.slotBlock.create({
    data: {
      orgId: org.id,
      venueId: venue.id,
      date: dateObj,
      startTime: parsed.data.startTime,
      reason: parsed.data.reason,
    },
  });

  redirect(`/${parsed.data.orgSlug}/admin/mantenimiento?venueId=${venue.id}&date=${parsed.data.date}`);
}

const unblockSlotSchema = z.object({
  orgSlug: z.string().min(1),
  slotBlockId: z.string().min(1),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function unblockSlot(formData: FormData): Promise<void> {
  const parsed = unblockSlotSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    slotBlockId: formData.get("slotBlockId"),
    venueId: formData.get("venueId"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    notFound();
  }

  const session = await requireAdminSession(parsed.data.orgSlug);

  const block = await db.slotBlock.findUnique({ where: { id: parsed.data.slotBlockId } });
  if (!block || block.orgId !== session.user.orgId) {
    notFound();
  }

  await db.slotBlock.delete({ where: { id: block.id } });

  redirect(`/${parsed.data.orgSlug}/admin/mantenimiento?venueId=${parsed.data.venueId}&date=${parsed.data.date}`);
}
