import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createUser, resetUserPassword } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";
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

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const { session, orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const users = await db.user.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  return (
    <main className="px-6 py-10">
      <h1 className="text-xl font-semibold">Usuarios — {organization.name}</h1>

      {error && ERROR_MESSAGES[error] && <div className="mt-4"><Banner type="error" message={ERROR_MESSAGES[error]} /></div>}
      {ok && OK_MESSAGES[ok] && <div className="mt-4"><Banner type="success" message={OK_MESSAGES[ok]} /></div>}

      <ul className="mt-6 grid gap-3">
        {users.map((user) => {
          const isSelf = user.id === session.user.id;
          return (
            <li key={user.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-medium">
                  {user.name} {isSelf && <span className="text-xs text-gray-400">(tú)</span>}
                </span>
                <span className="text-xs text-gray-500">{user.email}</span>
              </div>

              <UpdateUserForm userId={user.id} role={user.role} active={user.active} disabled={isSelf} />

              <form action={resetUserPassword} className="mt-2 flex items-end gap-3">
                <input type="hidden" name="userId" value={user.id} />
                <label className="grid gap-1 text-sm">
                  Nueva contraseña
                  <input
                    type="password"
                    name="newPassword"
                    minLength={8}
                    required
                    className="rounded-md border border-gray-300 px-3 py-3"
                  />
                </label>
                <SubmitButton
                  confirmMessage="¿Resetear la contraseña de este usuario?"
                  className="rounded-md bg-blue-600 px-3 py-3 text-sm text-white"
                >
                  Resetear contraseña
                </SubmitButton>
              </form>
            </li>
          );
        })}
      </ul>

      <form action={createUser} className="mt-8 grid gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium">Nuevo usuario</h2>
        <label className="grid gap-1 text-sm">
          Nombre
          <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Contraseña
          <input
            type="password"
            name="password"
            minLength={8}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Rol
          <select name="role" required className="rounded-md border border-gray-300 px-3 py-3">
            <option value="EMPLOYEE">Empleado</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        <SubmitButton className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
          Crear usuario
        </SubmitButton>
      </form>
    </main>
  );
}
