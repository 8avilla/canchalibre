"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Mientras la reserva sigue PENDIENTE_PAGO (esperando el webhook de Bold o la aprobación manual del
// comprobante), sondea el estado y refresca la página en cuanto cambie — evita que el cliente se
// quede viendo "verificando tu pago" para siempre sin recargar.
export function StatusWatcher({
  orgSlug,
  bookingId,
  currentStatus,
}: {
  orgSlug: string;
  bookingId: string;
  currentStatus: string;
}) {
  const router = useRouter();

  useSWR<{ status: string }>(`/api/${orgSlug}/reserva/${bookingId}/status`, fetcher, {
    refreshInterval: 4000,
    onSuccess: (data) => {
      if (data.status !== currentStatus) {
        router.refresh();
      }
    },
  });

  return null;
}
