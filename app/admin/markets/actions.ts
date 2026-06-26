"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createMarketSchema,
  updateMarketSchema,
} from "@/lib/markets/validation";

function slugifyMarketTitle(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return base || `mercado-${Date.now()}`;
}

function buildSlugCandidate(base: string, attempt: number) {
  if (attempt === 0) return base;

  const suffix = `-${attempt + 1}`;
  const maxBaseLength = Math.max(1, 80 - suffix.length);
  return `${base.slice(0, maxBaseLength)}${suffix}`;
}

function isSlugConflict(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "23505") return true;

  const message = String(error.message ?? "").toLowerCase();
  return message.includes("markets_slug_key") || message.includes("duplicate key value");
}

async function applySimpleResolutionSettlement(marketId: string, winningOptionId: string) {
  const admin = createAdminClient();

  const [{ data: market }, { data: winningOption }] = await Promise.all([
    admin.from("markets").select("title").eq("id", marketId).maybeSingle(),
    admin.from("market_options").select("label").eq("id", winningOptionId).maybeSingle(),
  ]);

  const marketTitle = market?.title ?? "Mercado";
  const winningOptionLabel = winningOption?.label ?? "Opcion ganadora";

  const { data: cancelledBuyOrders, error: ordersError } = await admin
    .from("limit_orders")
    .select("id, user_id, option_id, quantity, total_cost")
    .eq("market_id", marketId)
    .eq("side", "buy")
    .eq("status", "cancelled")
    .eq("quantity_filled", 0);

  if (ordersError) throw new Error(ordersError.message);
  if (!cancelledBuyOrders || cancelledBuyOrders.length === 0) return 0;

  const candidateUserIds = [...new Set(cancelledBuyOrders.map((order) => order.user_id))];

  const { data: existingSettlements, error: existingSettlementsError } = await admin
    .from("wallet_movements")
    .select("user_id")
    .eq("market_id", marketId)
    .eq("movement_type", "participation")
    .in("user_id", candidateUserIds)
    .filter("metadata->>reason", "eq", "market_resolution_simple_settlement");

  if (existingSettlementsError) throw new Error(existingSettlementsError.message);

  const alreadyProcessedUsers = new Set((existingSettlements ?? []).map((movement) => movement.user_id));

  const aggregatedByUser = new Map<string, { stake: number; payoutAmount: number }>();
  for (const order of cancelledBuyOrders) {
    if (alreadyProcessedUsers.has(order.user_id)) continue;

    const current = aggregatedByUser.get(order.user_id) ?? { stake: 0, payoutAmount: 0 };
    current.stake += Number(order.total_cost ?? 0);
    if (order.option_id === winningOptionId) {
      current.payoutAmount += Number(order.quantity ?? 0);
    }

    aggregatedByUser.set(order.user_id, current);
  }

  if (aggregatedByUser.size === 0) return 0;

  const userIds = Array.from(aggregatedByUser.keys());

  const { data: wallets, error: walletsError } = await admin
    .from("wallets")
    .select("id, user_id, balance_available")
    .in("user_id", userIds);

  if (walletsError) throw new Error(walletsError.message);

  const walletByUserId = new Map((wallets ?? []).map((wallet) => [wallet.user_id, wallet]));

  for (const userId of userIds) {
    const wallet = walletByUserId.get(userId);
    if (!wallet) {
      throw new Error(`Wallet no encontrada para usuario ${userId}`);
    }

    const summary = aggregatedByUser.get(userId);
    if (!summary) continue;

    const stake = Number(summary.stake || 0);
    const payoutAmount = Number(summary.payoutAmount || 0);
    const startingBalance = Number(wallet.balance_available ?? 0);
    const afterStakeBalance = startingBalance - stake;
    const finalBalance = afterStakeBalance + payoutAmount;

    if (finalBalance < -1e-6) {
      throw new Error(`El balance quedaria negativo para ${userId}`);
    }

    const { error: walletUpdateError } = await admin
      .from("wallets")
      .update({
        balance_available: finalBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);

    if (walletUpdateError) throw new Error(walletUpdateError.message);

    const { error: participationError } = await admin.from("wallet_movements").insert({
      user_id: userId,
      wallet_id: wallet.id,
      market_id: marketId,
      movement_type: "participation",
      amount: -stake,
      balance_after: afterStakeBalance,
      metadata: {
        reason: "market_resolution_simple_settlement",
        winning_option_id: winningOptionId,
        simple_mode: true,
      },
    });

    if (participationError) throw new Error(participationError.message);

    if (payoutAmount > 0) {
      const { error: payoutError } = await admin.from("wallet_movements").insert({
        user_id: userId,
        wallet_id: wallet.id,
        market_id: marketId,
        movement_type: "payout",
        amount: payoutAmount,
        balance_after: finalBalance,
        metadata: {
          reason: "market_resolution_payout",
          source: "simple_settlement",
          winning_option_id: winningOptionId,
          simple_mode: true,
        },
      });

      if (payoutError) throw new Error(payoutError.message);
    }

    const { data: userResolutionEvents, error: userResolutionEventsError } = await admin
      .from("notification_events")
      .select("id, payload")
      .eq("user_id", userId)
      .eq("event_type", "market_resolved")
      .filter("payload->>market_id", "eq", marketId);

    if (userResolutionEventsError) throw new Error(userResolutionEventsError.message);

    const nextResolutionStatus = payoutAmount > 0 ? "won" : "lost";

    if (!userResolutionEvents || userResolutionEvents.length === 0) {
      const { error: createEventError } = await admin.from("notification_events").insert({
        user_id: userId,
        event_type: "market_resolved",
        status: "pending",
        payload: {
          market_id: marketId,
          market_title: marketTitle,
          winning_option_id: winningOptionId,
          winning_option_label: winningOptionLabel,
          resolution_status: nextResolutionStatus,
          payout_amount: payoutAmount,
          simple_mode_settlement: true,
        },
      });

      if (createEventError) throw new Error(createEventError.message);
    } else {
      for (const event of userResolutionEvents) {
        const currentPayload =
          event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
            ? (event.payload as Record<string, unknown>)
            : {};

        const nextPayload = {
          ...currentPayload,
          market_id: marketId,
          market_title: marketTitle,
          winning_option_id: winningOptionId,
          winning_option_label: winningOptionLabel,
          resolution_status: nextResolutionStatus,
          payout_amount: payoutAmount,
          simple_mode_settlement: true,
        };

        const { error: updateEventError } = await admin
          .from("notification_events")
          .update({ payload: nextPayload })
          .eq("id", event.id);

        if (updateEventError) throw new Error(updateEventError.message);
      }
    }
  }

  return aggregatedByUser.size;
}

export async function createMarketAction(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const rawOptions: string[] = [];
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("option_") && typeof val === "string" && val.trim()) {
      rawOptions.push(val.trim());
    }
  }

  const parsed = createMarketSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    opens_at: formData.get("opens_at") || undefined,
    closes_at: formData.get("closes_at") || undefined,
    liquidity_b: formData.get("liquidity_b"),
    fee_bps: formData.get("fee_bps"),
    options: rawOptions,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(`/admin/markets/new?error=${encodeURIComponent(msg)}`);
  }

  const { options, ...marketFields } = parsed.data;

  const baseSlug = slugifyMarketTitle(marketFields.title);
  let market: { id: string } | null = null;
  let lastMarketError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = buildSlugCandidate(baseSlug, attempt);

    const { data: insertedMarket, error: marketError } = await supabase
      .from("markets")
      .insert({
        title: marketFields.title,
        description: marketFields.description ?? null,
        category: marketFields.category ?? null,
        opens_at: marketFields.opens_at ?? null,
        closes_at: marketFields.closes_at ?? null,
        liquidity_b: marketFields.liquidity_b,
        fee_bps: marketFields.fee_bps,
        slug,
        created_by: user.id,
        status: "draft",
      })
      .select("id")
      .single();

    if (!marketError && insertedMarket) {
      market = insertedMarket;
      lastMarketError = null;
      break;
    }

    lastMarketError = marketError;

    if (!isSlugConflict(marketError)) {
      break;
    }
  }

  if (!market) {
    const fallbackMessage = isSlugConflict(lastMarketError)
      ? "No se pudo generar un slug unico para el mercado. Intenta con un titulo mas especifico."
      : "Error al crear mercado";

    redirect(
      `/admin/markets/new?error=${encodeURIComponent(lastMarketError?.message ?? fallbackMessage)}`
    );
  }

  const optionRows = options.map((label, i) => ({
    market_id: market.id,
    label,
    sort_order: i,
  }));

  const { error: optionsError } = await supabase
    .from("market_options")
    .insert(optionRows);

  if (optionsError) {
    await supabase.from("markets").delete().eq("id", market.id);
    redirect(
      `/admin/markets/new?error=${encodeURIComponent(optionsError.message)}`
    );
  }

  revalidatePath("/admin/markets");
  redirect(`/admin/markets/${market.id}`);
}

export async function updateMarketAction(marketId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = updateMarketSchema.safeParse({
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    opens_at: formData.get("opens_at") || undefined,
    closes_at: formData.get("closes_at") || undefined,
    liquidity_b: formData.get("liquidity_b") || undefined,
    fee_bps: formData.get("fee_bps") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(
      `/admin/markets/${marketId}/edit?error=${encodeURIComponent(msg)}`
    );
  }

  const { error } = await supabase
    .from("markets")
    .update(parsed.data)
    .eq("id", marketId);

  if (error) {
    redirect(
      `/admin/markets/${marketId}/edit?error=${encodeURIComponent(error.message)}`
    );
  }

  if (parsed.data.status === "closed") {
    await tryDispatchPendingNotifications(25);
  }

  revalidatePath("/admin/markets");
  revalidatePath(`/admin/markets/${marketId}`);
  redirect(`/admin/markets/${marketId}`);
}

export async function changeMarketStatusAction(
  marketId: string,
  status: "open" | "closed" | "archived"
) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("markets")
    .update({ status })
    .eq("id", marketId);

  if (error) throw new Error(error.message);

  if (status === "closed") {
    await tryDispatchPendingNotifications(25);
  }

  revalidatePath("/admin/markets");
  revalidatePath(`/admin/markets/${marketId}`);
}

export async function resolveMarketAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const marketId = typeof formData.get("market_id") === "string" ? String(formData.get("market_id")) : "";
  const winningOptionId =
    typeof formData.get("winning_option_id") === "string"
      ? String(formData.get("winning_option_id"))
      : "";
  const resolutionNote =
    typeof formData.get("resolution_note") === "string"
      ? String(formData.get("resolution_note")).trim() || undefined
      : undefined;

  const uuid = z.uuid();
  const marketIdValid = uuid.safeParse(marketId).success;
  const winningOptionIdValid = uuid.safeParse(winningOptionId).success;

  if (!marketIdValid || !winningOptionIdValid) {
    redirect(`/admin/markets/${marketId || ""}?error=${encodeURIComponent("Parametros invalidos para resolucion")}`);
  }

  const { error } = await supabase.rpc("resolve_market", {
    p_market_id: marketId,
    p_winning_option_id: winningOptionId,
    p_resolution_note: resolutionNote,
  });

  if (error) {
    redirect(`/admin/markets/${marketId}?error=${encodeURIComponent(error.message || "No se pudo resolver el mercado")}`);
  }

  try {
    await applySimpleResolutionSettlement(marketId, winningOptionId);
  } catch (settlementError) {
    const settlementMessage =
      settlementError instanceof Error ? settlementError.message : "Error desconocido";

    redirect(
      `/admin/markets/${marketId}?error=${encodeURIComponent(`Mercado resuelto, pero fallo la liquidacion simplificada: ${settlementMessage}`)}`,
    );
  }

  await tryDispatchPendingNotifications(50);

  revalidatePath("/admin/markets");
  revalidatePath(`/admin/markets/${marketId}`);
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/markets");
  redirect(`/admin/markets/${marketId}?success=${encodeURIComponent("Mercado resuelto y liquidado")}`);
}
