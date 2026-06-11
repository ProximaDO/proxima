import Link from "next/link";
import { processWithdrawalsAction, reviewWithdrawalAction } from "@/app/admin/withdrawals/actions";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

interface Props {
  searchParams: Promise<{
    error?: string;
    success?: string;
    historyStatus?: "all" | "approved" | "rejected" | "completed" | "failed";
    historyQuery?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AdminWithdrawalsPage({ searchParams }: Props) {
  const { error, success, historyStatus: historyStatusRaw, historyQuery, from, to } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const historyStatus =
    historyStatusRaw === "approved" ||
    historyStatusRaw === "rejected" ||
    historyStatusRaw === "completed" ||
    historyStatusRaw === "failed"
      ? historyStatusRaw
      : "all";

  const { data: requests } = await supabase
    .from("withdrawal_requests")
    .select("id, user_id, amount, status, requested_at, admin_note, rejection_reason, profiles:profiles!withdrawal_requests_user_id_fkey(email)")
    .in("status", ["pending", "processing"])
    .order("requested_at", { ascending: true })
    .limit(100);

  const rows = (requests ?? []) as {
    id: string;
    user_id: string;
    amount: number;
    status: "pending" | "processing";
    requested_at: string;
    admin_note: string | null;
    rejection_reason: string | null;
    profiles: { email: string | null } | null;
  }[];

  const { data: historyRequests } = await supabase
    .from("withdrawal_requests")
    .select("id, user_id, amount, status, requested_at, reviewed_at, processed_at, admin_note, rejection_reason, external_reference, profiles:profiles!withdrawal_requests_user_id_fkey(email)")
    .not("status", "in", "(pending,processing)")
    .order("processed_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const historyBase = (historyRequests ?? []) as {
    id: string;
    user_id: string;
    amount: number;
    status: "approved" | "rejected" | "completed" | "failed";
    requested_at: string;
    reviewed_at: string | null;
    processed_at: string | null;
    admin_note: string | null;
    rejection_reason: string | null;
    external_reference: string | null;
    profiles: { email: string | null } | null;
  }[];

  const normalizedQuery = (historyQuery ?? "").trim().toLowerCase();
  const fromDate = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00.000Z`) : null;
  const toDate = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : null;

  const historyRows = historyBase.filter((row) => {
    if (historyStatus !== "all" && row.status !== historyStatus) return false;

    const email = (row.profiles?.email ?? "").toLowerCase();
    const userId = row.user_id.toLowerCase();
    if (normalizedQuery && !email.includes(normalizedQuery) && !userId.includes(normalizedQuery)) {
      return false;
    }

    const ts = new Date(row.requested_at);
    if (fromDate && ts < fromDate) return false;
    if (toDate && ts > toDate) return false;

    return true;
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-12">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Retiros pendientes</h1>
          <p className="mt-1 text-sm text-zinc-600">Revision, procesamiento y cierre administrativo de solicitudes.</p>
          <p className="mt-1 text-xs text-zinc-500">Pendientes: {rows.length} · Historial: {historyRows.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={processWithdrawalsAction} className="flex items-center gap-2">
            <input type="hidden" name="batch_size" value="25" />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              Procesar cola
            </button>
          </form>
          <Link href="/admin" className="text-sm underline">
            ← Admin
          </Link>
        </div>
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

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">No hay retiros pendientes.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 p-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Solicitado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 align-top">
                  <td className="py-2 pr-3 text-xs text-zinc-700">{row.profiles?.email ?? row.user_id}</td>
                  <td className="py-2 pr-3 font-medium">{formatMoney(row.amount)}</td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">{new Date(row.requested_at).toLocaleString("es-DO")}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={reviewWithdrawalAction} className="flex items-center gap-2">
                        <input type="hidden" name="request_id" value={row.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <input
                          type="text"
                          name="admin_note"
                          maxLength={500}
                          placeholder="Nota admin"
                          className="w-44 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                        >
                          Enviar a processing
                        </button>
                      </form>

                      <form action={reviewWithdrawalAction} className="flex items-center gap-2">
                        <input type="hidden" name="request_id" value={row.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <input
                          type="text"
                          name="rejection_reason"
                          required
                          maxLength={500}
                          placeholder="Motivo rechazo"
                          className="w-44 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                        >
                          Rechazar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10 rounded-xl border border-zinc-200 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Historial de retiros procesados</h2>
            <p className="mt-1 text-sm text-zinc-600">Filtra por estado, usuario y rango de solicitud.</p>
          </div>
        </div>

        <form method="get" action="/admin/withdrawals" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="historyStatus" className="text-xs text-zinc-500">Estado</label>
            <select
              id="historyStatus"
              name="historyStatus"
              defaultValue={historyStatus}
              className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
            >
              <option value="all">Todos</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="historyQuery" className="text-xs text-zinc-500">Usuario (email o id)</label>
            <input
              id="historyQuery"
              name="historyQuery"
              type="text"
              defaultValue={historyQuery ?? ""}
              placeholder="correo@dominio.com"
              className="w-56 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="from" className="text-xs text-zinc-500">Desde</label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="to" className="text-xs text-zinc-500">Hasta</label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
          >
            Filtrar
          </button>

          <Link
            href="/admin/withdrawals"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100"
          >
            Limpiar
          </Link>
        </form>

        {historyRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No hay registros en historial con los filtros actuales.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Detalle</th>
                  <th className="py-2 pr-3">Solicitado</th>
                  <th className="py-2 pr-3">Procesado</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-50 align-top">
                    <td className="py-2 pr-3 text-xs text-zinc-700">{row.profiles?.email ?? row.user_id}</td>
                    <td className="py-2 pr-3 font-medium">{formatMoney(row.amount)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          row.status === "approved" || row.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-600">
                      {row.rejection_reason || row.admin_note || row.external_reference || "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{new Date(row.requested_at).toLocaleString("es-DO")}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {row.processed_at ? new Date(row.processed_at).toLocaleString("es-DO") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
