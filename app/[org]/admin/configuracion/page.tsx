import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateOrganizationSettings } from "@/lib/admin/actions";

export default async function ConfiguracionPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Configuración — {organization.name}</h1>

      <form action={updateOrganizationSettings} className="mt-6 grid gap-4 rounded-lg border border-gray-200 p-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />

        <label className="grid gap-1 text-sm">
          % de abono mínimo
          <input
            type="number"
            name="depositPercentage"
            min={1}
            max={100}
            defaultValue={organization.depositPercentage}
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Ventana de cancelación con reembolso (horas)
          <input
            type="number"
            name="cancellationWindowHours"
            min={0}
            defaultValue={organization.cancellationWindowHours}
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Minutos para pagar el abono antes de liberar el cupo
          <input
            type="number"
            name="bookingHoldMinutes"
            min={1}
            defaultValue={organization.bookingHoldMinutes}
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          Guardar configuración
        </button>
      </form>
    </main>
  );
}
