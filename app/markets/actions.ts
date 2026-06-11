"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/server";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";

const placeOrderSchema = z.object({
  marketId: z.uuid(),
  optionId: z.uuid(),
  limitPrice: z.coerce.number().gt(0).lte(1),
  quantity: z.coerce.number().gt(0),
});

function normalizeCategory(rawCategory: FormDataEntryValue | null) {
  if (typeof rawCategory !== "string") return "all";
  return ["all", "politica", "economia", "social", "deportes"].includes(rawCategory)
    ? rawCategory
    : "all";
}

function buildErrorUrl(marketId: string, category: string, message: string) {
  return `/?category=${category}&market=${marketId}&error=${encodeURIComponent(message)}#activos`;
}

function buildSuccessUrl(marketId: string, category: string, message: string) {
  return `/?category=${category}&market=${marketId}&success=${encodeURIComponent(message)}#activos`;
}

function buildDashboardErrorUrl(message: string) {
  return `/dashboard?error=${encodeURIComponent(message)}`;
}

function buildDashboardSuccessUrl(message: string) {
  return `/dashboard?success=${encodeURIComponent(message)}`;
}

export async function placeBuyOrderAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();
  const category = normalizeCategory(formData.get("category"));

  const parsed = placeOrderSchema.safeParse({
    marketId: formData.get("market_id"),
    optionId: formData.get("option_id"),
    limitPrice: formData.get("limit_price"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    const marketId = typeof formData.get("market_id") === "string" ? String(formData.get("market_id")) : "markets";
    redirect(buildErrorUrl(marketId, category, "Datos de orden invalidos"));
  }

  const { marketId, optionId, limitPrice, quantity } = parsed.data;

  const { error: rpcError } = await supabase.rpc("place_buy_limit_order", {
    p_market_id: marketId,
    p_option_id: optionId,
    p_limit_price: limitPrice,
    p_quantity: quantity,
  });

  if (rpcError) {
    redirect(buildErrorUrl(marketId, category, rpcError.message || "No se pudo crear la orden"));
  }

  await tryDispatchPendingNotifications(10);

  redirect(buildSuccessUrl(marketId, category, "Orden enviada al libro"));
}

export async function placeSellOrderAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();
  const category = normalizeCategory(formData.get("category"));

  const parsed = placeOrderSchema.safeParse({
    marketId: formData.get("market_id"),
    optionId: formData.get("option_id"),
    limitPrice: formData.get("limit_price"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    const marketId = typeof formData.get("market_id") === "string" ? String(formData.get("market_id")) : "markets";
    redirect(buildErrorUrl(marketId, category, "Datos de orden invalidos"));
  }

  const { marketId, optionId, limitPrice, quantity } = parsed.data;

  const { error: rpcError } = await supabase.rpc("place_sell_limit_order", {
    p_market_id: marketId,
    p_option_id: optionId,
    p_limit_price: limitPrice,
    p_quantity: quantity,
  });

  if (rpcError) {
    redirect(buildErrorUrl(marketId, category, rpcError.message || "No se pudo crear la orden"));
  }

  await tryDispatchPendingNotifications(10);

  redirect(buildSuccessUrl(marketId, category, "Orden de venta enviada al libro"));
}

export async function cancelOrderAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const rawOrderId = formData.get("order_id");
  const parsed = z.uuid().safeParse(rawOrderId);

  if (!parsed.success) {
    redirect(buildDashboardErrorUrl("Orden invalida"));
  }

  const orderId = parsed.data;

  const { error: rpcError } = await supabase.rpc("cancel_user_order", {
    p_order_id: orderId,
  });

  if (rpcError) {
    redirect(buildDashboardErrorUrl(rpcError.message || "No se pudo cancelar la orden"));
  }

  await tryDispatchPendingNotifications(10);

  redirect(buildDashboardSuccessUrl("Orden cancelada"));
}
