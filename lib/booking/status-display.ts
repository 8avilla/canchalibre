// Único punto de verdad para cómo se ve un BookingStatus en toda la UI (admin). Antes vivía
// duplicado casi-idéntico en app/admin/reservas/page.tsx (badge Tailwind) y en
// app/admin/DashboardCharts.tsx (hex para el donut) — unificado acá para que la leyenda de la
// agenda, la tabla de reservas y el dashboard siempre coincidan.
export const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
  EXPIRADA: "Expirada",
};

// Hex, para contextos sin Tailwind (recharts, estilos inline en el grid de agenda).
export const STATUS_COLOR: Record<string, string> = {
  PENDIENTE_PAGO: "#f59e0b",
  CONFIRMADA: "#059669",
  EN_CURSO: "#3b82f6",
  FINALIZADA: "#6b7280",
  CANCELADA: "#ef4444",
  NO_SHOW: "#b91c1c",
  EXPIRADA: "#9ca3af",
};

// Clases Tailwind, para badges/pills.
export const STATUS_BADGE_STYLE: Record<string, string> = {
  PENDIENTE_PAGO: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  CONFIRMADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  EN_CURSO: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  FINALIZADA: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  CANCELADA: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  NO_SHOW: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  EXPIRADA: "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200",
};

// Bloque de la agenda: color de fondo + texto suave (no el badge saturado) para que el nombre del
// cliente siga siendo legible dentro del bloque.
export const STATUS_BLOCK_STYLE: Record<string, string> = {
  PENDIENTE_PAGO: "border-amber-300 bg-amber-100 text-amber-900",
  CONFIRMADA: "border-emerald-300 bg-emerald-100 text-emerald-900",
  EN_CURSO: "border-blue-300 bg-blue-100 text-blue-900",
  FINALIZADA: "border-gray-300 bg-gray-100 text-gray-700",
  CANCELADA: "border-red-300 bg-red-100 text-red-800",
  NO_SHOW: "border-red-300 bg-red-100 text-red-800",
  EXPIRADA: "border-gray-200 bg-gray-50 text-gray-500",
};

export const STATUS_ICON: Record<string, string> = {
  PENDIENTE_PAGO: "🕒",
  CONFIRMADA: "✓",
  EN_CURSO: "▶",
  FINALIZADA: "✓",
  CANCELADA: "✕",
  NO_SHOW: "✕",
  EXPIRADA: "✕",
};

// Los únicos 4 estados que la leyenda de la agenda muestra (mockup) — el resto (EN_CURSO, NO_SHOW,
// EXPIRADA) sigue coloreado en el grid pero no aparece en la leyenda por ser poco frecuentes.
export const LEGEND_STATUSES = ["CONFIRMADA", "PENDIENTE_PAGO", "CANCELADA", "FINALIZADA"] as const;
