import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteAdminUserAction,
  updateAdminUserKycStatusAction,
  updateAdminUserProfileAction,
} from "@/app/admin/users/actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string; q?: string; user?: string }>;
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  created_at: string;
};

const KYC_LABELS: Record<string, string> = {
  pending: "Pendiente",
  submitted: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
  requires_input: "Requiere acción",
};

const KYC_BADGE_STYLES: Record<string, string> = {
  pending: "border-amber-300/40 bg-amber-500/15 text-amber-100",
  submitted: "border-blue-300/40 bg-blue-500/15 text-blue-100",
  verified: "border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
  rejected: "border-red-300/40 bg-red-500/15 text-red-100",
  requires_input: "border-orange-300/40 bg-orange-500/15 text-orange-100",
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const currentAdmin = await requireAdmin();
  const { error: errorRaw, success: successRaw, q: qRaw, user: userRaw } = await searchParams;
  const q = (qRaw ?? "").trim().toLowerCase();
  const admin = createAdminClient();

  const { data: profilesData } = await admin
    .from("profiles")
    .select("id, email, full_name, username, created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  const profiles = (profilesData ?? []) as ProfileRow[];
  const filteredProfiles = q
    ? profiles.filter((row) => {
        const haystack = [row.email ?? "", row.full_name ?? "", row.username ?? "", row.id].join(" ").toLowerCase();
        return haystack.includes(q);
      })
    : profiles;

  const userIds = filteredProfiles.map((row) => row.id);

  const [walletsResult, kycResult] = await Promise.all([
    userIds.length
      ? admin.from("wallets").select("user_id, balance_available, balance_locked").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; balance_available: number; balance_locked: number }> }),
    userIds.length
      ? admin
          .from("kyc_verifications")
          .select("user_id, status, id_document_uploaded_at, id_document_path, legal_full_name, id_number, phone, address_line, rejection_reason")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; status: string; id_document_uploaded_at: string | null; id_document_path: string | null; legal_full_name: string | null; id_number: string | null; phone: string | null; address_line: string | null; rejection_reason: string | null }> }),
  ]);

  const walletMap = new Map((walletsResult.data ?? []).map((row) => [row.user_id, row]));
  const kycMap = new Map((kycResult.data ?? []).map((row) => [row.user_id, row]));

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;
  const selectedUser = filteredProfiles.find((row) => row.id === userRaw) ?? null;
  const selectedKyc = selectedUser ? kycMap.get(selectedUser.id) : null;
  const selectedDocumentIsImage =
    selectedKyc?.id_document_path
      ? /\.(jpg|jpeg|png|webp)$/i.test(selectedKyc.id_document_path)
      : false;

  let selectedDocumentUrl: string | null = null;
  if (selectedKyc?.id_document_path) {
    const { data } = await admin.storage.from("kyc-documents").createSignedUrl(selectedKyc.id_document_path, 600);
    selectedDocumentUrl = data?.signedUrl ?? null;
  }

  const closeModalHref = qRaw ? `/admin/users?q=${encodeURIComponent(qRaw)}` : "/admin/users";

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-(family-name:--font-display) text-3xl font-extrabold tracking-tight">Administración de usuarios</h1>
          <p className="mt-1 text-sm text-white/65">Edición de perfil y validación de identidad desde un solo flujo.</p>
        </div>
        <Link href="/admin" className="admin-btn-muted">
          ← Volver al panel
        </Link>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{successMessage}</div>
      ) : null}

      <section className="admin-card px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Usuarios registrados ({filteredProfiles.length})</h2>
          <form action="/admin/users" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={qRaw ?? ""}
              className="admin-input min-w-55"
              placeholder="Buscar por email, nombre o id"
            />
            <button type="submit" className="admin-btn-muted">Buscar</button>
          </form>
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/10 lg:block">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/45">
                <th className="w-[38%] px-3 py-3">Usuario</th>
                <th className="w-[28%] px-3 py-3">Balance (DOP)</th>
                <th className="w-[18%] px-3 py-3">KYC</th>
                <th className="w-[16%] px-3 py-3">Gestión</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-white/55">No hay usuarios para mostrar.</td>
                </tr>
              ) : (
                filteredProfiles.map((user) => {
                  const wallet = walletMap.get(user.id);
                  const kyc = kycMap.get(user.id);
                  const kycStatus = kyc?.status ?? "pending";
                  const displayName = user.full_name ?? kyc?.legal_full_name ?? user.username ?? "Sin nombre";
                  const isSelf = user.id === currentAdmin.id;

                  return (
                    <tr key={user.id} className="border-b border-white/8 align-top">
                      <td className="px-3 py-3">
                        <Link href={`/admin/users?user=${user.id}${qRaw ? `&q=${encodeURIComponent(qRaw)}` : ""}`} className="font-semibold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white/70">
                          {displayName}
                        </Link>
                        <p className="text-xs text-white/60">{user.email ?? "Sin correo"}</p>
                      </td>

                      <td className="px-3 py-3">
                        <p className="mb-1 text-xs text-white/60">
                          Disponible: <span className="font-semibold text-white">{Number(wallet?.balance_available ?? 0).toFixed(2)}</span>
                        </p>
                        <p className="mb-2 text-xs text-white/45">Bloqueado: {Number(wallet?.balance_locked ?? 0).toFixed(2)}</p>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            KYC_BADGE_STYLES[kycStatus] ?? "border-white/25 bg-white/10 text-white"
                          }`}
                        >
                          {KYC_LABELS[kycStatus] ?? "Pendiente"}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/users?user=${user.id}${qRaw ? `&q=${encodeURIComponent(qRaw)}` : ""}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/6 text-white/85 transition hover:bg-white/12"
                            title="Editar usuario"
                            aria-label="Editar usuario"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </Link>

                          <details className="relative">
                            <summary
                              className={`inline-flex h-9 w-9 list-none items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 ${
                                isSelf ? "pointer-events-none opacity-50" : "cursor-pointer"
                              }`}
                              title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                              aria-label="Eliminar usuario"
                            >
                              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M6 6v14h12V6" />
                                <path d="M10 11v6M14 11v6" />
                              </svg>
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-white/15 bg-[#0c184d] p-3 shadow-xl">
                              <p className="mb-2 text-xs text-white/70">Confirmar eliminación</p>
                              <form action={deleteAdminUserAction}>
                                <input type="hidden" name="user_id" value={user.id} />
                                <button
                                  type="submit"
                                  disabled={isSelf}
                                  className="w-full rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Eliminar
                                </button>
                              </form>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3 lg:hidden">
          {filteredProfiles.length === 0 ? (
            <div className="rounded-xl border border-white/10 px-3 py-8 text-center text-white/55">No hay usuarios para mostrar.</div>
          ) : (
            filteredProfiles.map((user) => {
              const wallet = walletMap.get(user.id);
              const kyc = kycMap.get(user.id);
              const kycStatus = kyc?.status ?? "pending";
              const displayName = user.full_name ?? kyc?.legal_full_name ?? user.username ?? "Sin nombre";
              const isSelf = user.id === currentAdmin.id;

              return (
                <article key={user.id} className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <Link href={`/admin/users?user=${user.id}${qRaw ? `&q=${encodeURIComponent(qRaw)}` : ""}`} className="font-semibold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white/70">
                    {displayName}
                  </Link>
                  <p className="text-xs text-white/60">{user.email ?? "Sin correo"}</p>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="text-white/55">Disponible: <span className="font-semibold text-white">{Number(wallet?.balance_available ?? 0).toFixed(2)}</span></p>
                      <p className="text-white/45">Bloqueado: {Number(wallet?.balance_locked ?? 0).toFixed(2)}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${
                        KYC_BADGE_STYLES[kycStatus] ?? "border-white/25 bg-white/10 text-white"
                      }`}
                    >
                      {KYC_LABELS[kycStatus] ?? "Pendiente"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`/admin/users?user=${user.id}${qRaw ? `&q=${encodeURIComponent(qRaw)}` : ""}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/6 text-white/85 transition hover:bg-white/12"
                      title="Editar usuario"
                      aria-label="Editar usuario"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </Link>

                    <details className="relative">
                      <summary
                        className={`inline-flex h-9 w-9 list-none items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 ${
                          isSelf ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }`}
                        title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                        aria-label="Eliminar usuario"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6v14h12V6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </summary>
                      <div className="absolute left-0 z-20 mt-2 w-48 rounded-xl border border-white/15 bg-[#0c184d] p-3 shadow-xl">
                        <p className="mb-2 text-xs text-white/70">Confirmar eliminación</p>
                        <form action={deleteAdminUserAction}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button
                            type="submit"
                            disabled={isSelf}
                            className="w-full rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {selectedUser ? (
        <section className="fixed inset-0 z-50 flex items-start justify-center bg-[#040b2f]/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#081445] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="font-(family-name:--font-display) text-2xl font-bold text-white">Editar usuario</h2>
                <p className="text-sm text-white/60">{selectedUser.full_name ?? selectedKyc?.legal_full_name ?? selectedUser.username ?? "Sin nombre"} · {selectedUser.email ?? "Sin correo"}</p>
              </div>
              <Link href={closeModalHref} className="admin-btn-muted">Cerrar</Link>
            </header>

            <div className="px-6 py-5">
              <section className="space-y-5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white">Perfil</h3>
                  <form action={updateAdminUserProfileAction} className="mt-3 space-y-2">
                    <input type="hidden" name="user_id" value={selectedUser.id} />
                    <input name="full_name" defaultValue={selectedUser.full_name ?? selectedKyc?.legal_full_name ?? ""} required className="admin-input" placeholder="Nombre completo" />
                    <input name="username" defaultValue={selectedUser.username ?? ""} className="admin-input" placeholder="Usuario" />
                    <button type="submit" className="admin-btn-muted w-full">Guardar perfil</button>
                  </form>
                </div>

              </section>

              <section className="space-y-5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white">Documento de identidad</h3>
                  {selectedDocumentUrl ? (
                    <div className="mt-3 space-y-2">
                      <a href={selectedDocumentUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#83c9ff] underline">
                        Abrir documento en nueva pestaña
                      </a>
                      {selectedDocumentIsImage ? (
                        <img src={selectedDocumentUrl} alt="Documento de identidad" className="max-h-64 w-full rounded-xl border border-white/15 bg-black/20 object-contain" />
                      ) : (
                        <p className="text-xs text-white/45">Previsualización no disponible para este formato.</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-white/45">El usuario no ha cargado documento todavía.</p>
                  )}
                  {selectedKyc?.id_document_uploaded_at ? (
                    <p className="mt-2 text-[11px] text-white/45">
                      Cargado: {new Date(selectedKyc.id_document_uploaded_at).toLocaleDateString("es-DO", { dateStyle: "long" })}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white">Validación de identidad (campos obligatorios)</h3>
                  <form action={updateAdminUserKycStatusAction} className="mt-3 space-y-2">
                    <input type="hidden" name="user_id" value={selectedUser.id} />
                    <input name="legal_full_name" required minLength={2} defaultValue={selectedKyc?.legal_full_name ?? selectedUser.full_name ?? ""} className="admin-input" placeholder="Nombre completo" />
                    <input name="id_number" required minLength={5} defaultValue={selectedKyc?.id_number ?? ""} className="admin-input" placeholder="Número de identificación" />
                    <input name="phone" required minLength={7} defaultValue={selectedKyc?.phone ?? ""} className="admin-input" placeholder="Teléfono" />
                    <input name="address_line" required minLength={8} defaultValue={selectedKyc?.address_line ?? ""} className="admin-input" placeholder="Dirección" />
                    <select name="status" defaultValue={selectedKyc?.status ?? "pending"} className="admin-input" required>
                      <option value="pending">Pendiente</option>
                      <option value="submitted">En revisión</option>
                      <option value="verified">Verificado</option>
                      <option value="rejected">Rechazado</option>
                      <option value="requires_input">Requiere acción</option>
                    </select>
                    <input name="rejection_reason" defaultValue={selectedKyc?.rejection_reason ?? ""} placeholder="Motivo (si rechazas)" className="admin-input" />
                    <button type="submit" className="admin-btn-primary w-full">Guardar validación KYC</button>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
