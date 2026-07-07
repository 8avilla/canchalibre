import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/admin/queries";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendientes de pago",
  CONFIRMADA: "Confirmadas",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobradas",
  CANCELADA: "Canceladas",
  NO_SHOW: "No-show",
  EXPIRADA: "Expiradas",
};

export default async function AdminDashboardPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const metrics = await getDashboardMetrics(organization.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-xl font-semibold">Dashboard — {organization.name}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Ingresos canchas hoy</div>
          <div className="mt-1 text-lg font-semibold">
            ${metrics.courtsRevenueToday.toLocaleString("es-CO")}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Ingresos barra hoy</div>
          <div className="mt-1 text-lg font-semibold">${metrics.barRevenueToday.toLocaleString("es-CO")}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Turno de caja</div>
          <div className="mt-1 text-lg font-semibold">{metrics.openShift ? "Abierto" : "Cerrado"}</div>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-medium text-gray-700">Reservas de hoy por estado</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(metrics.bookingsByStatus).map(([status, count]) => (
          <span key={status} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
            {STATUS_LABEL[status] ?? status}: {count}
          </span>
        ))}
        {Object.keys(metrics.bookingsByStatus).length === 0 && (
          <span className="text-sm text-gray-500">Sin reservas hoy.</span>
        )}
      </div>

      {metrics.lowStockProducts.length > 0 && (
        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">Alertas de inventario bajo</h2>
          <ul className="mt-2 grid gap-1 text-sm text-amber-800">
            {metrics.lowStockProducts.map((product) => (
              <li key={product.id}>
                {product.name}: quedan {product.stock} (umbral {product.lowStockThreshold})
              </li>
            ))}
          </ul>
          <Link href={`/${orgSlug}/admin/inventario`} className="mt-2 inline-block text-sm text-blue-700 underline">
            Ir a inventario
          </Link>
        </div>
      )}
    </main>
  );
}
