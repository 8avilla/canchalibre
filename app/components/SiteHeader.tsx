import Image from "next/image";
import Link from "next/link";
import { plusJakarta } from "@/app/fonts";
import { HeaderMenu } from "@/app/HeaderMenu";
import styles from "@/app/HomeSearch.module.css";

// Header compartido por las páginas de navegación del cliente (home, organización, Mis reservas,
// Quienes somos, Registrar cancha, Términos). Las pantallas de reservar/pagar mantienen su propio
// header minimalista (botón volver + título) a propósito, para no distraer en el checkout — no lleva
// este componente.
export function SiteHeader() {
  return (
    <header className={`${styles.header} ${plusJakarta.className}`}>
      <Link href="/" className={styles.brand}>
        <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} priority className="h-9 w-auto" />
      </Link>
      <nav className={styles.headerNav}>
        <button type="button" className={styles.navItem}>
          ❓ <span>Ayuda</span>
        </button>
        <Link href="/mis-reservas" className={styles.navItem}>
          📅 <span>Mis reservas</span>
        </Link>
        <HeaderMenu />
      </nav>
    </header>
  );
}
