import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAdminUserAction,
  deleteAdminUserAction,
  setAdminUserBalanceAction,
  updateAdminUserKycStatusAction,
  updateAdminUserProfileAction,
  updateAdminUserRoleAction,
} from "@/app/admin/users/actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string; q?: string }>;
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

export default async function AdminUsersPage({ searchParams }: Props) {
  const currentAdmin = await requireAdmin();
  const { error: errorRaw, success: successRaw, q: qRaw } = await searchParams;
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

  const [rolesResult, walletsResult, kycResult] = await Promise.all([
    userIds.length
      ? admin.from("user_roles").select("user_id, role").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; role: "admin" | "user" }> }),
    userIds.length
      ? admin.from("wallets").select("user_id, balance_available, balance_locked").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; balance_available: number; balance_locked: number }> }),
    userIds.length
      ? admin
          .from("kyc_verifications")
          .select("user_id, status, id_document_uploaded_at")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; status: string; id_document_uploaded_at: string | null }> }),
  ]);

  const roleMap = new Map((rolesResult.data ?? []).map((row) => [row.user_id, row.role]));
  const walletMap = new Map((walletsResult.data ?? []).map((row) => [row.user_id, row]));
  const kycMap = new Map((kycResult.data ?? []).map((row) => [row.user_id, row]));

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-(family-name:--font-display) text-3xl font-extrabold tracking-tight">Administración de usuarios</h1>
          <p className="mt-1 text-sm text-white/65">Creación, edición, eliminación, balance y estado de validación.</p>
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
        <h2 className="text-lg font-bold text-white">Crear usuario</h2>
        <form action={createAdminUserAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input name="email" type="email" placeholder="Correo" required className="admin-input" />
          <input name="password" type="password" placeholder="Contraseña temporal" required minLength={8} className="admin-input" />
          <input name="full_name" type="text" placeholder="Nombre completo" required className="admin-input" />
          <input name="username" type="text" placeholder="Usuario (opcional)" className="admin-input" />
          <select name="role" defaultValue="user" className="admin-input" required>
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <input
            name="initial_balance"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            placeholder="Saldo inicial (DOP)"
            className="admin-input"
          />
          <button type="submit" className="admin-btn-primary xl:col-span-3">Crear usuario</button>
        </form>
      </section>

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

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-300 text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/45">
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Perfil</th>
                <th className="px-3 py-3">Rol</th>
                <th className="px-3 py-3">Balance (DOP)</th>
                <th className="px-3 py-3">KYC</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/55">No hay usuarios para mostrar.</td>
                </tr>
              ) : (
                filteredProfiles.map((user) => {
                  const role = roleMap.get(user.id) ?? "user";
                  const wallet = walletMap.get(user.id);
                  const kyc = kycMap.get(user.id);
                  const isSelf = user.id === currentAdmin.id;

                  return (
                    <tr key={user.id} className="border-b border-white/8 align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-white">{user.full_name ?? user.username ?? "Sin nombre"}</p>
                        <p className="text-xs text-white/60">{user.email ?? "Sin correo"}</p>
                        <p className="text-[11px] text-white/40">{user.id.slice(0, 8)}…</p>
                        <p className="text-[11px] text-white/35">
                          Alta: {new Date(user.created_at).toLocaleDateString("es-DO", { dateStyle: "short" })}
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        <form action={updateAdminUserProfileAction} className="space-y-2">
                          <input type="hidden" name="user_id" value={user.id} />
                          <input name="full_name" defaultValue={user.full_name ?? ""} required className="admin-input" />
                          <input name="username" defaultValue={user.username ?? ""} className="admin-input" placeholder="username" />
                          <button type="submit" className="admin-btn-muted w-full">Guardar perfil</button>
                        </form>
                      </td>

                      <td className="px-3 py-3">
                        <form action={updateAdminUserRoleAction} className="space-y-2">
                          <input type="hidden" name="user_id" value={user.id} />
                          <select name="role" defaultValue={role} className="admin-input" required>
                            <option value="user">Usuario</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button type="submit" className="admin-btn-muted w-full" disabled={isSelf}>Actualizar rol</button>
                          {isSelf ? <p className="text-[11px] text-white/45">No puedes degradarte a ti mismo.</p> : null}
                        </form>
                      </td>

                      <td className="px-3 py-3">
                        <p className="mb-1 text-xs text-white/60">
                          Disponible: <span className="font-semibold text-white">{Number(wallet?.balance_available ?? 0).toFixed(2)}</span>
                        </p>
                        <p className="mb-2 text-xs text-white/45">Bloqueado: {Number(wallet?.balance_locked ?? 0).toFixed(2)}</p>
                        <form action={setAdminUserBalanceAction} className="space-y-2">
                          <input type="hidden" name="user_id" value={user.id} />
                          <input
                            name="balance_available"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={Number(wallet?.balance_available ?? 0).toFixed(2)}
                            className="admin-input"
                          />
                          <button type="submit" className="admin-btn-muted w-full">Fijar balance</button>
                        </form>
                      </td>

                      <td className="px-3 py-3">
                        <p className="mb-1 text-xs text-white/60">Actual: <span className="font-semibold text-white">{KYC_LABELS[kyc?.status ?? "pending"] ?? "Pendiente"}</span></p>
                        {kyc?.id_document_uploaded_at ? (
                          <p className="mb-2 text-[11px] text-white/45">
                            Documento: {new Date(kyc.id_document_uploaded_at).toLocaleDateString("es-DO", { dateStyle: "short" })}
                          </p>
                        ) : (
                          <p className="mb-2 text-[11px] text-white/35">Sin documento cargado</p>
                        )}
                        <form action={updateAdminUserKycStatusAction} className="space-y-2">
                          <input type="hidden" name="user_id" value={user.id} />
                          <select name="status" defaultValue={kyc?.status ?? "pending"} className="admin-input" required>
                            <option value="pending">Pendiente</option>
                            <option value="submitted">En revisión</option>
                            <option value="verified">Verificado</option>
                            <option value="rejected">Rechazado</option>
                            <option value="requires_input">Requiere acción</option>
                          </select>
                          <input name="rejection_reason" placeholder="Motivo (si rechazas)" className="admin-input" />
                          <button type="submit" className="admin-btn-muted w-full">Actualizar KYC</button>
                        </form>
                      </td>

                      <td className="px-3 py-3">
                        <form action={deleteAdminUserAction}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button
                            type="submit"
                            disabled={isSelf}
                            className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Eliminar usuario
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
