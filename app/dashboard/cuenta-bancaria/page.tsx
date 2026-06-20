import Link from "next/link";
import { requireAuth } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addBankAccountAction,
  setPrimaryBankAccountAction,
  deleteBankAccountAction,
} from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

type BankAccountRow = {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_last4: string;
  account_type: "checking" | "savings";
  is_primary: boolean;
  created_at: string;
};

export default async function CuentaBancariaPage({ searchParams }: Props) {
  await requireAuth();
  const { error: errorRaw, success: successRaw } = await searchParams;
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session!.user.id;

  const { data: accountsData } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_holder_name, account_last4, account_type, is_primary, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false });

  const accounts = (accountsData ?? []) as BankAccountRow[];

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  return (
    <main className="relative min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          ← Volver al panel
        </Link>

        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          Cuentas bancarias
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Registra la cuenta bancaria donde recibirás tus retiros. La cuenta marcada como principal será la predeterminada.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        {/* Lista de cuentas */}
        {accounts.length > 0 ? (
          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Tus cuentas registradas
            </p>
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`rounded-2xl border p-4 ${
                  account.is_primary
                    ? "border-[#65bfff]/40 bg-[#65bfff]/5"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white/95">{account.bank_name}</p>
                      {account.is_primary ? (
                        <span className="rounded-full bg-[#65bfff]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#83c9ff]">
                          Principal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-white/65">{account.account_holder_name}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {account.account_type === "checking" ? "Cuenta corriente" : "Cuenta de ahorros"} ·
                      **** **** {account.account_last4}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-2 text-right">
                    {!account.is_primary ? (
                      <form action={setPrimaryBankAccountAction}>
                        <input type="hidden" name="account_id" value={account.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-[#65bfff] hover:underline"
                        >
                          Marcar principal
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteBankAccountAction}>
                      <input type="hidden" name="account_id" value={account.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-red-400/80 hover:underline"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-white/50">
            No tienes cuentas bancarias registradas.
          </div>
        )}

        {/* Formulario agregar cuenta */}
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
            Agregar nueva cuenta
          </p>
          <form action={addBankAccountAction} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                  Banco
                </label>
                <select
                  name="bank_name"
                  required
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
                >
                  <option value="" className="bg-[#040b2f]">Selecciona banco</option>
                  <option value="Banco Popular Dominicano" className="bg-[#040b2f]">Banco Popular Dominicano</option>
                  <option value="BanReservas" className="bg-[#040b2f]">BanReservas</option>
                  <option value="Banco BHD León" className="bg-[#040b2f]">Banco BHD León</option>
                  <option value="Scotiabank" className="bg-[#040b2f]">Scotiabank</option>
                  <option value="Banco Santa Cruz" className="bg-[#040b2f]">Banco Santa Cruz</option>
                  <option value="Banesco" className="bg-[#040b2f]">Banesco</option>
                  <option value="Citibank" className="bg-[#040b2f]">Citibank</option>
                  <option value="Otro" className="bg-[#040b2f]">Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                  Tipo de cuenta
                </label>
                <select
                  name="account_type"
                  required
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#8d45e6]"
                >
                  <option value="checking" className="bg-[#040b2f]">Corriente</option>
                  <option value="savings" className="bg-[#040b2f]">Ahorros</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Nombre del titular (como figura en la cuenta)
              </label>
              <input
                type="text"
                name="account_holder_name"
                required
                maxLength={120}
                placeholder="Ej: Juan Manuel Pérez"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#8d45e6]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                Número de cuenta
              </label>
              <input
                type="text"
                name="account_number"
                required
                minLength={4}
                maxLength={30}
                inputMode="numeric"
                placeholder="Ej: 2100012345678"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#8d45e6]"
              />
              <p className="mt-1 text-xs text-white/40">
                Tu número de cuenta se almacena cifrado. Solo veremos los últimos 4 dígitos.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#7a31de] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(122,39,224,0.35)]"
            >
              Guardar cuenta bancaria
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-white/35">
          Tus datos bancarios están cifrados y protegidos. Solo son utilizados para procesar tus solicitudes de retiro aprobadas.
        </p>
      </div>
    </main>
  );
}
