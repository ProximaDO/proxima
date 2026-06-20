"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  request_id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  admin_note: z.string().trim().max(500).optional(),
  rejection_reason: z.string().trim().max(500).optional(),
});

const processSchema = z.object({
  batch_size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function reviewWithdrawalAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = reviewSchema.safeParse({
    request_id: formData.get("request_id"),
    decision: formData.get("decision"),
    admin_note: formData.get("admin_note") || undefined,
    rejection_reason: formData.get("rejection_reason") || undefined,
  });

  if (!parsed.success) {
    redirect("/admin/withdrawals?error=Parametros+invalidos+de+revision");
  }

  const { error } = await supabase.rpc("review_withdrawal_request", {
    p_request_id: parsed.data.request_id,
    p_decision: parsed.data.decision,
    p_admin_note: parsed.data.admin_note,
    p_rejection_reason: parsed.data.rejection_reason,
  });

  if (error) {
    redirect(`/admin/withdrawals?error=${encodeURIComponent(error.message || "No+se+pudo+procesar+retiro")}`);
  }

  if (parsed.data.decision === "approved") {
    await supabase.rpc("process_withdrawal_queue", { p_limit: 10 });
  }

  await tryDispatchPendingNotifications(25);

  const message = parsed.data.decision === "approved" ? "Retiro enviado a processing" : "Retiro rechazado";
  redirect(`/admin/withdrawals?success=${encodeURIComponent(message)}`);
}

export async function processWithdrawalsAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = processSchema.safeParse({
    batch_size: formData.get("batch_size") ?? 20,
  });

  if (!parsed.success) {
    redirect("/admin/withdrawals?error=Parametros+invalidos+de+procesamiento");
  }

  const { data, error } = await supabase.rpc("process_withdrawal_queue", {
    p_limit: parsed.data.batch_size,
  });

  if (error) {
    redirect(`/admin/withdrawals?error=${encodeURIComponent(error.message || "No+se+pudo+procesar+lote")}`);
  }

  await tryDispatchPendingNotifications(50);

  const processed = typeof data === "number" ? data : 0;
  redirect(`/admin/withdrawals?success=${encodeURIComponent(`Lote procesado: ${processed} retiros`)}`);
}

const withdrawalRulesSchema = z.object({
  min_amount: z.coerce.number().positive(),
  max_amount: z.coerce.number().positive(),
  max_per_day: z.coerce.number().positive(),
  max_per_month: z.coerce.number().positive(),
  cooldown_days: z.coerce.number().int().min(0),
  min_processing_days: z.coerce.number().int().min(0).max(30),
});

export async function updateWithdrawalRulesAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = withdrawalRulesSchema.safeParse({
    min_amount: formData.get("min_amount"),
    max_amount: formData.get("max_amount"),
    max_per_day: formData.get("max_per_day"),
    max_per_month: formData.get("max_per_month"),
    cooldown_days: formData.get("cooldown_days"),
    min_processing_days: formData.get("min_processing_days"),
  });

  if (!parsed.success) {
    redirect("/admin/withdrawals/settings?error=Parametros+invalidos");
  }

  // Actualizar la primera fila (o insertar si no existe)
  const { data: existing } = await supabase
    .from("withdrawal_rules")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("withdrawal_rules")
      .update(parsed.data)
      .eq("id", existing.id);

    if (error) {
      redirect(`/admin/withdrawals/settings?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { error } = await supabase.from("withdrawal_rules").insert(parsed.data);
    if (error) {
      redirect(`/admin/withdrawals/settings?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect("/admin/withdrawals/settings?success=Configuracion+guardada+exitosamente");
}
