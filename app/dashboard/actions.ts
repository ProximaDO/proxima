"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const topupSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
});

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
  destination: z.string().trim().max(280).optional(),
});

function dashboardRedirectTarget(formData: FormData) {
  const raw = formData.get("redirect_to");
  if (typeof raw !== "string") return "/dashboard";

  // Guardrail: only allow internal dashboard redirects.
  if (!raw.startsWith("/dashboard")) return "/dashboard";
  return raw;
}

export async function topUpWalletAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const parsed = topupSchema.safeParse({
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    redirect("/dashboard?error=Monto+invalido+para+recarga");
  }

  const { error } = await supabase.rpc("credit_user_wallet", {
    p_amount: parsed.data.amount,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message || "No+se+pudo+recargar")}`);
  }

  redirect("/dashboard?success=Wallet+recargada");
}

export async function requestWithdrawalAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const parsed = withdrawalSchema.safeParse({
    amount: formData.get("amount"),
    destination: formData.get("destination") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard?error=Parametros+invalidos+para+retiro");
  }

  const destination = parsed.data.destination
    ? {
        channel: "manual_transfer",
        detail: parsed.data.destination,
      }
    : null;

  const { error } = await supabase.rpc("request_withdrawal", {
    p_amount: parsed.data.amount,
    p_destination: destination,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message || "No+se+pudo+solicitar+retiro")}`);
  }

  redirect("/dashboard?success=Solicitud+de+retiro+registrada");
}

export async function markNotificationReadAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();
  const redirectTo = dashboardRedirectTarget(formData);

  const rawId = formData.get("notification_id");
  const parsed = z.uuid().safeParse(rawId);

  if (!parsed.success) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=Notificacion+invalida`);
  }

  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: parsed.data,
    p_read: true,
  });

  if (error) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message || "No+se+pudo+actualizar")}`);
  }

  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}success=Notificacion+marcada+como+leida`);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();
  const redirectTo = dashboardRedirectTarget(formData);

  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message || "No+se+pudo+actualizar")}`);
  }

  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}success=Notificaciones+marcadas+como+leidas`);
}
