import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createUser, resetUserPassword } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";
import { PasswordField } from "./PasswordField";
import { UpdateUserForm } from "./UpdateUserForm";

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa los datos ingresados (la contraseña debe tener al menos 8 caracteres).",
  email_en_uso: "Ya existe un usuario con ese email.",
  no_autogestion: "No puedes cambiar tu propio rol ni desactivar tu propia cuenta. Pídele a otro administrador que lo haga.",
};

const OK_MESSAGES: Record<string, string> = {
  clave_actualizada: "Contraseña actualizada.",
  usuario_creado: "Usuario creado correctamente.",
  usuario_actualizado: "Usuario actualizado correctamente.",
};

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", EMPLOYEE: "Empleado" };
const ROLE_ICON: Record<string, string> = { ADMIN: "🛡️", EMPLOYEE: "👤" };
const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
  EMPLOYEE: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    ok?: string;
    q?: string;
    role?: string;
    status?: string;
    nuevo?: string;
    editar?: string;
  }>;
}) {
  const { error, ok, q, role, status, nuevo, editar } = await searchParams;

  const { session, orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const users = await db.user.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  const activeCount = users.filter((u) => u.active).length;
  const inactiveCount = users.length - activeCount;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  const query = q?.trim().toLowerCase() ?? "";
  const roleFilter = role && role in ROLE_LABEL ? role : "";
  const statusFilter = status === "active" || status === "inactive" ? status : "";

  const filteredUsers = users
    .filter((u) => !query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    .filter((u) => !roleFilter || u.role === roleFilter)
    .filter((u) => !statusFilter || (statusFilter === "active" ? u.active : !u.active));

  const hasActiveFilters = Boolean(query || roleFilter || statusFilter);

  // Conserva los filtros activos (q/role/status) al armar los links de los drawers, para que
  // abrir/cerrar "Nuevo usuario" o "Editar" no resetee la búsqueda que el admin ya tenía escrita.
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (roleFilter) baseParams.set("role", roleFilter);
  if (statusFilter) baseParams.set("status", statusFilter);

  const hrefWith = (extra: Record<string, string>) => {
    const params = new URLSearchParams(baseParams);
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    return `/admin/usuarios?${params.toString()}`;
  };
  const closeHref = `/admin/usuarios?${baseParams.toString()}`;

  const editingUser = editar ? users.find((u) => u.id === editar) : undefined;

  return (
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Usuarios — {organization.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Gestiona los usuarios que tienen acceso al sistema.</p>
        </div>
        <Link
          href={hrefWith({ nuevo: "1" })}
          className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Nuevo usuario
        </Link>
      </div>

      {error && ERROR_MESSAGES[error] && <div className="mt-4"><Banner type="error" message={ERROR_MESSAGES[error]} /></div>}
      {ok && OK_MESSAGES[ok] && <div className="mt-4"><Banner type="success" message={OK_MESSAGES[ok]} /></div>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-gray-900">{users.length}</div>
          <div className="text-xs text-gray-500">Total usuarios</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-emerald-700">{activeCount}</div>
          <div className="text-xs text-gray-500">Usuarios activos</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-gray-600">{inactiveCount}</div>
          <div className="text-xs text-gray-500">Usuarios inactivos</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold text-purple-700">{adminCount}</div>
          <div className="text-xs text-gray-500">Administradores</div>
        </div>
      </div>

      <form
        method="get"
        className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4"
      >
        <div className="col-span-2 sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500">Buscar</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nombre o email…"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Rol</label>
          <select name="role" defaultValue={roleFilter} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
            <option value="">Todos</option>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Estado</label>
          <select name="status" defaultValue={statusFilter} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-3 sm:col-span-4">
          <SubmitButton pendingLabel="Filtrando…" className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
            Filtrar
          </SubmitButton>
          {hasActiveFilters && (
            <Link href="/admin/usuarios" className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
          <span className="ml-auto self-center text-sm text-gray-500">
            {filteredUsers.length} {filteredUsers.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => {
                const isSelf = user.id === session.user.id;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                          {getInitials(user.name)}
                        </div>
                        <span className="font-medium text-gray-900">
                          {user.name} {isSelf && <span className="text-xs font-normal text-gray-400">(Tú)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                        {ROLE_ICON[user.role]} {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${user.active ? "bg-emerald-500" : "bg-gray-400"}`} />
                        {user.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={hrefWith({ editar: user.id })}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    {users.length === 0 ? "Sin usuarios todavía." : "Sin usuarios para estos filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Mostrando {filteredUsers.length} de {users.length} usuarios
        </div>
      </div>

      {nuevo === "1" && (
        <>
          <Link href={closeHref} aria-label="Cerrar" className="fixed inset-0 z-40 bg-black/40" />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nuevo usuario</h2>
                <p className="mt-0.5 text-sm text-gray-500">Crea un nuevo usuario para tu complejo.</p>
              </div>
              <Link href={closeHref} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">
                ×
              </Link>
            </div>

            <form action={createUser} className="grid gap-4 px-6 py-5">
              <label className="grid gap-1 text-sm">
                Nombre completo
                <input name="name" required minLength={2} placeholder="Ej: Laura Pérez" className="rounded-md border border-gray-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm">
                Email
                <input type="email" name="email" required placeholder="Ej: laura@tuclub.com" className="rounded-md border border-gray-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm">
                Rol
                <select name="role" required defaultValue="EMPLOYEE" className="rounded-md border border-gray-300 px-3 py-2.5 text-sm">
                  <option value="EMPLOYEE">Empleado</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Contraseña
                <PasswordField name="password" minLength={8} required />
                <span className="text-xs text-gray-400">Mínimo 8 caracteres</span>
              </label>

              <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                <SubmitButton className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
                  Crear usuario
                </SubmitButton>
                <Link href={closeHref} className="text-sm text-gray-500 hover:underline">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </>
      )}

      {editingUser && (
        <>
          <Link href={closeHref} aria-label="Cerrar" className="fixed inset-0 z-40 bg-black/40" />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Editar usuario</h2>
                <p className="mt-0.5 text-sm text-gray-500">{editingUser.name} · {editingUser.email}</p>
              </div>
              <Link href={closeHref} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">
                ×
              </Link>
            </div>

            <div className="grid gap-6 px-6 py-5">
              <UpdateUserForm
                userId={editingUser.id}
                role={editingUser.role}
                active={editingUser.active}
                disabled={editingUser.id === session.user.id}
              />

              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-900">Restablecer contraseña</h3>
                <form action={resetUserPassword} className="mt-3 grid gap-3">
                  <input type="hidden" name="userId" value={editingUser.id} />
                  <PasswordField name="newPassword" minLength={8} required placeholder="Nueva contraseña" />
                  <SubmitButton
                    confirmMessage="¿Resetear la contraseña de este usuario?"
                    className="w-fit rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Resetear contraseña
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
