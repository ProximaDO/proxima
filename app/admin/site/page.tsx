import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  changeAdminPasswordAction,
  createAdditionalAdminAction,
  updateComingSoonSettingsAction,
} from "@/app/admin/site/actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

export default async function AdminSiteSettingsPage({ searchParams }: Props) {
  await requireAdmin();
  const { error: errorRaw, success: successRaw } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("site_settings")
    .select("coming_soon_enabled, coming_soon_target_at, coming_soon_title, coming_soon_message")
    .eq("id", 1)
    .maybeSingle();

  const settings = data ?? {
    coming_soon_enabled: false,
    coming_soon_target_at: null,
    coming_soon_title: "Proximamente",
    coming_soon_message: "Estamos preparando una experiencia increible para Proxima.",
  };

  const { data: adminRoleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  const adminIds = (adminRoleRows ?? []).map((row) => row.user_id);

  const [{ data: adminProfiles }, { data: credentialsNotifications }] = await Promise.all([
    adminIds.length
      ? supabase
          .from("profiles")
          .select("id, email, full_name, username, created_at, updated_at")
          .in("id", adminIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; full_name: string | null; username: string | null; created_at: string; updated_at: string }> }),
    adminIds.length
      ? supabase
          .from("notification_events")
          .select("user_id, created_at")
          .eq("event_type", "admin_credentials")
          .in("user_id", adminIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ user_id: string; created_at: string }> }),
  ]);

  const latestCredentialsNotificationMap = new Map<string, string>();
  for (const row of credentialsNotifications ?? []) {
    if (!latestCredentialsNotificationMap.has(row.user_id)) {
      latestCredentialsNotificationMap.set(row.user_id, row.created_at);
    }
  }

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-(family-name:--font-display) text-3xl font-extrabold tracking-tight">
            Configuracion
          </h1>
          <p className="mt-1 text-sm text-white/65">Landing, credenciales de administrador y alta de nuevos administradores.</p>
        </div>
        <Link href="/admin" className="admin-btn-muted">
          ← Volver al panel
        </Link>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      <section className="admin-card px-6 py-5">
        <h2 className="text-lg font-bold text-white">Landing Coming Soon</h2>
        <form action={updateComingSoonSettingsAction} className="max-w-2xl space-y-5">
          <label className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/85">
            <input
              type="checkbox"
              name="coming_soon_enabled"
              defaultChecked={settings.coming_soon_enabled}
              className="h-4 w-4 accent-[#7b30de]"
            />
            Activar landing de Coming Soon en la pagina principal
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
              Fecha y hora objetivo
            </label>
            <input
              type="datetime-local"
              name="coming_soon_target_at"
              defaultValue={toLocalDateTimeInput(settings.coming_soon_target_at)}
              required
              className="admin-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
              Titulo
            </label>
            <input
              type="text"
              name="coming_soon_title"
              defaultValue={settings.coming_soon_title}
              maxLength={120}
              required
              className="admin-input"
              placeholder="Ej: Proxima esta a punto de despegar"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
              Mensaje
            </label>
            <textarea
              name="coming_soon_message"
              defaultValue={settings.coming_soon_message}
              rows={4}
              maxLength={600}
              required
              className="admin-input"
              placeholder="Escribe el mensaje que deseas mostrar en la landing."
            />
          </div>

          <button type="submit" className="admin-btn-primary">
            Guardar configuracion
          </button>
        </form>
      </section>

      <section className="admin-card px-6 py-5">
        <h2 className="text-lg font-bold text-white">Seguridad del administrador</h2>
        <p className="mt-1 text-sm text-white/60">Cambia tu contrasena de acceso al panel.</p>

        <form action={changeAdminPasswordAction} className="mt-4 max-w-2xl space-y-3">
          <input
            type="password"
            name="new_password"
            minLength={8}
            maxLength={72}
            required
            className="admin-input"
            placeholder="Nueva contrasena"
          />
          <input
            type="password"
            name="confirm_password"
            minLength={8}
            maxLength={72}
            required
            className="admin-input"
            placeholder="Confirmar nueva contrasena"
          />
          <button type="submit" className="admin-btn-primary">Actualizar contrasena</button>
        </form>
      </section>

      <section className="admin-card px-6 py-5">
        <h2 className="text-lg font-bold text-white">Crear administrador</h2>
        <p className="mt-1 text-sm text-white/60">Se genera una contrasena temporal y se envia notificacion con URL de acceso.</p>

        <form action={createAdditionalAdminAction} className="mt-4 grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="text"
            name="username"
            required
            minLength={3}
            maxLength={40}
            className="admin-input"
            placeholder="Nombre de usuario"
          />
          <input
            type="text"
            name="full_name"
            required
            minLength={2}
            maxLength={120}
            className="admin-input"
            placeholder="Nombre completo"
          />
          <input
            type="email"
            name="notification_email"
            required
            className="admin-input md:col-span-2"
            placeholder="Correo para notificacion de credenciales"
          />
          <button type="submit" className="admin-btn-primary md:col-span-2">Crear administrador y notificar</button>
        </form>
      </section>

      <section className="admin-card px-6 py-5">
        <h2 className="text-lg font-bold text-white">Usuarios administradores</h2>
        <p className="mt-1 text-sm text-white/60">Listado de cuentas con rol administrador y ultimo envio de credenciales temporales.</p>

        <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/10 md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/50">
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Correo</th>
                <th className="px-3 py-3">Alta</th>
                <th className="px-3 py-3">Ultima notificacion</th>
              </tr>
            </thead>
            <tbody>
              {(adminProfiles ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-white/55">No hay administradores registrados.</td>
                </tr>
              ) : (
                (adminProfiles ?? []).map((adminProfile) => {
                  const lastNotificationAt = latestCredentialsNotificationMap.get(adminProfile.id);
                  return (
                    <tr key={adminProfile.id} className="border-b border-white/8">
                      <td className="px-3 py-3 font-semibold text-white">{adminProfile.full_name ?? "Sin nombre"}</td>
                      <td className="px-3 py-3 text-white/80">@{adminProfile.username ?? "sin-usuario"}</td>
                      <td className="px-3 py-3 text-white/75">{adminProfile.email ?? "Sin correo"}</td>
                      <td className="px-3 py-3 text-white/65">{new Date(adminProfile.created_at).toLocaleDateString("es-DO", { dateStyle: "short" })}</td>
                      <td className="px-3 py-3 text-white/65">
                        {lastNotificationAt
                          ? new Date(lastNotificationAt).toLocaleDateString("es-DO", { dateStyle: "short" })
                          : "Sin registro"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {(adminProfiles ?? []).length === 0 ? (
            <div className="rounded-xl border border-white/10 px-3 py-6 text-center text-white/55">No hay administradores registrados.</div>
          ) : (
            (adminProfiles ?? []).map((adminProfile) => {
              const lastNotificationAt = latestCredentialsNotificationMap.get(adminProfile.id);
              return (
                <article key={adminProfile.id} className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <p className="font-semibold text-white">{adminProfile.full_name ?? "Sin nombre"}</p>
                  <p className="text-xs text-white/65">@{adminProfile.username ?? "sin-usuario"}</p>
                  <p className="mt-1 text-xs text-white/70">{adminProfile.email ?? "Sin correo"}</p>
                  <p className="mt-2 text-[11px] text-white/55">Alta: {new Date(adminProfile.created_at).toLocaleDateString("es-DO", { dateStyle: "short" })}</p>
                  <p className="text-[11px] text-white/55">
                    Ultima notificacion: {lastNotificationAt
                      ? new Date(lastNotificationAt).toLocaleDateString("es-DO", { dateStyle: "short" })
                      : "Sin registro"}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
