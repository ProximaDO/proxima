import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createMarketAction } from "@/app/admin/markets/actions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewMarketPage({ searchParams }: Props) {
  await requireAdmin();
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/admin/markets"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Mercados
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold">Nuevo mercado</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={createMarketAction} className="space-y-6">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="title">
            Pregunta / titulo *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="¿Cual sera el tipo de cambio del dolar el viernes?"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="description">
            Descripcion
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Detalle adicional sobre el criterio de resolucion..."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="category">
              Categoria
            </label>
            <input
              id="category"
              name="category"
              type="text"
              placeholder="Economia, Politica..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="fee_bps">
              Comision (bps)
            </label>
            <input
              id="fee_bps"
              name="fee_bps"
              type="number"
              defaultValue="0"
              min="0"
              max="10000"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="opens_at">
              Abre en
            </label>
            <input
              id="opens_at"
              name="opens_at"
              type="datetime-local"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="closes_at">
              Cierra en
            </label>
            <input
              id="closes_at"
              name="closes_at"
              type="datetime-local"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="liquidity_b">
            Liquidez inicial (LMSR b)
          </label>
          <input
            id="liquidity_b"
            name="liquidity_b"
            type="number"
            defaultValue="100"
            min="1"
            step="any"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <p className="text-xs text-zinc-500">
            Valor mas alto = precios mas estables pero mas capital requerido.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Opciones * (min 2, max 10)</legend>
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              name={`option_${i}`}
              type="text"
              placeholder={i < 2 ? `Opcion ${i + 1} *` : `Opcion ${i + 1}`}
              required={i < 2}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          ))}
        </fieldset>

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
          <Link
            href="/admin/markets"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Crear mercado
          </button>
        </div>
      </form>
    </main>
  );
}
