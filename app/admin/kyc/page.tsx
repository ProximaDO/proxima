import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { reviewKycAction } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string; status?: string }>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:        { label: "Pendiente",     color: "bg-amber-100 text-amber-700" },
  submitted:      { label: "En revisión",   color: "bg-blue-100 text-blue-700" },
  verified:       { label: "Verificado",    color: "bg-emerald-100 text-emerald-700" },
  rejected:       { label: "Rechazado",     color: "bg-red-100 text-red-700" },
  requires_input: { label: "Req. info",     color: "bg-orange-100 text-orange-700" },
};

export default async function AdminKycPage({ searchParams }: Props) {
  await requireAdmin();
  const { error: errorRaw, success: successRaw, status: statusFilter } = await searchParams;
  const supabase = await createClient();

  const query = supabase
    .from("kyc_verifications")
    .select("id, user_id, status, verified_at, rejection_reason, created_at, updated_at")
    .order("updated_at", { ascending: false });

  const validStatuses = ["pending", "submitted", "verified", "rejected", "requires_input"] as const;
  const filter = validStatuses.includes(statusFilter as (typeof validStatuses)[number])
    ? (statusFilter as (typeof validStatuses)[number])
    : null;

  if (filter) query.eq("status", filter);

  const { data: kycRows } = await query.limit(100);

  // Obtener emails/nombres de los perfiles
  const userIds = (kycRows ?? []).map((r) => r.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, email, full_name, username").in("id", userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  const tabs: Array<{ label: string; value: string }> = [
    { label: "Todos", value: "" },
    { label: "Pendientes", value: "pending" },
    { label: "En revisión", value: "submitted" },
    { label: "Verificados", value: "verified" },
    { label: "Rechazados", value: "rejected" },
  ];

  return (
    <main className="min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
              Verificación de identidad
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {kycRows?.length ?? 0} registros · revisión manual
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 hover:text-white"
          >
            ← Admin
          </Link>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {/* Tabs de filtro */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value ? `/admin/kyc?status=${tab.value}` : "/admin/kyc"}
              className={`rounded-xl px-4 py-1.5 text-sm font-medium transition ${
                (filter ?? "") === tab.value
                  ? "bg-white/15 text-white"
                  : "border border-white/10 text-white/55 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Solicitado</th>
                <th className="px-4 py-3">Actualizado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(kycRows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/40">
                    No hay registros con este filtro.
                  </td>
                </tr>
              ) : (
                (kycRows ?? []).map((row) => {
                  const profile = profileMap.get(row.user_id);
                  const st = STATUS_LABELS[row.status] ?? { label: row.status, color: "bg-zinc-100 text-zinc-700" };
                  const canApprove = row.status !== "verified";
                  const canReject = row.status !== "rejected";

                  return (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{profile?.full_name ?? profile?.username ?? "—"}</p>
                        <p className="text-xs text-white/45">{profile?.email ?? row.user_id.slice(0, 8) + "…"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                        {row.rejection_reason ? (
                          <p className="mt-0.5 text-xs text-white/40">{row.rejection_reason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50">
                        {new Date(row.created_at).toLocaleDateString("es-DO", { dateStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50">
                        {new Date(row.updated_at).toLocaleDateString("es-DO", { dateStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canApprove && (
                            <form action={reviewKycAction}>
                              <input type="hidden" name="user_id" value={row.user_id} />
                              <input type="hidden" name="decision" value="verified" />
                              <button
                                type="submit"
                                className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                              >
                                Aprobar
                              </button>
                            </form>
                          )}
                          {canReject && (
                            <RejectForm userId={row.user_id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function RejectForm({ userId }: { userId: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10">
        Rechazar
      </summary>
      <form
        action={reviewKycAction}
        className="absolute z-10 mt-1 w-72 rounded-xl border border-white/10 bg-[#0d1540] p-3 shadow-xl"
      >
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="decision" value="rejected" />
        <label className="mb-1.5 block text-xs text-white/55">Motivo de rechazo (opcional)</label>
        <textarea
          name="rejection_reason"
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-white/30"
          placeholder="Ej. Documento ilegible, información no coincide..."
        />
        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-red-600/90 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
        >
          Confirmar rechazo
        </button>
      </form>
    </details>
  );
}
