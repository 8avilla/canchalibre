import { Plus_Jakarta_Sans } from "next/font/google";

// Tipografía del header compartido (SiteHeader) y de la home — un solo módulo para que next/font no
// genere instancias/caras de fuente duplicadas entre los archivos que lo usan.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
