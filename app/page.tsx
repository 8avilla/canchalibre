import Link from "next/link";
import { db } from "@/lib/db";

export default async function Home() {
  const organizations = await db.organization.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">SportArena</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cada complejo deportivo tiene su propio enlace: <code>/nombre-del-complejo</code>.
      </p>

      <ul className="mt-6 grid gap-2">
        {organizations.map((org) => (
          <li key={org.id}>
            <Link href={`/${org.slug}`} className="text-emerald-700 hover:underline">
              /{org.slug} — {org.name}
            </Link>
          </li>
        ))}

        {organizations.length === 0 && (
          <li className="text-sm text-gray-500">Todavía no hay complejos deportivos registrados.</li>
        )}
      </ul>
    </main>
  );
}
