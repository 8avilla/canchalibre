import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { logoutAction } from "@/lib/auth-actions";
import { getAdminAlertCounts } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { AdminNav, type AdminNavItem } from "./AdminNav";

const NAV_ITEMS: AdminNavItem[] = [
  { href: "", label: "Dashboard", icon: "🏠" },
  { href: "/reportes", label: "Reportes", icon: "📊" },
  { href: "/canchas", label: "Canchas", icon: "🏟️" },
  { href: "/mantenimiento", label: "Mantenimiento", icon: "🛠️" },
  { href: "/inventario", label: "Inventario", icon: "📦" },
  { href: "/reservas", label: "Reservas", icon: "📅" },
  { href: "/caja", label: "Caja", icon: "💰" },
  { href: "/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/auditoria", label: "Auditoría", icon: "🗒️" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, orgSlug } = await requireAdminSession();
  const isSuperadmin = session.user.role === "SUPERADMIN";

  const organization = await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true, name: true } });
  if (!organization) {
    notFound();
  }

  const alertCounts = await getAdminAlertCounts(organization.id);
  const alertCount = alertCounts.lowStockCount + alertCounts.pendingPaymentCount;

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <AdminNav
        items={NAV_ITEMS}
        userName={session.user.name ?? "?"}
        orgName={organization?.name ?? orgSlug}
        isSuperadmin={isSuperadmin}
        logoutAction={logoutAction}
      />

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
          <form method="get" action="/admin/reservas" className="max-w-xs flex-1">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                name="name"
                placeholder="Buscar cliente…"
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm
                  focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </form>

          <Link
            href="/admin/alertas"
            aria-label="Alertas"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500
              hover:bg-gray-100"
          >
            🔔
            {alertCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center
                  rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
              >
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </Link>

          {/* En desktop el "Salir" vive en el perfil al pie del sidebar (AdminNav) — ese sidebar no
              se muestra en mobile, así que acá queda un acceso equivalente compacto. */}
          <form action={logoutAction} className="md:hidden">
            <button type="submit" className="shrink-0 text-xs text-gray-400 underline hover:text-gray-600">
              Salir
            </button>
          </form>
        </header>

        {children}
      </div>
    </div>
  );
}
