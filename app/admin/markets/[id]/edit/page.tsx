import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { updateMarketAction } from "@/app/admin/markets/actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "open", label: "Abierto" },
  { value: "closed", label: "Cerrado" },
  { value: "archived", label: "Archivado" },
] as const;

export default async function EditMarketPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: market } = await supabase
    .from("markets")
    .select("id, title, description, category, status, opens_at, closes_at, liquidity_b, fee_bps")
    .eq("id", id)
    .single();

  if (!market) notFound();

  const updateWithId = updateMarketAction.bind(null, id);

  const fmtDatetime = (val: string | null) =>
    val ? val.slice(0, 16) : "";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href={`/admin/markets/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Detalle
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold">Editar mercado</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={updateWithId} className="space-y-6">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="title">
            Pregunta / titulo
          </label>
          <input
            id="title"
            name="title"
            type="text"
            defaultValue={market.title}
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
            defaultValue={market.description ?? ""}
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
              defaultValue={market.category ?? ""}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={market.status}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 bg-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              defaultValue={fmtDatetime(market.opens_at)}
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
              defaultValue={fmtDatetime(market.closes_at)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="liquidity_b">
              Liquidez (LMSR b)
            </label>
            <input
              id="liquidity_b"
              name="liquidity_b"
              type="number"
              defaultValue={String(market.liquidity_b)}
              min="1"
              step="any"
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
              defaultValue={String(market.fee_bps)}
              min="0"
              max="10000"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
          <Link
            href={`/admin/markets/${id}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}
