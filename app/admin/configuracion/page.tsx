import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updateOrganizationInfo,
  updateOrganizationLogo,
  updateOrganizationSettings,
  updateOrganizationSlug,
} from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { db } from "@/lib/db";
import { LocationFields } from "./LocationForm";
import { DescriptionField } from "./DescriptionField";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa los campos marcados: hay datos inválidos o incompletos.",
  logo_requerido: "Selecciona un archivo de logo.",
  logo_formato_invalido: "Formato no soportado. Usa PNG, JPG, WEBP o SVG.",
  logo_muy_grande: "El logo no debe superar los 2 MB.",
  ubicacion_invalida: "Selecciona un departamento y municipio válidos.",
  slug_invalido: "El slug solo puede tener minúsculas, números y guiones.",
  slug_en_uso: "Ya existe una organización con ese slug.",
};

const TABS = [
  { key: "general", label: "Información general", icon: "ℹ️" },
  { key: "horarios", label: "Horarios y políticas", icon: "🕐" },
  { key: "pagos", label: "Pagos y finanzas", icon: "💳" },
  { key: "notificaciones", label: "Notificaciones", icon: "🔔" },
  { key: "integraciones", label: "Integraciones", icon: "🔌" },
  { key: "seguridad", label: "Seguridad", icon: "🛡️" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Bogota": "América/Bogotá (GMT-05:00)",
};

const inputClassName =
  "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClassName = "grid gap-1.5 text-sm font-medium text-gray-700";
const cardClassName = "rounded-xl border border-gray-200 bg-white p-6";
const primaryButtonClassName =
  "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; logo?: string; info?: string; slug?: string; settings?: string }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { tab, error, logo, info, slug, settings } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const activeTab: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "general";
  const venueCount = await db.venue.count({ where: { orgId: organization.id } });

  const isInfoComplete = Boolean(
    organization.name &&
      organization.address &&
      organization.contactEmail &&
      organization.department &&
      organization.municipality,
  );

  return (
    <main className="px-6 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Configuración del complejo</h1>
          <p className="mt-1 text-sm text-gray-500">Administra la información general y las preferencias de tu complejo deportivo.</p>
        </div>
        {activeTab === "general" && (
          <button type="submit" form="org-info-form" className={`${primaryButtonClassName} shrink-0`}>
            ⬆️ Guardar cambios
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/configuracion?tab=${t.key}`}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              activeTab === t.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          {activeTab === "general" && (
            <>
              {error && ERROR_MESSAGES[error] && <Banner type="error" message={ERROR_MESSAGES[error]} />}
              {info === "actualizada" && <Banner type="success" message="Información actualizada correctamente." />}
              {logo === "actualizado" && <Banner type="success" message="Logo actualizado correctamente." />}

              <div className={cardClassName}>
                <h2 className="text-base font-semibold text-gray-900">Información básica</h2>

                <form
                  action={updateOrganizationLogo}
                  className="mt-5 flex flex-wrap items-center gap-4 border-b border-gray-100 pb-6"
                >
                  <span className="text-sm font-medium text-gray-700">Logo del complejo</span>
                  {organization.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organization.logoUrl}
                      alt={`Logo de ${organization.name}`}
                      className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 text-2xl">
                      🏟️
                    </div>
                  )}
                  <input
                    type="file"
                    name="logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    required
                    className="text-sm file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-50"
                  />
                  <SubmitButton className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cambiar logo
                  </SubmitButton>
                  <p className="w-full text-xs text-gray-500">Formatos: PNG, JPG, WEBP o SVG. Máx. 2MB.</p>
                </form>

                <form action={updateOrganizationInfo} id="org-info-form" className="mt-6 grid gap-4">
                  <label className={labelClassName}>
                    Nombre del complejo <span className="text-red-500">*</span>
                    <input
                      type="text"
                      name="name"
                      required
                      minLength={2}
                      defaultValue={organization.name}
                      placeholder="Ej. Cuna del Gol"
                      className={inputClassName}
                    />
                  </label>

                  <LocationFields
                    initialDepartment={organization.department}
                    initialMunicipality={organization.municipality}
                    initialLatitude={organization.latitude}
                    initialLongitude={organization.longitude}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className={labelClassName}>
                      Dirección <span className="text-red-500">*</span>
                      <input
                        type="text"
                        name="address"
                        required
                        defaultValue={organization.address ?? ""}
                        placeholder="Carrera 10 # 25-78, Barrio Manga"
                        className={inputClassName}
                      />
                    </label>
                    <label className={labelClassName}>
                      Teléfono
                      <input
                        type="tel"
                        name="phone"
                        defaultValue={organization.phone ?? ""}
                        placeholder="300 249 3031"
                        className={inputClassName}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className={labelClassName}>
                      Email de contacto <span className="text-red-500">*</span>
                      <input
                        type="email"
                        name="contactEmail"
                        required
                        defaultValue={organization.contactEmail ?? ""}
                        placeholder="info@tucomplejo.com"
                        className={inputClassName}
                      />
                    </label>
                    <label className={labelClassName}>
                      Sitio web (opcional)
                      <input
                        type="text"
                        name="website"
                        defaultValue={organization.website ?? ""}
                        placeholder="https://www.tucomplejo.com"
                        className={inputClassName}
                      />
                    </label>
                  </div>

                  <DescriptionField defaultValue={organization.description ?? ""} />

                  <div className="flex justify-end">
                    <SubmitButton className={primaryButtonClassName}>Guardar información</SubmitButton>
                  </div>
                </form>
              </div>
            </>
          )}

          {activeTab === "horarios" && (
            <div className={cardClassName}>
              <h2 className="text-base font-semibold text-gray-900">Horarios y políticas</h2>
              <p className="mt-1 text-sm text-gray-500">Reglas de abono y cancelación aplicadas a todas las reservas.</p>

              {settings === "actualizado" && (
                <div className="mt-4">
                  <Banner type="success" message="Configuración actualizada correctamente." />
                </div>
              )}

              <form action={updateOrganizationSettings} className="mt-5 grid gap-4">
                <label className={labelClassName}>
                  % de abono mínimo
                  <input
                    type="number"
                    inputMode="numeric"
                    name="depositPercentage"
                    min={1}
                    max={100}
                    defaultValue={organization.depositPercentage}
                    required
                    className={inputClassName}
                  />
                </label>

                <label className={labelClassName}>
                  Ventana de cancelación con reembolso (horas)
                  <input
                    type="number"
                    inputMode="numeric"
                    name="cancellationWindowHours"
                    min={0}
                    defaultValue={organization.cancellationWindowHours}
                    required
                    className={inputClassName}
                  />
                </label>

                <label className={labelClassName}>
                  Minutos para pagar el abono antes de liberar el cupo
                  <input
                    type="number"
                    inputMode="numeric"
                    name="bookingHoldMinutes"
                    min={1}
                    defaultValue={organization.bookingHoldMinutes}
                    required
                    className={inputClassName}
                  />
                </label>

                <div className="flex justify-end">
                  <SubmitButton className={primaryButtonClassName}>Guardar configuración</SubmitButton>
                </div>
              </form>

              <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                🚧 Horarios de apertura/cierre por día próximamente.
              </div>
            </div>
          )}

          {activeTab === "seguridad" && (
            <div className={cardClassName}>
              <h2 className="text-base font-semibold text-gray-900">Seguridad</h2>
              <p className="mt-1 text-sm text-gray-500">URL pública del complejo.</p>

              {slug === "actualizado" && (
                <div className="mt-4">
                  <Banner type="success" message="Slug actualizado correctamente." />
                </div>
              )}

              <form action={updateOrganizationSlug} className="mt-5 grid gap-2">
                <label className={labelClassName}>
                  Slug (URL pública)
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <span className="whitespace-nowrap">canchalibre.com/</span>
                    <input
                      name="slug"
                      required
                      pattern="[a-z0-9-]+"
                      defaultValue={organization.slug}
                      className={inputClassName}
                    />
                  </div>
                </label>
                <p className="text-xs text-amber-700">
                  ⚠️ Cambiar el slug cambia todas las URLs públicas de tu organización (reservas, POS). Los enlaces
                  que hayas compartido con el slug anterior dejarán de funcionar.
                </p>

                <div className="mt-1 flex justify-end">
                  <SubmitButton className={primaryButtonClassName}>Guardar slug</SubmitButton>
                </div>
              </form>

              <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                🚧 Autenticación en dos pasos y registro de sesiones próximamente. Para roles y contraseñas de tu
                equipo, ve a{" "}
                <Link href="/admin/usuarios" className="text-emerald-700 underline">
                  Usuarios
                </Link>
                .
              </div>
            </div>
          )}

          {(activeTab === "pagos" || activeTab === "notificaciones" || activeTab === "integraciones") && (
            <div className={`${cardClassName} flex flex-col items-center justify-center gap-2 py-16 text-center`}>
              <span className="text-3xl" aria-hidden>
                {TABS.find((t) => t.key === activeTab)?.icon}
              </span>
              <h2 className="text-base font-semibold text-gray-900">
                {TABS.find((t) => t.key === activeTab)?.label}
              </h2>
              <p className="max-w-sm text-sm text-gray-500">Esta sección está en construcción y estará disponible próximamente.</p>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <div className={cardClassName}>
            <h2 className="text-base font-semibold text-gray-900">Resumen de configuración</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-gray-500">🏢 Nombre</dt>
                <dd className="truncate font-medium text-gray-900">{organization.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-gray-500">📍 Ubicación</dt>
                <dd className="truncate font-medium text-gray-900">
                  {organization.municipality && organization.department
                    ? `${organization.municipality}, ${organization.department}`
                    : "Sin definir"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-gray-500">🏟️ Canchas</dt>
                <dd className="font-medium text-gray-900">{venueCount} canchas</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-gray-500">🕐 Zona horaria</dt>
                <dd className="truncate font-medium text-gray-900">
                  {TIMEZONE_LABELS[organization.timezone] ?? organization.timezone}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-gray-500">💰 Moneda</dt>
                <dd className="font-medium text-gray-900">COP - Peso colombiano</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-gray-500">🌐 Idioma</dt>
                <dd className="font-medium text-gray-900">Español</dd>
              </div>
            </dl>

            <div
              className={`mt-4 rounded-lg p-3 text-sm ${
                isInfoComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {isInfoComplete ? "✅ La información está completa" : "⚠️ Completa dirección, email y ubicación"}
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="text-base font-semibold text-gray-900">Opciones rápidas</h2>
            <div className="mt-3 grid gap-1">
              <Link
                href="/admin/configuracion?tab=horarios"
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-base">🕐</span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Políticas de reserva</span>
                    <span className="block text-xs text-gray-500">Abono y cancelaciones</span>
                  </span>
                </span>
                <span className="text-gray-400">›</span>
              </Link>

              <Link
                href="/admin/configuracion?tab=pagos"
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-base">💳</span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Formas de pago</span>
                    <span className="block text-xs text-gray-500">Administra métodos de pago disponibles</span>
                  </span>
                </span>
                <span className="text-gray-400">›</span>
              </Link>

              <Link
                href="/admin/configuracion?tab=notificaciones"
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-base">🔔</span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Notificaciones</span>
                    <span className="block text-xs text-gray-500">Configura alertas y notificaciones</span>
                  </span>
                </span>
                <span className="text-gray-400">›</span>
              </Link>

              <Link
                href="/admin/usuarios"
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-base">👥</span>
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Usuarios y permisos</span>
                    <span className="block text-xs text-gray-500">Gestiona roles y accesos</span>
                  </span>
                </span>
                <span className="text-gray-400">›</span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 p-5 text-sm text-blue-900">
            <p className="font-medium">💬 ¿Necesitas ayuda?</p>
            <p className="mt-1 text-blue-800">Escríbenos si tienes dudas sobre la configuración de tu complejo.</p>
            {organization.contactEmail && (
              <a href={`mailto:${organization.contactEmail}`} className="mt-2 inline-block font-medium underline">
                Contactar soporte
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
