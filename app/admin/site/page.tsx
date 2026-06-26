import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { updateComingSoonSettingsAction } from "@/app/admin/site/actions";

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

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-(family-name:--font-display) text-3xl font-extrabold tracking-tight">
            Landing Coming Soon
          </h1>
          <p className="mt-1 text-sm text-white/65">Configura fecha, titulo y mensaje mostrados en la portada.</p>
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
    </main>
  );
}
