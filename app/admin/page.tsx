import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Panel administrativo</h1>
          <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            Cerrar sesion
          </button>
        </form>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500">Mercados totales</p>
          <p className="mt-1 text-3xl font-semibold">{totalMarkets ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500">Mercados abiertos</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-600">{openMarkets ?? 0}</p>
        </div>
      </div>

      <nav className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/admin/markets"
          className="flex items-center justify-between rounded-xl border border-zinc-200 p-5 hover:bg-zinc-50"
        >
          <div>
            <p className="font-medium">Mercados</p>
            <p className="mt-0.5 text-sm text-zinc-500">Crear, editar y gestionar mercados</p>
          </div>
          <span className="text-zinc-400">→</span>
        </Link>
        <Link
          href="/admin/withdrawals"
          className="flex items-center justify-between rounded-xl border border-zinc-200 p-5 hover:bg-zinc-50"
        >
          <div>
            <p className="font-medium">Retiros</p>
            <p className="mt-0.5 text-sm text-zinc-500">Revisar y procesar solicitudes pendientes</p>
          </div>
          <span className="text-zinc-400">→</span>
        </Link>
      </nav>
    </main>
  );
}
