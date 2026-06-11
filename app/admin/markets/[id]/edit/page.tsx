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
    <main className="admin-fade-in mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/markets/${id}`}
          className="text-sm text-white/60 hover:text-white"
        >
          ← Detalle
        </Link>
        <span className="text-white/30">/</span>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Editar mercado</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={updateWithId} className="admin-card space-y-6 p-6">
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/85" htmlFor="title">
            Pregunta / titulo
          </label>
          <input
            id="title"
            name="title"
            type="text"
            defaultValue={market.title}
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
            defaultValue={market.description ?? ""}
            className="admin-input"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="category">
              Categoria
            </label>
            <input
              id="category"
              name="category"
              type="text"
              defaultValue={market.category ?? ""}
              className="admin-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={market.status}
              className="admin-input"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              defaultValue={fmtDatetime(market.opens_at)}
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
              defaultValue={fmtDatetime(market.closes_at)}
              className="admin-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="liquidity_b">
              Liquidez (LMSR b)
            </label>
            <input
              id="liquidity_b"
              name="liquidity_b"
              type="number"
              defaultValue={String(market.liquidity_b)}
              min="1"
              step="any"
              className="admin-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-white/85" htmlFor="fee_bps">
              Comision (bps)
            </label>
            <input
              id="fee_bps"
              name="fee_bps"
              type="number"
              defaultValue={String(market.fee_bps)}
              min="0"
              max="10000"
              className="admin-input"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <Link
            href={`/admin/markets/${id}`}
            className="admin-btn-muted"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="admin-btn-primary"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}
