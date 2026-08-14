import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await req.arrayBuffer();

  try {
    event = getStripe().webhooks.constructEvent(Buffer.from(rawBody), signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const checkoutSession = event.data.object as Stripe.Checkout.Session;

  if (checkoutSession.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const userIdResult = z.uuid().safeParse(checkoutSession.metadata?.user_id);
  const amountDopCents = Number(checkoutSession.metadata?.amount_dop ?? 0);

  if (
    !userIdResult.success ||
    !Number.isSafeInteger(amountDopCents) ||
    amountDopCents <= 0 ||
    checkoutSession.currency?.toLowerCase() !== "dop" ||
    checkoutSession.amount_total !== amountDopCents
  ) {
    return NextResponse.json({ error: "Invalid payment data" }, { status: 400 });
  }

  const userId = userIdResult.data;

  try {
    const supabase = createAdminClient();
    const amountDop = amountDopCents / 100;
    const { error: rpcError } = await supabase.rpc("complete_stripe_deposit", {
      p_checkout_session_id: checkoutSession.id,
      p_user_id: userId,
      p_amount_dop: amountDop,
    });

    if (rpcError) {
      console.error("[stripe/webhook] complete_stripe_deposit failed", {
        error: rpcError,
        sessionId: checkoutSession.id,
        userId,
        amountDop,
      });
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    console.error("[stripe/webhook] unhandled error", {
      message,
      sessionId: checkoutSession.id,
      userId,
      amountDopCents,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
