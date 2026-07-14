import Link from "next/link";
import { createBooking } from "@/lib/admin/actions";
import { CLOSING_HOUR, OPENING_HOUR } from "@/lib/booking/availability";
import { SubmitButton } from "@/app/components/SubmitButton";

const HOUR_OPTIONS = Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) =>
  `${String(OPENING_HOUR + i).padStart(2, "0")}:00`,
);

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa el nombre (solo letras) y el teléfono (10 dígitos) del cliente.",
  cupo_no_disponible: "Ese horario ya está ocupado en esa cancha — elige otra hora o cancha.",
};

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

export function NuevaReservaDrawer({
  venues,
  defaultDate,
  closeHref,
  error,
}: {
  venues: { id: string; name: string; hourlyRate: number }[];
  defaultDate: string;
  closeHref: string;
  error?: string;
}) {
  const estimatedTotal = venues[0]?.hourlyRate ?? 0;

  return (
    <>
      <Link href={closeHref} aria-label="Cerrar" className="fixed inset-0 z-40 bg-black/40" />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Nueva reserva</h2>
          <Link href={closeHref} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </Link>
        </div>

        {error && ERROR_MESSAGES[error] && (
          <p className="mx-6 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{ERROR_MESSAGES[error]}</p>
        )}

        <form action={createBooking} className="grid gap-4 px-6 py-5">
          <label className="text-sm font-medium text-gray-700">
            Cancha *
            <select name="venueId" required defaultValue="" className={INPUT_CLASS}>
              <option value="" disabled>
                Selecciona una cancha
              </option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">
              Fecha *
              <input type="date" name="date" required defaultValue={defaultDate} className={INPUT_CLASS} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Hora inicio *
              <select name="startTime" required defaultValue="" className={INPUT_CLASS}>
                <option value="" disabled>
                  Elige la hora
                </option>
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Duración
            {/* Duración fija en 1 hora — igual que el resto del sistema (ver plan: ningún flujo de
                reserva soporta hoy turnos de varias horas). */}
            <select disabled defaultValue="1" className={`${INPUT_CLASS} bg-gray-50 text-gray-500`}>
              <option value="1">1 hora</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">
              Cliente *
              <input type="text" name="customerName" required minLength={2} placeholder="Nombre" className={INPUT_CLASS} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Teléfono *
              <input type="tel" name="customerPhone" required minLength={7} placeholder="3001234567" className={INPUT_CLASS} />
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Estado *
            <select name="status" required defaultValue="CONFIRMADA" className={`${INPUT_CLASS} font-medium text-emerald-700`}>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="PENDIENTE_PAGO">Pendiente de pago</option>
            </select>
          </label>

          <div>
            <span className="text-sm font-medium text-gray-700">Pago *</span>
            <div className="mt-1 flex gap-2">
              <label className="flex-1">
                <input type="radio" name="paymentToggle" value="pendiente" defaultChecked className="peer sr-only" />
                <span
                  className="block cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-center text-sm
                    font-medium text-gray-600 peer-checked:border-amber-500 peer-checked:bg-amber-50
                    peer-checked:text-amber-700"
                >
                  Pendiente
                </span>
              </label>
              <label className="flex-1">
                <input type="radio" name="paymentToggle" value="pagado" className="peer sr-only" />
                <span
                  className="block cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-center text-sm
                    font-medium text-gray-600 peer-checked:border-emerald-600 peer-checked:bg-emerald-50
                    peer-checked:text-emerald-700"
                >
                  Pagado
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-md bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total estimado</span>
              <span className="text-lg font-semibold text-gray-900">${estimatedTotal.toLocaleString("es-CO")}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Según la tarifa de la cancha seleccionada — se calcula con el precio real al guardar.
            </p>
          </div>

          <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-4">
            <SubmitButton
              pendingLabel="Creando…"
              className="flex-1 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Crear reserva
            </SubmitButton>
            <Link href={closeHref} className="text-sm text-gray-500 hover:underline">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
