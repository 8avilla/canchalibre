"use client";

import { createWalkInBooking } from "@/lib/pos/actions";
import { SubmitButton } from "@/app/components/SubmitButton";

export type WalkInVenue = { id: string; name: string };

// Reserva manual/walk-in (negocio.md §6.4) — el cliente ya está presencial y ya pagó, así que el
// personal la crea directo en CONFIRMADA desde acá, sin pasar por el flujo público de pago.
export function WalkInBookingForm({ orgSlug, venues }: { orgSlug: string; venues: WalkInVenue[] }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <details className="mt-4 rounded-lg border border-gray-200 bg-white">
      <summary className="cursor-pointer list-none p-4 text-sm font-medium text-gray-700 [&::-webkit-details-marker]:hidden">
        + Nueva reserva (walk-in)
      </summary>

      <form action={createWalkInBooking} className="grid gap-3 border-t border-gray-100 p-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />

        <label className="grid gap-1 text-sm">
          Cancha
          <select name="venueId" required className="rounded-md border border-gray-300 px-3 py-2.5">
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Fecha
            <input
              type="date"
              name="date"
              required
              defaultValue={today}
              className="rounded-md border border-gray-300 px-3 py-2.5"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Hora
            <input
              type="time"
              name="startTime"
              step={3600}
              required
              className="rounded-md border border-gray-300 px-3 py-2.5"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          Nombre del cliente
          <input name="customerName" required minLength={3} className="rounded-md border border-gray-300 px-3 py-2.5" />
        </label>

        <label className="grid gap-1 text-sm">
          WhatsApp (10 dígitos)
          <input
            name="customerPhone"
            required
            pattern="\d{10}"
            inputMode="numeric"
            className="rounded-md border border-gray-300 px-3 py-2.5"
          />
        </label>

        <SubmitButton
          pendingLabel="Creando…"
          className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Crear reserva
        </SubmitButton>
      </form>
    </details>
  );
}
