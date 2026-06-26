import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { labelMarketStatus } from "@/lib/ui/labels-es-do";

export const dynamic = "force-dynamic";

export default async function AdminMarketsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: markets } = await supabase
    .from("markets")
    .select("id, title, status, category, closes_at, created_at, is_daily_fx")
    .order("created_at", { ascending: false });

  let seenDailyFx = false;
  const visibleMarkets = (markets ?? []).filter((market) => {
    if (!market.is_daily_fx) return true;
    if (seenDailyFx) return false;

    seenDailyFx = true;
    return true;
  });

  return (
    <main className="admin-fade-in space-y-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">Mercados</h1>
          <p className="mt-1 text-sm text-white/65">
            {visibleMarkets.length} mercados en total
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="admin-btn-muted"
          >
            Volver
          </Link>
          <Link
            href="/admin/markets/new"
            className="admin-btn-primary"
          >
            Nuevo mercado
          </Link>
        </div>
      </header>

      <section>
        {visibleMarkets.length === 0 ? (
          <div className="admin-empty py-16 text-center">
            <p className="text-sm text-white/60">
              No hay mercados aun.{" "}
              <Link
                href="/admin/markets/new"
                className="underline text-white"
              >
                Crea el primero
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="admin-card divide-y divide-white/10 overflow-hidden">
            {visibleMarkets.map((m) => (
              <Link
                key={m.id}
                href={`/admin/markets/${m.id}`}
                className="flex items-center justify-between px-5 py-4 transition hover:bg-white/[0.06]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{m.title}</p>
                  <p className="mt-0.5 text-xs text-white/55">
                    {m.category ? `${m.category} · ` : ""}
                    {m.closes_at
                      ? `Cierra ${new Date(m.closes_at).toLocaleDateString("es-DO")}`
                      : "Sin fecha de cierre"}
                  </p>
                </div>
                <span
                  className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    m.status === "open"
                      ? "bg-emerald-400/20 text-emerald-300"
                      : m.status === "closed"
                        ? "bg-amber-300/20 text-amber-200"
                        : m.status === "resolved"
                          ? "bg-blue-400/20 text-blue-300"
                          : "bg-white/15 text-white/65"
                  }`}
                >
                  {labelMarketStatus(m.status)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
