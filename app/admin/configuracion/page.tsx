import { notFound } from "next/navigation";
import { updateOrganizationLogo, updateOrganizationSettings, updateOrganizationSlug } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { db } from "@/lib/db";
import { LocationForm } from "./LocationForm";

const ERROR_MESSAGES: Record<string, string> = {
  logo_requerido: "Selecciona un archivo de logo.",
  logo_formato_invalido: "Formato no soportado. Usa PNG, JPG, WEBP o SVG.",
  logo_muy_grande: "El logo no debe superar los 2 MB.",
  ubicacion_invalida: "Selecciona un departamento y municipio válidos.",
  slug_invalido: "El slug solo puede tener minúsculas, números y guiones.",
  slug_en_uso: "Ya existe una organización con ese slug.",
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; logo?: string; ubicacion?: string; slug?: string }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { error, logo, ubicacion, slug } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Configuración — {organization.name}</h1>

      <form action={updateOrganizationSlug} className="mt-6 grid gap-2 rounded-lg border border-gray-200 p-4">
        <label className="grid gap-1 text-sm">
          Slug (URL pública)
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span className="whitespace-nowrap">canchalibre.com/</span>
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              defaultValue={organization.slug}
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-gray-900"
            />
          </div>
        </label>
        <p className="text-xs text-amber-700">
          ⚠️ Cambiar el slug cambia todas las URLs públicas de tu organización (reservas, POS). Los
          enlaces que hayas compartido con el slug anterior dejarán de funcionar.
        </p>

        {slug === "actualizado" && <p className="text-sm text-emerald-700">Slug actualizado correctamente.</p>}
        {error && (error === "slug_invalido" || error === "slug_en_uso") && (
          <p className="text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
        )}

        <button
          type="submit"
          className="mt-1 rounded-md bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800"
        >
          Guardar slug
        </button>
      </form>

      <form action={updateOrganizationLogo} className="mt-6 grid gap-4 rounded-lg border border-gray-200 p-4">
        <span className="text-sm font-medium">Logo de la organización</span>

        {organization.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organization.logoUrl}
            alt={`Logo de ${organization.name}`}
            className="h-16 w-16 rounded-md border border-gray-200 object-contain"
          />
        )}

        {logo === "actualizado" && <p className="text-sm text-emerald-700">Logo actualizado correctamente.</p>}
        {error && (error === "logo_requerido" || error === "logo_formato_invalido" || error === "logo_muy_grande") && (
          <p className="text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
        )}

        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2.5 file:text-sm file:font-medium hover:file:bg-gray-200"
        />

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800"
        >
          Subir logo
        </button>
      </form>

      <div>
        {ubicacion === "actualizada" && (
          <p className="text-sm text-emerald-700">Ubicación actualizada correctamente.</p>
        )}
        {error === "ubicacion_invalida" && <p className="text-sm text-red-600">{ERROR_MESSAGES[error]}</p>}
        <LocationForm
          initialDepartment={organization.department}
          initialMunicipality={organization.municipality}
          initialLatitude={organization.latitude}
          initialLongitude={organization.longitude}
        />
      </div>

      <form action={updateOrganizationSettings} className="mt-6 grid gap-4 rounded-lg border border-gray-200 p-4">
        <label className="grid gap-1 text-sm">
          % de abono mínimo
          <input
            type="number"
            inputMode="numeric"
            name="depositPercentage"
            min={1}
            max={100}
            defaultValue={organization.depositPercentage}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Ventana de cancelación con reembolso (horas)
          <input
            type="number"
            inputMode="numeric"
            name="cancellationWindowHours"
            min={0}
            defaultValue={organization.cancellationWindowHours}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Minutos para pagar el abono antes de liberar el cupo
          <input
            type="number"
            inputMode="numeric"
            name="bookingHoldMinutes"
            min={1}
            defaultValue={organization.bookingHoldMinutes}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800"
        >
          Guardar configuración
        </button>
      </form>
    </main>
  );
}
