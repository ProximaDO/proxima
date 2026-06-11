import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

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

export default async function AdminMarketsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: markets } = await supabase
    .from("markets")
    .select("id, title, status, category, closes_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Mercados</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {markets?.length ?? 0} mercados en total
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            ← Admin
          </Link>
          <Link
            href="/admin/markets/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Nuevo mercado
          </Link>
        </div>
      </header>

      <section className="mt-8">
        {!markets || markets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center">
            <p className="text-sm text-zinc-500">
              No hay mercados aun.{" "}
              <Link
                href="/admin/markets/new"
                className="underline"
              >
                Crea el primero
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {markets.map((m) => (
              <Link
                key={m.id}
                href={`/admin/markets/${m.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {m.category ? `${m.category} · ` : ""}
                    {m.closes_at
                      ? `Cierra ${new Date(m.closes_at).toLocaleDateString("es-DO")}`
                      : "Sin fecha de cierre"}
                  </p>
                </div>
                <span
                  className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[m.status] ?? STATUS_COLOR.draft}`}
                >
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
