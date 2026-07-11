import { Footer } from "@/app/components/Footer";
import { SiteHeader } from "@/app/components/SiteHeader";

export default function QuienesSomosPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Quienes somos</h1>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Cancha Libre es una plataforma de reservas para complejos deportivos. Conectamos a
          jugadores con canchas de fútbol y pádel disponibles ahora mismo, y le damos a cada
          complejo las herramientas para operar sin depender del teléfono ni de cuadernos de papel.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Para el jugador: buscar cancha, ver horarios reales y pagar el abono en minutos, sin
          llamadas ni esperas.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Para el dueño del complejo: agenda digital contra sobrecupos, punto de venta para la
          barra, y cierres de caja auditados turno a turno — todo en un solo lugar.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Nada de lo que mostramos es inventado: sin calificaciones falsas, sin contadores de
          demanda artificiales, sin promociones que no existen.
        </p>
      </main>
      <Footer />
    </>
  );
}
