import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { count: totalMarkets } = await supabase
    .from("markets")
    .select("id", { count: "exact", head: true });

  const { count: openMarkets } = await supabase
    .from("markets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card px-6 py-5">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
          Panel administrativo
        </h1>
        <p className="mt-2 text-sm text-white/65">Sesion activa: {user.email}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="admin-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Mercados totales</p>
          <p className="mt-2 text-4xl font-extrabold text-white">{totalMarkets ?? 0}</p>
        </div>
        <div className="admin-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Mercados abiertos</p>
          <p className="mt-2 text-4xl font-extrabold text-emerald-300">{openMarkets ?? 0}</p>
        </div>
        <div className="admin-card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Ritmo operativo</p>
          <p className="mt-2 text-2xl font-bold text-[#ff8d6e]">Monitoreo activo</p>
          <p className="mt-1 text-xs text-white/55">Cron, retiros y notificaciones vigilados</p>
        </div>
      </div>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/admin/markets"
          className="admin-card flex items-center justify-between p-5 transition hover:border-white/30 hover:bg-white/[0.08]"
        >
          <div>
            <p className="text-lg font-bold text-white">Mercados</p>
            <p className="mt-0.5 text-sm text-white/60">Crear, editar y gestionar mercados</p>
          </div>
          <span className="text-xl text-white/55">→</span>
        </Link>
        <Link
          href="/admin/withdrawals"
          className="admin-card flex items-center justify-between p-5 transition hover:border-white/30 hover:bg-white/[0.08]"
        >
          <div>
            <p className="text-lg font-bold text-white">Retiros</p>
            <p className="mt-0.5 text-sm text-white/60">Revisar y procesar solicitudes pendientes</p>
          </div>
          <span className="text-xl text-white/55">→</span>
        </Link>
      </nav>

      <section className="admin-empty">
        <p className="text-sm font-semibold text-white/85">Centro de operaciones</p>
        <p className="mt-1 text-sm text-white/60">
          Desde aqui puedes publicar mercados, resolver resultados y mantener el flujo de retiros sin friccion.
        </p>
      </section>
    </main>
  );
}
