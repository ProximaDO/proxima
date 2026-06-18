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
    .select("id, title, description, status, category, liquidity_b, fee_bps, closes_at, resolved_at, resolution_option_id")
    .eq("id", id)
    .maybeSingle();

  if (!market) notFound();

  type MarketOption = { id: string; label: string; sort_order: number };
  const [{ data: optionsData }, { data: resolutionOptionData }] = await Promise.all([
    supabase
      .from("market_options")
      .select("id, label, sort_order")
      .eq("market_id", id)
      .order("sort_order", { ascending: true }),
    market.resolution_option_id
      ? supabase
          .from("market_options")
          .select("label")
          .eq("id", market.resolution_option_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const options = (optionsData ?? []) as MarketOption[];

  return (
    <main className="admin-fade-in mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/markets"
          className="text-sm text-white/60 hover:text-white"
        >
          ← Mercados
        </Link>
        <span className="text-white/30">/</span>
        <span className="truncate text-sm text-white/70">{market.title}</span>
      </div>

      <header className="admin-card flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-snug">{market.title}</h1>
          {market.description && (
            <p className="mt-2 text-sm text-white/65">{market.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            market.status === "open"
              ? "bg-emerald-400/20 text-emerald-300"
              : market.status === "closed"
                ? "bg-amber-300/20 text-amber-200"
                : market.status === "resolved"
                  ? "bg-blue-400/20 text-blue-300"
                  : "bg-white/15 text-white/65"
          }`}
        >
          {STATUS_LABEL[market.status] ?? market.status}
        </span>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
          {decodeURIComponent(success)}
        </div>
      )}

      <dl className="admin-card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-white/50">Categoria</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">{market.category ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Liquidez b</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">{market.liquidity_b}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Comision</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">{market.fee_bps} bps</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Cierra</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">
            {market.closes_at
              ? new Date(market.closes_at).toLocaleDateString("es-DO")
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="admin-card p-5">
        <h2 className="text-sm font-medium text-white/80">Opciones</h2>
        <ul className="mt-3 space-y-2">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              <span className="h-2 w-2 rounded-full bg-[#66b4ff]" />
              {opt.label}
            </li>
          ))}
        </ul>
      </section>

      {market.status === "resolved" && (
        <section className="admin-card border-blue-400/25 bg-blue-500/10 p-5">
          <h2 className="text-sm font-medium text-blue-200">Resultado oficial</h2>
          <p className="mt-2 text-sm text-blue-100">
            Opcion ganadora: <span className="font-semibold">{resolutionOptionData?.label ?? "No disponible"}</span>
          </p>
          <p className="mt-1 text-xs text-blue-200/70">
            Resuelto el {market.resolved_at ? new Date(market.resolved_at).toLocaleString("es-DO") : "—"}
          </p>
        </section>
      )}

      {market.status === "closed" && (
        <section className="admin-card p-5">
          <h2 className="text-sm font-medium text-white/80">Resolver mercado</h2>
          <p className="mt-1 text-xs text-white/55">
            Esta accion cancela ordenes abiertas, liquida posiciones y marca el mercado como resuelto.
          </p>

          <form action={resolveMarketAction} className="mt-4 space-y-3">
            <input type="hidden" name="market_id" value={market.id} />

            <div className="space-y-1">
              <label htmlFor="winning_option_id" className="text-xs text-white/60">
                Opcion ganadora
              </label>
              <select
                id="winning_option_id"
                name="winning_option_id"
                required
                className="admin-input"
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
              <label htmlFor="resolution_note" className="text-xs text-white/60">
                Nota de resolucion (opcional)
              </label>
              <textarea
                id="resolution_note"
                name="resolution_note"
                rows={3}
                className="admin-input"
                placeholder="Fuente o criterio usado para resolver el mercado"
              />
            </div>

            <button
              type="submit"
              className="admin-btn-primary"
            >
              Resolver y liquidar
            </button>
          </form>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/markets/${id}/edit`}
          className="admin-btn-muted"
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
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
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
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
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
              className="admin-btn-muted"
            >
              Archivar
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
