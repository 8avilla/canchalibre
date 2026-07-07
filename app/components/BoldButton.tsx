"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { BoldCheckoutPayload } from "@/lib/payments/bold";

// Widget embebido de Bold (botón de pagos), verificado contra
// https://developers.bold.co/pagos-en-linea/boton-de-pagos/integracion-manual/integracion-manual :
// la librería se carga una vez (sin atributos) y un segundo <script> sin `src`, marcado con
// data-bold-button, es el que la librería detecta en el DOM para renderizar el botón ahí mismo.
//
// React no ejecuta ni reconcilia bien un <script> insertado vía su virtual DOM en el cliente (avisa
// "Scripts inside React components are never executed when rendering on the client"), así que ese
// script marcador se inserta con DOM nativo.
//
// Orden importa: la librería de Bold escanea el DOM buscando [data-bold-button] apenas se ejecuta
// (no usa un MutationObserver para detectar marcadores agregados después). Insertar el marcador
// recién cuando la librería avisa "onReady" llega tarde — el escaneo ya pasó y no encuentra nada, así
// que el botón nunca aparece aunque todo lo demás esté bien. Por eso el marcador se inserta primero
// (al montar el componente) y la librería se pide después, nunca al revés.
export function BoldButton({ payload }: { payload: BoldCheckoutPayload }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [markerReady, setMarkerReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const marker = document.createElement("script");
    marker.setAttribute("data-bold-button", "dark-L");
    marker.setAttribute("data-api-key", payload.apiKey);
    marker.setAttribute("data-order-id", payload.orderId);
    marker.setAttribute("data-amount", String(payload.amount));
    marker.setAttribute("data-currency", payload.currency);
    marker.setAttribute("data-description", payload.description);
    marker.setAttribute("data-redirection-url", payload.redirectionUrl);
    marker.setAttribute("data-integrity-signature", payload.integritySignature);
    container.appendChild(marker);
    setMarkerReady(true);

    return () => {
      if (container.contains(marker)) {
        container.removeChild(marker);
      }
      setMarkerReady(false);
    };
  }, [payload]);

  return (
    <>
      <div ref={containerRef} />
      {markerReady && (
        <Script src="https://checkout.bold.co/library/boldPaymentButton.js" strategy="afterInteractive" />
      )}
    </>
  );
}
