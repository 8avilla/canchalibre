"use client";

import { useEffect, useRef, useState } from "react";
import { todayBusinessDate } from "@/lib/time/business-day";

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

// timeZone: "UTC" a propósito en ambos formatters — el cursor de mes y las celdas del grid son
// aritmética de calendario pura (Date.UTC(year, month, day)), no un instante real de Bogotá como el
// resto de business-day.ts. Formatear eso con America/Bogota (UTC-5) correría la fecha un día para
// atrás (ej. 1 jul 00:00 UTC se ve como 30 jun 19:00 en Bogotá) — un bug real, no cosmético.
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: month - 1, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// Semana empieza en lunes (convención local) — Date.getUTCDay() nativo da 0=domingo, se remapea.
function firstWeekdayOfMonth(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

// Selector de fecha con navegación de mes propia — reemplaza el <input type="date"> nativo (cuya UI
// varía entre navegador/SO, a veces sin vista de calendario) por un dropdown consistente con el resto
// de la app. Value/onChange en "YYYY-MM-DD", igual formato que el resto del sistema; incluye un input
// hidden con `name` para seguir funcionando dentro de un <form action={serverAction}> normal.
const DEFAULT_TRIGGER_CLASS =
  "mt-1 flex w-full items-center gap-2 rounded-md border border-gray-300 px-3 py-2.5 text-left text-sm " +
  "shadow-sm hover:border-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export function CalendarDateField({
  name,
  value,
  onChange,
  required,
  triggerClassName,
  label,
}: {
  name: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  // Override para encajar en filtros más densos (ej. la barra de filtros de Vista lista, que usa
  // inputs más chicos que el drawer "Nueva reserva") sin duplicar todo el componente.
  triggerClassName?: string;
  // Reemplaza el contenido default del botón ("📅 17 de julio de 2026") — ej. el navegador de fecha
  // de la agenda necesita el formato compacto "Hoy, 17 Jul" que ya usaba, no la fecha larga.
  label?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseIso(value || todayBusinessDate()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function openPicker() {
    setCursor(parseIso(value || todayBusinessDate()));
    setOpen(true);
  }

  function goToMonth(delta: number) {
    setCursor((c) => {
      const totalMonths = c.year * 12 + c.month + delta;
      return { year: Math.floor(totalMonths / 12), month: ((totalMonths % 12) + 12) % 12, day: c.day };
    });
  }

  function pickDay(day: number) {
    onChange(toIso(cursor.year, cursor.month, day));
    setOpen(false);
  }

  const today = todayBusinessDate();
  // Deriva el label del botón directamente de `value`, no de `cursor` — el cursor es solo el mes que
  // se está navegando dentro del dropdown y puede quedar en un día distinto al realmente seleccionado
  // (ej. tras navegar de mes sin volver a elegir día), lo que mostraba el día equivocado en el botón.
  const parsedValue = value ? parseIso(value) : null;
  const selectedUtcDate = parsedValue ? new Date(Date.UTC(parsedValue.year, parsedValue.month, parsedValue.day)) : null;
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const leadingBlanks = firstWeekdayOfMonth(cursor.year, cursor.month);
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={triggerClassName ?? DEFAULT_TRIGGER_CLASS}
      >
        {label ?? (
          <>
            <span aria-hidden="true">📅</span>
            <span className="capitalize text-gray-900">
              {selectedUtcDate ? DAY_LABEL_FORMATTER.format(selectedUtcDate) : "Selecciona una fecha"}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Mes anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              ‹
            </button>
            <span className="text-sm font-medium capitalize text-gray-900">
              {MONTH_YEAR_FORMATTER.format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              ›
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[11px] font-medium text-gray-400">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const iso = toIso(cursor.year, cursor.month, day);
              const isSelected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                    isSelected
                      ? "bg-emerald-700 font-medium text-white"
                      : isToday
                        ? "border border-emerald-500 text-emerald-700"
                        : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
