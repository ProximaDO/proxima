import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { z } from "zod";

const bodySchema = z.object({
  amount_dop: z.number().int().min(100).max(500000),
});

function getAppUrl(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (forwarded) return `${proto}://${forwarded}`;
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit;
  return `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Monto inválido (mín RD$100, máx RD$500,000)" }, { status: 422 });
  }

  const stripe = getStripe();
  const appUrl = getAppUrl(req);

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "dop",
      line_items: [
        {
          price_data: {
            currency: "dop",
            unit_amount: parsed.data.amount_dop,
            product_data: {
              name: "Depósito Proxima",
              description: "Recarga de saldo en plataforma Proxima",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: session.user.id,
        amount_dop: String(parsed.data.amount_dop),
      },
      success_url: `${appUrl}/dashboard?success=${encodeURIComponent("Depósito procesado correctamente")}`,
      cancel_url: `${appUrl}/dashboard/depositar?error=${encodeURIComponent("Depósito cancelado")}`,
    });

    // Registrar sesión pendiente para auditoría
    await supabase
      .from("stripe_deposits")
      .insert({
        user_id: session.user.id,
        stripe_checkout_session_id: checkoutSession.id,
        amount_dop: parsed.data.amount_dop / 100,
        status: "pending",
      })
      .throwOnError();

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear sesión de pago";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
