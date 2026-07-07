"use client";

import { useFormStatus } from "react-dom";

// Botón de submit con estado de carga real (useFormStatus detecta cuándo la server action del
// <form> padre está en curso) — sin esto, el usuario hace clic y no pasa nada visible hasta que la
// navegación termina, lo que en una conexión lenta se siente como que la app no respondió.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          {pendingLabel ?? "Procesando…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
