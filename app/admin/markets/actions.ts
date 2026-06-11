"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";
import {
  createMarketSchema,
  updateMarketSchema,
} from "@/lib/markets/validation";

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

  const slug = marketFields.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const { data: market, error: marketError } = await supabase
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

  if (marketError || !market) {
    redirect(
      `/admin/markets/new?error=${encodeURIComponent(marketError?.message ?? "Error al crear mercado")}`
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

  await tryDispatchPendingNotifications(50);

  revalidatePath("/admin/markets");
  revalidatePath(`/admin/markets/${marketId}`);
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/markets");
  redirect(`/admin/markets/${marketId}?success=${encodeURIComponent("Mercado resuelto y liquidado")}`);
}
