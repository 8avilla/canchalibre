"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// Un solo componente cliente (necesita usePathname para el estado activo) usado dos veces: sidebar
// fijo en desktop, barra horizontal deslizable en mobile — mismo dato, dos layouts vía CSS
// responsive en vez de duplicar el árbol de links a mano.
function NavLinks({
  items,
  basePath,
  className,
  linkClassName,
}: {
  items: AdminNavItem[];
  basePath: string;
  className: string;
  linkClassName: (isActive: boolean) => string;
}) {
  const pathname = usePathname();

  return (
    <div className={className}>
      {items.map((item) => {
        const href = `${basePath}${item.href}`;
        const isActive = item.href === "" ? pathname === basePath : pathname.startsWith(href);

        return (
          <Link key={item.href} href={href} className={linkClassName(isActive)}>
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

const BASE_PATH = "/admin";

export function AdminNav({
  items,
  userName,
  orgName,
  isSuperadmin,
  logoutAction,
}: {
  items: AdminNavItem[];
  userName: string;
  orgName: string;
  isSuperadmin: boolean;
  logoutAction: () => Promise<void>;
}) {
  const activeClass = "bg-emerald-50 text-emerald-700";
  const inactiveClass = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";

  return (
    <>
      {/* Sidebar fijo en desktop, con el logo arriba y el perfil al pie */}
      <div
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-shrink-0 md:flex-col
          md:border-r md:border-gray-200 md:bg-white"
      >
        <Link href="/admin" className="flex items-center border-b border-gray-100 px-4 py-4">
          <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} className="h-9 w-auto" priority />
        </Link>
        <NavLinks
          items={items}
          basePath={BASE_PATH}
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
          linkClassName={(isActive) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${isActive ? activeClass : inactiveClass}`
          }
        />

        <div className="mt-auto flex items-center gap-2 border-t border-gray-100 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            {getInitials(userName || "?")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
            <p className="truncate text-xs text-gray-500">{orgName}</p>
            {isSuperadmin && (
              <Link href="/superadmin" className="text-xs text-emerald-700 underline">
                ← Cambiar organización
              </Link>
            )}
          </div>
          <form action={logoutAction}>
            <button type="submit" className="shrink-0 text-xs text-gray-400 underline hover:text-gray-600">
              Salir
            </button>
          </form>
        </div>
      </div>

      {/* Barra horizontal en mobile */}
      <div className="relative border-b border-gray-200 bg-white md:hidden">
        <NavLinks
          items={items}
          basePath={BASE_PATH}
          className="flex items-center gap-1 overflow-x-auto px-2 py-2 text-sm"
          linkClassName={(isActive) =>
            `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 font-medium ${
              isActive ? activeClass : inactiveClass
            }`
          }
        />
        {/* Aviso visual de que el menú sigue a la derecha — en móvil el último ítem queda a medio
            cortar y sin esto parece un texto roto en vez de una barra deslizable. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
        />
      </div>
    </>
  );
}
