import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createMarketAction } from "@/app/admin/markets/actions";
import CategorySelect from "@/app/admin/markets/category-select";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewMarketPage({ searchParams }: Props) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await searchParams;

  const { data: categories } = await supabase
    .from("market_categories")
    .select("id, name")
    .order("name", { ascending: true });

  const categoryRows = (categories ?? []) as { id: string; name: string }[];

  return (
    <main className="admin-fade-in mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/markets"
          className="text-sm text-white/60 hover:text-white"
        >
          ← Mercados
        </Link>
        <span className="text-white/30">/</span>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Nuevo mercado</h1>
        <Link
          href="/admin/markets/categories"
          className="ml-auto text-sm text-white/60 hover:text-white"
        >
          Gestionar categorias
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={createMarketAction} className="admin-card space-y-6 p-6">
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/85" htmlFor="title">
            Pregunta / titulo *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="¿Cual sera el tipo de cambio del dolar el viernes?"
            className="admin-input"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-white/85" htmlFor="description">
            Descripcion
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Detalle adicional sobre el criterio de resolucion..."
            className="admin-input"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="category">
              Categoria
            </label>
            <CategorySelect
              name="category"
              options={categoryRows}
              placeholder="Selecciona una categoria"
            />
            <p className="text-xs text-white/55">
              Las categorias se administran en{" "}
              <Link href="/admin/markets/categories" className="underline hover:text-white">
                Gestionar categorias
              </Link>
              .
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="fee_bps">
              Comision (bps)
            </label>
            <input
              id="fee_bps"
              name="fee_bps"
              type="number"
              defaultValue="0"
              min="0"
              max="10000"
              className="admin-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="opens_at">
              Abre en
            </label>
            <input
              id="opens_at"
              name="opens_at"
              type="datetime-local"
              className="admin-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="closes_at">
              Cierra en
            </label>
            <input
              id="closes_at"
              name="closes_at"
              type="datetime-local"
              className="admin-input"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-white/85" htmlFor="liquidity_b">
            Liquidez inicial (LMSR b)
          </label>
          <input
            id="liquidity_b"
            name="liquidity_b"
            type="number"
            defaultValue="100"
            min="1"
            step="any"
            className="admin-input"
          />
          <p className="text-xs text-white/55">
            Valor mas alto = precios mas estables pero mas capital requerido.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-white/85">Opciones * (min 2, max 10)</legend>
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              name={`option_${i}`}
              type="text"
              placeholder={i < 2 ? `Opcion ${i + 1} *` : `Opcion ${i + 1}`}
              required={i < 2}
              className="admin-input"
            />
          ))}
        </fieldset>

        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <Link
            href="/admin/markets"
            className="admin-btn-muted"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="admin-btn-primary"
          >
            Crear mercado
          </button>
        </div>
      </form>
    </main>
  );
}
