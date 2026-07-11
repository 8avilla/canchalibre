import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/session-guards";

const MAX_ENTRIES = 200;

export default async function AuditoriaPage() {
  const { orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const entries = await db.auditLog.findMany({
    where: { orgId: organization.id },
    orderBy: { createdAt: "desc" },
    take: MAX_ENTRIES,
  });

  return (
    <main className="px-6 py-10">
      <h1 className="text-xl font-semibold">Auditoría — {organization.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Últimos {MAX_ENTRIES} cambios sensibles (precios, roles, stock, contraseñas, caja).
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4 whitespace-nowrap">Fecha</th>
              <th className="py-2 pr-4 whitespace-nowrap">Quién</th>
              <th className="py-2 pr-4">Qué pasó</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-4 whitespace-nowrap text-gray-500">
                  {entry.createdAt.toLocaleString("es-CO")}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap font-medium text-gray-900">{entry.actorName}</td>
                <td className="py-2 pr-4 text-gray-700">{entry.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {entries.length === 0 && <p className="mt-4 text-sm text-gray-500">Sin actividad registrada todavía.</p>}
      </div>
    </main>
  );
}
