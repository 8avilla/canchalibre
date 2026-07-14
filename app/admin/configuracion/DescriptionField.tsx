"use client";

import { useState } from "react";

const MAX_LENGTH = 300;

// Textarea con contador de caracteres en vivo — el resto de inputs del form son server-rendered,
// este es el único que necesita estado de cliente (re-render del contador en cada tecla).
export function DescriptionField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="grid gap-1.5 text-sm font-medium text-gray-700">
      Descripción del complejo (opcional)
      <textarea
        name="description"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder="Cuéntale a tus clientes qué hace especial a tu complejo…"
        className="w-full resize-none rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <span className="justify-self-end text-xs text-gray-400">
        {value.length} / {MAX_LENGTH}
      </span>
    </label>
  );
}
