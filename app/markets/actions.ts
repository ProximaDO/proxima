"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/server";
import { DAILY_MARKET_CLOSE_MINUTES, getRdNowParts } from "@/lib/fx/daily-market";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";

const placeOrderSchema = z.object({
  marketId: z.uuid(),
  optionId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  requestId: z.uuid(),
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

async function ensureMarketCanReceivePredictions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marketId: string,
  category: string,
) {
  const { data: marketData } = await supabase
    .from("markets")
    .select("status, is_daily_fx, slug")
    .eq("id", marketId)
    .maybeSingle();

  if (!marketData) {
    redirect(buildErrorUrl(marketId, category, "Mercado no encontrado"));
  }

  if (marketData.status !== "open") {
    redirect(buildErrorUrl(marketId, category, "Este mercado esta cerrado para predicciones"));
  }

  if (marketData.is_daily_fx) {
    const rdNow = getRdNowParts();
    if (rdNow.minutesOfDay >= DAILY_MARKET_CLOSE_MINUTES) {
      redirect(buildErrorUrl(marketId, category, "El mercado diario de USD/Venta cerro a las 4:30 PM (hora RD)"));
    }
  }
}

export async function placeBuyOrderAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();
  const category = normalizeCategory(formData.get("category"));

  const parsed = placeOrderSchema.safeParse({
    marketId: formData.get("market_id"),
    optionId: formData.get("option_id"),
    quantity: formData.get("quantity"),
    requestId: formData.get("request_id"),
  });

  if (!parsed.success) {
    const marketId = typeof formData.get("market_id") === "string" ? String(formData.get("market_id")) : "markets";
    redirect(buildErrorUrl(marketId, category, "Datos de prediccion invalidos"));
  }

  const { marketId, optionId, quantity, requestId } = parsed.data;

  await ensureMarketCanReceivePredictions(supabase, marketId, category);

  const { error: rpcError } = await supabase.rpc("execute_lmsr_buy", {
    p_market_id: marketId,
    p_option_id: optionId,
    p_quantity: quantity,
    p_request_id: requestId,
  });

  if (rpcError) {
    redirect(buildErrorUrl(marketId, category, rpcError.message || "No se pudo registrar la prediccion"));
  }

  await tryDispatchPendingNotifications(10);

  redirect(buildSuccessUrl(marketId, category, "Prediccion registrada"));
}
