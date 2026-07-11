// Banner de éxito/error estándar del módulo admin — antes cada página tenía su propia paleta
// (red-600 vs red-800, emerald-50/700 vs green-50/800); esta es la única fuente de verdad ahora.
export function Banner({ type, message }: { type: "success" | "error"; message: string }) {
  const className =
    type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600";

  return <p className={`rounded-md p-3 text-sm ${className}`}>{message}</p>;
}
