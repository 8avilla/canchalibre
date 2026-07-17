"use client";

import { useState } from "react";
import { CalendarDateField } from "./CalendarDateField";

const TRIGGER_CLASS =
  "mt-1 flex w-full items-center gap-1.5 rounded-md border border-gray-300 px-2 py-2 text-left text-sm shadow-sm " +
  "hover:border-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

// Campos "Desde"/"Hasta" de la barra de filtros de Vista lista (BookingsTable.tsx) — Server Component,
// así que este pedazo con estado (para el dropdown de calendario) se aísla en su propio Client
// Component en vez de convertir toda la tabla. El <form method="get"> que los envuelve sigue siendo
// una navegación GET normal: los hidden inputs de CalendarDateField van con name="dateFrom"/"dateTo",
// se leen en el submit exactamente igual que los <input type="date"> nativos que reemplazan.
export function DateRangeFilterFields({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const [from, setFrom] = useState(dateFrom ?? "");
  const [to, setTo] = useState(dateTo ?? "");

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500">📅 Desde</label>
        <CalendarDateField name="dateFrom" value={from} onChange={setFrom} triggerClassName={TRIGGER_CLASS} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500">📅 Hasta</label>
        <CalendarDateField name="dateTo" value={to} onChange={setTo} triggerClassName={TRIGGER_CLASS} />
      </div>
    </>
  );
}
