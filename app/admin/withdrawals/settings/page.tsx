import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { updateWithdrawalRulesAction } from "@/app/admin/withdrawals/actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function AdminWithdrawalSettingsPage({ searchParams }: Props) {
  await requireAdmin();
  const { error: errorRaw, success: successRaw } = await searchParams;
  const supabase = await createClient();

  const { data: rulesData } = await supabase
    .from("withdrawal_rules")
    .select("min_amount, max_amount, max_per_day, max_per_month, cooldown_days, min_processing_days")
    .limit(1)
    .maybeSingle();

  const rules = rulesData ?? {
    min_amount: 500,
    max_amount: 100000,
    max_per_day: 200000,
    max_per_month: 1000000,
    cooldown_days: 1,
    min_processing_days: 3,
  };

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight">
            Configuracion de retiros
          </h1>
          <p className="mt-1 text-sm text-white/65">Limites, tiempos y politicas de procesamiento.</p>
        </div>
        <Link href="/admin/withdrawals" className="admin-btn-secondary">
          ← Retiros pendientes
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
        <form action={updateWithdrawalRulesAction} className="space-y-6 max-w-xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Monto minimo (DOP)
              </label>
              <input
                type="number"
                name="min_amount"
                defaultValue={rules.min_amount}
                min="1"
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Monto maximo (DOP)
              </label>
              <input
                type="number"
                name="max_amount"
                defaultValue={rules.max_amount}
                min="1"
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Limite diario (DOP)
              </label>
              <input
                type="number"
                name="max_per_day"
                defaultValue={rules.max_per_day}
                min="1"
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Limite mensual (DOP)
              </label>
              <input
                type="number"
                name="max_per_month"
                defaultValue={rules.max_per_month}
                min="1"
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Espera minima entre solicitudes (dias)
              </label>
              <input
                type="number"
                name="cooldown_days"
                defaultValue={rules.cooldown_days}
                min="0"
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Dias habiles de procesamiento (minimo)
              </label>
              <input
                type="number"
                name="min_processing_days"
                defaultValue={rules.min_processing_days}
                min="0"
                max="30"
                required
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
              />
              <p className="mt-1 text-xs text-white/40">
                Días hábiles desde la solicitud antes de que el cliente reciba el pago.
              </p>
            </div>
          </div>

          <button type="submit" className="admin-btn-primary">
            Guardar configuracion
          </button>
        </form>
      </section>
    </main>
  );
}
