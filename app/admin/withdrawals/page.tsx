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
    density?: "comfortable" | "compact";
  }>;
}

export default async function AdminWithdrawalsPage({ searchParams }: Props) {
  const { error, success, historyStatus: historyStatusRaw, historyQuery, from, to, density: densityRaw } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const density = densityRaw === "compact" ? "compact" : "comfortable";
  const rowPaddingClass = density === "compact" ? "py-1.5" : "py-2.5";

  const historyStatus =
    historyStatusRaw === "approved" ||
    historyStatusRaw === "rejected" ||
    historyStatusRaw === "completed" ||
    historyStatusRaw === "failed"
      ? historyStatusRaw
      : "all";

  const { data: requests } = await supabase
    .from("withdrawal_requests")
    .select("id, user_id, amount, status, requested_at, admin_note, rejection_reason, destination, profiles:profiles!withdrawal_requests_user_id_fkey(email)")
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
    destination: Record<string, string> | null;
    profiles: { email: string | null } | null;
  }[];

  const { data: historyRequests } = await supabase
    .from("withdrawal_requests")
    .select("id, user_id, amount, status, requested_at, reviewed_at, processed_at, admin_note, rejection_reason, external_reference, destination, profiles:profiles!withdrawal_requests_user_id_fkey(email)")
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
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">Retiros pendientes</h1>
          <p className="mt-1 text-sm text-white/65">Revision, procesamiento y cierre administrativo de solicitudes.</p>
          <p className="mt-1 text-xs text-white/50">Pendientes: {rows.length} · Historial: {historyRows.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={processWithdrawalsAction} className="flex items-center gap-2">
            <input type="hidden" name="batch_size" value="25" />
            <button
              type="submit"
              className="admin-btn-primary"
            >
              Procesar cola
            </button>
          </form>
          <Link href="/admin/withdrawals/settings" className="admin-btn-secondary">
            Configuracion
          </Link>
          <Link href="/admin" className="admin-btn-muted">
            Panel
          </Link>
        </div>
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

      {rows.length === 0 ? (
        <section className="admin-empty">
          <p className="text-sm font-semibold text-white/85">Sin pendientes</p>
          <p className="mt-1 text-sm text-white/60">La cola de retiros pendientes esta al dia.</p>
        </section>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <article key={row.id} className="admin-card p-4">
              <p className="text-xs text-white/60">{row.profiles?.email ?? row.user_id}</p>
              <p className="mt-1 text-xl font-bold text-white">{formatMoney(row.amount)}</p>
              <p className="mt-1 text-xs text-white/50">{new Date(row.requested_at).toLocaleString("es-DO")}</p>
              {row.destination?.bank_name ? (
                <p className="mt-1 text-xs text-[#65bfff]">
                  {row.destination.bank_name} · **** {row.destination.account_last4}
                </p>
              ) : null}

              <div className="mt-3 space-y-2">
                <form action={reviewWithdrawalAction} className="space-y-2">
                  <input type="hidden" name="request_id" value={row.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <input
                    type="text"
                    name="admin_note"
                    maxLength={500}
                    placeholder="Nota admin"
                    className="admin-input text-xs"
                  />
                  <button type="submit" className="w-full rounded-lg bg-emerald-500 px-2.5 py-2 text-xs font-semibold text-white">
                    Enviar a processing
                  </button>
                </form>

                <form action={reviewWithdrawalAction} className="space-y-2">
                  <input type="hidden" name="request_id" value={row.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <input
                    type="text"
                    name="rejection_reason"
                    required
                    maxLength={500}
                    placeholder="Motivo rechazo"
                    className="admin-input text-xs"
                  />
                  <button type="submit" className="w-full rounded-lg bg-red-500 px-2.5 py-2 text-xs font-semibold text-white">
                    Rechazar
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>

        <div className="admin-card hidden overflow-x-auto p-4 md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Cuenta bancaria destino</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Solicitado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/10 align-top">
                  <td className={`${rowPaddingClass} pr-3 text-xs text-white/80`}>{row.profiles?.email ?? row.user_id}</td>
                  <td className={`${rowPaddingClass} pr-3 text-xs text-[#65bfff]`}>
                    {row.destination?.bank_name
                      ? `${row.destination.bank_name} · **** ${row.destination.account_last4}`
                      : <span className="text-white/35">Sin cuenta bancaria</span>}
                  </td>
                  <td className={`${rowPaddingClass} pr-3 font-medium text-white`}>{formatMoney(row.amount)}</td>
                  <td className={`${rowPaddingClass} pr-3 text-white/70`}>{row.status}</td>
                  <td className={`${rowPaddingClass} pr-3 text-xs text-white/50`}>{new Date(row.requested_at).toLocaleString("es-DO")}</td>
                  <td className={`${rowPaddingClass} pr-3`}>
                    <div className="flex flex-wrap gap-2">
                      <form action={reviewWithdrawalAction} className="flex items-center gap-2">
                        <input type="hidden" name="request_id" value={row.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <input
                          type="text"
                          name="admin_note"
                          maxLength={500}
                          placeholder="Nota admin"
                          className="admin-input w-44 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white"
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
                          className="admin-input w-44 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white"
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
        </>
      )}

      <section className="admin-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-white">Historial de retiros procesados</h2>
            <p className="mt-1 text-sm text-white/60">Filtra por estado, usuario y rango de solicitud.</p>
          </div>
        </div>

        <form method="get" action="/admin/withdrawals" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="historyStatus" className="text-xs text-white/55">Estado</label>
            <select
              id="historyStatus"
              name="historyStatus"
              defaultValue={historyStatus}
              className="admin-input text-xs"
            >
              <option value="all">Todos</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="historyQuery" className="text-xs text-white/55">Usuario (email o id)</label>
            <input
              id="historyQuery"
              name="historyQuery"
              type="text"
              defaultValue={historyQuery ?? ""}
              placeholder="correo@dominio.com"
              className="admin-input w-56 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="from" className="text-xs text-white/55">Desde</label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="admin-input text-xs"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="to" className="text-xs text-white/55">Hasta</label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="admin-input text-xs"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="density" className="text-xs text-white/55">Densidad tabla</label>
            <select
              id="density"
              name="density"
              defaultValue={density}
              className="admin-input text-xs"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <button
            type="submit"
            className="admin-btn-primary"
          >
            Filtrar
          </button>

          <Link
            href="/admin/withdrawals"
            className="admin-btn-muted"
          >
            Limpiar
          </Link>
        </form>

        {historyRows.length === 0 ? (
          <section className="admin-empty mt-4">
            <p className="text-sm font-semibold text-white/85">Sin resultados en historial</p>
            <p className="mt-1 text-sm text-white/60">Prueba ampliando rango de fechas o limpiando filtros.</p>
          </section>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {historyRows.map((row) => (
              <article key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-white/60">{row.profiles?.email ?? row.user_id}</p>
                <p className="mt-1 text-lg font-bold text-white">{formatMoney(row.amount)}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      row.status === "approved" || row.status === "completed"
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-red-400/20 text-red-300"
                    }`}
                  >
                    {row.status}
                  </span>
                  <span className="text-[11px] text-white/50">
                    {row.processed_at ? new Date(row.processed_at).toLocaleString("es-DO") : "—"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/55">{row.rejection_reason || row.admin_note || row.external_reference || "—"}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
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
                  <tr key={row.id} className="border-b border-white/10 align-top">
                    <td className={`${rowPaddingClass} pr-3 text-xs text-white/80`}>{row.profiles?.email ?? row.user_id}</td>
                    <td className={`${rowPaddingClass} pr-3 font-medium text-white`}>{formatMoney(row.amount)}</td>
                    <td className={`${rowPaddingClass} pr-3`}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          row.status === "approved" || row.status === "completed"
                            ? "bg-emerald-400/20 text-emerald-300"
                            : "bg-red-400/20 text-red-300"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className={`${rowPaddingClass} pr-3 text-xs text-white/60`}>
                      {row.rejection_reason || row.admin_note || row.external_reference || "—"}
                    </td>
                    <td className={`${rowPaddingClass} pr-3 text-xs text-white/50`}>{new Date(row.requested_at).toLocaleString("es-DO")}</td>
                    <td className={`${rowPaddingClass} pr-3 text-xs text-white/50`}>
                      {row.processed_at ? new Date(row.processed_at).toLocaleString("es-DO") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </main>
  );
}
