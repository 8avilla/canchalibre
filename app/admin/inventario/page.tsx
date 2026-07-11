import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createProduct, updateProduct, adjustStock } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; actualizado?: string }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { creado, actualizado } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const products = await db.consumptionItem.findMany({
    where: { orgId: organization.id },
    orderBy: { name: "asc" },
  });

  return (
    <main className="px-6 py-10">
      <h1 className="text-xl font-semibold">Inventario</h1>

      {creado && <div className="mt-4"><Banner type="success" message="Producto creado correctamente." /></div>}
      {actualizado && <div className="mt-4"><Banner type="success" message="Producto actualizado correctamente." /></div>}

      <ul className="mt-6 grid gap-3">
        {products.map((product) => {
          const isLow = product.stock < product.lowStockThreshold;
          const justUpdated = actualizado === product.id;
          return (
            <li
              key={product.id}
              className={`rounded-lg border p-4 ${
                justUpdated ? "border-emerald-300 bg-emerald-50/30" : isLow ? "border-amber-300 bg-amber-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{product.name}</span>
                <span className="text-sm text-gray-500">Stock: {product.stock}</span>
              </div>

              <form action={updateProduct} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="productId" value={product.id} />
                <label className="grid gap-1 text-sm">
                  Precio
                  <input
                    type="number"
                    inputMode="numeric"
                    name="price"
                    min={0}
                    defaultValue={product.price}
                    className="rounded-md border border-gray-300 px-3 py-3"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Umbral stock bajo
                  <input
                    type="number"
                    inputMode="numeric"
                    name="lowStockThreshold"
                    min={0}
                    defaultValue={product.lowStockThreshold}
                    className="rounded-md border border-gray-300 px-3 py-3"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Estado
                  <select
                    name="active"
                    defaultValue={product.active ? "true" : "false"}
                    className="rounded-md border border-gray-300 px-3 py-3"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </label>
                <SubmitButton className="rounded-md bg-gray-900 px-3 py-3 text-sm text-white">Guardar</SubmitButton>
              </form>

              <form action={adjustStock} className="mt-2 flex items-end gap-3">
                <input type="hidden" name="productId" value={product.id} />
                <label className="grid gap-1 text-sm">
                  Ajustar stock (+ entrada / - salida)
                  <input
                    type="number"
                    inputMode="numeric"
                    name="delta"
                    required
                    className="rounded-md border border-gray-300 px-3 py-3"
                  />
                </label>
                <SubmitButton className="rounded-md bg-blue-600 px-3 py-3 text-sm text-white">Aplicar</SubmitButton>
              </form>
            </li>
          );
        })}

        {products.length === 0 && <li className="text-sm text-gray-500">Sin productos todavía.</li>}
      </ul>

      <form action={createProduct} className="mt-8 grid gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium">Nuevo producto</h2>
        <label className="grid gap-1 text-sm">
          Nombre
          <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Precio
          <input
            type="number"
            inputMode="numeric"
            name="price"
            min={0}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Stock inicial
          <input
            type="number"
            inputMode="numeric"
            name="stock"
            min={0}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Umbral de stock bajo
          <input
            type="number"
            inputMode="numeric"
            name="lowStockThreshold"
            min={0}
            defaultValue={10}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <SubmitButton className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
          Crear producto
        </SubmitButton>
      </form>
    </main>
  );
}
