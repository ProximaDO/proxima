import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMarketCategoryAction,
  deleteMarketCategoryAction,
  updateMarketCategoryAction,
} from "@/app/admin/markets/actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function MarketCategoriesPage({ searchParams }: Props) {
  await requireAdmin();
  const supabase = await createClient();
  const { error, success } = await searchParams;

  const [{ data: categories }, { data: markets }] = await Promise.all([
    supabase
      .from("market_categories")
      .select("id, name, created_at")
      .order("name", { ascending: true }),
    supabase
      .from("markets")
      .select("id, category"),
  ]);

  const categoryRows = (categories ?? []) as { id: string; name: string; created_at: string }[];
  const marketRows = (markets ?? []) as { id: string; category: string | null }[];

  const usageByCategory = new Map<string, number>();
  for (const market of marketRows) {
    const key = market.category?.trim();
    if (!key) continue;
    usageByCategory.set(key, (usageByCategory.get(key) ?? 0) + 1);
  }

  return (
    <main className="admin-fade-in mx-auto w-full max-w-4xl space-y-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Categorias de mercados</h1>
          <p className="mt-1 text-sm text-white/60">Crear, editar o eliminar categorias disponibles para mercados.</p>
        </div>
        <Link href="/admin/markets" className="admin-btn-muted">
          Volver a Mercados
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
          {decodeURIComponent(success)}
        </div>
      )}

      <section className="admin-card p-6">
        <h2 className="text-lg font-bold text-white">Nueva categoria</h2>
        <form action={createMarketCategoryAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="name" className="text-sm font-medium text-white/85">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              maxLength={50}
              required
              className="admin-input"
              placeholder="Ej: Economia"
            />
          </div>
          <button type="submit" className="admin-btn-primary sm:min-w-44">
            Crear categoria
          </button>
        </form>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Categorias existentes</h2>
        </div>

        {categoryRows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-white/60">No hay categorias creadas aun.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {categoryRows.map((category) => {
              const usageCount = usageByCategory.get(category.name) ?? 0;
              const updateWithId = updateMarketCategoryAction.bind(null, category.id);
              const deleteWithId = deleteMarketCategoryAction.bind(null, category.id);

              return (
                <div key={category.id} className="px-6 py-4">
                  <form action={updateWithId} className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="min-w-0 flex-1 space-y-1">
                      <label htmlFor={`cat-${category.id}`} className="text-xs uppercase tracking-[0.14em] text-white/50">
                        Categoria
                      </label>
                      <input
                        id={`cat-${category.id}`}
                        name="name"
                        type="text"
                        maxLength={50}
                        defaultValue={category.name}
                        required
                        className="admin-input"
                      />
                      <p className="text-xs text-white/50">Mercados asociados: {usageCount}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button type="submit" className="admin-btn-muted">
                        Guardar
                      </button>
                    </div>
                  </form>

                  <form action={deleteWithId} className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={usageCount > 0}
                      title={usageCount > 0 ? "No se puede eliminar porque hay mercados usando esta categoria" : "Eliminar categoria"}
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
