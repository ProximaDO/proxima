import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { changeMarketStatusAction, resolveMarketAction } from "@/app/admin/markets/actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Abierto",
  closed: "Cerrado",
  resolved: "Resuelto",
  archived: "Archivado",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-amber-100 text-amber-700",
  resolved: "bg-blue-100 text-blue-700",
  archived: "bg-zinc-200 text-zinc-500",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function MarketDetailPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: market } = await supabase
    .from("markets")
    .select("*, market_options(*), resolution_option:market_options!markets_resolution_option_id_fkey(label)")
    .eq("id", id)
    .single();

  if (!market) notFound();

  type MarketOption = { id: string; label: string; sort_order: number };
  const rawOptions = market.market_options as unknown as MarketOption[];
  const options = (rawOptions ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/admin/markets"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Mercados
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="truncate text-sm text-zinc-700">{market.title}</span>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold leading-snug">{market.title}</h1>
          {market.description && (
            <p className="mt-2 text-sm text-zinc-600">{market.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[market.status] ?? STATUS_COLOR.draft}`}
        >
          {STATUS_LABEL[market.status] ?? market.status}
        </span>
      </header>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {decodeURIComponent(success)}
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-zinc-100 p-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500">Categoria</dt>
          <dd className="mt-0.5 text-sm font-medium">{market.category ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Liquidez b</dt>
          <dd className="mt-0.5 text-sm font-medium">{market.liquidity_b}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Comision</dt>
          <dd className="mt-0.5 text-sm font-medium">{market.fee_bps} bps</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Cierra</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {market.closes_at
              ? new Date(market.closes_at).toLocaleDateString("es-DO")
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="mt-6 rounded-xl border border-zinc-100 p-5">
        <h2 className="text-sm font-medium text-zinc-700">Opciones</h2>
        <ul className="mt-3 space-y-2">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm"
            >
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              {opt.label}
            </li>
          ))}
        </ul>
      </section>

      {market.status === "resolved" && (
        <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-sm font-medium text-blue-800">Resultado oficial</h2>
          <p className="mt-2 text-sm text-blue-700">
            Opcion ganadora: <span className="font-semibold">{market.resolution_option?.label ?? "No disponible"}</span>
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Resuelto el {market.resolved_at ? new Date(market.resolved_at).toLocaleString("es-DO") : "—"}
          </p>
        </section>
      )}

      {market.status === "closed" && (
        <section className="mt-6 rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-medium text-zinc-700">Resolver mercado</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Esta accion cancela ordenes abiertas, liquida posiciones y marca el mercado como resuelto.
          </p>

          <form action={resolveMarketAction} className="mt-4 space-y-3">
            <input type="hidden" name="market_id" value={market.id} />

            <div className="space-y-1">
              <label htmlFor="winning_option_id" className="text-xs text-zinc-600">
                Opcion ganadora
              </label>
              <select
                id="winning_option_id"
                name="winning_option_id"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              >
                <option value="">Selecciona una opcion</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="resolution_note" className="text-xs text-zinc-600">
                Nota de resolucion (opcional)
              </label>
              <textarea
                id="resolution_note"
                name="resolution_note"
                rows={3}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                placeholder="Fuente o criterio usado para resolver el mercado"
              />
            </div>

            <button
              type="submit"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Resolver y liquidar
            </button>
          </form>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/markets/${id}/edit`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
        >
          Editar
        </Link>

        {market.status === "draft" && (
          <form
            action={async () => {
              "use server";
              await changeMarketStatusAction(id, "open");
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Abrir mercado
            </button>
          </form>
        )}

        {market.status === "open" && (
          <form
            action={async () => {
              "use server";
              await changeMarketStatusAction(id, "closed");
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              Cerrar mercado
            </button>
          </form>
        )}

        {(market.status === "closed" || market.status === "draft") && (
          <form
            action={async () => {
              "use server";
              await changeMarketStatusAction(id, "archived");
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Archivar
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
