"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DEPARTAMENTOS, getMunicipios } from "@/lib/data/colombia";

// Leaflet toca `window` al importarse, así que el picker solo puede vivir en el cliente.
const LocationMapPicker = dynamic(
  () => import("./LocationMapPicker").then((mod) => mod.LocationMapPicker),
  { ssr: false, loading: () => <div className="h-56 w-full animate-pulse rounded-lg bg-gray-100" /> },
);

// Centro de Colombia (Bogotá) como punto de partida cuando el complejo todavía no tiene pin propio.
const DEFAULT_LAT = 4.711;
const DEFAULT_LNG = -74.0721;

const selectClassName =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400";

// Campos de ubicación (departamento/municipio/mapa) del complejo — sin <form> propio: vive dentro
// del form de "Información general" en page.tsx para que país, dirección y ubicación se guarden en
// un solo submit con updateOrganizationInfo, tal como se ve en el diseño (una sola card, un solo
// botón "Guardar cambios").
export function LocationFields({
  initialDepartment,
  initialMunicipality,
  initialLatitude,
  initialLongitude,
}: {
  initialDepartment: string | null;
  initialMunicipality: string | null;
  initialLatitude: number | null;
  initialLongitude: number | null;
}) {
  const [department, setDepartment] = useState(initialDepartment ?? "");
  const municipios = department ? getMunicipios(department) : [];
  const municipalityDefault = department === initialDepartment ? (initialMunicipality ?? "") : "";
  const [lat, setLat] = useState(initialLatitude ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLongitude ?? DEFAULT_LNG);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">
          País <span className="text-red-500">*</span>
          <input type="text" value="Colombia" disabled className={selectClassName} />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-gray-700">
          Departamento <span className="text-red-500">*</span>
          <select
            name="department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            className={selectClassName}
          >
            <option value="" disabled>
              Selecciona un departamento
            </option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-gray-700">
          Municipio <span className="text-red-500">*</span>
          <select
            name="municipality"
            defaultValue={municipalityDefault}
            key={department}
            required
            disabled={!department}
            className={selectClassName}
          >
            <option value="" disabled>
              {department ? "Selecciona un municipio" : "Selecciona primero un departamento"}
            </option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-1.5">
        <h3 className="text-sm font-semibold text-gray-900">Ubicación</h3>
        <span className="text-sm font-medium text-gray-700">Punto exacto en el mapa</span>
        <p className="text-xs text-gray-500">Arrastra el pin o toca el mapa para marcar la entrada del complejo.</p>
        <LocationMapPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
        />
      </div>
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
    </>
  );
}
