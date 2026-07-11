"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ADMIN_ORG_COOKIE, requireAdminSession } from "@/lib/auth/session-guards";
import { notifyBookingCancelled } from "@/lib/booking/actions";
import {
  BookingStatus,
  CancelledBy,
  canTransition,
  computeBlockingSlotKey,
  computeCancellationOutcome,
  computeReleasedSlotKey,
} from "@/lib/booking/state-machine";
import { isValidMunicipio } from "@/lib/data/colombia";
import { db, isUniqueConstraintError } from "@/lib/db";
import { uploadOrganizationLogo, uploadVenuePhoto } from "@/lib/storage/azure";
import { addBusinessDays, businessDateTimeInstant, businessDayStart } from "@/lib/time/business-day";
import { logAdminAction } from "./audit";

const MAX_RECURRING_OCCURRENCES = 52;

// Resuelve el orgId real a partir del slug de la URL en vez de confiar en session.user.orgId — ese
// campo es undefined para SUPERADMIN (no pertenece a ninguna organización, pero sí puede operar
// sobre cualquiera vía requireAdminSession).
async function resolveOrgId(orgSlug: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } });
  if (!org) {
    notFound();
  }
  return org.id;
}

const createVenueSchema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(["FUTBOL_5", "FUTBOL_8", "PADEL"]),
  hourlyRate: z.coerce.number().int().min(0),
});

export async function createVenue(formData: FormData): Promise<void> {
  const parsed = createVenueSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      type: parsed.data.type,
      hourlyRate: parsed.data.hourlyRate,
    },
  });

  redirect(`/admin/canchas?creada=${venue.id}`);
}

const MAX_VENUE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_VENUE_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_VENUE_PHOTOS = 8;

const updateVenueSchema = z.object({
  venueId: z.string().min(1),
  hourlyRate: z.coerce.number().int().min(0),
  // El orden importa: Number("") es 0 (no NaN), así que si coerce.number() fuera la primera rama,
  // un campo vacío se guardaría como capacity=0 en vez de quedar sin definir.
  capacity: z.literal("").transform(() => undefined).or(z.coerce.number().int().min(0)),
  active: z.enum(["true", "false"]),
});

// Fotos: input de archivo real (Azure Blob, mismo patrón que uploadOrganizationLogo) en vez del
// textarea de URLs anterior — el admin no siempre tiene dónde hostear una foto para pegar el link.
// Las existentes se muestran como miniaturas con checkbox "Eliminar" (removePhotos); las nuevas se
// suben acá mismo y se agregan al arreglo.
export async function updateVenue(formData: FormData): Promise<void> {
  const parsed = updateVenueSchema.safeParse({
    venueId: formData.get("venueId"),
    hourlyRate: formData.get("hourlyRate"),
    capacity: formData.get("capacity"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const { venueId } = parsed.data;
  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    notFound();
  }

  const removePhotos = new Set(formData.getAll("removePhotos").map(String));
  const keptPhotos = venue.imageUrls.filter((url) => !removePhotos.has(url));

  const newFiles = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (keptPhotos.length + newFiles.length > MAX_VENUE_PHOTOS) {
    redirect("/admin/canchas?error=demasiadas_fotos");
  }

  for (const file of newFiles) {
    if (!ALLOWED_VENUE_PHOTO_TYPES.includes(file.type)) {
      redirect("/admin/canchas?error=foto_formato_invalido");
    }
    if (file.size > MAX_VENUE_PHOTO_SIZE_BYTES) {
      redirect("/admin/canchas?error=foto_muy_grande");
    }
  }

  const uploadedUrls = await Promise.all(newFiles.map((file) => uploadVenuePhoto(venueId, file)));

  if (parsed.data.hourlyRate !== venue.hourlyRate) {
    await logAdminAction({
      orgId: venue.orgId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      action: "venue.updatePrice",
      summary: `Cambió tarifa de ${venue.name} de $${venue.hourlyRate.toLocaleString("es-CO")} a $${parsed.data.hourlyRate.toLocaleString("es-CO")}`,
    });
  }

  await db.venue.update({
    where: { id: venueId },
    data: {
      hourlyRate: parsed.data.hourlyRate,
      imageUrls: [...keptPhotos, ...uploadedUrls],
      capacity: parsed.data.capacity ?? null,
      active: parsed.data.active === "true",
    },
  });

  redirect(`/admin/canchas?actualizado=${venueId}`);
}

const createProductSchema = z.object({
  name: z.string().trim().min(2),
  price: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
});

export async function createProduct(formData: FormData): Promise<void> {
  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const product = await db.consumptionItem.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      price: parsed.data.price,
      stock: parsed.data.stock,
      lowStockThreshold: parsed.data.lowStockThreshold,
    },
  });

  redirect(`/admin/inventario?creado=${product.id}`);
}

const updateProductSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
  active: z.enum(["true", "false"]),
});

export async function updateProduct(formData: FormData): Promise<void> {
  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    price: formData.get("price"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession();

  await db.consumptionItem.update({
    where: { id: parsed.data.productId },
    data: {
      price: parsed.data.price,
      lowStockThreshold: parsed.data.lowStockThreshold,
      active: parsed.data.active === "true",
    },
  });

  redirect(`/admin/inventario?actualizado=${parsed.data.productId}`);
}

const adjustStockSchema = z.object({
  productId: z.string().min(1),
  delta: z.coerce.number().int(),
});

// Entrada (o corrección) de almacén — negocio.md §6.4: "Ajustar inventario" es exclusivo de ADMIN.
export async function adjustStock(formData: FormData): Promise<void> {
  const parsed = adjustStockSchema.safeParse({
    productId: formData.get("productId"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const product = await db.consumptionItem.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    notFound();
  }

  const newStock = Math.max(0, product.stock + parsed.data.delta);

  await db.consumptionItem.update({
    where: { id: product.id },
    data: { stock: newStock },
  });

  await logAdminAction({
    orgId: product.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "product.adjustStock",
    summary: `Ajustó stock de ${product.name}: ${product.stock} → ${newStock} (${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta})`,
  });

  redirect(`/admin/inventario?actualizado=${product.id}`);
}

const settingsSchema = z.object({
  depositPercentage: z.coerce.number().int().min(1).max(100),
  cancellationWindowHours: z.coerce.number().int().min(0),
  bookingHoldMinutes: z.coerce.number().int().min(1),
});

export async function updateOrganizationSettings(formData: FormData): Promise<void> {
  const parsed = settingsSchema.safeParse({
    depositPercentage: formData.get("depositPercentage"),
    cancellationWindowHours: formData.get("cancellationWindowHours"),
    bookingHoldMinutes: formData.get("bookingHoldMinutes"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  await db.organization.update({
    where: { slug: orgSlug },
    data: {
      depositPercentage: parsed.data.depositPercentage,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      bookingHoldMinutes: parsed.data.bookingHoldMinutes,
    },
  });

  redirect("/admin/configuracion");
}

const slugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/),
});

// Cambiar el slug mueve todas las URLs públicas de la organización (/{slug}, /{slug}/pos, etc.) — el
// admin que hace el cambio sigue viendo su propio panel sin re-loguearse porque requireAdminSession
// resuelve el slug fresco desde orgId, no desde la sesión. Para SUPERADMIN (que "entra" vía la cookie
// admin_org_slug) sí hace falta actualizar esa cookie a mano, o quedaría apuntando al slug viejo.
export async function updateOrganizationSlug(formData: FormData): Promise<void> {
  const parsed = slugSchema.safeParse({ slug: formData.get("slug") });
  if (!parsed.success) {
    redirect("/admin/configuracion?error=slug_invalido");
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  if (parsed.data.slug === org.slug) {
    redirect("/admin/configuracion");
  }

  try {
    await db.organization.update({
      where: { id: org.id },
      data: { slug: parsed.data.slug },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/configuracion?error=slug_en_uso");
    }
    throw error;
  }

  if (session.user.role === "SUPERADMIN") {
    (await cookies()).set(ADMIN_ORG_COOKIE, parsed.data.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  redirect("/admin/configuracion?slug=actualizado");
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function updateOrganizationLogo(formData: FormData): Promise<void> {
  const { orgSlug } = await requireAdminSession();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/configuracion?error=logo_requerido");
  }

  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    redirect("/admin/configuracion?error=logo_formato_invalido");
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    redirect("/admin/configuracion?error=logo_muy_grande");
  }

  const logoUrl = await uploadOrganizationLogo(orgSlug, file as File);

  await db.organization.update({
    where: { slug: orgSlug },
    data: { logoUrl },
  });

  redirect("/admin/configuracion?logo=actualizado");
}

const updateLocationSchema = z.object({
  department: z.string().min(1),
  municipality: z.string().min(1),
  // Punto exacto del complejo en el mapa (LocationMapPicker) — separado de departamento/municipio,
  // que solo describen la región. Sin esto no hay pin que mostrar en el buscador principal.
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export async function updateOrganizationLocation(formData: FormData): Promise<void> {
  const parsed = updateLocationSchema.safeParse({
    department: formData.get("department"),
    municipality: formData.get("municipality"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    redirect("/admin/configuracion?error=ubicacion_invalida");
  }

  const { department, municipality, latitude, longitude } = parsed.data;

  const { orgSlug } = await requireAdminSession();

  if (!isValidMunicipio(department, municipality)) {
    redirect("/admin/configuracion?error=ubicacion_invalida");
  }

  await db.organization.update({
    where: { slug: orgSlug },
    data: { department, municipality, latitude, longitude },
  });

  redirect("/admin/configuracion?ubicacion=actualizada");
}

const optionalDateOrEmpty = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""))
  .optional();

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  dateFrom: optionalDateOrEmpty,
  dateTo: optionalDateOrEmpty,
  venueId: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

// negocio.md §6.4: "Cancelar reserva confirmada" — el empleado no puede, solo el ADMIN.
export async function cancelConfirmedBooking(formData: FormData): Promise<void> {
  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    dateFrom: formData.get("dateFrom") ?? undefined,
    dateTo: formData.get("dateTo") ?? undefined,
    venueId: formData.get("venueId") ?? undefined,
    type: formData.get("type") ?? undefined,
    status: formData.get("status") ?? undefined,
    name: formData.get("name") ?? undefined,
    phone: formData.get("phone") ?? undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.CANCELADA)) {
    notFound();
  }

  const organization = await db.organization.findUnique({ where: { id: booking.orgId } });
  const venue = await db.venue.findUnique({ where: { id: booking.venueId } });

  // El admin puede cancelar sin importar la ventana de tiempo — computeCancellationOutcome acá solo
  // deja un registro consistente de "hubiera sido reembolsable", nunca bloquea la cancelación.
  const dateIso = booking.date.toISOString().slice(0, 10);
  const outcome = organization
    ? computeCancellationOutcome(businessDateTimeInstant(dateIso, booking.startTime), new Date(), {
        cancellationWindowHours: organization.cancellationWindowHours,
      })
    : { refundable: false as const, reason: "late_cancellation" as const };

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELADA,
      blockingSlotKey: computeReleasedSlotKey(booking.id),
      cancelledAt: new Date(),
      cancelledBy: CancelledBy.ADMIN,
      cancellationReason: outcome.reason,
    },
  });

  if (organization) {
    await notifyBookingCancelled(booking, organization, outcome);
  }

  await logAdminAction({
    orgId: booking.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.cancel",
    summary: `Canceló la reserva de ${booking.customerName || "cliente sin nombre"} (${venue?.name ?? booking.venueId}) del ${dateIso} ${booking.startTime}`,
  });

  // Vuelve a la lista preservando los filtros que el admin tenía activos (rango de fechas, cancha,
  // tipo, estado) en vez de resetear siempre a "hoy sin filtros". dateFrom/dateTo se preservan
  // aunque vengan vacíos ("" = sin límite en ese extremo) para no perder un "todas las fechas".
  const query = new URLSearchParams();
  if (parsed.data.dateFrom !== undefined) {
    query.set("dateFrom", parsed.data.dateFrom);
  }
  if (parsed.data.dateTo !== undefined) {
    query.set("dateTo", parsed.data.dateTo);
  }
  if (parsed.data.venueId) {
    query.set("venueId", parsed.data.venueId);
  }
  if (parsed.data.type) {
    query.set("type", parsed.data.type);
  }
  if (parsed.data.status) {
    query.set("status", parsed.data.status);
  }
  if (parsed.data.name) {
    query.set("name", parsed.data.name);
  }
  if (parsed.data.phone) {
    query.set("phone", parsed.data.phone);
  }
  query.set("cancelada", "1");
  redirect(`/admin/reservas?${query.toString()}`);
}

const createRecurringBookingSchema = z.object({
  venueId: z.string().min(1),
  customerName: z.string().trim().min(2).max(200),
  customerPhone: z.string().trim().min(7).max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  // Checkbox HTML: presente ("on") solo si el admin la marcó, ausente si no.
  requiresDeposit: z.literal("on").optional(),
});

// Todas las fechas semanales entre startDate y endDate (ambas inclusive), comparadas como string
// "YYYY-MM-DD" — es válido porque ambas tienen el mismo formato de ancho fijo.
function buildWeeklyOccurrenceDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addBusinessDays(current, 7);
  }
  return dates;
}

// Crea una reserva recurrente semanal (ej. "cliente fijo todos los martes 6pm"): el admin la
// confirma directo, sin paso de pago online — el abono (si aplica) se cobra en persona y el admin
// decide al crear la serie si esta reserva lo requiere o no. Genera de una sola vez todas las
// ocurrencias entre startDate y endDate; si cualquiera choca con un turno ya ocupado, no crea nada
// de la serie (el admin debe resolver el conflicto primero, ver decisión de producto).
export async function createRecurringBooking(formData: FormData): Promise<void> {
  const parsed = createRecurringBookingSchema.safeParse({
    venueId: formData.get("venueId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    requiresDeposit: formData.get("requiresDeposit") ?? undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  const { venueId, customerName, customerPhone, startDate, endDate, startTime, endTime, requiresDeposit } =
    parsed.data;

  const { session, orgSlug } = await requireAdminSession();

  if (endDate < startDate) {
    redirect("/admin/reservas?error=recurrente_rango_invalido");
  }

  const occurrenceDates = buildWeeklyOccurrenceDates(startDate, endDate);
  if (occurrenceDates.length > MAX_RECURRING_OCCURRENCES) {
    redirect("/admin/reservas?error=recurrente_demasiadas_ocurrencias");
  }

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== org.id || !venue.active) {
    notFound();
  }

  const depositAmount = requiresDeposit ? Math.round((venue.hourlyRate * org.depositPercentage) / 100) : 0;

  try {
    await db.$transaction(async (tx) => {
      const series = await tx.recurringBooking.create({
        data: {
          orgId: org.id,
          venueId: venue.id,
          customerName,
          customerPhone,
          startTime,
          endTime,
          startDate: businessDayStart(startDate),
          endDate: businessDayStart(endDate),
        },
      });

      for (const dateIso of occurrenceDates) {
        const dateObj = businessDayStart(dateIso);
        await tx.booking.create({
          data: {
            orgId: org.id,
            venueId: venue.id,
            recurringBookingId: series.id,
            customerName,
            customerPhone,
            date: dateObj,
            startTime,
            endTime,
            status: BookingStatus.CONFIRMADA,
            blockingSlotKey: computeBlockingSlotKey(venue.id, dateObj, startTime),
            totalAmount: venue.hourlyRate,
            depositAmount,
          },
        });
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/reservas?error=recurrente_cupo_no_disponible");
    }
    throw error;
  }

  await logAdminAction({
    orgId: org.id,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.createRecurring",
    summary: `Creó reserva recurrente para ${customerName} en ${venue.name}, ${startTime}-${endTime}, ${occurrenceDates.length} ocurrencias (${startDate} a ${endDate})`,
  });

  redirect(`/admin/reservas?dateFrom=${startDate}&dateTo=${startDate}&recurrente=creada`);
}

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
});

export async function createUser(formData: FormData): Promise<void> {
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect("/admin/usuarios?error=datos_invalidos");
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    redirect("/admin/usuarios?error=email_en_uso");
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

  await logAdminAction({
    orgId: org.id,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "user.create",
    summary: `Creó el usuario ${parsed.data.name} (${parsed.data.email}) como ${parsed.data.role}`,
  });

  redirect("/admin/usuarios?ok=usuario_creado");
}

const updateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  active: z.enum(["true", "false"]),
});

export async function updateUser(formData: FormData): Promise<void> {
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session, orgSlug } = await requireAdminSession();

  // Un admin no puede quitarse a sí mismo el rol ni desactivar su propia cuenta — evita que la
  // organización se quede sin nadie que pueda entrar al panel.
  if (parsed.data.userId === session.user.id && (parsed.data.role !== "ADMIN" || parsed.data.active !== "true")) {
    redirect("/admin/usuarios?error=no_autogestion");
  }

  const orgId = await resolveOrgId(orgSlug);
  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.orgId !== orgId) {
    notFound();
  }

  await db.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role, active: parsed.data.active === "true" },
  });

  const changes: string[] = [];
  if (parsed.data.role !== user.role) changes.push(`rol ${user.role} → ${parsed.data.role}`);
  const newActive = parsed.data.active === "true";
  if (newActive !== user.active) changes.push(newActive ? "reactivado" : "desactivado");
  if (changes.length > 0) {
    await logAdminAction({
      orgId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      action: "user.update",
      summary: `Actualizó a ${user.name}: ${changes.join(", ")}`,
    });
  }

  redirect("/admin/usuarios?ok=usuario_actualizado");
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function resetUserPassword(formData: FormData): Promise<void> {
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    redirect("/admin/usuarios?error=datos_invalidos");
  }

  const { session, orgSlug } = await requireAdminSession();

  const orgId = await resolveOrgId(orgSlug);
  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.orgId !== orgId) {
    notFound();
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  await logAdminAction({
    orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "user.resetPassword",
    summary: `Reseteó la contraseña de ${user.name}`,
  });

  redirect("/admin/usuarios?ok=clave_actualizada");
}

const blockSlotSchema = z.object({
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional(),
});

// Bloquea un horario por mantenimiento (ej. luces dañadas) sin que exista una reserva real.
export async function blockSlot(formData: FormData): Promise<void> {
  const parsed = blockSlotSchema.safeParse({
    venueId: formData.get("venueId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
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
    redirect(`/admin/mantenimiento?venueId=${venue.id}&date=${parsed.data.date}&error=horario_ocupado`);
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

  redirect(`/admin/mantenimiento?venueId=${venue.id}&date=${parsed.data.date}&bloqueado=1`);
}

const unblockSlotSchema = z.object({
  slotBlockId: z.string().min(1),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function unblockSlot(formData: FormData): Promise<void> {
  const parsed = unblockSlotSchema.safeParse({
    slotBlockId: formData.get("slotBlockId"),
    venueId: formData.get("venueId"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const orgId = await resolveOrgId(orgSlug);
  const block = await db.slotBlock.findUnique({ where: { id: parsed.data.slotBlockId } });
  if (!block || block.orgId !== orgId) {
    notFound();
  }

  await db.slotBlock.delete({ where: { id: block.id } });

  redirect(`/admin/mantenimiento?venueId=${parsed.data.venueId}&date=${parsed.data.date}&desbloqueado=1`);
}
