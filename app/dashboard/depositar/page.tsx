import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function DepositarPage({ searchParams }: Props) {
  const session = await requireAuth();
  void session;

  const { error: errorRaw } = await searchParams;
  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;

  return (
    <main className="relative min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-14 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          ← Volver al panel
        </Link>

        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          Depositar fondos
        </h1>
        <p className="mt-2 text-sm text-white/60">
          El pago se procesa de forma segura con Stripe. El saldo se acredita inmediatamente en tu cuenta Proxima.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <form
          id="deposit-form"
          className="mt-8 space-y-5"
          onSubmit={undefined}
          action="/dashboard/depositar"
          method="post"
        >
          <div>
            <label
              htmlFor="amount"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55"
            >
              Monto a depositar (RD$)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="100"
              max="500000"
              step="1"
              required
              placeholder="Ej: 5000"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#8d45e6]"
            />
            <p className="mt-1.5 text-xs text-white/40">Mínimo RD$100 · Máximo RD$500,000 por transacción</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65 space-y-1">
            <p className="font-semibold text-white/80">¿Cómo funciona?</p>
            <p>1. Ingresa el monto y haz clic en &quot;Ir al pago&quot;.</p>
            <p>2. Completa el pago con tu tarjeta en la página segura de Stripe.</p>
            <p>3. Tu saldo se actualiza automáticamente al confirmar el pago.</p>
          </div>

          <DepositButton />
        </form>
      </div>
    </main>
  );
}

// Client component separado para el submit que llama a la API
async function DepositButton() {
  // Este formulario se maneja con el server action (POST /dashboard/depositar)
  return (
    <button
      type="submit"
      formAction={depositFormAction}
      className="w-full rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#7a31de] px-5 py-3.5 text-base font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(122,39,224,0.35)] transition hover:scale-[1.01]"
    >
      Ir al pago con Stripe →
    </button>
  );
}

async function depositFormAction(formData: FormData) {
  "use server";
  const session = await requireAuth();
  const rawAmount = formData.get("amount");
  const amountDop = Number(rawAmount);

  if (!amountDop || amountDop < 100 || amountDop > 500000) {
    redirect("/dashboard/depositar?error=Monto+inválido+(mín+RD%24100%2C+máx+RD%24500%2C000)");
  }

  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${proto}://${host}`;

  const { getStripe } = await import("@/lib/stripe/server");
  const stripe = getStripe();

  let checkoutUrl: string;
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "dop",
      line_items: [
        {
          price_data: {
            currency: "dop",
            unit_amount: amountDop * 100,
            product_data: {
              name: "Depósito Proxima",
              description: "Recarga de saldo en plataforma Proxima",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: session.id,
        amount_dop: String(amountDop * 100),
      },
      success_url: `${appUrl}/dashboard?success=${encodeURIComponent("Depósito procesado correctamente")}`,
      cancel_url: `${appUrl}/dashboard/depositar?error=${encodeURIComponent("Depósito cancelado")}`,
    });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase.from("stripe_deposits").insert({
      user_id: session.id,
      stripe_checkout_session_id: checkoutSession.id,
      amount_dop: amountDop,
      status: "pending",
    });

    checkoutUrl = checkoutSession.url!;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear sesión de pago";
    redirect(`/dashboard/depositar?error=${encodeURIComponent(message)}`);
  }

  redirect(checkoutUrl);
}
