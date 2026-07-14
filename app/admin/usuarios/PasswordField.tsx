"use client";

import { useState } from "react";

// Toggle de visibilidad para inputs de contraseña — no existía un componente compartido para esto
// en el resto del panel admin, así que vive junto a la única página que lo usa por ahora.
export function PasswordField({
  name,
  placeholder,
  minLength,
  required,
}: {
  name: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        className="w-full rounded-md border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
