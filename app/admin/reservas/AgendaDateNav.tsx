"use client";

import { useRouter } from "next/navigation";
import { addBusinessDays } from "@/lib/time/business-day";
import { CalendarDateField } from "./CalendarDateField";

const TRIGGER_CLASS = "px-1 text-sm font-medium text-gray-700 hover:text-gray-900";

// Navegador de fecha de Vista agenda — antes era un <span> estático flanqueado por flechas
// prev/día-siguiente (Link), sin forma de saltar a una fecha arbitraria salvo clic a clic. Ahora el
// label del medio abre el mismo calendario del resto de la app (CalendarDateField) para saltar
// directo a cualquier fecha, sin perder las flechas de un día para adelante/atrás.
export function AgendaDateNav({
  fecha,
  isToday,
  weekday,
  day,
  month,
}: {
  fecha: string;
  isToday: boolean;
  weekday: string;
  day: string;
  month: string;
}) {
  const router = useRouter();

  function goTo(dateIso: string) {
    router.push(`/admin/reservas?vista=agenda&fecha=${dateIso}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1.5">
      <button
        type="button"
        onClick={() => goTo(addBusinessDays(fecha, -1))}
        aria-label="Día anterior"
        className="px-1.5 text-gray-400 hover:text-gray-700"
      >
        ‹
      </button>

      <CalendarDateField
        name="fecha"
        value={fecha}
        onChange={goTo}
        triggerClassName={TRIGGER_CLASS}
        label={
          <span className="capitalize">
            📅 {isToday ? "Hoy" : weekday}, {day} {month}
          </span>
        }
      />

      <button
        type="button"
        onClick={() => goTo(addBusinessDays(fecha, 1))}
        aria-label="Día siguiente"
        className="px-1.5 text-gray-400 hover:text-gray-700"
      >
        ›
      </button>
    </div>
  );
}
