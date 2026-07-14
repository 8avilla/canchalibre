"use client";

import { useState } from "react";
import { updateUser } from "@/lib/admin/actions";
import { SubmitButton } from "@/app/components/SubmitButton";

// Componente cliente solo para poder leer el valor vivo del select "Estado" y pedir confirmación
// nada más cuando el cambio es desactivar a alguien — un cambio de rol solo no la necesita.
export function UpdateUserForm({
  userId,
  role,
  active,
  disabled,
}: {
  userId: string;
  role: string;
  active: boolean;
  disabled: boolean;
}) {
  const [activeValue, setActiveValue] = useState(active ? "true" : "false");

  return (
    <form action={updateUser} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="grid gap-1 text-sm">
        Rol
        <select
          name="role"
          defaultValue={role}
          disabled={disabled}
          className="rounded-md border border-gray-300 px-3 py-2.5 text-sm disabled:bg-gray-100"
        >
          <option value="ADMIN">Administrador</option>
          <option value="EMPLOYEE">Empleado</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Estado
        <select
          name="active"
          value={activeValue}
          onChange={(e) => setActiveValue(e.target.value)}
          disabled={disabled}
          className="rounded-md border border-gray-300 px-3 py-2.5 text-sm disabled:bg-gray-100"
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </label>

      {disabled && (
        <p className="col-span-2 text-xs text-gray-400">
          No puedes cambiar tu propio rol ni desactivar tu propia cuenta.
        </p>
      )}

      <div className="col-span-2">
        <SubmitButton
          disabled={disabled}
          confirmMessage={activeValue === "false" ? "¿Desactivar a este usuario? No podrá volver a iniciar sesión." : undefined}
          className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
        >
          Guardar cambios
        </SubmitButton>
      </div>
    </form>
  );
}
